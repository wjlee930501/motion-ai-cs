const { OpenAI } = require('openai');
const { pool } = require('../db/connection');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const { sendSlackNotification } = require('../utils/slack');

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'sk-dummy-key-for-development'
});

// Request types enum
const REQUEST_TYPES = {
    CONTRACT: '계약/결제',
    ACCOUNT: '계정/기능문의',
    ERROR: '오류신고',
    CONTENT: '콘텐츠요청',
    SCHEDULE: '일정/세팅변경',
    COMPLAINT: '불만/컴플레인',
    OTHER: '기타'
};

// Classification prompt template
const CLASSIFICATION_PROMPT = `
당신은 병원 고객 지원 메시지를 분류하는 AI입니다.
다음 메시지를 분석하여 JSON 형식으로 응답해주세요.

메시지: {message}
발신자: {sender}
채팅방: {roomName}

다음 형식으로 응답:
{
    "is_request": boolean (고객의 요청사항인지 여부),
    "request_type": string (계약/결제, 계정/기능문의, 오류신고, 콘텐츠요청, 일정/세팅변경, 불만/컴플레인, 기타 중 하나),
    "urgency": string (low, normal, high 중 하나 - 장애나 긴급 상황은 high),
    "confidence": number (0.0~1.0 사이의 확신도),
    "summary": string (간단한 요약)
}

일반 대화나 인사말은 is_request: false로 분류하세요.
`;

class RequestWorker {
    constructor(io) {
        this.io = io;
        this.isProcessing = false;
        this.processInterval = 5000; // Process every 5 seconds
    }

    async start() {
        logger.info('Request worker started');

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
            // Get unprocessed messages
            const unprocessedMessages = await this.getUnprocessedMessages();

            if (unprocessedMessages.length === 0) {
                this.isProcessing = false;
                return;
            }

            logger.info(`Processing ${unprocessedMessages.length} new messages`);

            for (const message of unprocessedMessages) {
                try {
                    // Check if sender is internal member
                    const isInternal = await this.isInternalMember(message.sender);

                    if (isInternal) {
                        // Mark as processed but not a request
                        await this.saveRequestItem(message, {
                            is_request: false,
                            confidence: 1.0,
                            notes: 'Internal member message'
                        });
                        continue;
                    }

                    // Classify with GPT
                    const classification = await this.classifyMessage(message);

                    // Save to database
                    const requestItem = await this.saveRequestItem(message, classification);

                    // Emit WebSocket event
                    this.io.emit('request.created', requestItem);

                    // Send Slack notification if urgent
                    if (classification.urgency === 'high') {
                        await this.sendUrgentNotification(message, classification);
                    }

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

    async classifyMessage(message) {
        try {
            const prompt = CLASSIFICATION_PROMPT
                .replace('{message}', message.body)
                .replace('{sender}', message.sender)
                .replace('{roomName}', message.room_name);

            const completion = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: 'You are a helpful assistant that classifies customer support messages.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.3,
                max_tokens: 200
            });

            const responseText = completion.choices[0].message.content;

            try {
                const classification = JSON.parse(responseText);
                return {
                    is_request: classification.is_request || false,
                    request_type: classification.request_type || REQUEST_TYPES.OTHER,
                    urgency: classification.urgency || 'normal',
                    confidence: classification.confidence || 0.5,
                    summary: classification.summary || ''
                };
            } catch (parseError) {
                logger.error('Failed to parse GPT response', { response: responseText });
                return this.getFallbackClassification();
            }

        } catch (error) {
            logger.error('GPT API error', error);
            return this.getFallbackClassification();
        }
    }

    getFallbackClassification() {
        return {
            is_request: false,
            request_type: REQUEST_TYPES.OTHER,
            urgency: 'normal',
            confidence: 0.0,
            summary: 'Classification failed'
        };
    }

    async saveRequestItem(message, classification) {
        const query = `
            INSERT INTO request_items (
                id, message_id, room_id, is_request,
                request_type, urgency, confidence, status, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `;

        const values = [
            uuidv4(),
            message.id,
            message.room_id,
            classification.is_request,
            classification.request_type,
            classification.urgency,
            classification.confidence,
            '미처리',
            classification.summary || classification.notes || null
        ];

        const result = await pool.query(query, values);
        return result.rows[0];
    }

    async sendUrgentNotification(message, classification) {
        const notificationText = `
🚨 *긴급 CS 요청*
채팅방: ${message.room_name}
발신자: ${message.sender}
유형: ${classification.request_type}
내용: ${message.body.substring(0, 200)}
`;

        await sendSlackNotification(notificationText);
        logger.info('Urgent notification sent', { messageId: message.id });
    }
}

let workerInstance = null;

function startRequestWorker(io) {
    if (!workerInstance) {
        workerInstance = new RequestWorker(io);
        workerInstance.start();
    }
    return workerInstance;
}

module.exports = { startRequestWorker };