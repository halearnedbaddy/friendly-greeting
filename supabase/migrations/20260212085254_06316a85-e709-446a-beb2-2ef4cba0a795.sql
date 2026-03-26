
-- Allow public to view active payment methods (so buyers can see seller's payment info)
CREATE POLICY "Public can view active payment methods"
ON public.payment_methods FOR SELECT
TO public
USING (is_active = true);

-- Create storage bucket for payment screenshots
INSERT INTO storage.buckets (id, name, public) 
VALUES ('transaction-screenshots', 'transaction-screenshots', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for screenshots
CREATE POLICY "Anyone can upload transaction screenshots"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'transaction-screenshots');

CREATE POLICY "Anyone can view transaction screenshots"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'transaction-screenshots');

-- Allow anonymous inserts to transactions for buyer checkout
CREATE POLICY "Anyone can create transactions for checkout"
ON public.transactions FOR INSERT
TO public
WITH CHECK (true);

-- Allow anyone to view transactions by payment_reference (for success page)
CREATE POLICY "Anyone can view transactions by reference"
ON public.transactions FOR SELECT
TO public
USING (payment_reference IS NOT NULL);

-- Unique index on transaction_code (only non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_code ON public.transactions(transaction_code) WHERE transaction_code IS NOT NULL;
