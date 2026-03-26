
-- 1. Profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  name text,
  email text,
  phone text,
  avatar_url text,
  business_name text,
  rating numeric DEFAULT 0,
  total_reviews integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Public profiles readable" ON public.profiles FOR SELECT USING (true);

-- 2. Stores table
CREATE TABLE public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  bio text,
  logo text,
  status text DEFAULT 'inactive',
  visibility text DEFAULT 'PRIVATE',
  plan text DEFAULT 'free',
  theme jsonb DEFAULT '{}',
  social_links jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can manage own store" ON public.stores FOR ALL USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Public can view active stores" ON public.stores FOR SELECT USING (status = 'active');

-- 3. Products table
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text,
  description text,
  price numeric NOT NULL DEFAULT 0,
  compare_at_price numeric,
  currency text DEFAULT 'KES',
  images text[] DEFAULT '{}',
  category_id integer,
  sku text,
  quantity integer DEFAULT 0,
  status text DEFAULT 'draft',
  sales_count integer DEFAULT 0,
  seo_title text,
  seo_description text,
  weight numeric,
  dimensions jsonb,
  tags text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners can manage products" ON public.products FOR ALL 
  USING (store_id IN (SELECT id FROM public.stores WHERE seller_id = auth.uid()))
  WITH CHECK (store_id IN (SELECT id FROM public.stores WHERE seller_id = auth.uid()));
CREATE POLICY "Public can view published products" ON public.products FOR SELECT USING (status = 'published');

-- 4. Add missing columns to transactions
ALTER TABLE public.transactions 
  ADD COLUMN IF NOT EXISTS seller_id uuid,
  ADD COLUMN IF NOT EXISTS buyer_id uuid,
  ADD COLUMN IF NOT EXISTS product_id uuid,
  ADD COLUMN IF NOT EXISTS item_name text,
  ADD COLUMN IF NOT EXISTS item_description text,
  ADD COLUMN IF NOT EXISTS item_images text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS buyer_name text,
  ADD COLUMN IF NOT EXISTS buyer_phone text,
  ADD COLUMN IF NOT EXISTS buyer_email text,
  ADD COLUMN IF NOT EXISTS buyer_address text,
  ADD COLUMN IF NOT EXISTS platform_fee numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seller_payout numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS courier_name text,
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS estimated_delivery_date timestamptz,
  ADD COLUMN IF NOT EXISTS shipping_notes text,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Allow seller to view orders where they are the seller
CREATE POLICY "Sellers can view their orders" ON public.transactions FOR SELECT USING (seller_id = auth.uid());
CREATE POLICY "Sellers can update their orders" ON public.transactions FOR UPDATE USING (seller_id = auth.uid());

-- 5. Chat conversations table
CREATE TABLE public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  customer_id uuid,
  customer_name text,
  customer_email text,
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  status text DEFAULT 'waiting',
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sellers can view their conversations" ON public.chat_conversations FOR SELECT USING (auth.uid() = seller_id);
CREATE POLICY "Sellers can update their conversations" ON public.chat_conversations FOR UPDATE USING (auth.uid() = seller_id);
CREATE POLICY "Service role full access conversations" ON public.chat_conversations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Customers can view their conversations" ON public.chat_conversations FOR SELECT USING (auth.uid() = customer_id);

-- 6. Chat messages table
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id uuid,
  sender_type text NOT NULL DEFAULT 'customer',
  sender_name text,
  message text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Conversation participants can view messages" ON public.chat_messages FOR SELECT 
  USING (conversation_id IN (SELECT id FROM public.chat_conversations WHERE seller_id = auth.uid() OR customer_id = auth.uid()));
CREATE POLICY "Conversation participants can insert messages" ON public.chat_messages FOR INSERT 
  WITH CHECK (conversation_id IN (SELECT id FROM public.chat_conversations WHERE seller_id = auth.uid() OR customer_id = auth.uid()));
CREATE POLICY "Service role full access messages" ON public.chat_messages FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 7. Wallets table
CREATE TABLE public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  available_balance numeric DEFAULT 0,
  pending_balance numeric DEFAULT 0,
  total_earned numeric DEFAULT 0,
  currency text DEFAULT 'KES',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own wallet" ON public.wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own wallet" ON public.wallets FOR UPDATE USING (auth.uid() = user_id);

-- 8. Social accounts table
CREATE TABLE public.social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  platform text NOT NULL,
  username text,
  profile_url text,
  connected boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners manage social accounts" ON public.social_accounts FOR ALL
  USING (store_id IN (SELECT id FROM public.stores WHERE seller_id = auth.uid()))
  WITH CHECK (store_id IN (SELECT id FROM public.stores WHERE seller_id = auth.uid()));

-- 9. Customers table
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  email text,
  phone text,
  first_name text,
  last_name text,
  total_orders integer DEFAULT 0,
  total_spent numeric DEFAULT 0,
  average_order_value numeric DEFAULT 0,
  last_order_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners manage customers" ON public.customers FOR ALL
  USING (store_id IN (SELECT id FROM public.stores WHERE seller_id = auth.uid()))
  WITH CHECK (store_id IN (SELECT id FROM public.stores WHERE seller_id = auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stores_seller_id ON public.stores(seller_id);
CREATE INDEX IF NOT EXISTS idx_stores_slug ON public.stores(slug);
CREATE INDEX IF NOT EXISTS idx_products_store_id ON public.products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);
CREATE INDEX IF NOT EXISTS idx_transactions_seller_id ON public.transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_transactions_buyer_id ON public.transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_seller ON public.chat_conversations(seller_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON public.chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_customers_store_id ON public.customers(store_id);
