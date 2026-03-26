
-- Fix RLS so sellers can view + update orders whether linked by seller_id or account_id

DROP POLICY IF EXISTS "Sellers can view their orders" ON public.transactions;
DROP POLICY IF EXISTS "Sellers can update their orders" ON public.transactions;

CREATE POLICY "Sellers can view their orders"
  ON public.transactions
  FOR SELECT
  USING (
    seller_id = auth.uid()
    OR account_id IN (
      SELECT id FROM public.accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can update their orders"
  ON public.transactions
  FOR UPDATE
  USING (
    seller_id = auth.uid()
    OR account_id IN (
      SELECT id FROM public.accounts WHERE user_id = auth.uid()
    )
  );
