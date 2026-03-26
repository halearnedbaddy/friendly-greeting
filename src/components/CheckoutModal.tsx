import { useState } from 'react';
import { X, CreditCard, Smartphone, Wallet } from 'lucide-react';
import { useCurrency } from '@/hooks/useCurrency';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabaseProject';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: string;
    name: string;
    description?: string;
    price?: number;
    images?: string[];
  };
  storeSlug: string;
  onSuccess: (transactionId: string) => void;
}

export function CheckoutModal({ isOpen, onClose, product, storeSlug, onSuccess }: CheckoutModalProps) {
  const { formatPrice } = useCurrency();
  const [step, setStep] = useState<'details' | 'payment' | 'processing'>('details');
  const [paymentMethod, setPaymentMethod] = useState<'MPESA' | 'MOBILE_MONEY' | 'CARD'>('MPESA');
  const [buyerDetails, setBuyerDetails] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);

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

    setError(null);
    setStep('processing');

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/storefront-api/checkout/${storeSlug}/${product.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          buyerName: buyerDetails.name,
          buyerPhone: buyerDetails.phone,
          buyerEmail: buyerDetails.email || undefined,
          deliveryAddress: buyerDetails.address || undefined,
          paymentMethod,
        }),
      });
      const response = await res.json();

      if (response.success && response.data) {
        const txId = (response.data as any).transactionId ?? (response.data as any).id;
        if (txId) {
          setTransactionId(txId);
          setStep('payment');
          onSuccess(txId);
        } else {
          throw new Error(response.error || 'Failed to create checkout');
        }
      } else {
        throw new Error(response.error || 'Failed to create checkout');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create checkout');
      setStep('details');
    }
  };

  const handleInitiatePayment = async () => {
    if (!transactionId) return;
    // Manual payment - redirect to buy page with transaction
    window.location.href = `/track/${transactionId}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">Checkout</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Product Summary */}
          <div className="border border-border rounded-xl p-4">
            <div className="flex gap-4">
              {product.images && product.images.length > 0 && (
                <img src={product.images[0]} alt={product.name} className="w-20 h-20 object-cover rounded-lg" />
              )}
              <div className="flex-1">
                <h3 className="font-semibold">{product.name}</h3>
                {product.price && (
                  <p className="text-lg font-bold text-[#3d1a7a] mt-1">{formatPrice(product.price ?? 0, (product as any).currency || 'KES')}</p>
                )}
              </div>
            </div>
          </div>

          {step === 'details' && (
            <>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={buyerDetails.name}
                    onChange={(e) => setBuyerDetails(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Enter your name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    value={buyerDetails.phone}
                    onChange={(e) => setBuyerDetails(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="+1234567890"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Email (optional)</label>
                  <input
                    type="email"
                    value={buyerDetails.email}
                    onChange={(e) => setBuyerDetails(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="your@email.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Delivery Address (optional)</label>
                  <textarea
                    value={buyerDetails.address}
                    onChange={(e) => setBuyerDetails(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    rows={3}
                    placeholder="Enter delivery address"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleCreateTransaction}
                className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:bg-primary/90 transition"
              >
                Continue to Payment
              </button>
            </>
          )}

          {step === 'payment' && (
            <>
              <div className="space-y-3">
                <h3 className="font-semibold">Select Payment Method</h3>
                <button
                  onClick={() => setPaymentMethod('MPESA')}
                  className={`w-full p-4 border-2 rounded-lg flex items-center gap-3 transition ${
                    paymentMethod === 'MPESA' ? 'border-primary bg-primary/10' : 'border-border'
                  }`}
                >
                  <Smartphone className="text-primary" size={24} />
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-foreground">M-Pesa</p>
                    <p className="text-sm text-muted-foreground">Pay via M-Pesa STK Push</p>
                  </div>
                </button>
                <button
                  onClick={() => setPaymentMethod('MOBILE_MONEY')}
                  className={`w-full p-4 border-2 rounded-lg flex items-center gap-3 transition ${
                    paymentMethod === 'MOBILE_MONEY' ? 'border-primary bg-primary/10' : 'border-border'
                  }`}
                >
                  <Wallet className="text-primary" size={24} />
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-foreground">Mobile Money</p>
                    <p className="text-sm text-muted-foreground">Other mobile money providers</p>
                  </div>
                </button>
                <button
                  onClick={() => setPaymentMethod('CARD')}
                  className={`w-full p-4 border-2 rounded-lg flex items-center gap-3 transition ${
                    paymentMethod === 'CARD' ? 'border-primary bg-primary/10' : 'border-border'
                  }`}
                >
                  <CreditCard className="text-primary" size={24} />
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-foreground">Card Payment</p>
                    <p className="text-sm text-muted-foreground">Credit or debit card</p>
                  </div>
                </button>
              </div>

              {error && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('details')}
                  className="flex-1 bg-muted text-foreground py-3 rounded-lg font-semibold hover:bg-muted/80 transition"
                >
                  Back
                </button>
                <button
                  onClick={handleInitiatePayment}
                  className="flex-1 bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:bg-primary/90 transition"
                >
                  Pay Now
                </button>
              </div>
            </>
          )}

          {step === 'processing' && (
            <div className="text-center py-8">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-muted-foreground">Processing...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

