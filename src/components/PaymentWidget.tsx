import { useState } from 'react';
import { Smartphone, Loader, ShieldCheck, Clock, CheckCircle, Copy } from 'lucide-react';
import { useCurrency } from '@/hooks/useCurrency';
import { validateTransactionCode } from '@/lib/transactionValidation';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabaseProject';

interface PaymentWidgetProps {
  transactionId: string;
  linkId?: string;
  amount: number;
  buyerName?: string;
  buyerCurrency?: string;
  onPaymentSuccess?: () => void;
}

export function PaymentWidget({ transactionId, amount, buyerCurrency = 'KES', onPaymentSuccess }: PaymentWidgetProps) {
  const { formatPrice } = useCurrency();
  const [phone, setPhone] = useState('');
  const [transactionCode, setTransactionCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle');
  const [copied, setCopied] = useState(false);

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async () => {
    const validation = validateTransactionCode(transactionCode, 'MPESA');
    if (!validation.valid) {
      setCodeError(validation.error || 'Invalid code');
      return;
    }
    setCodeError(null);
    setIsLoading(true);
    setPaymentStatus('processing');

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/validate-payment/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({
          transactionId,
          transactionCode: transactionCode.trim().toUpperCase(),
          payerPhone: phone,
          paymentMethod: 'MPESA',
          amountPaid: amount,
        }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Submission failed');
      setPaymentStatus('success');
      onPaymentSuccess?.();
    } catch (err: any) {
      setError(err.message || 'Payment submission failed');
      setPaymentStatus('failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-card rounded-lg p-6 border border-border">
      {paymentStatus === 'idle' && (
        <>
          <h3 className="font-bold text-lg text-foreground mb-4">Complete Your Payment</h3>

          <div className="bg-muted p-3 rounded-lg mb-4">
            <p className="text-sm text-muted-foreground">Amount:</p>
            <p className="text-2xl font-bold text-foreground">{formatPrice(amount, buyerCurrency)}</p>
          </div>

          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-4">
            <p className="text-sm font-bold text-foreground mb-3">📱 M-Pesa Paybill Instructions:</p>
            <ol className="space-y-2 text-sm text-foreground">
              <li>1. Go to M-Pesa → <strong>Lipa Na M-Pesa</strong> → <strong>Pay Bill</strong></li>
              <li className="flex items-center gap-1">
                2. Business Number: <strong className="text-primary font-mono">522522</strong>
                <button onClick={() => copyText('522522')} className="p-1 hover:bg-muted rounded">
                  {copied ? <CheckCircle size={14} className="text-primary" /> : <Copy size={14} className="text-muted-foreground" />}
                </button>
              </li>
              <li>3. Account: <strong className="text-primary font-mono">{transactionId.slice(0, 12)}</strong></li>
              <li>4. Amount: <strong className="text-primary">{formatPrice(amount, buyerCurrency)}</strong></li>
              <li>5. Enter PIN and confirm</li>
            </ol>
          </div>

          <div className="space-y-3 mb-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Your Phone Number</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="+254712345678"
                className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Transaction Code *</label>
              <input type="text" value={transactionCode}
                onChange={e => { setTransactionCode(e.target.value.toUpperCase()); setCodeError(null); }}
                placeholder="e.g. SJK7Y6H4TQ" maxLength={12}
                className="w-full px-3 py-3 border border-input rounded-lg bg-background text-foreground font-mono text-lg tracking-wider focus:outline-none focus:ring-2 focus:ring-primary/20 uppercase" />
              {codeError && <p className="text-xs text-destructive mt-1">{codeError}</p>}
            </div>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg mb-4">{error}</div>
          )}

          <button onClick={handleSubmit} disabled={isLoading || !transactionCode.trim()}
            className="w-full bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground font-bold py-3 rounded-lg transition flex items-center justify-center gap-2">
            {isLoading ? <><Loader size={20} className="animate-spin" /> Processing...</> : <><Smartphone size={20} /> Submit Payment</>}
          </button>

          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-3">
            <ShieldCheck size={14} className="text-primary" />
            <span>Secure manual verification</span>
          </div>
        </>
      )}

      {paymentStatus === 'processing' && (
        <div className="py-12 text-center space-y-4">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <Loader size={28} className="text-primary animate-spin" />
          </div>
          <h3 className="text-lg font-bold text-foreground">Verifying Payment...</h3>
          <p className="text-sm text-muted-foreground">
            Checking code <strong className="font-mono">{transactionCode}</strong>
          </p>
          <div className="flex items-center justify-center gap-2 text-primary animate-pulse">
            <Clock size={16} />
            <span className="text-sm font-medium">Please wait...</span>
          </div>
        </div>
      )}

      {paymentStatus === 'success' && (
        <div className="py-8 text-center space-y-4">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle size={32} className="text-primary" />
          </div>
          <h3 className="text-lg font-bold text-foreground">Payment Submitted!</h3>
          <p className="text-sm text-muted-foreground">Your payment is being reviewed. You'll be notified once approved.</p>
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-start gap-2 text-sm text-left">
            <ShieldCheck size={16} className="text-primary shrink-0 mt-0.5" />
            <span>Your money is held securely until you confirm delivery.</span>
          </div>
          <button onClick={() => window.location.href = '/'} className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-bold hover:bg-primary/90 transition">
            Back to Home
          </button>
        </div>
      )}

      {paymentStatus === 'failed' && (
        <div className="py-8 text-center space-y-4">
          <div className="text-4xl">❌</div>
          <p className="text-destructive font-bold">Payment Failed</p>
          {error && <p className="text-sm text-destructive/80">{error}</p>}
          <button onClick={() => { setPaymentStatus('idle'); setError(null); }}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold py-2 px-4 rounded-lg">
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
