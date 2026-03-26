-- =====================================================
-- LIVE CHAT TAB - Complete Implementation
-- Real-Time Customer Support, AI Chatbot & Multi-Channel Inbox
-- Extends existing chat_conversations and chat_messages
-- =====================================================

-- 1. Extend chat_conversations
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS session_id VARCHAR(255);
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS ip_address INET;
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS current_page_url TEXT;
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS referrer_url TEXT;
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS cart_value NUMERIC(10,2);
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS order_count INTEGER DEFAULT 0;
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS total_spent NUMERIC(12,2);
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS customer_lifetime_value NUMERIC(10,2);
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'normal';
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id);
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS department VARCHAR(100);
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS queue_position INTEGER;
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS estimated_wait_time INTEGER;
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS first_response_time INTEGER;
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS resolution_time INTEGER;
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0;
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS customer_satisfaction_rating INTEGER CHECK (customer_satisfaction_rating IS NULL OR (customer_satisfaction_rating >= 1 AND customer_satisfaction_rating <= 5));
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS customer_feedback TEXT;
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS bot_handled BOOLEAN DEFAULT false;
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS bot_handoff BOOLEAN DEFAULT false;
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS bot_handoff_reason TEXT;
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ;
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
-- Map legacy 'open' to 'active' for consistency with new status values
UPDATE public.chat_conversations SET status = 'active' WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_chat_conv_assigned ON public.chat_conversations(assigned_to);
CREATE INDEX IF NOT EXISTS idx_chat_conv_started ON public.chat_conversations(started_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_chat_conv_session ON public.chat_conversations(session_id) WHERE session_id IS NOT NULL;

-- 2. Extend chat_messages
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS message_type VARCHAR(50) DEFAULT 'text';
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS file_url VARCHAR(500);
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS file_name VARCHAR(255);
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS file_size INTEGER;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS file_type VARCHAR(100);
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT false;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS bot_generated BOOLEAN DEFAULT false;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS bot_confidence NUMERIC(5,4);
UPDATE public.chat_messages SET content = message WHERE content IS NULL AND message IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chat_msg_created ON public.chat_messages(created_at DESC);

-- 3. Chat Agents
CREATE TABLE IF NOT EXISTS public.chat_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(500),
    status VARCHAR(50) DEFAULT 'offline',
    status_message VARCHAR(255),
    last_seen_at TIMESTAMPTZ,
    department VARCHAR(100),
    skills TEXT[] DEFAULT '{}',
    languages TEXT[] DEFAULT ARRAY['en'],
    max_concurrent_chats INTEGER DEFAULT 5,
    current_active_chats INTEGER DEFAULT 0,
    routing_priority INTEGER DEFAULT 0,
    auto_accept_chats BOOLEAN DEFAULT true,
    total_chats_handled INTEGER DEFAULT 0,
    avg_satisfaction_rating NUMERIC(3,2),
    avg_response_time INTEGER,
    avg_resolution_time INTEGER,
    notification_preferences JSONB DEFAULT '{"desktop": true, "sound": true, "email": false}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_agents_seller ON public.chat_agents(seller_id);
CREATE INDEX IF NOT EXISTS idx_chat_agents_status ON public.chat_agents(status);
CREATE INDEX IF NOT EXISTS idx_chat_agents_user ON public.chat_agents(user_id);
ALTER TABLE public.chat_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sellers manage own agents"
ON public.chat_agents FOR ALL
USING (seller_id = auth.uid());

-- 4. Canned Responses
CREATE TABLE IF NOT EXISTS public.chat_canned_responses (
    id SERIAL PRIMARY KEY,
    seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    shortcut VARCHAR(50),
    category VARCHAR(100),
    usage_count INTEGER DEFAULT 0,
    is_shared BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_canned_responses_seller ON public.chat_canned_responses(seller_id);
CREATE INDEX IF NOT EXISTS idx_canned_responses_shortcut ON public.chat_canned_responses(shortcut);
ALTER TABLE public.chat_canned_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sellers manage own canned responses"
ON public.chat_canned_responses FOR ALL
USING (seller_id = auth.uid());

-- 5. Chat Widget Settings
CREATE TABLE IF NOT EXISTS public.chat_widget_settings (
    seller_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    theme_color VARCHAR(7) DEFAULT '#3B82F6',
    position VARCHAR(50) DEFAULT 'bottom-right',
    bubble_icon VARCHAR(50) DEFAULT 'chat',
    welcome_message TEXT DEFAULT 'Hi! How can we help you today?',
    offline_message TEXT DEFAULT 'We''re currently offline. Leave us a message!',
    show_branding BOOLEAN DEFAULT true,
    avatar_url VARCHAR(500),
    company_name VARCHAR(255),
    auto_popup_enabled BOOLEAN DEFAULT false,
    auto_popup_delay INTEGER DEFAULT 30,
    auto_popup_on_exit_intent BOOLEAN DEFAULT false,
    auto_popup_on_scroll_percentage INTEGER,
    triggers JSONB DEFAULT '[]',
    file_upload_enabled BOOLEAN DEFAULT true,
    emoji_enabled BOOLEAN DEFAULT true,
    typing_indicators_enabled BOOLEAN DEFAULT true,
    read_receipts_enabled BOOLEAN DEFAULT true,
    pre_chat_form_enabled BOOLEAN DEFAULT false,
    pre_chat_form_fields JSONB,
    require_name BOOLEAN DEFAULT false,
    require_email BOOLEAN DEFAULT false,
    business_hours JSONB,
    timezone VARCHAR(100) DEFAULT 'America/New_York',
    chatbot_enabled BOOLEAN DEFAULT false,
    chatbot_greeting TEXT DEFAULT 'Hello! I''m here to help. What can I assist you with?',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.chat_widget_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sellers manage own widget settings"
ON public.chat_widget_settings FOR ALL
USING (seller_id = auth.uid());

-- 6. Chatbot Flows (Enterprise)
CREATE TABLE IF NOT EXISTS public.chatbot_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(50) NOT NULL,
    trigger_value VARCHAR(255),
    trigger_priority INTEGER DEFAULT 0,
    flow_data JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    triggered_count INTEGER DEFAULT 0,
    completed_count INTEGER DEFAULT 0,
    handoff_count INTEGER DEFAULT 0,
    success_rate NUMERIC(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chatbot_flows_seller ON public.chatbot_flows(seller_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_flows_trigger ON public.chatbot_flows(trigger_type, trigger_value);
ALTER TABLE public.chatbot_flows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sellers manage own chatbot flows"
ON public.chatbot_flows FOR ALL
USING (seller_id = auth.uid());

-- 7. Chatbot Interactions
CREATE TABLE IF NOT EXISTS public.chatbot_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    flow_id UUID REFERENCES public.chatbot_flows(id) ON DELETE SET NULL,
    current_node_id VARCHAR(100),
    flow_state JSONB,
    status VARCHAR(50) DEFAULT 'active',
    messages_exchanged INTEGER DEFAULT 0,
    user_satisfied BOOLEAN,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chatbot_interactions_conversation ON public.chatbot_interactions(conversation_id);
ALTER TABLE public.chatbot_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sellers view chatbot interactions for own convos"
ON public.chatbot_interactions FOR SELECT
USING (
    EXISTS (SELECT 1 FROM public.chat_conversations c WHERE c.id = conversation_id AND c.seller_id = auth.uid())
);

-- 8. Chat Analytics Daily
CREATE TABLE IF NOT EXISTS public.chat_analytics_daily (
    id SERIAL PRIMARY KEY,
    seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_conversations INTEGER DEFAULT 0,
    new_conversations INTEGER DEFAULT 0,
    resolved_conversations INTEGER DEFAULT 0,
    abandoned_conversations INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    messages_from_customers INTEGER DEFAULT 0,
    messages_from_agents INTEGER DEFAULT 0,
    messages_from_bot INTEGER DEFAULT 0,
    avg_first_response_time INTEGER,
    median_first_response_time INTEGER,
    avg_resolution_time INTEGER,
    median_resolution_time INTEGER,
    avg_satisfaction_rating NUMERIC(3,2),
    total_ratings INTEGER DEFAULT 0,
    bot_handled_conversations INTEGER DEFAULT 0,
    bot_handoff_conversations INTEGER DEFAULT 0,
    bot_success_rate NUMERIC(5,2),
    avg_wait_time INTEGER,
    max_wait_time INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(seller_id, date)
);
CREATE INDEX IF NOT EXISTS idx_chat_analytics_seller_date ON public.chat_analytics_daily(seller_id, date DESC);
ALTER TABLE public.chat_analytics_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sellers view own chat analytics"
ON public.chat_analytics_daily FOR ALL
USING (seller_id = auth.uid());

-- 9. Chat Routing Rules
CREATE TABLE IF NOT EXISTS public.chat_routing_rules (
    id SERIAL PRIMARY KEY,
    seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    priority INTEGER DEFAULT 0,
    conditions JSONB NOT NULL DEFAULT '{}',
    action_type VARCHAR(50) NOT NULL,
    action_config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_routing_rules_seller ON public.chat_routing_rules(seller_id);
ALTER TABLE public.chat_routing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sellers manage own routing rules"
ON public.chat_routing_rules FOR ALL
USING (seller_id = auth.uid());

-- 10. Multi-Channel Messages (Enterprise)
CREATE TABLE IF NOT EXISTS public.multi_channel_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE SET NULL,
    channel VARCHAR(50) NOT NULL,
    channel_message_id VARCHAR(255),
    sender_type VARCHAR(50) NOT NULL,
    sender_id VARCHAR(255),
    sender_name VARCHAR(255),
    content TEXT,
    attachments JSONB DEFAULT '[]',
    status VARCHAR(50) DEFAULT 'received',
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_multi_channel_messages_seller ON public.multi_channel_messages(seller_id);
CREATE INDEX IF NOT EXISTS idx_multi_channel_messages_conversation ON public.multi_channel_messages(conversation_id);
ALTER TABLE public.multi_channel_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sellers view own multi-channel messages"
ON public.multi_channel_messages FOR ALL
USING (seller_id = auth.uid());

-- Triggers
CREATE TRIGGER update_chat_agents_updated_at BEFORE UPDATE ON public.chat_agents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_chat_canned_responses_updated_at BEFORE UPDATE ON public.chat_canned_responses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_chatbot_flows_updated_at BEFORE UPDATE ON public.chatbot_flows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_chat_routing_rules_updated_at BEFORE UPDATE ON public.chat_routing_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
