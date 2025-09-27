const cron = require('node-cron');
const { pool } = require('../db/connection');
const { sendSlackNotification } = require('../utils/slack');
const logger = require('../utils/logger');

class ReportScheduler {
    constructor() {
        this.jobs = [];
    }

    start() {
        // Daily morning report at 9:00 AM
        const morningReport = cron.schedule('0 9 * * *', async () => {
            logger.info('Running daily morning report');
            await this.generateDailyReport();
        });

        // Hourly check for urgent unattended requests
        const urgentCheck = cron.schedule('0 * * * *', async () => {
            logger.info('Checking for urgent unattended requests');
            await this.checkUrgentRequests();
        });

        // Weekly summary report on Monday at 9:00 AM (48-hour request report)
        const weeklyReport = cron.schedule('0 9 * * 1', async () => {
            logger.info('Running Monday morning 48-hour report');
            await this.generateMondayMorningReport();
        });

        // Weekend/Holiday evening check at 9:00 PM on Friday, Saturday, Sunday
        const weekendCheck = cron.schedule('0 21 * * 5,6,0', async () => {
            logger.info('Running weekend evening check');
            await this.generateWeekendEveningReport();
        });

        // SLA monitoring every 30 minutes during business hours
        const slaMonitor = cron.schedule('*/30 9-18 * * 1-5', async () => {
            logger.info('Checking SLA status');
            await this.checkSLAStatus();
        });

        this.jobs.push(morningReport, urgentCheck, weeklyReport, weekendCheck, slaMonitor);
        logger.info('Enhanced scheduler started with Stage 2.1 updates');
    }

    async generateDailyReport() {
        try {
            // Get statistics for the last 24 hours
            const stats = await pool.query(`
                SELECT
                    COUNT(*) as total_requests,
                    COUNT(CASE WHEN is_request = true THEN 1 END) as actual_requests,
                    COUNT(CASE WHEN urgency = 'high' THEN 1 END) as urgent_requests,
                    COUNT(CASE WHEN status = '미처리' THEN 1 END) as pending_requests,
                    COUNT(CASE WHEN status = '완료' THEN 1 END) as completed_requests
                FROM request_items
                WHERE created_at > NOW() - INTERVAL '24 hours'
            `);

            const typeBreakdown = await pool.query(`
                SELECT
                    request_type,
                    COUNT(*) as count
                FROM request_items
                WHERE is_request = true
                    AND created_at > NOW() - INTERVAL '24 hours'
                GROUP BY request_type
                ORDER BY count DESC
                LIMIT 5
            `);

            const pendingUrgent = await pool.query(`
                SELECT
                    cr.room_name,
                    cm.sender,
                    ri.request_type,
                    ri.created_at
                FROM request_items ri
                JOIN chat_messages cm ON ri.message_id = cm.id
                JOIN chat_rooms cr ON ri.room_id = cr.id
                WHERE ri.urgency = 'high'
                    AND ri.status = '미처리'
                ORDER BY ri.created_at ASC
                LIMIT 10
            `);

            const { rows: [summary] } = stats;

            let reportText = `
📊 *일일 CS 리포트*
날짜: ${new Date().toLocaleDateString('ko-KR')}

📈 *24시간 통계*
• 전체 메시지: ${summary.total_requests}건
• 실제 요청: ${summary.actual_requests}건
• 긴급 요청: ${summary.urgent_requests}건
• 미처리: ${summary.pending_requests}건
• 완료: ${summary.completed_requests}건

📝 *요청 유형별 현황*
`;

            typeBreakdown.rows.forEach(type => {
                reportText += `• ${type.request_type}: ${type.count}건\n`;
            });

            if (pendingUrgent.rows.length > 0) {
                reportText += `\n⚠️ *미처리 긴급 요청*\n`;
                pendingUrgent.rows.forEach(req => {
                    const time = new Date(req.created_at).toLocaleTimeString('ko-KR');
                    reportText += `• [${req.room_name}] ${req.sender} - ${req.request_type} (${time})\n`;
                });
            }

            await sendSlackNotification(reportText);
            logger.info('Daily report sent successfully');

        } catch (error) {
            logger.error('Error generating daily report', error);
        }
    }

    async checkUrgentRequests() {
        try {
            // Check for urgent requests that have been pending for more than 1 hour
            const urgentPending = await pool.query(`
                SELECT
                    ri.*,
                    cr.room_name,
                    cm.sender,
                    cm.body
                FROM request_items ri
                JOIN chat_messages cm ON ri.message_id = cm.id
                JOIN chat_rooms cr ON ri.room_id = cr.id
                WHERE ri.urgency = 'high'
                    AND ri.status = '미처리'
                    AND ri.created_at < NOW() - INTERVAL '1 hour'
                ORDER BY ri.created_at ASC
            `);

            if (urgentPending.rows.length > 0) {
                let alertText = `
🚨 *긴급 요청 알림*
1시간 이상 미처리된 긴급 요청이 ${urgentPending.rows.length}건 있습니다.

`;
                urgentPending.rows.slice(0, 5).forEach(req => {
                    const hours = Math.floor((Date.now() - new Date(req.created_at).getTime()) / (1000 * 60 * 60));
                    alertText += `• [${req.room_name}] ${req.sender} - ${hours}시간 경과\n`;
                    alertText += `  "${req.body.substring(0, 50)}..."\n\n`;
                });

                await sendSlackNotification(alertText);
                logger.info(`Urgent request alert sent for ${urgentPending.rows.length} requests`);
            }

        } catch (error) {
            logger.error('Error checking urgent requests', error);
        }
    }

    async generateMondayMorningReport() {
        try {
            // Get 48-hour backlog (weekend requests)
            const backlog = await pool.query(`
                SELECT
                    ri.*,
                    cr.room_name,
                    cm.sender,
                    cm.body
                FROM request_items ri
                JOIN chat_messages cm ON ri.message_id = cm.id
                JOIN chat_rooms cr ON ri.room_id = cr.id
                WHERE ri.created_at > NOW() - INTERVAL '48 hours'
                    AND ri.is_request = true
                ORDER BY ri.urgency DESC, ri.created_at ASC
            `);

            const stats = await pool.query(`
                SELECT
                    COUNT(*) as total_requests,
                    COUNT(CASE WHEN urgency = 'high' THEN 1 END) as urgent_requests,
                    COUNT(CASE WHEN status = '미처리' THEN 1 END) as pending_requests,
                    COUNT(CASE WHEN sla_due_at < NOW() THEN 1 END) as overdue_requests
                FROM request_items
                WHERE created_at > NOW() - INTERVAL '48 hours'
                    AND is_request = true
            `);

            const byGroup = await pool.query(`
                SELECT
                    assignee_group,
                    COUNT(*) as count
                FROM request_items
                WHERE created_at > NOW() - INTERVAL '48 hours'
                    AND is_request = true
                GROUP BY assignee_group
                ORDER BY count DESC
            `);

            const { rows: [summary] } = stats;

            let reportText = `
📅 *월요일 아침 CS 리포트*
48시간 요청 현황 (주말 포함)

📊 *요약*
• 전체 요청: ${summary.total_requests}건
• 긴급 요청: ${summary.urgent_requests}건
• 미처리: ${summary.pending_requests}건
• SLA 초과: ${summary.overdue_requests}건

📋 *팀별 분배*
`;

            byGroup.rows.forEach(group => {
                reportText += `• ${group.assignee_group || '미지정'}: ${group.count}건\n`;
            });

            if (backlog.rows.filter(r => r.urgency === 'high' && r.status === '미처리').length > 0) {
                reportText += `\n🚨 *미처리 긴급 요청*\n`;
                backlog.rows
                    .filter(r => r.urgency === 'high' && r.status === '미처리')
                    .slice(0, 5)
                    .forEach(req => {
                        reportText += `• [${req.room_name}] ${req.sender}\n`;
                        reportText += `  ${req.request_type} - ${req.body.substring(0, 50)}...\n`;
                    });
            }

            reportText += `\n💡 우선 처리 필요 항목이 ${summary.overdue_requests}건 있습니다.`;

            await sendSlackNotification(reportText);
            logger.info('Monday morning report sent successfully');

        } catch (error) {
            logger.error('Error generating Monday morning report', error);
        }
    }

    async generateWeekendEveningReport() {
        try {
            const todayStats = await pool.query(`
                SELECT
                    COUNT(*) as total,
                    COUNT(CASE WHEN urgency = 'high' THEN 1 END) as urgent,
                    COUNT(CASE WHEN status = '미처리' THEN 1 END) as pending
                FROM request_items
                WHERE DATE(created_at) = CURRENT_DATE
                    AND is_request = true
            `);

            const urgentPending = await pool.query(`
                SELECT
                    cr.room_name,
                    ri.request_type,
                    ri.assignee_group
                FROM request_items ri
                JOIN chat_rooms cr ON ri.room_id = cr.id
                WHERE ri.urgency = 'high'
                    AND ri.status = '미처리'
                    AND DATE(ri.created_at) = CURRENT_DATE
                LIMIT 5
            `);

            const { rows: [stats] } = todayStats;

            if (stats.total > 0) {
                let reportText = `
🌙 *주말/휴일 저녁 CS 현황*
오늘 들어온 요청: ${stats.total}건

📊 상태
• 긴급: ${stats.urgent}건
• 미처리: ${stats.pending}건
`;

                if (urgentPending.rows.length > 0) {
                    reportText += `\n⚠️ 미처리 긴급 요청\n`;
                    urgentPending.rows.forEach(req => {
                        reportText += `• [${req.room_name}] ${req.request_type} (${req.assignee_group}팀)\n`;
                    });
                }

                reportText += `\n월요일 아침 처리가 필요합니다.`;

                await sendSlackNotification(reportText);
                logger.info('Weekend evening report sent');
            }

        } catch (error) {
            logger.error('Error generating weekend evening report', error);
        }
    }

    async checkSLAStatus() {
        try {
            // Check for requests approaching SLA deadline (within 30 minutes)
            const approachingSLA = await pool.query(`
                SELECT
                    ri.*,
                    cr.room_name,
                    cm.sender
                FROM request_items ri
                JOIN chat_rooms cr ON ri.room_id = cr.id
                JOIN chat_messages cm ON ri.message_id = cm.id
                WHERE ri.status != '완료'
                    AND ri.sla_due_at BETWEEN NOW() AND NOW() + INTERVAL '30 minutes'
            `);

            if (approachingSLA.rows.length > 0) {
                let alertText = `
⏰ *SLA 임박 알림*
30분 내 처리 기한 도래: ${approachingSLA.rows.length}건

`;
                approachingSLA.rows.slice(0, 3).forEach(req => {
                    const minutesLeft = Math.floor((new Date(req.sla_due_at) - new Date()) / 60000);
                    alertText += `• [${req.room_name}] ${req.request_type} - ${minutesLeft}분 남음\n`;
                });

                await sendSlackNotification(alertText);
                logger.info(`SLA alert sent for ${approachingSLA.rows.length} requests`);
            }

        } catch (error) {
            logger.error('Error checking SLA status', error);
        }
    }

    async generateWeeklyReport() {
        try {
            const weekStats = await pool.query(`
                SELECT
                    COUNT(*) as total_requests,
                    COUNT(CASE WHEN status = '완료' THEN 1 END) as completed,
                    AVG(CASE
                        WHEN status = '완료' AND resolved_at IS NOT NULL
                        THEN EXTRACT(EPOCH FROM (resolved_at - created_at))/3600
                    END)::NUMERIC(10,2) as avg_resolution_hours
                FROM request_items
                WHERE created_at > NOW() - INTERVAL '7 days'
            `);

            const topRooms = await pool.query(`
                SELECT
                    cr.room_name,
                    COUNT(*) as request_count
                FROM request_items ri
                JOIN chat_rooms cr ON ri.room_id = cr.id
                WHERE ri.created_at > NOW() - INTERVAL '7 days'
                    AND ri.is_request = true
                GROUP BY cr.room_name
                ORDER BY request_count DESC
                LIMIT 10
            `);

            const { rows: [summary] } = weekStats;

            let reportText = `
📊 *주간 CS 리포트*
기간: ${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString('ko-KR')} ~ ${new Date().toLocaleDateString('ko-KR')}

📈 *주간 성과*
• 전체 요청: ${summary.total_requests}건
• 처리 완료: ${summary.completed}건
• 완료율: ${((summary.completed / summary.total_requests) * 100).toFixed(1)}%
• 평균 처리 시간: ${summary.avg_resolution_hours || 0}시간

🏥 *요청 많은 병원 TOP 10*
`;

            topRooms.rows.forEach((room, index) => {
                reportText += `${index + 1}. ${room.room_name}: ${room.request_count}건\n`;
            });

            await sendSlackNotification(reportText);
            logger.info('Weekly report sent successfully');

        } catch (error) {
            logger.error('Error generating weekly report', error);
        }
    }

    stop() {
        this.jobs.forEach(job => job.stop());
        logger.info('Report scheduler stopped');
    }
}

let schedulerInstance = null;

function startScheduler() {
    if (!schedulerInstance) {
        schedulerInstance = new ReportScheduler();
        schedulerInstance.start();
    }
    return schedulerInstance;
}

module.exports = { startScheduler };