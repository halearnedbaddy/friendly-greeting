-- Allow public/anonymous users to view active payment methods (needed for buyer checkout)
CREATE POLICY "Anyone can view active payment methods"
ON public.payment_methods
FOR SELECT
USING (is_active = true);