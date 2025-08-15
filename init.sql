-- Create database schema for ChatLogger

-- Chat rooms table
CREATE TABLE IF NOT EXISTS chat_rooms (
    id VARCHAR(36) PRIMARY KEY,
    room_name VARCHAR(255) NOT NULL,
    last_message_at BIGINT NOT NULL,
    last_message TEXT,
    unread_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id VARCHAR(36) PRIMARY KEY,
    room_id VARCHAR(36) NOT NULL,
    timestamp BIGINT NOT NULL,
    sender VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    raw_json TEXT,
    is_from_me BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE
);

-- Indexes for better performance
CREATE INDEX idx_chat_rooms_last_message_at ON chat_rooms(last_message_at DESC);
CREATE INDEX idx_chat_messages_room_id ON chat_messages(room_id);
CREATE INDEX idx_chat_messages_timestamp ON chat_messages(timestamp DESC);
CREATE INDEX idx_chat_messages_sender ON chat_messages(sender);
CREATE INDEX idx_chat_messages_body ON chat_messages USING gin(to_tsvector('simple', body));

-- Sync status table
CREATE TABLE IF NOT EXISTS sync_status (
    id SERIAL PRIMARY KEY,
    last_sync_time BIGINT NOT NULL,
    sync_status VARCHAR(50),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Statistics view
CREATE OR REPLACE VIEW chat_statistics AS
SELECT 
    COUNT(DISTINCT cr.id) as room_count,
    COUNT(cm.id) as message_count,
    MIN(cm.timestamp) as oldest_message,
    MAX(cm.timestamp) as newest_message
FROM chat_rooms cr
LEFT JOIN chat_messages cm ON cr.id = cm.room_id;