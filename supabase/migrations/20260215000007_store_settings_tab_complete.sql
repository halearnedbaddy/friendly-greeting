-- =====================================================
-- STORE SETTINGS TAB - Complete Implementation
-- Configuration, Customization, Integrations & Domain
-- Uses store_id (per store)
-- =====================================================

-- 1. Store Settings (general configuration)
CREATE TABLE IF NOT EXISTS public.store_settings (
    store_id UUID PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
    store_description TEXT,
    store_tagline VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    support_email VARCHAR(255),
    business_address_line1 VARCHAR(255),
    business_address_line2 VARCHAR(255),
    business_city VARCHAR(100),
    business_state VARCHAR(100),
    business_postal_code VARCHAR(20),
    business_country VARCHAR(100) DEFAULT 'US',
    business_type VARCHAR(50),
    tax_id VARCHAR(50),
    timezone VARCHAR(100) DEFAULT 'America/New_York',
    default_currency VARCHAR(3) DEFAULT 'USD',
    default_language VARCHAR(10) DEFAULT 'en',
    weight_unit VARCHAR(10) DEFAULT 'kg',
    dimension_unit VARCHAR(10) DEFAULT 'cm',
    checkout_require_account BOOLEAN DEFAULT FALSE,
    checkout_guest_allowed BOOLEAN DEFAULT TRUE,
    inventory_tracking_enabled BOOLEAN DEFAULT TRUE,
    inventory_low_stock_notifications BOOLEAN DEFAULT TRUE,
    order_prefix VARCHAR(20) DEFAULT 'ORD',
    order_number_start INTEGER DEFAULT 1000,
    email_from_name VARCHAR(255),
    email_from_address VARCHAR(255),
    maintenance_mode BOOLEAN DEFAULT FALSE,
    maintenance_message TEXT,
    gdpr_enabled BOOLEAN DEFAULT FALSE,
    cookie_consent_enabled BOOLEAN DEFAULT TRUE,
    custom_settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage store_settings"
ON public.store_settings FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_settings.store_id AND s.seller_id = auth.uid()));

-- 2. Store Themes (branding)
CREATE TABLE IF NOT EXISTS public.store_themes (
    store_id UUID PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
    primary_color VARCHAR(7) DEFAULT '#3B82F6',
    secondary_color VARCHAR(7) DEFAULT '#6B7280',
    accent_color VARCHAR(7) DEFAULT '#10B981',
    background_color VARCHAR(7) DEFAULT '#FFFFFF',
    text_color VARCHAR(7) DEFAULT '#111827',
    font_family_heading VARCHAR(100) DEFAULT 'Inter',
    font_family_body VARCHAR(100) DEFAULT 'Inter',
    layout_style VARCHAR(50) DEFAULT 'modern',
    header_style VARCHAR(50) DEFAULT 'centered',
    product_card_style VARCHAR(50) DEFAULT 'card',
    custom_css TEXT,
    favicon_url VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.store_themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage store_themes"
ON public.store_themes FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_themes.store_id AND s.seller_id = auth.uid()));

-- 3. Custom Domains
CREATE TABLE IF NOT EXISTS public.custom_domains (
    id SERIAL PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    domain VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100),
    is_primary BOOLEAN DEFAULT FALSE,
    dns_verified BOOLEAN DEFAULT FALSE,
    dns_verification_token VARCHAR(255),
    dns_records JSONB,
    ssl_enabled BOOLEAN DEFAULT FALSE,
    ssl_status VARCHAR(50) DEFAULT 'pending',
    status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    redirect_to_https BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    verified_at TIMESTAMPTZ,
    UNIQUE(store_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_custom_domains_store ON public.custom_domains(store_id);

ALTER TABLE public.custom_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage custom_domains"
ON public.custom_domains FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = custom_domains.store_id AND s.seller_id = auth.uid()));

-- 4. SEO Settings
CREATE TABLE IF NOT EXISTS public.seo_settings (
    store_id UUID PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
    meta_title VARCHAR(255),
    meta_description TEXT,
    meta_keywords TEXT[],
    og_title VARCHAR(255),
    og_description TEXT,
    og_image_url VARCHAR(500),
    og_type VARCHAR(50) DEFAULT 'website',
    twitter_card_type VARCHAR(50) DEFAULT 'summary_large_image',
    google_analytics_id VARCHAR(100),
    google_tag_manager_id VARCHAR(100),
    facebook_pixel_id VARCHAR(100),
    google_site_verification VARCHAR(255),
    sitemap_enabled BOOLEAN DEFAULT TRUE,
    robots_txt TEXT,
    noindex BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.seo_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage seo_settings"
ON public.seo_settings FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = seo_settings.store_id AND s.seller_id = auth.uid()));

-- 5. Payment Settings (store-level)
CREATE TABLE IF NOT EXISTS public.payment_settings (
    store_id UUID PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
    stripe_account_id VARCHAR(255),
    stripe_account_status VARCHAR(50),
    payment_currency VARCHAR(3) DEFAULT 'USD',
    accepted_payment_methods JSONB DEFAULT '["card"]',
    bank_transfer_enabled BOOLEAN DEFAULT FALSE,
    bank_transfer_instructions TEXT,
    cash_on_delivery_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage payment_settings"
ON public.payment_settings FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = payment_settings.store_id AND s.seller_id = auth.uid()));

-- 6. Shipping Settings
CREATE TABLE IF NOT EXISTS public.shipping_settings (
    store_id UUID PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
    origin_address_line1 VARCHAR(255),
    origin_city VARCHAR(100),
    origin_state VARCHAR(100),
    origin_postal_code VARCHAR(20),
    origin_country VARCHAR(100) DEFAULT 'US',
    free_shipping_enabled BOOLEAN DEFAULT FALSE,
    free_shipping_threshold NUMERIC(10,2),
    flat_rate_enabled BOOLEAN DEFAULT FALSE,
    flat_rate_amount NUMERIC(10,2),
    flat_rate_name VARCHAR(255) DEFAULT 'Standard Shipping',
    local_pickup_enabled BOOLEAN DEFAULT FALSE,
    local_pickup_instructions TEXT,
    international_shipping_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.shipping_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage shipping_settings"
ON public.shipping_settings FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = shipping_settings.store_id AND s.seller_id = auth.uid()));

-- 7. Shipping Zones
CREATE TABLE IF NOT EXISTS public.shipping_zones (
    id SERIAL PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    countries TEXT[],
    states TEXT[],
    rates JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipping_zones_store ON public.shipping_zones(store_id);

ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage shipping_zones"
ON public.shipping_zones FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = shipping_zones.store_id AND s.seller_id = auth.uid()));

-- 8. Tax Settings
CREATE TABLE IF NOT EXISTS public.tax_settings (
    store_id UUID PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
    tax_calculation_method VARCHAR(50) DEFAULT 'automatic',
    taxjar_enabled BOOLEAN DEFAULT FALSE,
    taxjar_api_token VARCHAR(255),
    prices_include_tax BOOLEAN DEFAULT FALSE,
    display_prices_with_tax BOOLEAN DEFAULT FALSE,
    vat_number VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tax_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage tax_settings"
ON public.tax_settings FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = tax_settings.store_id AND s.seller_id = auth.uid()));

-- 9. Tax Rates (manual)
CREATE TABLE IF NOT EXISTS public.tax_rates (
    id SERIAL PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    country VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    rate NUMERIC(5,4) NOT NULL,
    tax_type VARCHAR(50) DEFAULT 'sales_tax',
    applies_to_shipping BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tax_rates_store ON public.tax_rates(store_id);

ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage tax_rates"
ON public.tax_rates FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = tax_rates.store_id AND s.seller_id = auth.uid()));

-- 10. Store Integrations
CREATE TABLE IF NOT EXISTS public.store_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    integration_type VARCHAR(100) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    api_key VARCHAR(255),
    config JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'active',
    last_sync_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, integration_type)
);

CREATE INDEX IF NOT EXISTS idx_store_integrations_store ON public.store_integrations(store_id);

ALTER TABLE public.store_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage store_integrations"
ON public.store_integrations FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_integrations.store_id AND s.seller_id = auth.uid()));

-- 11. Email Templates
CREATE TABLE IF NOT EXISTS public.email_templates (
    id SERIAL PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    template_type VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    html_body TEXT NOT NULL,
    text_body TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_templates_store ON public.email_templates(store_id);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage email_templates"
ON public.email_templates FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = email_templates.store_id AND s.seller_id = auth.uid()));

-- 12. Legal Pages
CREATE TABLE IF NOT EXISTS public.legal_pages (
    id SERIAL PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    page_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    slug VARCHAR(100) NOT NULL,
    meta_description TEXT,
    is_published BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    UNIQUE(store_id, page_type)
);

CREATE INDEX IF NOT EXISTS idx_legal_pages_store ON public.legal_pages(store_id);

ALTER TABLE public.legal_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage legal_pages"
ON public.legal_pages FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = legal_pages.store_id AND s.seller_id = auth.uid()));

-- 13. Webhook Subscriptions
CREATE TABLE IF NOT EXISTS public.webhook_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    url VARCHAR(500) NOT NULL,
    events TEXT[] NOT NULL,
    secret VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    total_deliveries INTEGER DEFAULT 0,
    successful_deliveries INTEGER DEFAULT 0,
    failed_deliveries INTEGER DEFAULT 0,
    last_delivery_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_store ON public.webhook_subscriptions(store_id);

ALTER TABLE public.webhook_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage webhook_subscriptions"
ON public.webhook_subscriptions FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = webhook_subscriptions.store_id AND s.seller_id = auth.uid()));

-- Triggers
CREATE TRIGGER update_store_settings_updated_at BEFORE UPDATE ON public.store_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_store_themes_updated_at BEFORE UPDATE ON public.store_themes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_custom_domains_updated_at BEFORE UPDATE ON public.custom_domains FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_seo_settings_updated_at BEFORE UPDATE ON public.seo_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_payment_settings_updated_at BEFORE UPDATE ON public.payment_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_shipping_settings_updated_at BEFORE UPDATE ON public.shipping_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_shipping_zones_updated_at BEFORE UPDATE ON public.shipping_zones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_tax_settings_updated_at BEFORE UPDATE ON public.tax_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_tax_rates_updated_at BEFORE UPDATE ON public.tax_rates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_store_integrations_updated_at BEFORE UPDATE ON public.store_integrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_legal_pages_updated_at BEFORE UPDATE ON public.legal_pages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_webhook_subscriptions_updated_at BEFORE UPDATE ON public.webhook_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
