const express = require('express');
const { pool } = require('../db/connection');
const logger = require('../utils/logger');

const router = express.Router();

// GET /api/v1/stats/overview - Get overall statistics
router.get('/overview', async (req, res) => {
    try {
        const overview = await pool.query(`
            SELECT
                (SELECT COUNT(*) FROM chat_rooms) as total_rooms,
                (SELECT COUNT(*) FROM chat_messages) as total_messages,
                (SELECT COUNT(*) FROM request_items WHERE is_request = true) as total_requests,
                (SELECT COUNT(*) FROM request_items WHERE status = '미처리') as pending_requests,
                (SELECT COUNT(*) FROM request_items WHERE urgency = 'high' AND status != '완료') as urgent_open
        `);

        res.json(overview.rows[0]);

    } catch (error) {
        logger.error('Error fetching overview stats', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/v1/stats/daily - Get daily statistics
router.get('/daily', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;

        const daily = await pool.query(`
            SELECT
                DATE(created_at) as date,
                COUNT(*) as total_requests,
                COUNT(CASE WHEN is_request = true THEN 1 END) as actual_requests,
                COUNT(CASE WHEN urgency = 'high' THEN 1 END) as urgent_requests,
                COUNT(CASE WHEN status = '완료' THEN 1 END) as completed_requests,
                AVG(confidence)::NUMERIC(3,2) as avg_confidence
            FROM request_items
            WHERE created_at > NOW() - INTERVAL '%s days'
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        `, [days]);

        res.json(daily.rows);

    } catch (error) {
        logger.error('Error fetching daily stats', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/v1/stats/by-type - Get statistics by request type
router.get('/by-type', async (req, res) => {
    try {
        const byType = await pool.query(`
            SELECT
                request_type,
                COUNT(*) as count,
                COUNT(CASE WHEN status = '완료' THEN 1 END) as completed,
                COUNT(CASE WHEN status = '미처리' THEN 1 END) as pending,
                AVG(confidence)::NUMERIC(3,2) as avg_confidence
            FROM request_items
            WHERE is_request = true
            GROUP BY request_type
            ORDER BY count DESC
        `);

        res.json(byType.rows);

    } catch (error) {
        logger.error('Error fetching type stats', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/v1/stats/response-times - Get response time statistics
router.get('/response-times', async (req, res) => {
    try {
        const responseTimes = await pool.query(`
            SELECT
                request_type,
                AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600)::NUMERIC(10,2) as avg_hours,
                MIN(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600)::NUMERIC(10,2) as min_hours,
                MAX(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600)::NUMERIC(10,2) as max_hours
            FROM request_items
            WHERE status = '완료' AND resolved_at IS NOT NULL
            GROUP BY request_type
        `);

        res.json(responseTimes.rows);

    } catch (error) {
        logger.error('Error fetching response times', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/v1/stats/assignee-performance - Get assignee performance
router.get('/assignee-performance', async (req, res) => {
    try {
        const performance = await pool.query(`
            SELECT
                assignee,
                COUNT(*) as total_assigned,
                COUNT(CASE WHEN status = '완료' THEN 1 END) as completed,
                COUNT(CASE WHEN status = '진행중' THEN 1 END) as in_progress,
                COUNT(CASE WHEN status = '미처리' THEN 1 END) as pending,
                AVG(CASE
                    WHEN status = '완료' AND resolved_at IS NOT NULL
                    THEN EXTRACT(EPOCH FROM (resolved_at - created_at))/3600
                END)::NUMERIC(10,2) as avg_resolution_hours
            FROM request_items
            WHERE assignee IS NOT NULL
            GROUP BY assignee
            ORDER BY total_assigned DESC
        `);

        res.json(performance.rows);

    } catch (error) {
        logger.error('Error fetching assignee performance', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;