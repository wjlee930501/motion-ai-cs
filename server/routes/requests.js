const express = require('express');
const { pool } = require('../db/connection');
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const querySchema = Joi.object({
    room_id: Joi.string().uuid(),
    type: Joi.string(),
    urgency: Joi.string().valid('low', 'normal', 'high'),
    status: Joi.string(),
    assignee: Joi.string(),
    assignee_group: Joi.string(),
    policy_flag: Joi.string(),
    overdue: Joi.boolean(),
    weekend_backlog: Joi.boolean(),
    cursor: Joi.string(),
    limit: Joi.number().integer().min(1).max(100).default(20)
});

const updateSchema = Joi.object({
    status: Joi.string().valid('미처리', '진행중', '완료'),
    assignee: Joi.string().allow('', null),
    assignee_group: Joi.string(),
    notes: Joi.string(),
    manual_override: Joi.boolean(),
    sla_due_at: Joi.date().iso()
});

// GET /api/v1/requests - Get requests with filters
router.get('/', async (req, res) => {
    try {
        const { error, value } = querySchema.validate(req.query);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        // Use special views for specific queries
        if (value.overdue) {
            const overdueQuery = `
                SELECT * FROM overdue_requests
                LIMIT $1
            `;
            const result = await pool.query(overdueQuery, [value.limit]);
            return res.json({
                data: result.rows,
                count: result.rows.length,
                limit: value.limit,
                overdue: true
            });
        }

        if (value.weekend_backlog) {
            const backlogQuery = `
                SELECT * FROM weekend_backlog
                LIMIT $1
            `;
            const result = await pool.query(backlogQuery, [value.limit]);
            return res.json({
                data: result.rows,
                count: result.rows.length,
                limit: value.limit,
                weekend_backlog: true
            });
        }

        let query = `
            SELECT
                ri.*,
                cm.sender,
                cm.body as message_body,
                cm.timestamp as message_timestamp,
                cr.room_name,
                CASE
                    WHEN ri.sla_due_at < NOW() THEN true
                    ELSE false
                END as is_overdue,
                EXTRACT(EPOCH FROM (ri.sla_due_at - NOW()))/3600 as hours_until_due
            FROM request_items ri
            JOIN chat_messages cm ON ri.message_id = cm.id
            JOIN chat_rooms cr ON ri.room_id = cr.id
            WHERE 1=1
        `;

        const params = [];
        let paramCount = 0;

        if (value.room_id) {
            query += ` AND ri.room_id = $${++paramCount}`;
            params.push(value.room_id);
        }

        if (value.type) {
            query += ` AND ri.request_type = $${++paramCount}`;
            params.push(value.type);
        }

        if (value.urgency) {
            query += ` AND ri.urgency = $${++paramCount}`;
            params.push(value.urgency);
        }

        if (value.status) {
            query += ` AND ri.status = $${++paramCount}`;
            params.push(value.status);
        }

        if (value.assignee) {
            query += ` AND ri.assignee = $${++paramCount}`;
            params.push(value.assignee);
        }

        if (value.assignee_group) {
            query += ` AND ri.assignee_group = $${++paramCount}`;
            params.push(value.assignee_group);
        }

        if (value.policy_flag) {
            query += ` AND ri.policy_flag = $${++paramCount}`;
            params.push(value.policy_flag);
        }

        if (value.cursor) {
            query += ` AND ri.created_at < $${++paramCount}`;
            params.push(value.cursor);
        }

        query += ` ORDER BY ri.created_at DESC LIMIT $${++paramCount}`;
        params.push(value.limit);

        const result = await pool.query(query, params);

        res.json({
            data: result.rows,
            count: result.rows.length,
            limit: value.limit
        });

    } catch (error) {
        logger.error('Error fetching requests', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/v1/requests/stats - Get request statistics
router.get('/stats', async (req, res) => {
    try {
        const stats = await pool.query(`
            SELECT
                COUNT(*) as total_requests,
                COUNT(CASE WHEN is_request = true THEN 1 END) as actual_requests,
                COUNT(CASE WHEN urgency = 'high' THEN 1 END) as urgent_requests,
                COUNT(CASE WHEN status = '미처리' THEN 1 END) as pending_requests,
                COUNT(CASE WHEN status = '진행중' THEN 1 END) as in_progress_requests,
                COUNT(CASE WHEN status = '완료' THEN 1 END) as completed_requests,
                COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as today_requests
            FROM request_items
        `);

        const typeBreakdown = await pool.query(`
            SELECT
                request_type,
                COUNT(*) as count
            FROM request_items
            WHERE is_request = true
            GROUP BY request_type
            ORDER BY count DESC
        `);

        res.json({
            summary: stats.rows[0],
            byType: typeBreakdown.rows
        });

    } catch (error) {
        logger.error('Error fetching stats', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/v1/requests/:id - Get single request
router.get('/:id', async (req, res) => {
    try {
        const query = `
            SELECT
                ri.*,
                cm.sender,
                cm.body as message_body,
                cm.timestamp as message_timestamp,
                cr.room_name
            FROM request_items ri
            JOIN chat_messages cm ON ri.message_id = cm.id
            JOIN chat_rooms cr ON ri.room_id = cr.id
            WHERE ri.id = $1
        `;

        const result = await pool.query(query, [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Request not found' });
        }

        // Get context messages (5 before and 5 after)
        const contextQuery = `
            SELECT
                cm.id,
                cm.sender,
                cm.body,
                cm.timestamp,
                cm.is_from_me
            FROM chat_messages cm
            WHERE cm.room_id = $1
                AND cm.timestamp BETWEEN $2 - 300000 AND $2 + 300000
            ORDER BY cm.timestamp ASC
        `;

        const contextResult = await pool.query(contextQuery, [
            result.rows[0].room_id,
            result.rows[0].message_timestamp
        ]);

        res.json({
            request: result.rows[0],
            context: contextResult.rows
        });

    } catch (error) {
        logger.error('Error fetching request', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /api/v1/requests/:id - Update request
router.patch('/:id', async (req, res) => {
    try {
        const { error, value } = updateSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        let updateQuery = 'UPDATE request_items SET updated_at = NOW()';
        const params = [];
        let paramCount = 1;

        if (value.status) {
            updateQuery += `, status = $${paramCount++}`;
            params.push(value.status);

            if (value.status === '완료') {
                updateQuery += `, resolved_at = NOW()`;
            }
        }

        if (value.assignee !== undefined) {
            updateQuery += `, assignee = $${paramCount++}`;
            params.push(value.assignee);
        }

        if (value.notes) {
            updateQuery += `, notes = $${paramCount++}`;
            params.push(value.notes);
        }

        updateQuery += ` WHERE id = $${paramCount} RETURNING *`;
        params.push(req.params.id);

        const result = await pool.query(updateQuery, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Request not found' });
        }

        // Emit WebSocket event
        const io = req.app.get('io');
        io.emit('request.updated', result.rows[0]);

        res.json(result.rows[0]);

    } catch (error) {
        logger.error('Error updating request', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/v1/requests/reprocess/:id - Reprocess classification
router.post('/reprocess/:id', async (req, res) => {
    try {
        // Get the original message
        const query = `
            SELECT
                cm.*,
                cr.room_name
            FROM request_items ri
            JOIN chat_messages cm ON ri.message_id = cm.id
            JOIN chat_rooms cr ON cm.room_id = cr.id
            WHERE ri.id = $1
        `;

        const result = await pool.query(query, [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Request not found' });
        }

        // Mark for reprocessing by deleting the request item
        await pool.query('DELETE FROM request_items WHERE id = $1', [req.params.id]);

        res.json({
            message: 'Request marked for reprocessing',
            id: req.params.id
        });

    } catch (error) {
        logger.error('Error reprocessing request', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;