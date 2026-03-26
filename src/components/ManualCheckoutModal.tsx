import { useState, useEffect } from 'react';
import { X, Copy, Check, AlertCircle, Loader2, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/hooks/useCurrency';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabaseProject';
interface SellerPaymentMethod {
  id: string;
  provider: string;
  type: string;
  account_name: string;
  account_number: string;
  payment_type?: string | null;
  method_name?: string | null;
  details?: Record<string, string> | null;
  is_active: boolean | null;
  is_default: boolean | null;
}

interface ManualCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: string;
    name: string;
    description?: string;
    price?: number;
    currency?: string;
    images?: string[];
  };
  storeSlug: string;
  sellerId?: string;
  onSuccess: (transactionId: string) => void;
}

export function ManualCheckoutModal({ isOpen, onClose, product, storeSlug, sellerId, onSuccess }: ManualCheckoutModalProps) {
  const { formatPrice } = useCurrency();
  const [step, setStep] = useState<'details' | 'select-method' | 'payment' | 'success'>('details');
  const [sellerMethods, setSellerMethods] = useState<SellerPaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<SellerPaymentMethod | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [loadingMethods, setLoadingMethods] = useState(false);
  const [buyerDetails, setBuyerDetails] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
  });
  const [paymentDetails, setPaymentDetails] = useState({ reference: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSellerPaymentMethods();
    }
  }, [isOpen, sellerId, storeSlug]);

  const loadSellerPaymentMethods = async () => {
    setLoadingMethods(true);
    try {
      // If we have sellerId directly, use it
      let sid = sellerId;
      if (!sid) {
        // Fetch from store
        const { data: store } = await (supabase as any)
          .from('stores')
          .select('seller_id')
          .eq('slug', storeSlug)
          .maybeSingle();
        sid = (store as any)?.user_id;
      }

      if (sid) {
        const { data } = await (supabase
          .from('payment_methods' as any)
          .select('*')
          .eq('user_id', sid)
          .eq('is_active', true)
          .order('is_default', { ascending: false }) as any);

        if (data) {
          setSellerMethods(data as SellerPaymentMethod[]);
        }
      }
    } catch (err) {
      console.error('Failed to load seller methods:', err);
    } finally {
      setLoadingMethods(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const getProviderIcon = (provider: string) => {
    const p = provider?.toLowerCase() || '';
    if (p.includes('safaricom')) return '📱';
    if (p.includes('airtel')) return '🔴';
    if (p.includes('mtn')) return '🟡';
    if (p.includes('vodacom')) return '📱';
    if (p.includes('tigo')) return '📱';
    if (p.includes('bank')) return '🏦';
    return '💳';
  };

  if (!isOpen) return null;

  const handleCreateTransaction = async () => {
    if (!buyerDetails.name || !buyerDetails.phone) {
      setError('Please fill in your name and phone number');
      return;
    }
    if (!product.price) {
      setError('Product price is not available');
      return;
    }

    if (sellerMethods.length === 0) {
      setError('Seller has not configured payment methods yet. Please contact the seller.');
      return;
    }

    // If only one method, auto-select and skip method selection
    if (sellerMethods.length === 1) {
      setSelectedMethod(sellerMethods[0]);
      await createOrderAndProceed(sellerMethods[0]);
    } else {
      setStep('select-method');
    }
  };

  const handleSelectMethod = async (method: SellerPaymentMethod) => {
    setSelectedMethod(method);
    await createOrderAndProceed(method);
  };

  const createOrderAndProceed = async (method: SellerPaymentMethod) => {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/storefront-api/checkout/${encodeURIComponent(storeSlug)}/${encodeURIComponent(product.id)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            buyerName: buyerDetails.name,
            buyerPhone: buyerDetails.phone,
            buyerEmail: buyerDetails.email || undefined,
            deliveryAddress: buyerDetails.address || undefined,
            paymentMethod: method.payment_type || method.type || 'MPESA',
          }),
        }
      );

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to create order');
      }

      const txId = data.data?.id || data.data?.transactionId;
      if (txId) {
        setTransactionId(txId);
        setStep('payment');
      } else {
        throw new Error('No transaction ID returned');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create order');
      setStep('details');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitPayment = async () => {
    if (!paymentDetails.reference) {
      setError('Please enter your payment reference code');
      return;
    }
    if (!transactionId) {
      setError('Transaction not found');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/escrow-api/submit-payment/${transactionId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            paymentMethod: selectedMethod?.payment_type || selectedMethod?.type || 'MPESA',
            paymentReference: paymentDetails.reference,
            payerPhone: buyerDetails.phone,
            payerName: buyerDetails.name,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to submit payment');
      }

      setStep('success');
      onSuccess(transactionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit payment');
    } finally {
      setLoading(false);
    }
  };

  const renderPaymentInstructions = (method: SellerPaymentMethod) => {
    const d = method.details as Record<string, string> | null || {};
    const price = product.price || 0;
    const currency = product.currency || 'KES';
    const payType = method.payment_type || method.type || '';

    if (payType === 'PAYBILL' || payType === 'paybill') {
      return (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2 text-sm">
          <p className="font-bold text-foreground">📱 M-Pesa Paybill Instructions:</p>
          <ol className="space-y-2">
            <li>1. Go to M-Pesa → <strong>Lipa Na M-Pesa</strong> → <strong>Pay Bill</strong></li>
            <li className="flex items-center gap-1 flex-wrap">
              2. Business Number: <strong className="text-primary font-mono">{d.paybill_number || d.business_number}</strong>
              <button onClick={() => copyToClipboard(d.paybill_number || d.business_number || '', 'pb')} className="p-0.5 hover:bg-muted rounded">
                {copied === 'pb' ? <Check size={12} className="text-primary" /> : <Copy size={12} />}
              </button>
            </li>
            <li className="flex items-center gap-1 flex-wrap">
              3. Account Number: <strong className="text-primary font-mono">{d.account_number || method.account_number}</strong>
              <button onClick={() => copyToClipboard(d.account_number || method.account_number || '', 'ac')} className="p-0.5 hover:bg-muted rounded">
                {copied === 'ac' ? <Check size={12} className="text-primary" /> : <Copy size={12} />}
              </button>
            </li>
            <li>4. Amount: <strong className="text-primary">{formatPrice(price, currency)}</strong></li>
            <li>5. Enter your M-Pesa PIN and confirm</li>
            <li className="text-primary font-semibold">6. Enter the confirmation code below ↓</li>
          </ol>
        </div>
      );
    }

    if (payType === 'TILL' || payType === 'till') {
      return (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2 text-sm">
          <p className="font-bold text-foreground">📱 M-Pesa Buy Goods Instructions:</p>
          <ol className="space-y-2">
            <li>1. Go to M-Pesa → <strong>Lipa Na M-Pesa</strong> → <strong>Buy Goods</strong></li>
            <li className="flex items-center gap-1 flex-wrap">
              2. Till Number: <strong className="text-primary font-mono">{d.till_number}</strong>
              <button onClick={() => copyToClipboard(d.till_number || '', 'tl')} className="p-0.5 hover:bg-muted rounded">
                {copied === 'tl' ? <Check size={12} className="text-primary" /> : <Copy size={12} />}
              </button>
            </li>
            <li>3. Amount: <strong className="text-primary">{formatPrice(price, currency)}</strong></li>
            <li>4. Enter your M-Pesa PIN and confirm</li>
            <li className="text-primary font-semibold">5. Enter the confirmation code below ↓</li>
          </ol>
        </div>
      );
    }

    if (payType === 'BANK' || payType === 'bank_account' || payType === 'BANK_ACCOUNT') {
      return (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2 text-sm">
          <p className="font-bold text-foreground">🏦 Bank Transfer Instructions:</p>
          <div className="space-y-1">
            <p>Bank: <strong>{d.bank_name || method.provider}</strong></p>
            <p className="flex items-center gap-1">
              Account: <strong className="font-mono">{d.account_number || method.account_number}</strong>
              <button onClick={() => copyToClipboard(d.account_number || method.account_number || '', 'bank')} className="p-0.5 hover:bg-muted rounded">
                {copied === 'bank' ? <Check size={12} className="text-primary" /> : <Copy size={12} />}
              </button>
            </p>
            <p>Name: <strong>{d.account_name || method.account_name}</strong></p>
            {d.swift_code && <p>Swift: <strong className="font-mono">{d.swift_code}</strong></p>}
            <p>Amount: <strong className="text-primary">{formatPrice(price, currency)}</strong></p>
          </div>
        </div>
      );
    }

    // Default: Mobile Money (Send Money)
    return (
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2 text-sm">
        <p className="font-bold text-foreground">{getProviderIcon(method.provider)} Send Money Instructions:</p>
        <ol className="space-y-2">
          <li>1. Open {method.provider || 'Mobile Money'}</li>
          <li className="flex items-center gap-1 flex-wrap">
            2. Send to: <strong className="text-primary font-mono">{d.phone_number || method.account_number}</strong>
            <button onClick={() => copyToClipboard(d.phone_number || method.account_number || '', 'ph')} className="p-0.5 hover:bg-muted rounded">
              {copied === 'ph' ? <Check size={12} className="text-primary" /> : <Copy size={12} />}
            </button>
          </li>
          <li>3. Name: <strong>{d.account_name || method.account_name}</strong></li>
          <li>4. Amount: <strong className="text-primary">{formatPrice(price, currency)}</strong></li>
          <li className="text-primary font-semibold">5. Enter the confirmation code below ↓</li>
        </ol>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-card-foreground">
            {step === 'details' && 'Checkout'}
            {step === 'select-method' && 'Choose Payment Method'}
            {step === 'payment' && 'Complete Payment'}
            {step === 'success' && 'Payment Submitted'}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Product Summary */}
          <div className="border border-border rounded-lg p-4 bg-muted/30">
            <div className="flex gap-4">
              {product.images && product.images.length > 0 && (
                <img src={product.images[0]} alt={product.name} className="w-20 h-20 object-cover rounded-lg" />
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">{product.name}</h3>
                {product.price && (
                  <p className="text-lg font-bold text-primary mt-1">
                    {formatPrice(product.price, product.currency || 'KES')}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Step 1: Buyer Details */}
          {step === 'details' && (
            <>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={buyerDetails.name}
                    onChange={(e) => setBuyerDetails(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter your name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    value={buyerDetails.phone}
                    onChange={(e) => setBuyerDetails(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="+254712345678"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Email (optional)</label>
                  <input
                    type="email"
                    value={buyerDetails.email}
                    onChange={(e) => setBuyerDetails(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="your@email.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Delivery Address</label>
                  <textarea
                    value={buyerDetails.address}
                    onChange={(e) => setBuyerDetails(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    rows={2}
                    placeholder="Enter delivery address"
                  />
                </div>
              </div>

              {loadingMethods && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 size={14} className="animate-spin" />
                  Loading payment methods...
                </div>
              )}

              {error && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              <button
                onClick={handleCreateTransaction}
                disabled={loading || loadingMethods}
                className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><Loader2 size={16} className="animate-spin" /> Creating Order...</>
                ) : (
                  <>Continue to Payment <ChevronRight size={16} /></>
                )}
              </button>
            </>
          )}

          {/* Step 2: Select Payment Method */}
          {step === 'select-method' && (
            <>
              <p className="text-sm text-muted-foreground">
                Choose how you want to pay {formatPrice(product.price || 0, product.currency || 'KES')}
              </p>
              <div className="space-y-3">
                {sellerMethods.map((method) => (
                  <button
                    key={method.id}
                    onClick={() => handleSelectMethod(method)}
                    disabled={loading}
                    className="w-full text-left p-4 border border-border rounded-lg hover:border-primary transition bg-background disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{getProviderIcon(method.provider)}</span>
                        <div>
                          <p className="font-semibold text-foreground">{method.method_name || method.provider}</p>
                          <p className="text-xs text-muted-foreground">{method.provider}</p>
                        </div>
                      </div>
                      {method.is_default && (
                        <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">Default</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {loading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 size={24} className="animate-spin text-primary" />
                </div>
              )}

              {error && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              <button
                onClick={() => { setStep('details'); setError(null); }}
                className="w-full bg-muted text-muted-foreground py-3 rounded-lg font-semibold hover:bg-muted/80 transition"
              >
                ← Back
              </button>
            </>
          )}

          {/* Step 3: Payment Instructions */}
          {step === 'payment' && selectedMethod && (
            <>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-1">
                  💰 Pay {formatPrice(product.price || 0, product.currency || 'KES')}
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Send the exact amount using the details below, then enter your confirmation code.
                </p>
              </div>

              {renderPaymentInstructions(selectedMethod)}

              <div className="space-y-4 pt-4 border-t border-border">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Transaction Confirmation Code *
                  </label>
                  <input
                    type="text"
                    value={paymentDetails.reference}
                    onChange={(e) => setPaymentDetails({ reference: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary uppercase"
                    placeholder="e.g. QHK7XXXXXX"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setStep('details'); setError(null); }}
                  className="flex-1 bg-muted text-muted-foreground py-3 rounded-lg font-semibold hover:bg-muted/80 transition"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmitPayment}
                  disabled={loading || !paymentDetails.reference}
                  className="flex-1 bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Submitting...</> : 'I Have Paid'}
                </button>
              </div>
            </>
          )}

          {/* Step 4: Success */}
          {step === 'success' && (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                <Check className="text-green-600 dark:text-green-400" size={32} />
              </div>
              <h3 className="text-xl font-bold text-foreground">Payment Submitted!</h3>
              <p className="text-muted-foreground">
                Your payment is being verified. You'll receive a notification once it's confirmed.
              </p>
              <div className="bg-muted/50 rounded-lg p-4 text-sm">
                <p className="text-muted-foreground">Order ID</p>
                <p className="font-mono font-bold text-foreground">{transactionId}</p>
              </div>
              <button
                onClick={onClose}
                className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:bg-primary/90 transition"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}