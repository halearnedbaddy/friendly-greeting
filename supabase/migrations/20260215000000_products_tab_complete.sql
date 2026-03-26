-- =====================================================
-- PRODUCTS TAB - Complete Implementation
-- FreshCart Seller Dashboard
-- Extends products, adds categories, variants, bulk ops, etc.
-- =====================================================

-- Add new product_status value 'active' (alias for published in some contexts)
-- product_status already has draft, published, archived
-- We'll use 'published' as active - no enum change needed

-- 1. Add new columns to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS short_description VARCHAR(1000);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS compare_at_price NUMERIC(10,2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cost NUMERIC(10,2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sku VARCHAR(255);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS barcode VARCHAR(255);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS track_inventory BOOLEAN DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 10;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS brand VARCHAR(255);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS product_type VARCHAR(50) DEFAULT 'physical';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS videos JSONB DEFAULT '[]';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS seo_title VARCHAR(255);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS seo_description TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS seo_keywords TEXT[] DEFAULT '{}';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS requires_shipping BOOLEAN DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS weight NUMERIC(10,3);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS length NUMERIC(10,2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS width NUMERIC(10,2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS height NUMERIC(10,2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS digital_file_url VARCHAR(500);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS digital_file_size INTEGER;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS download_limit INTEGER;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sales_count INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- Sync stock -> quantity for existing rows
UPDATE public.products SET quantity = COALESCE(stock, 0) WHERE quantity IS NULL OR quantity = 0;

-- Unique slug per store (add constraint after backfill)
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_store_slug ON public.products(store_id, slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_tags ON public.products USING GIN(tags) WHERE tags IS NOT NULL AND array_length(tags, 1) > 0;

-- 2. Categories table (per store)
CREATE TABLE IF NOT EXISTS public.categories (
    id SERIAL PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    parent_id INTEGER REFERENCES public.categories(id) ON DELETE CASCADE,
    level INTEGER DEFAULT 0,
    path VARCHAR(500),
    image_url VARCHAR(500),
    display_order INTEGER DEFAULT 0,
    is_visible BOOLEAN DEFAULT true,
    seo_title VARCHAR(255),
    seo_description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_categories_store ON public.categories(store_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON public.categories(parent_id);

-- Link products to categories
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES public.categories(id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id) WHERE category_id IS NOT NULL;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage categories"
ON public.categories FOR ALL
USING (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = categories.store_id AND s.seller_id = auth.uid())
);
CREATE POLICY "Public can view visible categories"
ON public.categories FOR SELECT
USING (is_visible = true);

-- 3. Product Variants
CREATE TABLE IF NOT EXISTS public.product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(255),
    barcode VARCHAR(255),
    options JSONB NOT NULL DEFAULT '{}',
    price NUMERIC(10,2),
    compare_at_price NUMERIC(10,2),
    cost NUMERIC(10,2),
    quantity INTEGER DEFAULT 0,
    image_url VARCHAR(500),
    is_available BOOLEAN DEFAULT true,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_variants_sku ON public.product_variants(sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_variants_product ON public.product_variants(product_id);

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage variants"
ON public.product_variants FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.products p
        JOIN public.stores s ON p.store_id = s.id
        WHERE p.id = product_variants.product_id AND s.seller_id = auth.uid()
    )
);

-- 4. Product Options (for variant creation)
CREATE TABLE IF NOT EXISTS public.product_options (
    id SERIAL PRIMARY KEY,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(100) NOT NULL,
    values TEXT[] NOT NULL DEFAULT '{}',
    position INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_product_options_product ON public.product_options(product_id);

ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage product options"
ON public.product_options FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.products p
        JOIN public.stores s ON p.store_id = s.id
        WHERE p.id = product_options.product_id AND s.seller_id = auth.uid()
    )
);

-- 5. Product Images (separate table for ordering/alt)
CREATE TABLE IF NOT EXISTS public.product_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
    url VARCHAR(500) NOT NULL,
    alt_text VARCHAR(255),
    position INTEGER DEFAULT 0,
    width INTEGER,
    height INTEGER,
    size INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON public.product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_variant ON public.product_images(variant_id);

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage product images"
ON public.product_images FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.products p
        JOIN public.stores s ON p.store_id = s.id
        WHERE p.id = product_images.product_id AND s.seller_id = auth.uid()
    )
);
CREATE POLICY "Public can view product images"
ON public.product_images FOR SELECT
USING (true);

-- 6. Product Collections
CREATE TABLE IF NOT EXISTS public.product_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    conditions JSONB,
    is_automatic BOOLEAN DEFAULT false,
    image_url VARCHAR(500),
    is_visible BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    seo_title VARCHAR(255),
    seo_description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_collections_store ON public.product_collections(store_id);

CREATE TABLE IF NOT EXISTS public.product_collection_items (
    collection_id UUID REFERENCES public.product_collections(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    position INTEGER DEFAULT 0,
    PRIMARY KEY (collection_id, product_id)
);

ALTER TABLE public.product_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage collections"
ON public.product_collections FOR ALL
USING (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = product_collections.store_id AND s.seller_id = auth.uid())
);

ALTER TABLE public.product_collection_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage collection items"
ON public.product_collection_items FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.product_collections pc
        JOIN public.stores s ON pc.store_id = s.id
        WHERE pc.id = product_collection_items.collection_id AND s.seller_id = auth.uid()
    )
);

-- 7. Product Analytics
CREATE TABLE IF NOT EXISTS public.product_analytics (
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
CREATE INDEX IF NOT EXISTS idx_product_analytics_product_date ON public.product_analytics(product_id, date DESC);

ALTER TABLE public.product_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can view product analytics"
ON public.product_analytics FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.products p
        JOIN public.stores s ON p.store_id = s.id
        WHERE p.id = product_analytics.product_id AND s.seller_id = auth.uid()
    )
);

-- 8. Product Import Jobs
CREATE TABLE IF NOT EXISTS public.product_import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER,
    status VARCHAR(50) DEFAULT 'pending',
    total_rows INTEGER,
    processed_rows INTEGER DEFAULT 0,
    successful_rows INTEGER DEFAULT 0,
    failed_rows INTEGER DEFAULT 0,
    errors JSONB DEFAULT '[]',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_import_jobs_store ON public.product_import_jobs(store_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON public.product_import_jobs(status);

ALTER TABLE public.product_import_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage import jobs"
ON public.product_import_jobs FOR ALL
USING (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = product_import_jobs.store_id AND s.seller_id = auth.uid())
);

-- 9. Product Tags (for autocomplete)
CREATE TABLE IF NOT EXISTS public.product_tags (
    id SERIAL PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_product_tags_store ON public.product_tags(store_id);

ALTER TABLE public.product_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage tags"
ON public.product_tags FOR ALL
USING (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = product_tags.store_id AND s.seller_id = auth.uid())
);

-- 10. Product History (audit)
CREATE TABLE IF NOT EXISTS public.product_history (
    id BIGSERIAL PRIMARY KEY,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_product_history_product ON public.product_history(product_id);
CREATE INDEX IF NOT EXISTS idx_product_history_date ON public.product_history(created_at DESC);

ALTER TABLE public.product_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can view product history"
ON public.product_history FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.products p
        JOIN public.stores s ON p.store_id = s.id
        WHERE p.id = product_history.product_id AND s.seller_id = auth.uid()
    )
);

-- 11. Related Products
CREATE TABLE IF NOT EXISTS public.related_products (
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    related_product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    relation_type VARCHAR(50) DEFAULT 'related',
    position INTEGER DEFAULT 0,
    PRIMARY KEY (product_id, related_product_id),
    CHECK (product_id != related_product_id)
);
CREATE INDEX IF NOT EXISTS idx_related_products ON public.related_products(product_id);

ALTER TABLE public.related_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage related products"
ON public.related_products FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.products p
        JOIN public.stores s ON p.store_id = s.id
        WHERE p.id = related_products.product_id AND s.seller_id = auth.uid()
    )
);

-- Triggers
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_product_variants_updated_at
  BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_product_collections_updated_at
  BEFORE UPDATE ON public.product_collections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
