-- =====================================================
-- MARKETING TAB - Complete Implementation
-- Email, SMS, Abandoned Cart, Discounts & Automation
-- Store-scoped (matches customers, segments)
-- =====================================================

-- 1. Email Campaigns
CREATE TABLE IF NOT EXISTS public.email_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    segment_id UUID REFERENCES public.customer_segments(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    preview_text VARCHAR(255),
    from_name VARCHAR(255) NOT NULL,
    from_email VARCHAR(255) NOT NULL,
    reply_to_email VARCHAR(255),
    html_content TEXT,
    plain_text_content TEXT,
    status VARCHAR(50) DEFAULT 'draft',
    recipient_count INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    open_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    bounce_count INTEGER DEFAULT 0,
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_store ON public.email_campaigns(store_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON public.email_campaigns(status);
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners manage email campaigns"
ON public.email_campaigns FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.seller_id = auth.uid()));

-- 2. Campaign Recipients
CREATE TABLE IF NOT EXISTS public.campaign_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    email VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    sent_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    bounced_at TIMESTAMPTZ,
    unsubscribed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON public.campaign_recipients(campaign_id);
ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners view campaign recipients"
ON public.campaign_recipients FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.email_campaigns ec
        JOIN public.stores s ON ec.store_id = s.id
        WHERE ec.id = campaign_id AND s.seller_id = auth.uid()
    )
);

-- 3. Abandoned Carts
CREATE TABLE IF NOT EXISTS public.abandoned_carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_email VARCHAR(255),
    customer_name VARCHAR(255),
    customer_phone VARCHAR(50),
    session_id VARCHAR(255),
    cart_items JSONB NOT NULL DEFAULT '[]',
    cart_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'KES',
    recovery_url TEXT,
    discount_code VARCHAR(100),
    discount_amount NUMERIC(10,2),
    discount_type VARCHAR(50),
    status VARCHAR(50) DEFAULT 'abandoned',
    email_sent_count INTEGER DEFAULT 0,
    last_recovery_sent_at TIMESTAMPTZ,
    abandoned_at TIMESTAMPTZ DEFAULT NOW(),
    recovered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_store ON public.abandoned_carts(store_id);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_status ON public.abandoned_carts(status);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_abandoned ON public.abandoned_carts(abandoned_at DESC);
ALTER TABLE public.abandoned_carts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners manage abandoned carts"
ON public.abandoned_carts FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.seller_id = auth.uid()));

-- 4. Discount Codes
CREATE TABLE IF NOT EXISTS public.discount_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    code VARCHAR(100) NOT NULL,
    description TEXT,
    discount_type VARCHAR(50) NOT NULL,
    discount_value NUMERIC(10,2) NOT NULL,
    applies_to VARCHAR(50) DEFAULT 'all',
    applies_to_ids UUID[] DEFAULT '{}',
    minimum_purchase_amount NUMERIC(12,2),
    usage_limit INTEGER,
    usage_limit_per_customer INTEGER DEFAULT 1,
    times_used INTEGER DEFAULT 0,
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    auto_apply BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, code)
);
CREATE INDEX IF NOT EXISTS idx_discount_codes_store ON public.discount_codes(store_id);
CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON public.discount_codes(store_id, code);
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners manage discount codes"
ON public.discount_codes FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.seller_id = auth.uid()));

-- 5. Discount Code Usage
CREATE TABLE IF NOT EXISTS public.discount_code_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discount_code_id UUID NOT NULL REFERENCES public.discount_codes(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    transaction_id UUID,
    order_id TEXT,
    discount_amount NUMERIC(10,2),
    used_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_discount_usage_code ON public.discount_code_usage(discount_code_id);
ALTER TABLE public.discount_code_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners view discount usage"
ON public.discount_code_usage FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.discount_codes dc
        JOIN public.stores s ON dc.store_id = s.id
        WHERE dc.id = discount_code_id AND s.seller_id = auth.uid()
    )
);

-- 6. Marketing Workflows (Automation)
CREATE TABLE IF NOT EXISTS public.marketing_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(50) NOT NULL,
    trigger_config JSONB DEFAULT '{}',
    steps JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_marketing_workflows_store ON public.marketing_workflows(store_id);
ALTER TABLE public.marketing_workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners manage workflows"
ON public.marketing_workflows FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.seller_id = auth.uid()));

-- 7. Marketing Settings (per store)
CREATE TABLE IF NOT EXISTS public.marketing_settings (
    store_id UUID PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
    abandoned_cart_recovery_enabled BOOLEAN DEFAULT true,
    abandoned_cart_delay_minutes INTEGER DEFAULT 60,
    abandoned_cart_max_emails INTEGER DEFAULT 3,
    abandoned_cart_discount_percent INTEGER DEFAULT 10,
    sms_enabled BOOLEAN DEFAULT false,
    email_from_default VARCHAR(255),
    email_reply_to_default VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.marketing_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners manage marketing settings"
ON public.marketing_settings FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.seller_id = auth.uid()));

-- 8. SMS Campaigns (Business+)
CREATE TABLE IF NOT EXISTS public.sms_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    segment_id UUID REFERENCES public.customer_segments(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'draft',
    recipient_count INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sms_campaigns_store ON public.sms_campaigns(store_id);
ALTER TABLE public.sms_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners manage SMS campaigns"
ON public.sms_campaigns FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.seller_id = auth.uid()));

-- 9. Referral Programs
CREATE TABLE IF NOT EXISTS public.referral_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    referrer_reward_type VARCHAR(50) DEFAULT 'percentage',
    referrer_reward_value NUMERIC(10,2) DEFAULT 0,
    referee_reward_type VARCHAR(50) DEFAULT 'percentage',
    referee_reward_value NUMERIC(10,2) DEFAULT 0,
    min_purchase_amount NUMERIC(12,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_referral_programs_store ON public.referral_programs(store_id);
ALTER TABLE public.referral_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners manage referral programs"
ON public.referral_programs FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.seller_id = auth.uid()));

-- Triggers
CREATE TRIGGER update_email_campaigns_updated_at BEFORE UPDATE ON public.email_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_abandoned_carts_updated_at BEFORE UPDATE ON public.abandoned_carts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_discount_codes_updated_at BEFORE UPDATE ON public.discount_codes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_marketing_workflows_updated_at BEFORE UPDATE ON public.marketing_workflows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
