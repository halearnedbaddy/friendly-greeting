-- Escrow deposits table to track manual payments
CREATE TABLE public.escrow_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  amount DOUBLE PRECISION NOT NULL,
  currency TEXT DEFAULT 'KES',
  payment_method TEXT NOT NULL, -- 'MPESA', 'BANK_TRANSFER', etc.
  payment_reference TEXT, -- M-Pesa code or bank reference from buyer
  payment_proof_url TEXT, -- Screenshot/receipt upload
  payer_phone TEXT,
  payer_name TEXT,
  
  -- Status flow: pending -> confirmed -> released | refunded
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'released', 'refunded', 'expired')),
  
  -- Admin actions
  confirmed_by_id UUID,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  released_by_id UUID,
  released_at TIMESTAMP WITH TIME ZONE,
  auto_release_at TIMESTAMP WITH TIME ZONE, -- 7 days after shipped
  
  -- Notes
  admin_notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create unique index to ensure one escrow per transaction
CREATE UNIQUE INDEX escrow_deposits_transaction_unique ON public.escrow_deposits(transaction_id);

-- Add escrow tracking fields to transactions
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS escrow_status TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS payment_instructions TEXT DEFAULT NULL;

-- RLS policies for escrow_deposits
ALTER TABLE public.escrow_deposits ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage all escrow deposits"
ON public.escrow_deposits FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Sellers can view their escrow deposits
CREATE POLICY "Sellers can view their escrow deposits"
ON public.escrow_deposits FOR SELECT
USING (EXISTS (
  SELECT 1 FROM transactions t 
  WHERE t.id = escrow_deposits.transaction_id 
  AND t.seller_id = auth.uid()
));

-- Buyers can view their escrow deposits
CREATE POLICY "Buyers can view their escrow deposits"
ON public.escrow_deposits FOR SELECT
USING (EXISTS (
  SELECT 1 FROM transactions t 
  WHERE t.id = escrow_deposits.transaction_id 
  AND t.buyer_id = auth.uid()
));

-- Trigger for updated_at
CREATE TRIGGER update_escrow_deposits_updated_at
BEFORE UPDATE ON public.escrow_deposits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();