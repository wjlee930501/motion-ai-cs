-- MotionLabs KakaoTalk CS Intelligence System v1.0
-- Database Schema (PostgreSQL 15+)

-- ============================================
-- 1. Users (계정 관리)
-- ============================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 초기 admin 계정 (password: 1234)
-- bcrypt hash for '1234'
INSERT INTO users (email, password_hash, name) VALUES 
('admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.G5eRxqPzLJqHGa', '관리자');

-- ============================================
-- 2. Message Event (카카오톡 메시지)
-- ============================================
CREATE TABLE message_event (
    event_id UUID PRIMARY KEY,
    device_id TEXT NOT NULL,
    chat_room TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('staff', 'customer')),
    staff_member TEXT,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    text_raw TEXT NOT NULL,
    text_hash TEXT NOT NULL,
    bucket_ts TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL,
    metadata_json JSONB,
    ingest_status TEXT NOT NULL DEFAULT 'received',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dedup index
CREATE UNIQUE INDEX ux_message_event_dedup ON message_event(text_hash, bucket_ts);

-- Query indexes
CREATE INDEX ix_message_event_room_time ON message_event(chat_room, received_at DESC);
CREATE INDEX ix_message_event_sender_type_time ON message_event(sender_type, received_at DESC);
CREATE INDEX ix_message_event_created ON message_event(created_at DESC);

-- ============================================
-- 3. Ticket (CS 티켓)
-- ============================================
CREATE TABLE ticket (
    ticket_id UUID PRIMARY KEY,
    clinic_key TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('new', 'in_progress', 'waiting', 'done')),
    priority TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    topic_primary TEXT,
    summary_latest TEXT,
    next_action TEXT,
    first_inbound_at TIMESTAMPTZ,
    first_response_sec INTEGER,
    last_inbound_at TIMESTAMPTZ,
    last_outbound_at TIMESTAMPTZ,
    sla_breached BOOLEAN NOT NULL DEFAULT FALSE,
    sla_alerted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Query indexes
CREATE INDEX ix_ticket_clinic_status ON ticket(clinic_key, status);
CREATE INDEX ix_ticket_status ON ticket(status);
CREATE INDEX ix_ticket_sla_breached ON ticket(sla_breached) WHERE sla_breached = TRUE;
CREATE INDEX ix_ticket_updated ON ticket(updated_at DESC);
CREATE INDEX ix_ticket_first_inbound ON ticket(first_inbound_at DESC);

-- ============================================
-- 4. Ticket Event Link (티켓-메시지 연결)
-- ============================================
CREATE TABLE ticket_event_link (
    ticket_id UUID REFERENCES ticket(ticket_id) ON DELETE CASCADE,
    event_id UUID REFERENCES message_event(event_id) ON DELETE CASCADE,
    link_type TEXT NOT NULL DEFAULT 'append',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (ticket_id, event_id)
);

-- ============================================
-- 5. LLM Annotation (AI 분류 결과)
-- ============================================
CREATE TABLE llm_annotation (
    id BIGSERIAL PRIMARY KEY,
    target_type TEXT NOT NULL CHECK (target_type IN ('event', 'ticket')),
    target_id UUID NOT NULL,
    model TEXT NOT NULL,
    topic TEXT,
    urgency TEXT,
    sentiment TEXT,
    intent TEXT,
    summary TEXT,
    confidence NUMERIC,
    raw_response JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_llm_target ON llm_annotation(target_type, target_id);
CREATE INDEX ix_llm_created ON llm_annotation(created_at DESC);

-- ============================================
-- 6. Device Heartbeat (Android 상태)
-- ============================================
CREATE TABLE device_heartbeat (
    device_id TEXT PRIMARY KEY,
    last_seen_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 7. SLA Alert Log (알림 발송 기록)
-- ============================================
CREATE TABLE sla_alert_log (
    id BIGSERIAL PRIMARY KEY,
    ticket_id UUID REFERENCES ticket(ticket_id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL DEFAULT 'slack',
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    response_status INTEGER,
    error_message TEXT
);

CREATE INDEX ix_sla_alert_ticket ON sla_alert_log(ticket_id);

-- ============================================
-- Helper Functions
-- ============================================

-- 10초 단위 bucket timestamp 생성
CREATE OR REPLACE FUNCTION get_bucket_ts(ts TIMESTAMPTZ)
RETURNS TIMESTAMPTZ AS $$
BEGIN
    RETURN DATE_TRUNC('minute', ts) + 
           INTERVAL '10 seconds' * FLOOR(EXTRACT(SECOND FROM ts) / 10);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_ticket_updated_at
    BEFORE UPDATE ON ticket
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
