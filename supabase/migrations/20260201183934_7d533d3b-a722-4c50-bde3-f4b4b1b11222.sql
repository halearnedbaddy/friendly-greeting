-- Create enums
CREATE TYPE public.app_role AS ENUM ('admin', 'seller', 'buyer');
CREATE TYPE public.account_status AS ENUM ('active', 'suspended', 'pending_verification');
CREATE TYPE public.transaction_status AS ENUM ('pending', 'processing', 'paid', 'accepted', 'shipped', 'delivered', 'completed', 'disputed', 'cancelled', 'refunded', 'expired');
CREATE TYPE public.store_status AS ENUM ('inactive', 'active', 'frozen');
CREATE TYPE public.product_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE public.social_platform AS ENUM ('instagram', 'facebook', 'linkedin');

-- User roles table (for authorization)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    avatar_url TEXT,
    business_name TEXT,
    business_address TEXT,
    is_verified BOOLEAN DEFAULT false,
    account_status account_status DEFAULT 'active',
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Seller profiles (extended info for sellers)
CREATE TABLE public.seller_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    rating NUMERIC(3,2) DEFAULT 0,
    total_reviews INTEGER DEFAULT 0,
    total_sales INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.seller_profiles ENABLE ROW LEVEL SECURITY;

-- Wallets table
CREATE TABLE public.wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    available_balance NUMERIC(12,2) DEFAULT 0,
    pending_balance NUMERIC(12,2) DEFAULT 0,
    total_earned NUMERIC(12,2) DEFAULT 0,
    total_spent NUMERIC(12,2) DEFAULT 0,
    currency TEXT DEFAULT 'KES',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- Stores table
CREATE TABLE public.stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo TEXT,
    bio TEXT,
    visibility TEXT DEFAULT 'public',
    status store_status DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- Products table
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(12,2),
    currency TEXT DEFAULT 'KES',
    images TEXT[] DEFAULT '{}',
    status product_status DEFAULT 'draft',
    is_available BOOLEAN DEFAULT true,
    stock INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Transactions table
CREATE TABLE public.transactions (
    id TEXT PRIMARY KEY,
    seller_id UUID REFERENCES auth.users(id) NOT NULL,
    buyer_id UUID REFERENCES auth.users(id),
    product_id UUID REFERENCES public.products(id),
    item_name TEXT NOT NULL,
    item_description TEXT,
    item_images TEXT[] DEFAULT '{}',
    amount NUMERIC(12,2) NOT NULL,
    quantity INTEGER DEFAULT 1,
    currency TEXT DEFAULT 'KES',
    buyer_phone TEXT,
    buyer_name TEXT,
    buyer_email TEXT,
    buyer_address TEXT,
    payment_method TEXT,
    payment_reference TEXT,
    platform_fee NUMERIC(12,2),
    seller_payout NUMERIC(12,2),
    status transaction_status DEFAULT 'pending',
    expires_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    courier_name TEXT,
    tracking_number TEXT,
    delivery_proof_urls TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Payment links table
CREATE TABLE public.payment_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id),
    title TEXT NOT NULL,
    description TEXT,
    amount NUMERIC(12,2) NOT NULL,
    currency TEXT DEFAULT 'KES',
    status TEXT DEFAULT 'active',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;

-- Social accounts table
CREATE TABLE public.social_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    platform social_platform NOT NULL,
    page_url TEXT NOT NULL,
    page_id TEXT,
    last_scanned_at TIMESTAMPTZ,
    scan_status TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;

-- Audit logs table
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT,
    details JSONB,
    ip_address TEXT,
    user_agent TEXT,
    success BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Admin logs table
CREATE TABLE public.admin_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES auth.users(id) NOT NULL,
    action TEXT NOT NULL,
    target_user_id UUID REFERENCES auth.users(id),
    details JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- Notifications table
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_seller_profiles_updated_at BEFORE UPDATE ON public.seller_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_payment_links_updated_at BEFORE UPDATE ON public.payment_links FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_social_accounts_updated_at BEFORE UPDATE ON public.social_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS POLICIES

-- User roles policies
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Public can view seller names" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Seller profiles policies
CREATE POLICY "Public can view seller profiles" ON public.seller_profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own seller profile" ON public.seller_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own seller profile" ON public.seller_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Wallets policies
CREATE POLICY "Users can view own wallet" ON public.wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own wallet" ON public.wallets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own wallet" ON public.wallets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all wallets" ON public.wallets FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Stores policies
CREATE POLICY "Public can view stores" ON public.stores FOR SELECT USING (status = 'active' OR status IS NULL);
CREATE POLICY "Sellers can manage own stores" ON public.stores FOR ALL USING (auth.uid() = seller_id);
CREATE POLICY "Admins can view all stores" ON public.stores FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all stores" ON public.stores FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Products policies
CREATE POLICY "Public can view published products" ON public.products FOR SELECT USING (status = 'published');
CREATE POLICY "Store owners can manage products" ON public.products FOR ALL USING (
    EXISTS (SELECT 1 FROM public.stores WHERE stores.id = products.store_id AND stores.seller_id = auth.uid())
);
CREATE POLICY "Admins can view all products" ON public.products FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Transactions policies
CREATE POLICY "Sellers can view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = seller_id);
CREATE POLICY "Buyers can view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = buyer_id);
CREATE POLICY "Sellers can update own transactions" ON public.transactions FOR UPDATE USING (auth.uid() = seller_id);
CREATE POLICY "Admins can view all transactions" ON public.transactions FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all transactions" ON public.transactions FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can create transactions" ON public.transactions FOR INSERT WITH CHECK (true);

-- Payment links policies
CREATE POLICY "Public can view active payment links" ON public.payment_links FOR SELECT USING (status = 'active');
CREATE POLICY "Sellers can manage own links" ON public.payment_links FOR ALL USING (auth.uid() = seller_id);
CREATE POLICY "Admins can view all links" ON public.payment_links FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Social accounts policies
CREATE POLICY "Store owners can manage social accounts" ON public.social_accounts FOR ALL USING (
    EXISTS (SELECT 1 FROM public.stores WHERE stores.id = social_accounts.store_id AND stores.seller_id = auth.uid())
);

-- Audit logs policies
CREATE POLICY "Users can view own audit logs" ON public.audit_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all audit logs" ON public.audit_logs FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "System can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (true);

-- Admin logs policies
CREATE POLICY "Admins can view admin logs" ON public.admin_logs FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert admin logs" ON public.admin_logs FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);