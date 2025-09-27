const express = require('express');
const { pool } = require('../db/connection');
const Joi = require('joi');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const templateSchema = Joi.object({
    title: Joi.string().required().max(255),
    category: Joi.string().max(100),
    template_text: Joi.string().required()
});

// GET /api/v1/templates - Get all templates
router.get('/', async (req, res) => {
    try {
        const query = `
            SELECT * FROM request_templates
            ORDER BY usage_count DESC, created_at DESC
        `;

        const result = await pool.query(query);
        res.json(result.rows);

    } catch (error) {
        logger.error('Error fetching templates', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/v1/templates - Create new template
router.post('/', async (req, res) => {
    try {
        const { error, value } = templateSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        const query = `
            INSERT INTO request_templates (title, category, template_text)
            VALUES ($1, $2, $3)
            RETURNING *
        `;

        const result = await pool.query(query, [
            value.title,
            value.category,
            value.template_text
        ]);

        res.status(201).json(result.rows[0]);

    } catch (error) {
        logger.error('Error creating template', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /api/v1/templates/:id - Update template
router.patch('/:id', async (req, res) => {
    try {
        const { error, value } = templateSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        const query = `
            UPDATE request_templates
            SET title = $1, category = $2, template_text = $3, updated_at = NOW()
            WHERE id = $4
            RETURNING *
        `;

        const result = await pool.query(query, [
            value.title,
            value.category,
            value.template_text,
            req.params.id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Template not found' });
        }

        res.json(result.rows[0]);

    } catch (error) {
        logger.error('Error updating template', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/v1/templates/:id/use - Track template usage
router.post('/:id/use', async (req, res) => {
    try {
        const query = `
            UPDATE request_templates
            SET usage_count = usage_count + 1
            WHERE id = $1
            RETURNING *
        `;

        const result = await pool.query(query, [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Template not found' });
        }

        res.json(result.rows[0]);

    } catch (error) {
        logger.error('Error updating template usage', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/v1/templates/:id - Delete template
router.delete('/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM request_templates WHERE id = $1 RETURNING id',
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Template not found' });
        }

        res.json({ message: 'Template deleted successfully' });

    } catch (error) {
        logger.error('Error deleting template', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;