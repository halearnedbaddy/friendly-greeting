-- =====================================================
-- SUPPORT TAB - Complete Implementation
-- Help Center, Ticketing, Account Manager & Knowledge Base
-- Extends existing support_tickets, adds new tables
-- =====================================================

-- 1. Extend support_tickets with additional columns
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS ticket_number VARCHAR(50);
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS subcategory VARCHAR(100);
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS satisfaction_rating INTEGER CHECK (satisfaction_rating IS NULL OR (satisfaction_rating >= 1 AND satisfaction_rating <= 5));
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS satisfaction_comment TEXT;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]';
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS response_sla_minutes INTEGER;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS response_due_at TIMESTAMPTZ;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS resolution_sla_hours INTEGER;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS resolution_due_at TIMESTAMPTZ;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- Backfill ticket_number for existing rows
UPDATE public.support_tickets SET ticket_number = 'TKT-' || UPPER(SUBSTRING(id::text, 1, 8)) WHERE ticket_number IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_support_tickets_number ON public.support_tickets(ticket_number) WHERE ticket_number IS NOT NULL;

-- 2. Extend support_messages
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS sender_type VARCHAR(50);
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS sender_name VARCHAR(255);
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]';
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT false;
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- 3. Account Managers (admin-managed)
CREATE TABLE IF NOT EXISTS public.account_managers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    title VARCHAR(100),
    avatar_url VARCHAR(500),
    bio TEXT,
    expertise TEXT[] DEFAULT '{}',
    timezone VARCHAR(100) DEFAULT 'America/New_York',
    working_hours JSONB,
    total_clients INTEGER DEFAULT 0,
    active_clients INTEGER DEFAULT 0,
    avg_satisfaction_rating NUMERIC(3,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_account_managers_active ON public.account_managers(is_active);
ALTER TABLE public.account_managers ENABLE ROW LEVEL SECURITY;

-- 4. Seller Account Manager Assignments
CREATE TABLE IF NOT EXISTS public.seller_account_managers (
    seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    account_manager_id UUID REFERENCES public.account_managers(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by UUID REFERENCES auth.users(id),
    is_active BOOLEAN DEFAULT true,
    PRIMARY KEY (seller_id, account_manager_id)
);
CREATE INDEX IF NOT EXISTS idx_seller_account_managers_seller ON public.seller_account_managers(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_account_managers_manager ON public.seller_account_managers(account_manager_id);
ALTER TABLE public.seller_account_managers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sellers view own assignment"
ON public.seller_account_managers FOR SELECT
USING (seller_id = auth.uid());

CREATE POLICY "Account managers viewable by assigned sellers"
ON public.account_managers FOR SELECT
USING (
    EXISTS (SELECT 1 FROM public.seller_account_managers sam WHERE sam.account_manager_id = account_managers.id AND sam.seller_id = auth.uid())
);

-- 5. Account Manager Meetings
CREATE TABLE IF NOT EXISTS public.account_manager_meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    account_manager_id UUID REFERENCES public.account_managers(id) ON DELETE CASCADE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    meeting_type VARCHAR(50) DEFAULT 'check_in',
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    meeting_url VARCHAR(500),
    meeting_password VARCHAR(100),
    status VARCHAR(50) DEFAULT 'scheduled',
    agenda TEXT,
    notes TEXT,
    action_items JSONB,
    seller_attended BOOLEAN,
    manager_attended BOOLEAN,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_account_manager_meetings_seller ON public.account_manager_meetings(seller_id);
CREATE INDEX IF NOT EXISTS idx_account_manager_meetings_manager ON public.account_manager_meetings(account_manager_id);
CREATE INDEX IF NOT EXISTS idx_account_manager_meetings_scheduled ON public.account_manager_meetings(scheduled_at);
ALTER TABLE public.account_manager_meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sellers view own meetings"
ON public.account_manager_meetings FOR ALL
USING (seller_id = auth.uid());

-- 6. Knowledge Base Articles (platform-wide, no RLS for public read)
CREATE TABLE IF NOT EXISTS public.kb_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(500) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    excerpt TEXT,
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100),
    tags TEXT[] DEFAULT '{}',
    difficulty VARCHAR(50) DEFAULT 'beginner',
    featured_image_url VARCHAR(500),
    video_url VARCHAR(500),
    meta_title VARCHAR(255),
    meta_description TEXT,
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    related_article_ids UUID[] DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'draft',
    published_at TIMESTAMPTZ,
    author_id UUID REFERENCES auth.users(id),
    author_name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_articles_category ON public.kb_articles(category);
CREATE INDEX IF NOT EXISTS idx_kb_articles_status ON public.kb_articles(status);
CREATE INDEX IF NOT EXISTS idx_kb_articles_slug ON public.kb_articles(slug);
CREATE INDEX IF NOT EXISTS idx_kb_articles_published ON public.kb_articles(published_at DESC NULLS LAST);
ALTER TABLE public.kb_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view published KB articles"
ON public.kb_articles FOR SELECT
USING (status = 'published');

-- 7. Support Chat Sessions
CREATE TABLE IF NOT EXISTS public.support_chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    session_type VARCHAR(50) DEFAULT 'text',
    agent_id UUID REFERENCES auth.users(id),
    agent_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'waiting',
    queue_position INTEGER,
    estimated_wait_time INTEGER,
    meeting_url VARCHAR(500),
    meeting_started_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    rating INTEGER CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
    feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_chat_sessions_seller ON public.support_chat_sessions(seller_id);
CREATE INDEX IF NOT EXISTS idx_support_chat_sessions_status ON public.support_chat_sessions(status);
ALTER TABLE public.support_chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sellers manage own chat sessions"
ON public.support_chat_sessions FOR ALL
USING (seller_id = auth.uid());

-- 8. Support Chat Messages
CREATE TABLE IF NOT EXISTS public.support_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES public.support_chat_sessions(id) ON DELETE CASCADE NOT NULL,
    sender_type VARCHAR(50) NOT NULL,
    sender_id UUID REFERENCES auth.users(id),
    sender_name VARCHAR(255),
    message TEXT NOT NULL,
    attachments JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_chat_messages_session ON public.support_chat_messages(session_id);
ALTER TABLE public.support_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sellers view own chat messages"
ON public.support_chat_messages FOR ALL
USING (
    EXISTS (SELECT 1 FROM public.support_chat_sessions s WHERE s.id = session_id AND s.seller_id = auth.uid())
);

-- 9. Support Resources
CREATE TABLE IF NOT EXISTS public.support_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    resource_type VARCHAR(50) NOT NULL,
    url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500),
    duration_minutes INTEGER,
    category VARCHAR(100),
    tags TEXT[] DEFAULT '{}',
    required_tier VARCHAR(50),
    view_count INTEGER DEFAULT 0,
    completion_count INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_resources_category ON public.support_resources(category);
CREATE INDEX IF NOT EXISTS idx_support_resources_type ON public.support_resources(resource_type);
ALTER TABLE public.support_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view published resources"
ON public.support_resources FOR SELECT
USING (is_published = true);

-- 10. Onboarding Checklist
CREATE TABLE IF NOT EXISTS public.onboarding_checklists (
    seller_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    completed_steps JSONB DEFAULT '[]',
    total_steps INTEGER DEFAULT 10,
    completion_percentage INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.onboarding_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sellers manage own checklist"
ON public.onboarding_checklists FOR ALL
USING (seller_id = auth.uid());

-- 11. Support Feedback
CREATE TABLE IF NOT EXISTS public.support_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    reference_type VARCHAR(50),
    reference_id UUID,
    rating INTEGER CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
    feedback_type VARCHAR(50),
    comment TEXT,
    feedback_category VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_feedback_seller ON public.support_feedback(seller_id);
ALTER TABLE public.support_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sellers can insert own feedback"
ON public.support_feedback FOR INSERT
WITH CHECK (seller_id = auth.uid());

-- 12. System Status (platform status page)
CREATE TABLE IF NOT EXISTS public.system_status (
    id SERIAL PRIMARY KEY,
    component_name VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    incident_title VARCHAR(500),
    incident_description TEXT,
    started_at TIMESTAMPTZ NOT NULL,
    resolved_at TIMESTAMPTZ,
    updates JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_system_status_component ON public.system_status(component_name);
CREATE INDEX IF NOT EXISTS idx_system_status_status ON public.system_status(status);
ALTER TABLE public.system_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view system status"
ON public.system_status FOR SELECT
USING (true);

-- Triggers
CREATE TRIGGER update_account_managers_updated_at BEFORE UPDATE ON public.account_managers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_account_manager_meetings_updated_at BEFORE UPDATE ON public.account_manager_meetings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_kb_articles_updated_at BEFORE UPDATE ON public.kb_articles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_support_resources_updated_at BEFORE UPDATE ON public.support_resources FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_onboarding_checklists_updated_at BEFORE UPDATE ON public.onboarding_checklists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
