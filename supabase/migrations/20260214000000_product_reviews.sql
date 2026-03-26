-- =====================================================
-- PRODUCT REVIEWS - Complete Schema
-- Adapted for PayLoom: transactions (not orders), profiles (not customers)
-- =====================================================

-- Reviews Table
CREATE TABLE IF NOT EXISTS public.product_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    order_id TEXT REFERENCES public.transactions(id) ON DELETE SET NULL,
    seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

    -- Review content
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(255),
    content TEXT NOT NULL CHECK (char_length(content) >= 10),

    -- Media
    images JSONB DEFAULT '[]',
    video_url VARCHAR(500),

    -- Verification
    is_verified_purchase BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,

    -- Status
    status VARCHAR(50) DEFAULT 'pending',
    moderation_status VARCHAR(50) DEFAULT 'pending',
    is_published BOOLEAN DEFAULT FALSE,

    -- Seller response
    seller_response TEXT,
    seller_responded_at TIMESTAMPTZ,
    seller_responder_id UUID REFERENCES auth.users(id),

    -- Analytics
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,
    report_count INTEGER DEFAULT 0,

    -- Metadata
    customer_name VARCHAR(255),
    customer_location VARCHAR(255),
    purchase_date DATE,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reviews_product ON public.product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_customer ON public.product_reviews(customer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_seller ON public.product_reviews(seller_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON public.product_reviews(status);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON public.product_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_created ON public.product_reviews(created_at DESC);

ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

-- RLS: Sellers see their reviews; public sees approved reviews for products
CREATE POLICY "Sellers can manage their product reviews"
ON public.product_reviews FOR ALL
USING (seller_id = auth.uid());

CREATE POLICY "Public can view approved published reviews"
ON public.product_reviews FOR SELECT
USING (status = 'approved' AND is_published = true);

CREATE POLICY "Buyers can insert reviews (customer_id must match auth)"
ON public.product_reviews FOR INSERT
WITH CHECK (customer_id = auth.uid());

-- Review Helpfulness
CREATE TABLE IF NOT EXISTS public.review_helpfulness (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES public.product_reviews(id) ON DELETE CASCADE,
    user_id TEXT,
    is_helpful BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Prevent duplicate votes per user (user_id null = anonymous, can vote once per review via app logic)
CREATE UNIQUE INDEX IF NOT EXISTS idx_review_helpfulness_unique ON public.review_helpfulness(review_id, user_id) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_review_helpfulness_review ON public.review_helpfulness(review_id);
ALTER TABLE public.review_helpfulness ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view review helpfulness"
ON public.review_helpfulness FOR SELECT USING (true);

CREATE POLICY "Authenticated users can mark helpful"
ON public.review_helpfulness FOR ALL
USING (true)
WITH CHECK (true);

-- Review Reports
CREATE TABLE IF NOT EXISTS public.review_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES public.product_reviews(id) ON DELETE CASCADE,
    reporter_id UUID REFERENCES auth.users(id),
    reason VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_reports_review ON public.review_reports(review_id);
CREATE INDEX IF NOT EXISTS idx_review_reports_status ON public.review_reports(status);
ALTER TABLE public.review_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can report reviews"
ON public.review_reports FOR INSERT WITH CHECK (true);

CREATE POLICY "Sellers can view reports for their reviews"
ON public.review_reports FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.product_reviews pr
    WHERE pr.id = review_reports.review_id AND pr.seller_id = auth.uid()
  )
);

-- Review Requests
CREATE TABLE IF NOT EXISTS public.review_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    order_id TEXT NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES auth.users(id),
    product_ids JSONB NOT NULL DEFAULT '[]',

    request_type VARCHAR(50) DEFAULT 'email',
    sent_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,

    incentive_type VARCHAR(50),
    incentive_value VARCHAR(100),
    incentive_claimed BOOLEAN DEFAULT FALSE,

    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_requests_seller ON public.review_requests(seller_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_order ON public.review_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_status ON public.review_requests(status);
ALTER TABLE public.review_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers manage their review requests"
ON public.review_requests FOR ALL
USING (seller_id = auth.uid());

-- Seller review settings (for auto-approve, auto-request)
CREATE TABLE IF NOT EXISTS public.seller_review_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    review_auto_approve_enabled BOOLEAN DEFAULT FALSE,
    review_auto_approve_min_rating INTEGER DEFAULT 4,
    review_auto_request_enabled BOOLEAN DEFAULT FALSE,
    review_auto_request_delay_days INTEGER DEFAULT 7,
    review_auto_request_method VARCHAR(20) DEFAULT 'email',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seller_review_settings_seller ON public.seller_review_settings(seller_id);
ALTER TABLE public.seller_review_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers manage their review settings"
ON public.seller_review_settings FOR ALL
USING (seller_id = auth.uid());

-- Triggers
CREATE TRIGGER update_product_reviews_updated_at
  BEFORE UPDATE ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_seller_review_settings_updated_at
  BEFORE UPDATE ON public.seller_review_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
