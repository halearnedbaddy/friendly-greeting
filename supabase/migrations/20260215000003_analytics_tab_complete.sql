-- =====================================================
-- ANALYTICS TAB - Complete Implementation
-- Business Intelligence, Reporting, Forecasting & Insights
-- Uses store_id (stores) and seller_id from transactions
-- =====================================================

-- 1. Daily Analytics (aggregated per store per day)
CREATE TABLE IF NOT EXISTS public.daily_analytics (
    id BIGSERIAL PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    
    -- Revenue
    gross_revenue NUMERIC(12,2) DEFAULT 0,
    net_revenue NUMERIC(12,2) DEFAULT 0,
    refunds NUMERIC(12,2) DEFAULT 0,
    discount_total NUMERIC(12,2) DEFAULT 0,
    
    -- Orders
    order_count INTEGER DEFAULT 0,
    completed_orders INTEGER DEFAULT 0,
    cancelled_orders INTEGER DEFAULT 0,
    average_order_value NUMERIC(10,2) DEFAULT 0,
    
    -- Customers
    new_customers INTEGER DEFAULT 0,
    returning_customers INTEGER DEFAULT 0,
    unique_buyers INTEGER DEFAULT 0,
    
    -- Traffic (if tracked)
    page_views INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    sessions INTEGER DEFAULT 0,
    bounce_rate NUMERIC(5,2),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_analytics_store_date ON public.daily_analytics(store_id, date DESC);
ALTER TABLE public.daily_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can view daily analytics"
ON public.daily_analytics FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = daily_analytics.store_id AND s.seller_id = auth.uid()));

-- 2. Hourly Analytics (real-time)
CREATE TABLE IF NOT EXISTS public.hourly_analytics (
    id BIGSERIAL PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    hour SMALLINT NOT NULL CHECK (hour >= 0 AND hour <= 23),
    
    revenue NUMERIC(12,2) DEFAULT 0,
    order_count INTEGER DEFAULT 0,
    visitors INTEGER DEFAULT 0,
    sessions INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, date, hour)
);

CREATE INDEX IF NOT EXISTS idx_hourly_analytics_store ON public.hourly_analytics(store_id, date DESC, hour);
ALTER TABLE public.hourly_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can view hourly analytics"
ON public.hourly_analytics FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = hourly_analytics.store_id AND s.seller_id = auth.uid()));

-- 3. Product Analytics Daily
CREATE TABLE IF NOT EXISTS public.product_analytics_daily (
    id BIGSERIAL PRIMARY KEY,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    
    views INTEGER DEFAULT 0,
    unique_views INTEGER DEFAULT 0,
    add_to_cart_count INTEGER DEFAULT 0,
    purchase_count INTEGER DEFAULT 0,
    revenue NUMERIC(10,2) DEFAULT 0,
    
    view_to_cart_rate NUMERIC(5,2),
    cart_to_purchase_rate NUMERIC(5,2),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(product_id, date)
);

CREATE INDEX IF NOT EXISTS idx_product_analytics_daily_product ON public.product_analytics_daily(product_id, date DESC);
ALTER TABLE public.product_analytics_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can view product analytics daily"
ON public.product_analytics_daily FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.products p
        JOIN public.stores s ON p.store_id = s.id
        WHERE p.id = product_analytics_daily.product_id AND s.seller_id = auth.uid()
    )
);

-- 4. Customer Cohorts
CREATE TABLE IF NOT EXISTS public.customer_cohorts (
    id BIGSERIAL PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    cohort_date DATE NOT NULL,
    period_type VARCHAR(20) DEFAULT 'month',
    
    cohort_size INTEGER DEFAULT 0,
    retention_data JSONB DEFAULT '[]',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, cohort_date, period_type)
);

CREATE INDEX IF NOT EXISTS idx_customer_cohorts_store ON public.customer_cohorts(store_id, cohort_date DESC);
ALTER TABLE public.customer_cohorts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can view cohorts"
ON public.customer_cohorts FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = customer_cohorts.store_id AND s.seller_id = auth.uid()));

-- 5. Traffic Sources Daily
CREATE TABLE IF NOT EXISTS public.traffic_sources_daily (
    id BIGSERIAL PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    
    source VARCHAR(100) NOT NULL,
    medium VARCHAR(100),
    campaign VARCHAR(255),
    
    sessions INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    page_views INTEGER DEFAULT 0,
    bounce_rate NUMERIC(5,2),
    
    conversions INTEGER DEFAULT 0,
    conversion_value NUMERIC(12,2) DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_traffic_sources_unique ON public.traffic_sources_daily(store_id, date, source, COALESCE(medium, ''), COALESCE(campaign, ''));

CREATE INDEX IF NOT EXISTS idx_traffic_sources_store ON public.traffic_sources_daily(store_id, date DESC);
ALTER TABLE public.traffic_sources_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can view traffic"
ON public.traffic_sources_daily FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = traffic_sources_daily.store_id AND s.seller_id = auth.uid()));

-- 6. Sales Forecasts (ML predictions)
CREATE TABLE IF NOT EXISTS public.sales_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    
    forecast_type VARCHAR(50) DEFAULT 'revenue',
    horizon_days INTEGER NOT NULL,
    
    forecast_date DATE NOT NULL,
    predicted_value NUMERIC(12,2),
    lower_bound NUMERIC(12,2),
    upper_bound NUMERIC(12,2),
    confidence DECIMAL(5,4),
    
    model_version VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_forecasts_store ON public.sales_forecasts(store_id, forecast_date);
ALTER TABLE public.sales_forecasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can view forecasts"
ON public.sales_forecasts FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = sales_forecasts.store_id AND s.seller_id = auth.uid()));

-- 7. Custom Reports (Enterprise)
CREATE TABLE IF NOT EXISTS public.custom_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    report_config JSONB NOT NULL DEFAULT '{}',
    metrics JSONB DEFAULT '[]',
    dimensions JSONB DEFAULT '[]',
    filters JSONB DEFAULT '{}',
    
    schedule_cron VARCHAR(100),
    schedule_next_run TIMESTAMPTZ,
    recipients TEXT[],
    
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_reports_store ON public.custom_reports(store_id);
ALTER TABLE public.custom_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage custom reports"
ON public.custom_reports FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = custom_reports.store_id AND s.seller_id = auth.uid()));

-- 8. Automated Insights
CREATE TABLE IF NOT EXISTS public.automated_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    
    insight_type VARCHAR(100) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    
    severity VARCHAR(50) DEFAULT 'info',
    category VARCHAR(100),
    
    data JSONB,
    recommendation TEXT,
    
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    
    date_from DATE,
    date_to DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automated_insights_store ON public.automated_insights(store_id, created_at DESC);
ALTER TABLE public.automated_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage insights"
ON public.automated_insights FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = automated_insights.store_id AND s.seller_id = auth.uid()));

-- 9. Analytics Events (granular tracking)
CREATE TABLE IF NOT EXISTS public.analytics_events (
    id BIGSERIAL PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB,
    
    session_id VARCHAR(255),
    visitor_id VARCHAR(255),
    
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    page_url VARCHAR(500),
    
    source VARCHAR(100),
    medium VARCHAR(100),
    campaign VARCHAR(255),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_store ON public.analytics_events(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON public.analytics_events(event_type);
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can view analytics events"
ON public.analytics_events FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = analytics_events.store_id AND s.seller_id = auth.uid()));

-- 10. RFM Analysis
CREATE TABLE IF NOT EXISTS public.rfm_analysis (
    id BIGSERIAL PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    analysis_date DATE NOT NULL,
    
    segment_name VARCHAR(100),
    r_score SMALLINT,
    f_score SMALLINT,
    m_score SMALLINT,
    
    customer_count INTEGER DEFAULT 0,
    total_revenue NUMERIC(12,2) DEFAULT 0,
    avg_order_value NUMERIC(10,2) DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rfm_analysis_store ON public.rfm_analysis(store_id, analysis_date DESC);
ALTER TABLE public.rfm_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can view RFM"
ON public.rfm_analysis FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = rfm_analysis.store_id AND s.seller_id = auth.uid()));

-- 11. Conversion Funnels
CREATE TABLE IF NOT EXISTS public.conversion_funnels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    steps JSONB NOT NULL DEFAULT '[]',
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversion_funnels_store ON public.conversion_funnels(store_id);
ALTER TABLE public.conversion_funnels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage funnels"
ON public.conversion_funnels FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = conversion_funnels.store_id AND s.seller_id = auth.uid()));

-- 12. Funnel Performance Daily
CREATE TABLE IF NOT EXISTS public.funnel_performance_daily (
    id BIGSERIAL PRIMARY KEY,
    funnel_id UUID REFERENCES public.conversion_funnels(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    
    step_data JSONB NOT NULL DEFAULT '[]',
    conversion_rate NUMERIC(5,2),
    total_entered INTEGER DEFAULT 0,
    total_converted INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(funnel_id, date)
);

CREATE INDEX IF NOT EXISTS idx_funnel_performance_funnel ON public.funnel_performance_daily(funnel_id, date DESC);
ALTER TABLE public.funnel_performance_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can view funnel performance"
ON public.funnel_performance_daily FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.conversion_funnels cf
        JOIN public.stores s ON cf.store_id = s.id
        WHERE cf.id = funnel_performance_daily.funnel_id AND s.seller_id = auth.uid()
    )
);

-- 13. A/B Test Results
CREATE TABLE IF NOT EXISTS public.ab_test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    
    test_name VARCHAR(255) NOT NULL,
    variant_a VARCHAR(100),
    variant_b VARCHAR(100),
    
    metric VARCHAR(100),
    date_from DATE,
    date_to DATE,
    
    sample_size_a INTEGER DEFAULT 0,
    sample_size_b INTEGER DEFAULT 0,
    
    result_a NUMERIC(12,4),
    result_b NUMERIC(12,4),
    
    winner VARCHAR(50),
    confidence DECIMAL(5,4),
    p_value DECIMAL(10,6),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ab_test_results_store ON public.ab_test_results(store_id);
ALTER TABLE public.ab_test_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage AB tests"
ON public.ab_test_results FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = ab_test_results.store_id AND s.seller_id = auth.uid()));

-- Triggers
CREATE TRIGGER update_custom_reports_updated_at BEFORE UPDATE ON public.custom_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_conversion_funnels_updated_at BEFORE UPDATE ON public.conversion_funnels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
