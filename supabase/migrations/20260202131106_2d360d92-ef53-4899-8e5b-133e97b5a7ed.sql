-- Create payment_links table for storing seller payment links
CREATE TABLE public.payment_links (
    id TEXT PRIMARY KEY,
    seller_id UUID NOT NULL,
    product_name TEXT NOT NULL,
    product_description TEXT,
    price DECIMAL(12,2) NOT NULL,
    original_price DECIMAL(12,2),
    currency TEXT NOT NULL DEFAULT 'KES',
    base_price_usd DECIMAL(12,2),
    images TEXT[] DEFAULT '{}',
    customer_phone TEXT,
    quantity INTEGER DEFAULT 1,
    expiry_date TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    clicks INTEGER DEFAULT 0,
    purchases INTEGER DEFAULT 0,
    revenue DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;

-- Public can view active links
CREATE POLICY "Anyone can view active payment links"
ON public.payment_links FOR SELECT
USING (status = 'ACTIVE' OR status = 'active');

-- Sellers can create their own links
CREATE POLICY "Sellers can create payment links"
ON public.payment_links FOR INSERT
WITH CHECK (seller_id = auth.uid());

-- Sellers can update their own links
CREATE POLICY "Sellers can update their own links"
ON public.payment_links FOR UPDATE
USING (seller_id = auth.uid());

-- Sellers can view all their links
CREATE POLICY "Sellers can view their own links"
ON public.payment_links FOR SELECT
USING (seller_id = auth.uid());

-- Trigger for updated_at (using existing function)
CREATE TRIGGER update_payment_links_updated_at
    BEFORE UPDATE ON public.payment_links
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Index for common queries
CREATE INDEX idx_payment_links_seller_id ON public.payment_links(seller_id);
CREATE INDEX idx_payment_links_status ON public.payment_links(status);
CREATE INDEX idx_payment_links_created_at ON public.payment_links(created_at DESC);