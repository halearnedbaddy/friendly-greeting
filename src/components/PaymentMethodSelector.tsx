import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Copy, Check, CheckCircle, Info, Loader2 } from 'lucide-react';
import { useCurrency } from '@/hooks/useCurrency';

interface SellerMethod {
  id: string;
  provider: string;
  payment_type: string | null;
  account_name: string;
  account_number: string;
  method_name: string | null;
  details: Record<string, any> | null;
  is_default: boolean | null;
  country: string | null;
}

interface PaymentMethodSelectorProps {
  sellerId: string;
  amount: number;
  currency: string;
  onPaymentSubmit: (method: SellerMethod, reference: string, phone: string) => void;
  loading?: boolean;
}

export function PaymentMethodSelector({ sellerId, amount, currency, onPaymentSubmit, loading: submitting }: PaymentMethodSelectorProps) {
  const { formatPrice } = useCurrency();
  const [methods, setMethods] = useState<SellerMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState<SellerMethod | null>(null);
  const [transactionCode, setTransactionCode] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetchSellerMethods();
  }, [sellerId]);

  const fetchSellerMethods = async () => {
    setLoading(true);
    const { data, error } = await (supabase
      .from('payment_methods' as any)
      .select('*')
      .eq('user_id', sellerId)
      .eq('is_active', true)
      .order('is_default', { ascending: false }) as any);

    if (!error && data) {
      setMethods(data as SellerMethod[]);
      // Auto-select default
      const defaultMethod = (data as any[]).find((m: any) => m.is_default);
      if (defaultMethod) setSelectedMethod(defaultMethod as SellerMethod);
    }
    setLoading(false);
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const getProviderIcon = (provider: string) => {
    if (provider.toLowerCase().includes('safaricom') || provider.toLowerCase().includes('m-pesa') || provider.toLowerCase().includes('mpesa')) return '📱';
    if (provider.toLowerCase().includes('airtel')) return '🔴';
    if (provider.toLowerCase().includes('mtn')) return '🟡';
    if (provider.toLowerCase().includes('vodacom')) return '📱';
    if (provider.toLowerCase().includes('tigo')) return '📱';
    if (provider.toLowerCase().includes('bank')) return '🏦';
    return '💳';
  };

  const getPaymentInstructions = (method: SellerMethod) => {
    const details = method.details || {};
    const type = method.payment_type?.toUpperCase() || '';

    if (type === 'PAYBILL' || type.includes('PAYBILL')) {
      return [
        'Go to M-Pesa menu on your phone',
        'Select "Lipa na M-Pesa" → "Paybill"',
        { text: `Business Number: ${details.paybill_number || details.business_number || method.account_number}`, copyable: true, value: details.paybill_number || details.business_number || method.account_number },
        { text: `Account Number: ${details.account_number || ''}`, copyable: true, value: details.account_number || '' },
        { text: `Amount: ${currency} ${amount.toLocaleString()}`, copyable: true, value: amount.toString() },
        'Enter your M-Pesa PIN',
        'You\'ll receive an SMS confirmation',
        'Enter the transaction code below ↓',
      ];
    }

    if (type === 'TILL' || type.includes('TILL')) {
      return [
        'Go to M-Pesa menu',
        'Select "Lipa na M-Pesa" → "Buy Goods and Services"',
        { text: `Till Number: ${details.till_number || method.account_number}`, copyable: true, value: details.till_number || method.account_number },
        { text: `Amount: ${currency} ${amount.toLocaleString()}`, copyable: true, value: amount.toString() },
        'Enter your PIN',
        'Enter transaction code below ↓',
      ];
    }

    // Mobile money (send money)
    return [
      `Open ${method.provider} on your phone`,
      'Select "Send Money"',
      { text: `Phone Number: ${details.phone_number || method.account_number}`, copyable: true, value: details.phone_number || method.account_number },
      { text: `Amount: ${currency} ${amount.toLocaleString()}`, copyable: true, value: amount.toString() },
      'Enter your PIN',
      'Enter transaction code below ↓',
    ];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="animate-spin text-primary" size={24} />
        <span className="ml-2 text-muted-foreground">Loading payment methods...</span>
      </div>
    );
  }

  if (methods.length === 0) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <p className="text-amber-800 dark:text-amber-200 font-medium">No payment methods available</p>
        <p className="text-sm text-amber-600 dark:text-amber-300 mt-1">The seller has not configured payment methods yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Choose Payment Method</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Amount to pay: <span className="font-bold text-primary">{formatPrice(amount, currency)}</span>
        </p>
      </div>

      {/* Method Selection */}
      <div className="space-y-2">
        {methods.map((method) => (
          <button
            key={method.id}
            onClick={() => setSelectedMethod(method)}
            className={`w-full text-left p-4 border-2 rounded-lg transition-all ${
              selectedMethod?.id === method.id
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-xl">
                  {getProviderIcon(method.provider)}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{method.method_name || method.provider}</p>
                  <p className="text-xs text-muted-foreground">{method.provider}</p>
                </div>
              </div>
              {selectedMethod?.id === method.id && (
                <CheckCircle className="text-primary" size={20} />
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Payment Instructions */}
      {selectedMethod && (
        <div className="bg-accent/30 border border-accent/50 rounded-lg p-5 space-y-4">
          <div className="flex items-start gap-2">
            <Info className="text-primary mt-0.5 flex-shrink-0" size={18} />
            <h4 className="font-semibold text-foreground">Payment Instructions</h4>
          </div>

          <ol className="space-y-2 text-sm">
            {getPaymentInstructions(selectedMethod).map((step, i) => {
              if (typeof step === 'string') {
                return <li key={i} className="text-muted-foreground">{i + 1}. {step}</li>;
              }
              return (
                <li key={i} className="flex items-center justify-between bg-background rounded-lg p-2 border border-border">
                  <span className="text-foreground font-medium">{i + 1}. {step.text}</span>
                  <button
                    onClick={() => copyToClipboard(step.value, `step-${i}`)}
                    className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition"
                  >
                    {copied === `step-${i}` ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                  </button>
                </li>
              );
            })}
          </ol>

          {/* Transaction Code Input */}
          <div className="pt-4 border-t border-border space-y-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Your Phone Number *
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="+254712345678"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Transaction/Confirmation Code *
              </label>
              <input
                type="text"
                value={transactionCode}
                onChange={(e) => setTransactionCode(e.target.value.toUpperCase())}
                className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary uppercase"
                placeholder="e.g., QHK7XXXXXX"
              />
              <p className="text-xs text-muted-foreground mt-1">Enter the confirmation code from your payment SMS</p>
            </div>

            <button
              onClick={() => onPaymentSubmit(selectedMethod, transactionCode, customerPhone)}
              disabled={!transactionCode.trim() || !customerPhone.trim() || submitting}
              className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Payment'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
