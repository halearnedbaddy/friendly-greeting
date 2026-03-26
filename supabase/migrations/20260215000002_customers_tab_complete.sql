-- =====================================================
-- CUSTOMERS TAB - Complete Implementation
-- CRM, Segmentation, Loyalty Programs & Analytics
-- Adapted for store_id (customers per store)
-- =====================================================

-- 1. Customers (per store - buyers who transacted or were added manually)
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Linked auth user if registered
    
    email VARCHAR(255),
    phone VARCHAR(50),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    
    email_verified BOOLEAN DEFAULT false,
    phone_verified BOOLEAN DEFAULT false,
    addresses JSONB DEFAULT '[]',
    default_shipping_address JSONB,
    default_billing_address JSONB,
    
    marketing_consent BOOLEAN DEFAULT false,
    sms_consent BOOLEAN DEFAULT false,
    language VARCHAR(10) DEFAULT 'en',
    currency VARCHAR(3) DEFAULT 'KES',
    
    total_spent NUMERIC(12,2) DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    average_order_value NUMERIC(10,2) DEFAULT 0,
    
    last_order_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    last_email_opened_at TIMESTAMPTZ,
    last_email_clicked_at TIMESTAMPTZ,
    
    tags TEXT[] DEFAULT '{}',
    notes TEXT,
    customer_since TIMESTAMPTZ DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'active',
    
    source VARCHAR(100),
    utm_source VARCHAR(255),
    utm_medium VARCHAR(255),
    utm_campaign VARCHAR(255),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT customers_email_or_phone CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_store_email ON public.customers(store_id, email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_store ON public.customers(store_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_tags ON public.customers USING GIN(tags) WHERE tags IS NOT NULL AND array_length(tags, 1) > 0;
CREATE INDEX IF NOT EXISTS idx_customers_total_spent ON public.customers(total_spent DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_customers_created ON public.customers(created_at DESC);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage customers"
ON public.customers FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = customers.store_id AND s.seller_id = auth.uid()));

-- 2. Customer Segments
CREATE TABLE IF NOT EXISTS public.customer_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    segment_type VARCHAR(50) DEFAULT 'custom',
    conditions JSONB NOT NULL DEFAULT '{}',
    is_dynamic BOOLEAN DEFAULT true,
    customer_count INTEGER DEFAULT 0,
    last_calculated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customer_segments_store ON public.customer_segments(store_id);
CREATE INDEX IF NOT EXISTS idx_customer_segments_type ON public.customer_segments(segment_type);

ALTER TABLE public.customer_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage segments"
ON public.customer_segments FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = customer_segments.store_id AND s.seller_id = auth.uid()));

-- 3. Customer Segment Membership
CREATE TABLE IF NOT EXISTS public.customer_segment_members (
    segment_id UUID REFERENCES public.customer_segments(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (segment_id, customer_id)
);
CREATE INDEX IF NOT EXISTS idx_segment_members_segment ON public.customer_segment_members(segment_id);
CREATE INDEX IF NOT EXISTS idx_segment_members_customer ON public.customer_segment_members(customer_id);

ALTER TABLE public.customer_segment_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage segment members"
ON public.customer_segment_members FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.customer_segments cs
        JOIN public.stores s ON cs.store_id = s.id
        WHERE cs.id = customer_segment_members.segment_id AND s.seller_id = auth.uid()
    )
);

-- 4. Customer LTV Predictions
CREATE TABLE IF NOT EXISTS public.customer_ltv_predictions (
    customer_id UUID PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
    predicted_ltv_30d NUMERIC(10,2),
    predicted_ltv_90d NUMERIC(10,2),
    predicted_ltv_365d NUMERIC(10,2),
    churn_probability NUMERIC(5,4),
    churn_risk VARCHAR(50),
    predicted_next_purchase_days INTEGER,
    predicted_next_purchase_date DATE,
    ltv_confidence NUMERIC(5,4),
    churn_confidence NUMERIC(5,4),
    model_version VARCHAR(50),
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ltv_predictions_risk ON public.customer_ltv_predictions(churn_risk);
CREATE INDEX IF NOT EXISTS idx_ltv_predictions_value ON public.customer_ltv_predictions(predicted_ltv_365d DESC NULLS LAST);

ALTER TABLE public.customer_ltv_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can view LTV predictions"
ON public.customer_ltv_predictions FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.customers c
        JOIN public.stores s ON c.store_id = s.id
        WHERE c.id = customer_ltv_predictions.customer_id AND s.seller_id = auth.uid()
    )
);

-- 5. Customer Activity Log
CREATE TABLE IF NOT EXISTS public.customer_activity_log (
    id BIGSERIAL PRIMARY KEY,
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
    activity_type VARCHAR(100) NOT NULL,
    activity_data JSONB,
    session_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customer_activity_customer ON public.customer_activity_log(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_activity_type ON public.customer_activity_log(activity_type);
CREATE INDEX IF NOT EXISTS idx_customer_activity_created ON public.customer_activity_log(created_at DESC);

ALTER TABLE public.customer_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can view customer activity"
ON public.customer_activity_log FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.customers c
        JOIN public.stores s ON c.store_id = s.id
        WHERE c.id = customer_activity_log.customer_id AND s.seller_id = auth.uid()
    )
);

-- 6. Customer Tags
CREATE TABLE IF NOT EXISTS public.customer_tags (
    id SERIAL PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    color VARCHAR(7),
    description TEXT,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_customer_tags_store ON public.customer_tags(store_id);

ALTER TABLE public.customer_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage customer tags"
ON public.customer_tags FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = customer_tags.store_id AND s.seller_id = auth.uid()));

-- 7. Loyalty Programs
CREATE TABLE IF NOT EXISTS public.loyalty_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    points_per_dollar NUMERIC(5,2) DEFAULT 1.00,
    welcome_bonus_points INTEGER DEFAULT 0,
    birthday_bonus_points INTEGER DEFAULT 0,
    referral_points INTEGER DEFAULT 0,
    review_points INTEGER DEFAULT 0,
    points_value NUMERIC(5,4),
    minimum_redemption_points INTEGER DEFAULT 100,
    tiers JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_loyalty_programs_store ON public.loyalty_programs(store_id);

ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage loyalty programs"
ON public.loyalty_programs FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = loyalty_programs.store_id AND s.seller_id = auth.uid()));

-- 8. Customer Loyalty Accounts
CREATE TABLE IF NOT EXISTS public.customer_loyalty_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    points_balance INTEGER DEFAULT 0,
    lifetime_points_earned INTEGER DEFAULT 0,
    lifetime_points_redeemed INTEGER DEFAULT 0,
    current_tier VARCHAR(100),
    tier_progress_percentage NUMERIC(5,2),
    tier_qualifying_spend NUMERIC(12,2) DEFAULT 0,
    tier_period_start DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(customer_id, store_id)
);
CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_customer ON public.customer_loyalty_accounts(customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_store ON public.customer_loyalty_accounts(store_id);

ALTER TABLE public.customer_loyalty_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage loyalty accounts"
ON public.customer_loyalty_accounts FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = customer_loyalty_accounts.store_id AND s.seller_id = auth.uid()));

-- 9. Loyalty Points Transactions
CREATE TABLE IF NOT EXISTS public.loyalty_points_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loyalty_account_id UUID REFERENCES public.customer_loyalty_accounts(id) ON DELETE CASCADE NOT NULL,
    points INTEGER NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    reason VARCHAR(255),
    reference_type VARCHAR(50),
    reference_id UUID,
    balance_after INTEGER,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_account ON public.loyalty_points_transactions(loyalty_account_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_created ON public.loyalty_points_transactions(created_at DESC);

ALTER TABLE public.loyalty_points_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can view loyalty transactions"
ON public.loyalty_points_transactions FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.customer_loyalty_accounts la
        JOIN public.stores s ON la.store_id = s.id
        WHERE la.id = loyalty_points_transactions.loyalty_account_id AND s.seller_id = auth.uid()
    )
);

-- 10. Customer Communications
CREATE TABLE IF NOT EXISTS public.customer_communications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    type VARCHAR(50) NOT NULL,
    subject VARCHAR(500),
    content TEXT,
    campaign_id UUID,
    template_id UUID,
    status VARCHAR(50) DEFAULT 'sent',
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    provider VARCHAR(50),
    provider_message_id VARCHAR(255),
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customer_communications_customer ON public.customer_communications(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_communications_store ON public.customer_communications(store_id);
CREATE INDEX IF NOT EXISTS idx_customer_communications_type ON public.customer_communications(type);

ALTER TABLE public.customer_communications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage communications"
ON public.customer_communications FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = customer_communications.store_id AND s.seller_id = auth.uid()));

-- 11. Customer Referrals
CREATE TABLE IF NOT EXISTS public.customer_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    referrer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    referee_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    referral_code VARCHAR(50),
    referral_link VARCHAR(500),
    status VARCHAR(50) DEFAULT 'pending',
    referrer_reward_type VARCHAR(50),
    referrer_reward_value VARCHAR(100),
    referee_reward_type VARCHAR(50),
    referee_reward_value VARCHAR(100),
    referred_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    rewarded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customer_referrals_store ON public.customer_referrals(store_id);
CREATE INDEX IF NOT EXISTS idx_customer_referrals_referrer ON public.customer_referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_customer_referrals_code ON public.customer_referrals(referral_code);

ALTER TABLE public.customer_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage referrals"
ON public.customer_referrals FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = customer_referrals.store_id AND s.seller_id = auth.uid()));

-- Triggers
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_customer_segments_updated_at BEFORE UPDATE ON public.customer_segments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_loyalty_programs_updated_at BEFORE UPDATE ON public.loyalty_programs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_customer_loyalty_accounts_updated_at BEFORE UPDATE ON public.customer_loyalty_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
