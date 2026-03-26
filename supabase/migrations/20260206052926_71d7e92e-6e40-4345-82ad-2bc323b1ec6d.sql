-- ESCROW WALLETS - Main escrow holding table
CREATE TABLE IF NOT EXISTS public.escrow_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_ref VARCHAR(30) UNIQUE NOT NULL,
  order_id TEXT,
  gross_amount DECIMAL(15,2) NOT NULL,
  platform_fee DECIMAL(15,2) NOT NULL,
  net_amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'KES',
  status VARCHAR(20) DEFAULT 'locked' CHECK (status IN ('locked', 'released', 'refunded', 'disputed')),
  requires_buyer_confirmation BOOLEAN DEFAULT TRUE,
  auto_release_date TIMESTAMP WITH TIME ZONE,
  locked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  released_at TIMESTAMP WITH TIME ZONE,
  released_by VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- LEDGER ENTRIES - Double-entry accounting for all money movements
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_ref VARCHAR(30) UNIQUE NOT NULL,
  order_id TEXT,
  transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN ('escrow_lock', 'escrow_release', 'escrow_refund', 'fee_collection', 'payout', 'topup', 'withdrawal')),
  debit_account VARCHAR(50) NOT NULL,
  credit_account VARCHAR(50) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  debit_balance_before DECIMAL(15,2),
  debit_balance_after DECIMAL(15,2),
  credit_balance_before DECIMAL(15,2),
  credit_balance_after DECIMAL(15,2),
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- MPESA TRANSACTIONS - Track all M-Pesa API calls
CREATE TABLE IF NOT EXISTS public.mpesa_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT,
  transaction_type VARCHAR(20) CHECK (transaction_type IN ('stk_push', 'b2c_payout', 'b2c_refund')),
  merchant_request_id VARCHAR(100),
  checkout_request_id VARCHAR(100),
  conversation_id VARCHAR(100),
  mpesa_receipt_number VARCHAR(50),
  phone_number VARCHAR(20),
  amount DECIMAL(15,2),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  result_code VARCHAR(10),
  result_desc TEXT,
  raw_request JSONB,
  raw_response JSONB,
  callback_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- PLATFORM ACCOUNTS - Track platform financial positions
CREATE TABLE IF NOT EXISTS public.platform_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_type VARCHAR(30) UNIQUE NOT NULL CHECK (account_type IN ('escrow_pool', 'platform_fees', 'payout_pending')),
  balance DECIMAL(15,2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'KES',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DISPUTES TABLE - For handling transaction disputes (transaction_id is TEXT to match transactions.id)
CREATE TABLE IF NOT EXISTS public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT NOT NULL,
  opened_by UUID NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'closed')),
  resolution TEXT,
  resolved_by UUID,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DISPUTE MESSAGES - Chat messages for disputes
CREATE TABLE IF NOT EXISTS public.dispute_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add escrow fields to existing transactions table
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS escrow_wallet_id UUID,
ADD COLUMN IF NOT EXISTS escrow_status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS auto_release_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS buyer_confirmed_at TIMESTAMP WITH TIME ZONE;

-- Initialize platform accounts
INSERT INTO public.platform_accounts (account_type, balance, description) VALUES
('escrow_pool', 0, 'Total money held in escrow'),
('platform_fees', 0, 'Platform fees collected'),
('payout_pending', 0, 'Money waiting to be paid to sellers')
ON CONFLICT (account_type) DO NOTHING;

-- Enable RLS on all new tables
ALTER TABLE public.escrow_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mpesa_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for escrow_wallets
CREATE POLICY "Admins can view all escrow wallets" ON public.escrow_wallets
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Sellers can view their escrow wallets" ON public.escrow_wallets
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.transactions t 
    WHERE t.escrow_wallet_id = escrow_wallets.id 
    AND t.seller_id = auth.uid()
  )
);

-- RLS Policies for ledger_entries (admin only)
CREATE POLICY "Admins can view all ledger entries" ON public.ledger_entries
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for mpesa_transactions
CREATE POLICY "Admins can manage mpesa transactions" ON public.mpesa_transactions
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their mpesa transactions" ON public.mpesa_transactions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.transactions t 
    WHERE t.id = mpesa_transactions.order_id 
    AND (t.seller_id = auth.uid() OR t.buyer_id = auth.uid())
  )
);

-- RLS Policies for platform_accounts (admin only)
CREATE POLICY "Admins can view platform accounts" ON public.platform_accounts
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for disputes
CREATE POLICY "Admins can manage all disputes" ON public.disputes
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their disputes" ON public.disputes
FOR SELECT USING (opened_by = auth.uid());

CREATE POLICY "Users can create disputes" ON public.disputes
FOR INSERT WITH CHECK (opened_by = auth.uid());

-- RLS Policies for dispute_messages
CREATE POLICY "Admins can manage all dispute messages" ON public.dispute_messages
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view messages on their disputes" ON public.dispute_messages
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.disputes d 
    WHERE d.id = dispute_messages.dispute_id 
    AND d.opened_by = auth.uid()
  )
);

CREATE POLICY "Users can send messages on their disputes" ON public.dispute_messages
FOR INSERT WITH CHECK (
  sender_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.disputes d 
    WHERE d.id = dispute_messages.dispute_id 
    AND d.opened_by = auth.uid()
  )
);

-- Triggers for updated_at
CREATE TRIGGER update_escrow_wallets_updated_at
  BEFORE UPDATE ON public.escrow_wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_platform_accounts_updated_at
  BEFORE UPDATE ON public.platform_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_disputes_updated_at
  BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Enable realtime for dispute_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.dispute_messages;