
-- Allow buyers to view their own transactions (where buyer_id matches their auth id)
CREATE POLICY "Buyers can view their orders"
ON public.transactions
FOR SELECT
TO authenticated
USING (buyer_id = auth.uid());
