
-- RLS policies for mpesa_transactions (service role manages, no public access)
CREATE POLICY "Service role manages mpesa_transactions" ON public.mpesa_transactions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- RLS policies for mpesa_callbacks
CREATE POLICY "Service role manages mpesa_callbacks" ON public.mpesa_callbacks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- RLS policies for mpesa_account_balances
CREATE POLICY "Service role manages mpesa_account_balances" ON public.mpesa_account_balances
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- RLS policies for ledger_entries
CREATE POLICY "Service role manages ledger_entries" ON public.ledger_entries
  FOR ALL TO service_role USING (true) WITH CHECK (true);
