-- Create escrow_wallets table for holding funds
CREATE TABLE IF NOT EXISTS public.escrow_wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_ref TEXT NOT NULL UNIQUE,
  order_id TEXT REFERENCES public.transactions(id),
  gross_amount DOUBLE PRECISION NOT NULL,
  platform_fee DOUBLE PRECISION NOT NULL DEFAULT 0,
  net_amount DOUBLE PRECISION NOT NULL,
  currency TEXT DEFAULT 'KES',
  status TEXT DEFAULT 'locked' CHECK (status IN ('locked', 'released', 'refunded', 'disputed')),
  requires_buyer_confirmation BOOLEAN DEFAULT true,
  auto_release_date TIMESTAMPTZ,
  locked_at TIMESTAMPTZ DEFAULT now(),
  released_at TIMESTAMPTZ,
  released_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create platform_accounts table for tracking platform balances
CREATE TABLE IF NOT EXISTS public.platform_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_type TEXT NOT NULL UNIQUE CHECK (account_type IN ('escrow_pool', 'platform_fees', 'payout_pending')),
  balance DOUBLE PRECISION DEFAULT 0,
  currency TEXT DEFAULT 'KES',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create ledger_entries table for financial audit trail
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_ref TEXT NOT NULL UNIQUE,
  order_id TEXT REFERENCES public.transactions(id),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('escrow_lock', 'escrow_release', 'escrow_refund', 'fee_collection', 'payout')),
  debit_account TEXT NOT NULL,
  credit_account TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default platform accounts
INSERT INTO public.platform_accounts (account_type, balance, currency)
VALUES 
  ('escrow_pool', 0, 'KES'),
  ('platform_fees', 0, 'KES'),
  ('payout_pending', 0, 'KES')
ON CONFLICT (account_type) DO NOTHING;

-- Add escrow_wallet_id column to transactions if not exists
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS escrow_wallet_id UUID REFERENCES public.escrow_wallets(id);

-- Add auto_release_at column to transactions if not exists
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS auto_release_at TIMESTAMPTZ;

-- Add buyer_confirmed_at column to transactions if not exists
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS buyer_confirmed_at TIMESTAMPTZ;

-- Enable RLS
ALTER TABLE public.escrow_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

-- Escrow wallets policies
CREATE POLICY "Admins can manage all escrow wallets"
ON public.escrow_wallets FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Sellers can view their escrow wallets"
ON public.escrow_wallets FOR SELECT
USING (EXISTS (
  SELECT 1 FROM transactions t
  WHERE t.id = escrow_wallets.order_id AND t.seller_id = auth.uid()
));

CREATE POLICY "Buyers can view their escrow wallets"
ON public.escrow_wallets FOR SELECT
USING (EXISTS (
  SELECT 1 FROM transactions t
  WHERE t.id = escrow_wallets.order_id AND t.buyer_id = auth.uid()
));

-- Platform accounts policies (admin only)
CREATE POLICY "Admins can view platform accounts"
ON public.platform_accounts FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Ledger entries policies (admin only)
CREATE POLICY "Admins can view ledger entries"
ON public.ledger_entries FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Triggers for updated_at
CREATE OR REPLACE TRIGGER update_escrow_wallets_updated_at
BEFORE UPDATE ON public.escrow_wallets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_platform_accounts_updated_at
BEFORE UPDATE ON public.platform_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();