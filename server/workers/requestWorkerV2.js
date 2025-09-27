const { OpenAI } = require('openai');
const { pool } = require('../db/connection');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const { sendSlackNotification } = require('../utils/slack');

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'sk-dummy-key-for-development'
});

// Updated request types for Stage 2.1
const REQUEST_TYPES = {
    PAYMENT: '요금·정산/세금',
    CONTRACT: '계약/서명/증빙',
    INSTALLATION: '설치·교육·일정 조율',
    TEMPLATE: '템플릿 등록/수정/검수',
    POLICY: '정책·심사 가이드',
    CONTENT: '콘텐츠 제작 지원',
    TECH: '기능/기술 지원',
    OPERATION: '병원 운영정보 반영',
    OTHER: '기타/자유형',
    NON_REQUEST: '비요청'
};

// Group routing rules
const GROUP_ROUTING = {
    '요금·정산/세금': 'ops',
    '계약/서명/증빙': 'cs',
    '설치·교육·일정 조율': 'cs',
    '템플릿 등록/수정/검수': 'content',
    '정책·심사 가이드': 'content',
    '콘텐츠 제작 지원': 'content',
    '기능/기술 지원': 'tech',
    '병원 운영정보 반영': 'content',
    '기타/자유형': 'cs',
    '비요청': null
};

// Keyword patterns for rule-based classification
const KEYWORD_PATTERNS = {
    '요금·정산/세금': /요금|정산|세금|계산서|결제|청구|입금|환불|비용|가격/i,
    '계약/서명/증빙': /계약|서명|증명|서류|문서|날인|직인|사업자|등록증/i,
    '설치·교육·일정 조율': /설치|교육|일정|방문|미팅|회의|세팅|셋팅/i,
    '템플릿 등록/수정/검수': /템플릿|템플렛|문구|메시지|알림톡|친구톡|검수/i,
    '정책·심사 가이드': /정책|심사|가이드|광고|규정|위반|반려|승인/i,
    '콘텐츠 제작 지원': /촬영|편집|디자인|콘텐츠|영상|이미지|대본/i,
    '기능/기술 지원': /오류|에러|버그|장애|안됨|안돼|고장|문제|이슈/i,
    '병원 운영정보 반영': /진료시간|휴진|휴무|주차|위치|주소|연락처|전화/i
};

// Policy flag patterns
const POLICY_FLAGS = {
    'ad-risk': /광고|홍보|마케팅|프로모션|이벤트|할인/i,
    'medical-claim': /치료|완치|개선|효과|효능|시술/i,
    'price-mention': /원|가격|비용|요금|무료/i,
    'review-required': /심사|검토|확인.*필요|검수/i,
    'brand-usage': /카카오|네이버|구글|페이스북|인스타/i
};

// Enhanced classification prompt
const CLASSIFICATION_PROMPT = `
당신은 병원 CS 메시지를 분류하는 전문가입니다.
다음 메시지를 분석하여 JSON 형식으로 응답해주세요.

메시지: {message}
발신자: {sender}
채팅방: {roomName}
시간: {timestamp}

분류 기준:
1. 요청 유형:
   - 요금·정산/세금: 이용요금, 세금계산서, 결제/정산 관련
   - 계약/서명/증빙: 계약서, 증명서류, 관리자 초대
   - 설치·교육·일정 조율: 설치, 교육, 일정 변경·확인
   - 템플릿 등록/수정/검수: 신규 등록, 문구 수정, 검수 요청
   - 정책·심사 가이드: 카카오 심사, 광고 정책 적합성
   - 콘텐츠 제작 지원: 촬영, 편집, 대본, 검수
   - 기능/기술 지원: 시스템 오류, 세팅, 예약/캘린더
   - 병원 운영정보 반영: 진료시간, 휴진, 주차, 위치, 연락처
   - 기타/자유형: 위 카테고리에 속하지 않는 요청
   - 비요청: 감사/인사, 단순 안내, 시스템 메시지

2. 긴급도:
   - high: 서비스 장애, 결제 오류, 당일 일정, 즉시 대응 필요
   - normal: 일반적인 업무 요청
   - low: 단순 확인, 비핵심 정보 수정

응답 형식:
{
    "is_request": boolean,
    "request_type": string,
    "request_subtype": string (세부 분류),
    "urgency": string (high/normal/low),
    "assignee_group": string (ops/cs/content/tech),
    "policy_flag": string (해당시 ad-risk/medical-claim 등),
    "summary": string (한 줄 요약),
    "confidence": number (0.0~1.0),
    "artifacts": array (첨부파일, 링크 등이 있으면)
}
`;

class RequestWorkerV2 {
    constructor(io) {
        this.io = io;
        this.isProcessing = false;
        this.processInterval = 5000; // Process every 5 seconds
        this.dedupeWindow = 600000; // 10 minutes for deduplication
    }

    async start() {
        logger.info('Request Worker V2 started');

        // Initial processing
        await this.processNewMessages();

        // Set up interval processing
        setInterval(async () => {
            if (!this.isProcessing) {
                await this.processNewMessages();
            }
        }, this.processInterval);
    }

    async processNewMessages() {
        this.isProcessing = true;

        try {
            const unprocessedMessages = await this.getUnprocessedMessages();

            if (unprocessedMessages.length === 0) {
                this.isProcessing = false;
                return;
            }

            logger.info(`Processing ${unprocessedMessages.length} new messages`);

            for (const message of unprocessedMessages) {
                try {
                    // Check for duplicate within deduplication window
                    const isDuplicate = await this.checkDuplicate(message);
                    if (isDuplicate) {
                        logger.info(`Skipping duplicate message ${message.id}`);
                        continue;
                    }

                    // Check if sender is internal member
                    const isInternal = await this.isInternalMember(message.sender);

                    if (isInternal) {
                        await this.saveRequestItem(message, {
                            is_request: false,
                            request_type: REQUEST_TYPES.NON_REQUEST,
                            confidence: 1.0,
                            notes: 'Internal member message'
                        });
                        continue;
                    }

                    // Rule-based pre-classification
                    const ruleBasedClass = this.classifyByRules(message.body);

                    // GPT classification with rule hints
                    const classification = await this.classifyMessage(message, ruleBasedClass);

                    // Calculate SLA
                    const slaTime = await this.calculateSLA(classification.urgency, new Date());

                    // Save to database
                    const requestItem = await this.saveRequestItem(message, {
                        ...classification,
                        sla_due_at: slaTime
                    });

                    // Emit WebSocket event
                    this.io.emit('request.created', requestItem);

                    // Send notifications based on urgency and time
                    await this.handleNotifications(message, classification);

                } catch (error) {
                    logger.error('Error processing message', {
                        messageId: message.id,
                        error: error.message
                    });
                }
            }

        } catch (error) {
            logger.error('Error in processNewMessages', error);
        } finally {
            this.isProcessing = false;
        }
    }

    classifyByRules(messageBody) {
        const detected = {
            types: [],
            policyFlags: []
        };

        // Check keyword patterns
        for (const [type, pattern] of Object.entries(KEYWORD_PATTERNS)) {
            if (pattern.test(messageBody)) {
                detected.types.push(type);
            }
        }

        // Check policy flags
        for (const [flag, pattern] of Object.entries(POLICY_FLAGS)) {
            if (pattern.test(messageBody)) {
                detected.policyFlags.push(flag);
            }
        }

        return detected;
    }

    async classifyMessage(message, ruleHints) {
        try {
            const timestamp = new Date(message.timestamp).toLocaleString('ko-KR');
            const prompt = CLASSIFICATION_PROMPT
                .replace('{message}', message.body)
                .replace('{sender}', message.sender)
                .replace('{roomName}', message.room_name)
                .replace('{timestamp}', timestamp);

            // Add rule hints to prompt
            const hintsPrompt = ruleHints.types.length > 0
                ? `\n키워드 분석 힌트: ${ruleHints.types.join(', ')}`
                : '';

            const completion = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a CS message classifier for hospital customers. Be precise and consistent.'
                    },
                    {
                        role: 'user',
                        content: prompt + hintsPrompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 300
            });

            const responseText = completion.choices[0].message.content;

            try {
                const classification = JSON.parse(responseText);

                // Merge with rule-based policy flags
                if (ruleHints.policyFlags.length > 0 && !classification.policy_flag) {
                    classification.policy_flag = ruleHints.policyFlags[0];
                }

                // Set assignee group based on request type
                classification.assignee_group = GROUP_ROUTING[classification.request_type] || 'cs';

                return {
                    is_request: classification.is_request || false,
                    request_type: classification.request_type || REQUEST_TYPES.OTHER,
                    request_subtype: classification.request_subtype || null,
                    urgency: classification.urgency || 'normal',
                    assignee_group: classification.assignee_group,
                    policy_flag: classification.policy_flag || null,
                    confidence: classification.confidence || 0.5,
                    summary: classification.summary || '',
                    artifacts: classification.artifacts || null
                };
            } catch (parseError) {
                logger.error('Failed to parse GPT response', { response: responseText });
                return this.getFallbackClassification(ruleHints);
            }

        } catch (error) {
            logger.error('GPT API error', error);
            return this.getFallbackClassification(ruleHints);
        }
    }

    getFallbackClassification(ruleHints) {
        // Use rule-based classification as fallback
        const requestType = ruleHints.types.length > 0
            ? ruleHints.types[0]
            : REQUEST_TYPES.OTHER;

        return {
            is_request: ruleHints.types.length > 0,
            request_type: requestType,
            request_subtype: null,
            urgency: 'normal',
            assignee_group: GROUP_ROUTING[requestType] || 'cs',
            policy_flag: ruleHints.policyFlags[0] || null,
            confidence: 0.3,
            summary: 'Rule-based classification',
            artifacts: null
        };
    }

    async calculateSLA(urgency, createdTime) {
        // Use PostgreSQL function for SLA calculation
        const query = `SELECT calculate_sla_due_time($1, $2) as sla_time`;
        const result = await pool.query(query, [urgency, createdTime]);
        return result.rows[0].sla_time;
    }

    async checkDuplicate(message) {
        const query = `
            SELECT COUNT(*) as count
            FROM request_items ri
            JOIN chat_messages cm ON ri.message_id = cm.id
            WHERE cm.room_id = $1
                AND cm.sender = $2
                AND cm.timestamp > $3
                AND similarity(cm.body, $4) > 0.8
        `;

        const tenMinutesAgo = message.timestamp - this.dedupeWindow;
        const result = await pool.query(query, [
            message.room_id,
            message.sender,
            tenMinutesAgo,
            message.body
        ]);

        return result.rows[0].count > 0;
    }

    async getUnprocessedMessages() {
        const query = `
            SELECT
                cm.id,
                cm.room_id,
                cm.sender,
                cm.body,
                cm.timestamp,
                cr.room_name
            FROM chat_messages cm
            LEFT JOIN chat_rooms cr ON cm.room_id = cr.id
            LEFT JOIN request_items ri ON cm.id = ri.message_id
            WHERE ri.id IS NULL
                AND cm.timestamp > EXTRACT(EPOCH FROM (NOW() - INTERVAL '7 days')) * 1000
            ORDER BY cm.timestamp ASC
            LIMIT 100
        `;

        const result = await pool.query(query);
        return result.rows;
    }

    async isInternalMember(sender) {
        const query = `
            SELECT COUNT(*) as count
            FROM internal_members
            WHERE LOWER(name) = LOWER($1) AND is_active = true
        `;

        const result = await pool.query(query, [sender]);
        return result.rows[0].count > 0;
    }

    async saveRequestItem(message, classification) {
        const query = `
            INSERT INTO request_items (
                id, message_id, room_id, is_request,
                request_type, request_subtype, urgency,
                confidence, status, notes, policy_flag,
                assignee_group, sla_due_at, artifacts,
                source_channel
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING *
        `;

        const values = [
            uuidv4(),
            message.id,
            message.room_id,
            classification.is_request,
            classification.request_type,
            classification.request_subtype,
            classification.urgency,
            classification.confidence,
            '미처리',
            classification.summary || classification.notes || null,
            classification.policy_flag,
            classification.assignee_group,
            classification.sla_due_at || null,
            classification.artifacts ? JSON.stringify(classification.artifacts) : null,
            'kakao'
        ];

        const result = await pool.query(query, values);
        return result.rows[0];
    }

    async handleNotifications(message, classification) {
        const now = new Date();
        const hour = now.getHours();
        const dayOfWeek = now.getDay();

        // Check if it's outside working hours
        const isOutsideHours = hour < 9 || hour >= 18;
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        // Send urgent notifications immediately
        if (classification.urgency === 'high') {
            await this.sendUrgentNotification(message, classification);
        }

        // Send summary for weekend/night requests
        if ((isWeekend || isOutsideHours) && classification.is_request) {
            // This will be handled by the scheduler
            logger.info('Request received outside working hours', {
                messageId: message.id,
                urgency: classification.urgency
            });
        }
    }

    async sendUrgentNotification(message, classification) {
        const notificationText = `
🚨 *긴급 CS 요청*
채팅방: ${message.room_name}
발신자: ${message.sender}
유형: ${classification.request_type}
${classification.request_subtype ? `세부: ${classification.request_subtype}` : ''}
${classification.policy_flag ? `⚠️ 정책: ${classification.policy_flag}` : ''}
담당 그룹: ${classification.assignee_group}
내용: ${message.body.substring(0, 200)}
`;

        await sendSlackNotification(notificationText);
        logger.info('Urgent notification sent', { messageId: message.id });
    }
}

let workerInstance = null;

function startRequestWorker(io) {
    if (!workerInstance) {
        workerInstance = new RequestWorkerV2(io);
        workerInstance.start();
    }
    return workerInstance;
}

module.exports = { startRequestWorker };