
-- Add dispute_type column to disputes table
ALTER TABLE public.disputes ADD COLUMN IF NOT EXISTS dispute_type text;

-- Add sender_type, sender_name, status tracking to dispute_messages
ALTER TABLE public.dispute_messages ADD COLUMN IF NOT EXISTS sender_type text DEFAULT 'CUSTOMER';
ALTER TABLE public.dispute_messages ADD COLUMN IF NOT EXISTS sender_name text;
ALTER TABLE public.dispute_messages ADD COLUMN IF NOT EXISTS status text DEFAULT 'SENT';
ALTER TABLE public.dispute_messages ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
ALTER TABLE public.dispute_messages ADD COLUMN IF NOT EXISTS read_at timestamptz;

-- Create SMS logs table
CREATE TABLE IF NOT EXISTS public.sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient text NOT NULL,
  message text NOT NULL,
  event_type text,
  status text DEFAULT 'PENDING',
  metadata jsonb,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on sms_logs
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view SMS logs
CREATE POLICY "Admins can manage SMS logs" ON public.sms_logs
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Add method_name column to payment_methods for display purposes
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS method_name text;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_sms_logs_recipient ON public.sms_logs(recipient);
CREATE INDEX IF NOT EXISTS idx_sms_logs_status ON public.sms_logs(status);
CREATE INDEX IF NOT EXISTS idx_sms_logs_event_type ON public.sms_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_dispute_messages_status ON public.dispute_messages(status);
CREATE INDEX IF NOT EXISTS idx_disputes_dispute_type ON public.disputes(dispute_type);

-- Trigger for sms_logs updated_at
CREATE TRIGGER update_sms_logs_updated_at
  BEFORE UPDATE ON public.sms_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
