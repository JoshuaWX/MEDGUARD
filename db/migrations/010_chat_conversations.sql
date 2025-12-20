-- ============================================
-- 010_chat_conversations.sql
-- Tables for storing chat conversations per user
-- ============================================

-- Table to store chat sessions/conversations
CREATE TABLE IF NOT EXISTS chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Chat',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table to store individual messages within a conversation
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_updated_at ON chat_conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- Enable Row Level Security
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_conversations
-- Users can only see their own conversations
DROP POLICY IF EXISTS "Users can view own conversations" ON chat_conversations;
CREATE POLICY "Users can view own conversations" ON chat_conversations
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own conversations" ON chat_conversations;
CREATE POLICY "Users can insert own conversations" ON chat_conversations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own conversations" ON chat_conversations;
CREATE POLICY "Users can update own conversations" ON chat_conversations
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own conversations" ON chat_conversations;
CREATE POLICY "Users can delete own conversations" ON chat_conversations
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for chat_messages
-- Users can only see messages from their own conversations
DROP POLICY IF EXISTS "Users can view messages from own conversations" ON chat_messages;
CREATE POLICY "Users can view messages from own conversations" ON chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chat_conversations c
            WHERE c.id = chat_messages.conversation_id
            AND c.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert messages to own conversations" ON chat_messages;
CREATE POLICY "Users can insert messages to own conversations" ON chat_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM chat_conversations c
            WHERE c.id = chat_messages.conversation_id
            AND c.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete messages from own conversations" ON chat_messages;
CREATE POLICY "Users can delete messages from own conversations" ON chat_messages
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM chat_conversations c
            WHERE c.id = chat_messages.conversation_id
            AND c.user_id = auth.uid()
        )
    );

-- Function to auto-update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_chat_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chat_conversations
    SET updated_at = now()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update conversation timestamp when a message is added
DROP TRIGGER IF EXISTS trigger_update_conversation_timestamp ON chat_messages;
CREATE TRIGGER trigger_update_conversation_timestamp
    AFTER INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_chat_conversation_timestamp();

-- Function to auto-generate conversation title from first user message
CREATE OR REPLACE FUNCTION auto_title_conversation()
RETURNS TRIGGER AS $$
DECLARE
    first_msg TEXT;
    conv_title TEXT;
BEGIN
    -- Only process if this is a user message and conversation title is still default
    IF NEW.role = 'user' THEN
        SELECT title INTO conv_title FROM chat_conversations WHERE id = NEW.conversation_id;
        
        IF conv_title = 'New Chat' THEN
            -- Take first 50 chars of user's first message as title
            first_msg := LEFT(NEW.content, 50);
            IF LENGTH(NEW.content) > 50 THEN
                first_msg := first_msg || '...';
            END IF;
            
            UPDATE chat_conversations
            SET title = first_msg
            WHERE id = NEW.conversation_id AND title = 'New Chat';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-set title from first message
DROP TRIGGER IF EXISTS trigger_auto_title_conversation ON chat_messages;
CREATE TRIGGER trigger_auto_title_conversation
    AFTER INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION auto_title_conversation();
