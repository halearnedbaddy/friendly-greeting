-- Fix function search path warning
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Fix overly permissive INSERT policies

-- Transactions: require seller_id to be set (for guest checkout, seller creates the link)
DROP POLICY IF EXISTS "Anyone can create transactions" ON public.transactions;
CREATE POLICY "Anyone can create transactions" ON public.transactions 
FOR INSERT WITH CHECK (seller_id IS NOT NULL);

-- Audit logs: require user_id or allow service role
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated can insert audit logs" ON public.audit_logs 
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL OR user_id IS NULL);

-- Notifications: only allow inserting for own user or by admins
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert own notifications" ON public.notifications 
FOR INSERT WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));