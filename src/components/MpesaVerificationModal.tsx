import { useState, useEffect } from 'react';
import { X, Smartphone, CheckCircle, AlertTriangle, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface MpesaVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  expectedAmount?: number;
  paymentRecipient?: string;
  onVerified?: () => void;
}

export function MpesaVerificationModal({
  isOpen,
  onClose,
  orderId,
  expectedAmount,
  paymentRecipient,
  onVerified,
}: MpesaVerificationModalProps) {
  const [transactionCode, setTransactionCode] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'pending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [_attempts, setAttempts] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen && orderId) {
      fetchAttempts();
    }
  }, [isOpen, orderId]);

  const fetchAttempts = async () => {
    try {
      const response = await supabase.functions.invoke('mpesa-api/verification-status', {
        method: 'GET',
      });
      if (response.data?.data) {
        setAttempts(response.data.data);
      }
    } catch {
      // Silently fail
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!transactionCode.trim() || !customerPhone.trim()) {
      setMessage('Please fill in all fields');
      setStatus('error');
      return;
    }

    // Validate M-Pesa code format
    const codeRegex = /^[A-Z0-9]{10}$/i;
    if (!codeRegex.test(transactionCode.trim())) {
      setMessage('Invalid M-Pesa code format. Must be exactly 10 alphanumeric characters (e.g. QGH7XYZ123)');
      setStatus('error');
      return;
    }

    // Format phone number
    let phone = customerPhone.replace(/[\s+\-]/g, '');
    if (phone.startsWith('0')) {
      phone = '254' + phone.slice(1);
    }
    if (!phone.startsWith('254')) {
      phone = '254' + phone;
    }

    const phoneRegex = /^254[0-9]{9}$/;
    if (!phoneRegex.test(phone)) {
      setMessage('Invalid phone number. Use format: 07XXXXXXXX or 254XXXXXXXXX');
      setStatus('error');
      return;
    }

    setStatus('submitting');
    setMessage('');

    try {
      const { data, error } = await supabase.functions.invoke('mpesa-api/verify', {
        body: {
          transaction_code: transactionCode.trim().toUpperCase(),
          customer_phone: phone,
          order_id: orderId,
          expected_amount: expectedAmount,
          payment_recipient: paymentRecipient,
        },
      });

      if (error) {
        setStatus('error');
        setMessage(error.message || 'Verification failed');
        return;
      }

      if (data?.success) {
        setStatus('pending');
        setMessage(data.message || 'Verification submitted! Awaiting M-Pesa confirmation.');
        onVerified?.();
      } else {
        setStatus('error');
        setMessage(data?.error || 'Verification failed');
      }
    } catch (err: any) {
      setStatus('error');
      setMessage(err?.message || 'An error occurred. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card rounded-2xl w-full max-w-md shadow-2xl border border-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-primary/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-foreground text-lg">Verify M-Pesa Payment</h2>
              <p className="text-xs text-muted-foreground">Enter your M-Pesa transaction code</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {expectedAmount && (
            <div className="mb-4 p-3 bg-accent/50 rounded-xl border border-accent">
              <p className="text-sm text-muted-foreground">Expected Amount</p>
              <p className="text-xl font-bold text-foreground">KES {expectedAmount.toLocaleString()}</p>
              {paymentRecipient && (
                <p className="text-xs text-muted-foreground mt-1">To: {paymentRecipient}</p>
              )}
            </div>
          )}

          {status === 'success' ? (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-bold text-foreground mb-2">Payment Verified!</h3>
              <p className="text-sm text-muted-foreground">{message}</p>
              <button
                onClick={onClose}
                className="mt-6 w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity"
              >
                Done
              </button>
            </div>
          ) : status === 'pending' ? (
            <div className="text-center py-8">
              <Loader2 className="w-16 h-16 text-primary mx-auto mb-4 animate-spin" />
              <h3 className="text-lg font-bold text-foreground mb-2">Verification Submitted</h3>
              <p className="text-sm text-muted-foreground">{message}</p>
              <p className="text-xs text-muted-foreground mt-2">This may take a few moments. You'll be notified once confirmed.</p>
              <button
                onClick={onClose}
                className="mt-6 w-full py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Transaction Code */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  M-Pesa Transaction Code
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={transactionCode}
                    onChange={(e) => setTransactionCode(e.target.value.toUpperCase())}
                    placeholder="e.g. QGH7XYZ123"
                    maxLength={10}
                    className="w-full px-4 py-3 bg-background border border-input rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-lg tracking-wider uppercase"
                    disabled={status === 'submitting'}
                  />
                  <Smartphone className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Find this in your M-Pesa SMS confirmation message
                </p>
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Phone Number Used to Pay
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="07XXXXXXXX"
                  className="w-full px-4 py-3 bg-background border border-input rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  disabled={status === 'submitting'}
                />
              </div>

              {/* Error Message */}
              {status === 'error' && message && (
                <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-xl border border-destructive/20">
                  <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                  <p className="text-sm text-destructive">{message}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={status === 'submitting'}
                className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {status === 'submitting' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5" />
                    Verify Payment
                  </>
                )}
              </button>

              <p className="text-xs text-center text-muted-foreground">
                We verify your payment directly with Safaricom's M-Pesa system
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
