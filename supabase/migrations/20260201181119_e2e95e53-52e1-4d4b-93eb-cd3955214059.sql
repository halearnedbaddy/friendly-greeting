BEGIN;

-- Allow disputes not tied to a specific transaction ("general" disputes)
ALTER TABLE public.disputes
  ALTER COLUMN transaction_id DROP NOT NULL;

-- Update dispute creation policy to allow either:
-- 1) a dispute tied to a transaction the user participated in, OR
-- 2) a general dispute opened by the current user (transaction_id IS NULL)
DROP POLICY IF EXISTS "Users can create disputes for their transactions" ON public.disputes;
CREATE POLICY "Users can create disputes"
ON public.disputes
FOR INSERT
WITH CHECK (
  (transaction_id IS NULL AND opened_by_id = auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.transactions
    WHERE transactions.id = disputes.transaction_id
      AND (transactions.seller_id = auth.uid() OR transactions.buyer_id = auth.uid())
  )
);

-- Allow viewing dispute messages for both transaction-backed disputes and general disputes
DROP POLICY IF EXISTS "Dispute participants can view messages" ON public.dispute_messages;
CREATE POLICY "Dispute participants can view messages"
ON public.dispute_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.disputes d
    LEFT JOIN public.transactions t ON t.id = d.transaction_id
    WHERE d.id = dispute_messages.dispute_id
      AND (
        d.opened_by_id = auth.uid()
        OR t.seller_id = auth.uid()
        OR t.buyer_id = auth.uid()
      )
  )
);

COMMIT;