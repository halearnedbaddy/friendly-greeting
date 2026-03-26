-- =====================================================
-- INVENTORY TAB - Complete Implementation
-- Stock Management, Multi-Location, Alerts & Forecasting
-- Adapted for store_id (products belong to stores)
-- =====================================================

-- 1. Suppliers (must exist before purchase_orders)
CREATE TABLE IF NOT EXISTS public.suppliers (
    id SERIAL PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    contact_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    website VARCHAR(255),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100),
    payment_terms VARCHAR(100),
    lead_time_days INTEGER,
    minimum_order_value NUMERIC(10,2),
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_suppliers_store ON public.suppliers(store_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON public.suppliers(is_active);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage suppliers"
ON public.suppliers FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = suppliers.store_id AND s.seller_id = auth.uid()));

-- 2. Inventory Locations (Warehouses)
CREATE TABLE IF NOT EXISTS public.inventory_locations (
    id SERIAL PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'US',
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    location_type VARCHAR(50) DEFAULT 'warehouse',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inventory_locations_store ON public.inventory_locations(store_id);
CREATE INDEX IF NOT EXISTS idx_inventory_locations_active ON public.inventory_locations(is_active);

ALTER TABLE public.inventory_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage inventory locations"
ON public.inventory_locations FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = inventory_locations.store_id AND s.seller_id = auth.uid()));

-- 3. Inventory Levels (stock per location)
-- product_id required; variant_id optional (null = product-level stock)
CREATE TABLE IF NOT EXISTS public.inventory_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
    location_id INTEGER REFERENCES public.inventory_locations(id) ON DELETE CASCADE NOT NULL,
    quantity INTEGER DEFAULT 0,
    reserved_quantity INTEGER DEFAULT 0,
    reorder_point INTEGER,
    reorder_quantity INTEGER,
    unit_cost NUMERIC(10,2),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inv_levels_product_loc ON public.inventory_levels(product_id, location_id) WHERE variant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_inv_levels_variant_loc ON public.inventory_levels(variant_id, location_id) WHERE variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_levels_product ON public.inventory_levels(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_levels_variant ON public.inventory_levels(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_levels_location ON public.inventory_levels(location_id);

-- Add generated column for available_quantity (Postgres 12+)
ALTER TABLE public.inventory_levels ADD COLUMN IF NOT EXISTS available_quantity INTEGER GENERATED ALWAYS AS (quantity - reserved_quantity) STORED;

ALTER TABLE public.inventory_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage inventory levels"
ON public.inventory_levels FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.products p
        JOIN public.stores s ON p.store_id = s.id
        WHERE p.id = inventory_levels.product_id AND s.seller_id = auth.uid()
    )
);

-- 4. Inventory Adjustments
CREATE TABLE IF NOT EXISTS public.inventory_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
    location_id INTEGER REFERENCES public.inventory_locations(id) ON DELETE SET NULL,
    adjustment_type VARCHAR(50) NOT NULL,
    quantity_change INTEGER NOT NULL,
    quantity_before INTEGER NOT NULL,
    quantity_after INTEGER NOT NULL,
    reference_type VARCHAR(50),
    reference_id UUID,
    reason TEXT,
    notes TEXT,
    unit_cost NUMERIC(10,2),
    total_cost NUMERIC(12,2),
    adjusted_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT inv_adj_product_or_variant CHECK (product_id IS NOT NULL OR variant_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_product ON public.inventory_adjustments(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_variant ON public.inventory_adjustments(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_location ON public.inventory_adjustments(location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_created ON public.inventory_adjustments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_type ON public.inventory_adjustments(adjustment_type);

ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can view inventory adjustments"
ON public.inventory_adjustments FOR SELECT
USING (
    (product_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.products p JOIN public.stores s ON p.store_id = s.id
        WHERE p.id = inventory_adjustments.product_id AND s.seller_id = auth.uid()
    ))
    OR
    (variant_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.product_variants pv
        JOIN public.products p ON pv.product_id = p.id
        JOIN public.stores s ON p.store_id = s.id
        WHERE pv.id = inventory_adjustments.variant_id AND s.seller_id = auth.uid()
    ))
);
CREATE POLICY "Store owners can insert inventory adjustments"
ON public.inventory_adjustments FOR INSERT
WITH CHECK (
    (product_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.products p JOIN public.stores s ON p.store_id = s.id
        WHERE p.id = inventory_adjustments.product_id AND s.seller_id = auth.uid()
    ))
    OR
    (variant_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.product_variants pv
        JOIN public.products p ON pv.product_id = p.id
        JOIN public.stores s ON p.store_id = s.id
        WHERE pv.id = inventory_adjustments.variant_id AND s.seller_id = auth.uid()
    ))
);

-- 5. Inventory Transfers
CREATE TABLE IF NOT EXISTS public.inventory_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    from_location_id INTEGER REFERENCES public.inventory_locations(id) ON DELETE SET NULL,
    to_location_id INTEGER REFERENCES public.inventory_locations(id) ON DELETE SET NULL,
    items JSONB NOT NULL DEFAULT '[]',
    status VARCHAR(50) DEFAULT 'pending',
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    shipped_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    tracking_number VARCHAR(255),
    carrier VARCHAR(100),
    notes TEXT,
    requested_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_store ON public.inventory_transfers(store_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_from ON public.inventory_transfers(from_location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_to ON public.inventory_transfers(to_location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_status ON public.inventory_transfers(status);

ALTER TABLE public.inventory_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage inventory transfers"
ON public.inventory_transfers FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = inventory_transfers.store_id AND s.seller_id = auth.uid()));

-- 6. Purchase Orders
CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    supplier_id INTEGER REFERENCES public.suppliers(id) ON DELETE SET NULL,
    location_id INTEGER REFERENCES public.inventory_locations(id) ON DELETE SET NULL,
    po_number VARCHAR(100),
    items JSONB NOT NULL DEFAULT '[]',
    subtotal NUMERIC(12,2),
    tax NUMERIC(12,2) DEFAULT 0,
    shipping NUMERIC(12,2) DEFAULT 0,
    total NUMERIC(12,2),
    status VARCHAR(50) DEFAULT 'draft',
    order_date DATE,
    expected_date DATE,
    received_date DATE,
    payment_terms VARCHAR(100),
    payment_status VARCHAR(50) DEFAULT 'unpaid',
    paid_date DATE,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_orders_po_number ON public.purchase_orders(po_number) WHERE po_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_store ON public.purchase_orders(store_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON public.purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_date ON public.purchase_orders(order_date DESC NULLS LAST);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage purchase orders"
ON public.purchase_orders FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = purchase_orders.store_id AND s.seller_id = auth.uid()));

-- 7. Product Suppliers
CREATE TABLE IF NOT EXISTS public.product_suppliers (
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    supplier_id INTEGER REFERENCES public.suppliers(id) ON DELETE CASCADE,
    supplier_sku VARCHAR(255),
    unit_cost NUMERIC(10,2),
    lead_time_days INTEGER,
    minimum_quantity INTEGER DEFAULT 1,
    is_preferred BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (product_id, supplier_id)
);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_product ON public.product_suppliers(product_id);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_supplier ON public.product_suppliers(supplier_id);

ALTER TABLE public.product_suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage product suppliers"
ON public.product_suppliers FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.products p
        JOIN public.stores s ON p.store_id = s.id
        WHERE p.id = product_suppliers.product_id AND s.seller_id = auth.uid()
    )
);

-- 8. Inventory Snapshots
CREATE TABLE IF NOT EXISTS public.inventory_snapshots (
    id BIGSERIAL PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    snapshot_date DATE NOT NULL,
    total_products INTEGER DEFAULT 0,
    total_quantity INTEGER DEFAULT 0,
    total_value NUMERIC(12,2) DEFAULT 0,
    in_stock_products INTEGER DEFAULT 0,
    low_stock_products INTEGER DEFAULT 0,
    out_of_stock_products INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_store_date ON public.inventory_snapshots(store_id, snapshot_date DESC);

ALTER TABLE public.inventory_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage inventory snapshots"
ON public.inventory_snapshots FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = inventory_snapshots.store_id AND s.seller_id = auth.uid()));

-- Triggers
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_inventory_locations_updated_at BEFORE UPDATE ON public.inventory_locations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_inventory_transfers_updated_at BEFORE UPDATE ON public.inventory_transfers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
