-- Migration: Stage 2.1 Updates - Enhanced CS Request Management
-- Version: 003
-- Date: 2025-09-27

-- Alter request_items table to add new columns
ALTER TABLE request_items
  ADD COLUMN IF NOT EXISTS request_subtype VARCHAR(32),
  ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_channel VARCHAR(32) DEFAULT 'kakao',
  ADD COLUMN IF NOT EXISTS manual_override BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS policy_flag VARCHAR(32),
  ADD COLUMN IF NOT EXISTS artifacts JSONB,
  ADD COLUMN IF NOT EXISTS assignee_group VARCHAR(32);

-- Add new indexes for performance
CREATE INDEX IF NOT EXISTS idx_request_sla_due ON request_items(sla_due_at) WHERE status != '완료';
CREATE INDEX IF NOT EXISTS idx_request_policy_flag ON request_items(policy_flag) WHERE policy_flag IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_request_group_status ON request_items(assignee_group, status);
CREATE INDEX IF NOT EXISTS idx_request_source_channel ON request_items(source_channel);
CREATE INDEX IF NOT EXISTS idx_request_overdue ON request_items(sla_due_at, status) WHERE status != '완료';

-- Update request type categories to match new specification
UPDATE request_templates SET category = '요금·정산/세금' WHERE category = '계약/결제';
UPDATE request_templates SET category = '계약/서명/증빙' WHERE category IN ('계약/결제', '계정/기능문의');

-- Insert new request templates for updated categories
INSERT INTO request_templates (title, category, template_text) VALUES
    ('요금 문의 응답', '요금·정산/세금', '요금 관련 문의 확인했습니다. 세부 내역 확인 후 안내드리겠습니다.'),
    ('세금계산서 안내', '요금·정산/세금', '세금계산서 발급 요청 확인했습니다. 사업자등록증 확인 후 발급 진행하겠습니다.'),
    ('계약서 처리', '계약/서명/증빙', '계약서 요청 확인했습니다. 준비된 계약서를 이메일로 발송드리겠습니다.'),
    ('설치 일정 조율', '설치·교육·일정 조율', '설치 일정 조율 요청 확인했습니다. 가능한 일정 확인 후 연락드리겠습니다.'),
    ('템플릿 검수', '템플릿 등록/수정/검수', '템플릿 검수 요청 접수되었습니다. 정책 검토 후 결과 안내드리겠습니다.'),
    ('정책 가이드', '정책·심사 가이드', '정책 관련 문의 확인했습니다. 카카오 정책 기준에 따라 안내드리겠습니다.'),
    ('콘텐츠 제작', '콘텐츠 제작 지원', '콘텐츠 제작 지원 요청 확인했습니다. 제작팀 확인 후 일정 안내드리겠습니다.'),
    ('기술 지원', '기능/기술 지원', '기술 지원 요청 확인했습니다. 시스템 확인 후 조치하겠습니다.'),
    ('운영정보 변경', '병원 운영정보 반영', '운영정보 변경 요청 확인했습니다. 즉시 반영 처리하겠습니다.')
ON CONFLICT DO NOTHING;

-- Create working hours function for SLA calculation
CREATE OR REPLACE FUNCTION get_next_working_day_start(input_time TIMESTAMPTZ)
RETURNS TIMESTAMPTZ AS $$
DECLARE
    next_start TIMESTAMPTZ;
    day_of_week INT;
BEGIN
    -- Get day of week (0 = Sunday, 6 = Saturday)
    day_of_week := EXTRACT(DOW FROM input_time);

    -- If weekend (Saturday or Sunday)
    IF day_of_week = 0 THEN -- Sunday
        next_start := date_trunc('day', input_time) + INTERVAL '1 day' + INTERVAL '9 hours';
    ELSIF day_of_week = 6 THEN -- Saturday
        next_start := date_trunc('day', input_time) + INTERVAL '2 days' + INTERVAL '9 hours';
    -- If weekday after 6 PM
    ELSIF EXTRACT(HOUR FROM input_time) >= 18 THEN
        -- If Friday after 6 PM
        IF day_of_week = 5 THEN
            next_start := date_trunc('day', input_time) + INTERVAL '3 days' + INTERVAL '9 hours';
        ELSE
            next_start := date_trunc('day', input_time) + INTERVAL '1 day' + INTERVAL '9 hours';
        END IF;
    -- If weekday before 9 AM
    ELSIF EXTRACT(HOUR FROM input_time) < 9 THEN
        next_start := date_trunc('day', input_time) + INTERVAL '9 hours';
    -- Working hours
    ELSE
        next_start := input_time;
    END IF;

    RETURN next_start;
END;
$$ LANGUAGE plpgsql;

-- Create function to calculate SLA due time
CREATE OR REPLACE FUNCTION calculate_sla_due_time(urgency VARCHAR, created_time TIMESTAMPTZ)
RETURNS TIMESTAMPTZ AS $$
DECLARE
    working_start TIMESTAMPTZ;
    sla_hours INT;
BEGIN
    -- Get next working day start
    working_start := get_next_working_day_start(created_time);

    -- Set SLA based on urgency
    CASE urgency
        WHEN 'high' THEN
            sla_hours := 0; -- Immediate
        WHEN 'normal' THEN
            sla_hours := 2; -- 2 hours
        WHEN 'low' THEN
            sla_hours := 6; -- 6 hours
        ELSE
            sla_hours := 2; -- Default to normal
    END CASE;

    -- For high priority during working hours, use current time
    IF urgency = 'high' AND working_start = created_time THEN
        RETURN created_time + INTERVAL '30 minutes';
    ELSE
        RETURN working_start + (sla_hours * INTERVAL '1 hour');
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create view for overdue requests
CREATE OR REPLACE VIEW overdue_requests AS
SELECT
    ri.*,
    cr.room_name,
    cm.sender,
    cm.body as message_body,
    CASE
        WHEN ri.sla_due_at < NOW() THEN
            EXTRACT(EPOCH FROM (NOW() - ri.sla_due_at))/3600
        ELSE 0
    END as hours_overdue
FROM request_items ri
JOIN chat_messages cm ON ri.message_id = cm.id
JOIN chat_rooms cr ON ri.room_id = cr.id
WHERE ri.status != '완료'
    AND ri.sla_due_at < NOW()
ORDER BY ri.sla_due_at ASC;

-- Create view for weekend backlog
CREATE OR REPLACE VIEW weekend_backlog AS
SELECT
    ri.*,
    cr.room_name,
    cm.sender,
    cm.body as message_body,
    cm.timestamp as message_timestamp
FROM request_items ri
JOIN chat_messages cm ON ri.message_id = cm.id
JOIN chat_rooms cr ON ri.room_id = cr.id
WHERE ri.created_at >= (
    CASE
        WHEN EXTRACT(DOW FROM NOW()) = 1 THEN -- Monday
            NOW() - INTERVAL '3 days' -- From Friday 6PM
        WHEN EXTRACT(DOW FROM NOW()) = 0 THEN -- Sunday
            NOW() - INTERVAL '2 days' -- From Friday 6PM
        WHEN EXTRACT(DOW FROM NOW()) = 6 THEN -- Saturday
            NOW() - INTERVAL '1 day' -- From Friday 6PM
        ELSE
            NOW() - INTERVAL '2 days' -- Default weekend window
    END
)
AND ri.is_request = true
ORDER BY ri.urgency DESC, ri.created_at ASC;

-- Update trigger to calculate SLA on insert
CREATE OR REPLACE FUNCTION set_sla_due_time()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.sla_due_at IS NULL THEN
        NEW.sla_due_at := calculate_sla_due_time(NEW.urgency, NEW.created_at);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new requests
DROP TRIGGER IF EXISTS set_request_sla ON request_items;
CREATE TRIGGER set_request_sla
    BEFORE INSERT ON request_items
    FOR EACH ROW
    EXECUTE FUNCTION set_sla_due_time();

-- Policy flags reference table
CREATE TABLE IF NOT EXISTS policy_flags (
    id VARCHAR(32) PRIMARY KEY,
    description TEXT,
    severity VARCHAR(16),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO policy_flags (id, description, severity) VALUES
    ('ad-risk', '광고 정책 위험', 'high'),
    ('medical-claim', '의료 효능 표현', 'high'),
    ('price-mention', '가격 언급 주의', 'medium'),
    ('review-required', '심사 필요', 'medium'),
    ('brand-usage', '브랜드 사용 주의', 'low')
ON CONFLICT (id) DO NOTHING;