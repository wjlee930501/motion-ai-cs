-- Migration 004: Resolution tracking, clinic profiles, highlights, topic knowledge
-- Date: 2026-02-01
-- Features: Conversation resolution, clinic profiling, best response highlights, topic knowledge

-- 1. Ticket: Add resolution tracking columns
ALTER TABLE ticket ADD COLUMN IF NOT EXISTS resolution_status TEXT;
ALTER TABLE ticket ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS ix_ticket_resolution ON ticket (resolution_status);

-- 2. StaffResponseLog: Add highlight columns
ALTER TABLE staff_response_log ADD COLUMN IF NOT EXISTS is_highlighted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE staff_response_log ADD COLUMN IF NOT EXISTS highlight_reason TEXT;
CREATE INDEX IF NOT EXISTS ix_staff_response_highlighted ON staff_response_log (is_highlighted) WHERE is_highlighted = TRUE;

-- 3. ClinicProfile: New table (create_all handles this, but explicit for safety)
CREATE TABLE IF NOT EXISTS clinic_profile (
    clinic_key TEXT PRIMARY KEY,
    sentiment_avg NUMERIC(3,2),
    complaint_ratio NUMERIC(3,2),
    urgency_avg NUMERIC(3,2),
    escalation_tendency NUMERIC(3,2),
    recontact_rate NUMERIC(3,2),
    profile_label TEXT,
    total_interactions INTEGER NOT NULL DEFAULT 0,
    total_tickets INTEGER NOT NULL DEFAULT 0,
    last_analyzed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_clinic_profile_label ON clinic_profile (profile_label);

-- 4. TopicKnowledge: New table
CREATE TABLE IF NOT EXISTS topic_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic TEXT NOT NULL,
    pattern_summary TEXT NOT NULL,
    resolution_summary TEXT NOT NULL,
    example_conversation TEXT,
    occurrence_count INTEGER NOT NULL DEFAULT 1,
    resolution_success_rate NUMERIC(3,2),
    source_version INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_topic_knowledge_topic ON topic_knowledge (topic);
CREATE INDEX IF NOT EXISTS ix_topic_knowledge_occurrence ON topic_knowledge (occurrence_count);
