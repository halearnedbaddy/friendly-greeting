
-- M-Pesa Transactions table (logs all M-Pesa API interactions)
CREATE TABLE IF NOT EXISTS public.mpesa_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text,
  transaction_type text NOT NULL CHECK (transaction_type IN ('stk_push', 'c2b', 'b2c_payout', 'verification', 'balance_query')),
  merchant_request_id text,
  checkout_request_id text,
  conversation_id text,
  originator_conversation_id text,
  phone_number text,
  amount numeric NOT NULL DEFAULT 0,
  currency text DEFAULT 'KES',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'timeout')),
  result_code text,
  result_desc text,
  mpesa_receipt_number text,
  callback_data jsonb,
  raw_request jsonb,
  verification_status text,
  verified_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for mpesa_transactions
CREATE INDEX idx_mpesa_tx_checkout ON public.mpesa_transactions(checkout_request_id);
CREATE INDEX idx_mpesa_tx_conversation ON public.mpesa_transactions(conversation_id);
CREATE INDEX idx_mpesa_tx_order ON public.mpesa_transactions(order_id);
CREATE INDEX idx_mpesa_tx_status ON public.mpesa_transactions(status);
CREATE INDEX idx_mpesa_tx_type ON public.mpesa_transactions(transaction_type);
CREATE INDEX idx_mpesa_tx_receipt ON public.mpesa_transactions(mpesa_receipt_number);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'basic', 'premium')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'expired', 'cancelled', 'pending', 'trial')),
  amount numeric DEFAULT 0,
  currency text DEFAULT 'KES',
  mpesa_transaction_id text,
  checkout_request_id text,
  reference text UNIQUE,
  started_at timestamptz,
  expires_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  trial_ends_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_sub_user ON public.subscriptions(user_id);
CREATE INDEX idx_sub_status ON public.subscriptions(status);
CREATE INDEX idx_sub_reference ON public.subscriptions(reference);

-- Earnings table (referrals, bonuses, commissions)
CREATE TABLE IF NOT EXISTS public.earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('referral', 'milestone', 'promotion', 'commission')),
  amount numeric NOT NULL DEFAULT 0,
  description text,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'withdrawn', 'pending', 'expired')),
  reference text,
  withdrawal_id text,
  earned_at timestamptz DEFAULT now(),
  withdrawn_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_earn_user ON public.earnings(user_id);
CREATE INDEX idx_earn_status ON public.earnings(status);
CREATE INDEX idx_earn_type ON public.earnings(type);

-- M-Pesa Callbacks log (for debugging)
CREATE TABLE IF NOT EXISTS public.mpesa_callbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  callback_type text NOT NULL CHECK (callback_type IN ('stk_push', 'c2b_validation', 'c2b_confirmation', 'b2c_result', 'status_result', 'balance_result', 'timeout')),
  request_body jsonb NOT NULL,
  response_body jsonb,
  transaction_id text,
  checkout_request_id text,
  result_code integer,
  result_desc text,
  processed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_cb_type ON public.mpesa_callbacks(callback_type);
CREATE INDEX idx_cb_tx ON public.mpesa_callbacks(transaction_id);
CREATE INDEX idx_cb_processed ON public.mpesa_callbacks(processed);

-- Account balance snapshots
CREATE TABLE IF NOT EXISTS public.mpesa_account_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shortcode text NOT NULL,
  available_balance numeric DEFAULT 0,
  current_balance numeric DEFAULT 0,
  reserved_balance numeric DEFAULT 0,
  currency text DEFAULT 'KES',
  raw_balance_string text,
  checked_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_bal_shortcode ON public.mpesa_account_balances(shortcode);
CREATE INDEX idx_bal_checked ON public.mpesa_account_balances(checked_at DESC);

-- Ledger entries for financial tracking
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_ref text UNIQUE NOT NULL,
  order_id text,
  transaction_type text NOT NULL,
  debit_account text NOT NULL,
  credit_account text NOT NULL,
  amount numeric NOT NULL,
  description text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ledger_order ON public.ledger_entries(order_id);
CREATE INDEX idx_ledger_type ON public.ledger_entries(transaction_type);

-- Enable RLS on all new tables
ALTER TABLE public.mpesa_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mpesa_callbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mpesa_account_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

-- RLS policies for subscriptions (users can read their own)
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- RLS policies for earnings (users can read their own)
CREATE POLICY "Users can view own earnings" ON public.earnings
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Service role can do everything (edge functions use service role)
-- mpesa_transactions, mpesa_callbacks, mpesa_account_balances, ledger_entries
-- are managed by edge functions with service role key
