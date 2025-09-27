-- Migration: Add request_items table for CS request management
-- Version: 002
-- Date: 2025-09-27

-- Create request_items table
CREATE TABLE IF NOT EXISTS request_items (
    id VARCHAR(36) PRIMARY KEY,
    message_id VARCHAR(36) NOT NULL,
    room_id VARCHAR(36) NOT NULL,
    conversation_id VARCHAR(36),
    device_id VARCHAR(36),
    is_request BOOLEAN NOT NULL DEFAULT FALSE,
    request_type VARCHAR(32),
    urgency VARCHAR(16) DEFAULT 'normal',
    confidence NUMERIC(3,2),
    status VARCHAR(16) DEFAULT '미처리',
    assignee VARCHAR(64),
    notes TEXT,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX idx_request_room ON request_items(room_id, created_at DESC);
CREATE INDEX idx_request_status ON request_items(status);
CREATE INDEX idx_request_type ON request_items(request_type);
CREATE INDEX idx_request_urgency ON request_items(urgency);
CREATE INDEX idx_request_assignee ON request_items(assignee);
CREATE INDEX idx_request_created_at ON request_items(created_at DESC);

-- Create internal_members table for filtering internal messages
CREATE TABLE IF NOT EXISTS internal_members (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    department VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default internal members (MotionLabs staff)
INSERT INTO internal_members (name, department) VALUES
    ('모션랩스', 'Admin'),
    ('MotionLabs', 'Admin'),
    ('관리자', 'Admin'),
    ('CS팀', 'CS'),
    ('개발팀', 'Dev'),
    ('영업팀', 'Sales')
ON CONFLICT (name) DO NOTHING;

-- Create request_templates table for response templates
CREATE TABLE IF NOT EXISTS request_templates (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    template_text TEXT NOT NULL,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default templates
INSERT INTO request_templates (title, category, template_text) VALUES
    ('기본 인사', '인사', '안녕하세요, 모션랩스 CS팀입니다. 문의 주신 내용 확인했습니다.'),
    ('처리 완료', '완료', '요청하신 사항이 처리 완료되었습니다. 추가 문의사항이 있으시면 언제든지 말씀해 주세요.'),
    ('확인 중', '진행', '문의 주신 내용 확인 중입니다. 잠시만 기다려 주세요.'),
    ('계약/결제 안내', '계약/결제', '계약 및 결제 관련 문의 확인했습니다. 담당자가 곧 연락드리겠습니다.'),
    ('오류 접수', '오류신고', '오류 신고 접수되었습니다. 기술팀에서 확인 후 조치하겠습니다.'),
    ('긴급 대응', '긴급', '긴급 요청 확인했습니다. 최우선으로 처리하겠습니다.')
ON CONFLICT DO NOTHING;

-- Create request_stats view for analytics
CREATE OR REPLACE VIEW request_stats AS
SELECT
    DATE(created_at) as date,
    COUNT(*) as total_requests,
    COUNT(CASE WHEN is_request = true THEN 1 END) as actual_requests,
    COUNT(CASE WHEN urgency = 'high' THEN 1 END) as urgent_requests,
    COUNT(CASE WHEN status = '미처리' THEN 1 END) as pending_requests,
    COUNT(CASE WHEN status = '완료' THEN 1 END) as completed_requests,
    AVG(confidence)::NUMERIC(3,2) as avg_confidence
FROM request_items
GROUP BY DATE(created_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for request_items
CREATE TRIGGER update_request_items_updated_at
    BEFORE UPDATE ON request_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for request_templates
CREATE TRIGGER update_request_templates_updated_at
    BEFORE UPDATE ON request_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();