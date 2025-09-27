const { Pool } = require('pg');
const logger = require('../utils/logger');

// Create connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://chatlogger:chatlogger123@localhost:5432/chatlogger',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Test connection
async function connectDB() {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW()');
        client.release();
        logger.info('Database connection established', { time: result.rows[0].now });
        return true;
    } catch (error) {
        logger.error('Database connection failed', error);
        throw error;
    }
}

// Execute migration
async function runMigration() {
    const client = await pool.connect();
    try {
        // Check if migrations table exists
        await client.query(`
            CREATE TABLE IF NOT EXISTS migrations (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) NOT NULL UNIQUE,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Run migrations (simplified for now - in production use a migration tool)
        logger.info('Migrations check completed');
    } catch (error) {
        logger.error('Migration failed', error);
        throw error;
    } finally {
        client.release();
    }
}

module.exports = { pool, connectDB, runMigration };