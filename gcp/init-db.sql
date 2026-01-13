-- ============================================
-- CS Intelligence System - Database Schema
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Users Table
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'agent',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Default admin user (password: admin123)
INSERT INTO users (email, password_hash, name, role)
VALUES (
    'admin@motionlabs.kr',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiGYRz/TqKme',
    'Admin',
    'admin'
) ON CONFLICT (email) DO NOTHING;

-- ============================================
-- Tickets Table
-- ============================================
CREATE TABLE IF NOT EXISTS tickets (
    ticket_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_key VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'new',
    priority VARCHAR(50) DEFAULT 'normal',
    topic_primary VARCHAR(255),
    topic_secondary VARCHAR(255),
    summary_latest TEXT,
    next_action TEXT,
    sla_breached BOOLEAN DEFAULT false,
    first_inbound_at TIMESTAMP WITH TIME ZONE,
    first_response_at TIMESTAMP WITH TIME ZONE,
    first_response_sec INTEGER,
    assigned_to INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for tickets
CREATE INDEX IF NOT EXISTS idx_tickets_clinic_key ON tickets(clinic_key);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_sla_breached ON tickets(sla_breached);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);

-- ============================================
-- Events Table
-- ============================================
CREATE TABLE IF NOT EXISTS events (
    event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID REFERENCES tickets(ticket_id) ON DELETE CASCADE,
    sender_type VARCHAR(50) NOT NULL, -- 'customer' or 'staff'
    sender_name VARCHAR(255),
    text_raw TEXT NOT NULL,
    media_url TEXT,
    llm_result JSONB,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for events
CREATE INDEX IF NOT EXISTS idx_events_ticket_id ON events(ticket_id);
CREATE INDEX IF NOT EXISTS idx_events_received_at ON events(received_at DESC);

-- ============================================
-- Job Queue Table
-- ============================================
CREATE TABLE IF NOT EXISTS job_queue (
    job_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(event_id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for job queue
CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue(status);
CREATE INDEX IF NOT EXISTS idx_job_queue_created_at ON job_queue(created_at);

-- ============================================
-- Update trigger function
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets;
CREATE TRIGGER update_tickets_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_job_queue_updated_at ON job_queue;
CREATE TRIGGER update_job_queue_updated_at
    BEFORE UPDATE ON job_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Views for metrics
-- ============================================
CREATE OR REPLACE VIEW daily_metrics AS
SELECT
    DATE(created_at) as date,
    COUNT(*) FILTER (WHERE DATE(first_inbound_at) = DATE(created_at)) as today_inbound,
    COUNT(*) FILTER (WHERE status != 'done') as open_tickets,
    COUNT(*) FILTER (WHERE sla_breached = true) as sla_breached_count,
    COUNT(*) FILTER (WHERE priority = 'urgent') as urgent_count,
    AVG(first_response_sec) FILTER (WHERE first_response_sec IS NOT NULL) as avg_response_sec
FROM tickets
GROUP BY DATE(created_at);

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO cs_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cs_admin;
