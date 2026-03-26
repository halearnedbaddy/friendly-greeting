import { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/hooks/useCurrency';
import { LoaderIcon, ShieldIcon, CheckCircleIcon, ChevronRightIcon, XIcon } from '@/components/icons';
import { Copy, Sparkles } from 'lucide-react';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabaseProject';
import { validateTransactionCode } from '@/lib/transactionValidation';
import { supabase } from '@/integrations/supabase/client';
import confetti from 'canvas-confetti';

interface PaymentLinkData {
  id: string;
  productName: string;
  productDescription?: string;
  price: number;
  originalPrice?: number;
  currency: string;
  images: string[];
  status: string;
  seller: {
    id: string;
    name: string;
    sellerProfile?: {
      rating: number;
      totalReviews: number;
      isVerified: boolean;
    };
  };
}

interface SellerPaymentMethod {
  id: string;
  provider: string;
  type: string;
  account_name: string;
  account_number: string;
  is_active: boolean | null;
  is_default: boolean | null;
  method_name: string | null;
  payment_type: string;
  details: Record<string, string> | null;
}

type CheckoutStep = 'details' | 'select-method' | 'instructions' | 'submitting' | 'success';

export function BuyPage() {
  const { linkId } = useParams<{ linkId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { formatPrice } = useCurrency();
  const [link, setLink] = useState<PaymentLinkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>('details');
  const [activeImage, setActiveImage] = useState(0);
  const [sellerMethods, setSellerMethods] = useState<SellerPaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<SellerPaymentMethod | null>(null);
  const [transactionCode, setTransactionCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [buyerInfo, setBuyerInfo] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
  });

  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    const reference = searchParams.get('reference');
    if (paymentStatus === 'success' && reference) {
      setShowCheckout(true);
      setCheckoutStep('success');
      setTransactionCode(reference);
    }
  }, [searchParams]);

  useEffect(() => {
    if (linkId) loadPaymentLink();
  }, [linkId]);

  const loadPaymentLink = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/links-api/${linkId}`, {
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      });
      const result = await response.json();
      if (result.success && result.data) {
        setLink(result.data);
        if (result.data.seller?.id) loadSellerMethods(result.data.seller.id);
      } else {
        setError(result.error || 'Payment link not found');
      }
    } catch (err) {
      setError('Failed to load payment link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadSellerMethods = async (sellerId: string) => {
    try {
      const { data } = await (supabase
        .from('payment_methods' as any)
        .select('*')
        .eq('user_id', sellerId)
        .eq('is_active', true)
        .order('is_default', { ascending: false }) as any);

      if (data && data.length > 0) {
        setSellerMethods(data.map((m: any) => ({
          ...m,
          payment_type: m.payment_type || m.type || 'MPESA',
          details: m.details || {},
        })));
      } else {
        // Default PayLoom PayBill as fallback
        setSellerMethods([{
          id: 'payloom-default',
          provider: 'PayLoom PayBill',
          type: 'mobile_money',
          account_name: 'PayLoom',
          account_number: '522533',
          is_active: true,
          is_default: true,
          method_name: 'PayLoom PayBill (Recommended)',
          payment_type: 'PAYBILL',
          details: { paybill_number: '522533', account_number: `PL-${sellerId.slice(0, 8).toUpperCase()}` },
        }]);
      }
    } catch (err) {
      console.error('Failed to load seller methods:', err);
    }
  };

  const validateBuyerInfo = () => {
    if (!buyerInfo.name.trim()) {
      toast({ title: 'Required', description: 'Please enter your name', variant: 'destructive' });
      return false;
    }
    if (!buyerInfo.phone.trim()) {
      toast({ title: 'Required', description: 'Please enter your phone number', variant: 'destructive' });
      return false;
    }
    return true;
  };

  const handleContinueToPay = () => {
    if (!validateBuyerInfo()) return;
    if (sellerMethods.length === 0) {
      toast({ title: 'No Payment Methods', description: 'Seller has not configured payment methods', variant: 'destructive' });
      return;
    }
    setCheckoutStep('select-method');
  };

  const handleSelectMethod = (method: SellerPaymentMethod) => {
    setSelectedMethod(method);
    setCheckoutStep('instructions');
  };

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const triggerConfetti = () => {
    const duration = 3000;
    const end = Date.now() + duration;
    const frame = () => {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#3d1a7a', '#5d2ba3', '#06d6a0', '#ffd700'] });
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#3d1a7a', '#5d2ba3', '#06d6a0', '#ffd700'] });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  };

  const handleSubmitPayment = async () => {
    if (!selectedMethod) return;
    const validation = validateTransactionCode(transactionCode, selectedMethod.payment_type);
    if (!validation.valid) {
      setCodeError(validation.error || 'Invalid code');
      return;
    }
    setCodeError(null);
    setSubmitting(true);
    setCheckoutStep('submitting');

    try {
      // Create order
      const orderResponse = await fetch(`${SUPABASE_URL}/functions/v1/links-api/${linkId}/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({
          buyerName: buyerInfo.name,
          buyerPhone: buyerInfo.phone || undefined,
          buyerEmail: buyerInfo.email || undefined,
          deliveryAddress: buyerInfo.address || undefined,
          paymentMethod: selectedMethod.payment_type || 'MPESA',
        }),
      });
      const orderResult = await orderResponse.json();
      if (!orderResult.success || !orderResult.data?.transactionId) {
        throw new Error(orderResult.error || 'Failed to create order');
      }
      const orderId = orderResult.data.transactionId;
      setTransactionId(orderId);

      // Submit for validation
      const validateResponse = await fetch(`${SUPABASE_URL}/functions/v1/validate-payment/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({
          transactionId: orderId,
          transactionCode: transactionCode.trim().toUpperCase(),
          payerPhone: buyerInfo.phone,
          payerName: buyerInfo.name,
          paymentMethod: selectedMethod.payment_type || 'MPESA',
          amountPaid: link?.price,
        }),
      });
      const validateResult = await validateResponse.json();
      if (!validateResult.success) throw new Error(validateResult.error || 'Failed to submit');

      setCheckoutStep('success');
      triggerConfetti();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      setCheckoutStep('instructions');
    } finally {
      setSubmitting(false);
    }
  };

  const getMethodIcon = (method: SellerPaymentMethod) => {
    const pt = method.payment_type;
    if (pt === 'PAYBILL') return '🏢';
    if (pt === 'TILL') return '🏪';
    if (pt === 'BANK_ACCOUNT') return '🏦';
    return '📱';
  };

  const getMethodLabel = (method: SellerPaymentMethod) => {
    return method.method_name || method.provider || method.payment_type;
  };

  const getMethodSubtext = (method: SellerPaymentMethod) => {
    const d = method.details || {};
    if (d.paybill_number) return `PayBill: ${d.paybill_number} • Acc: ${d.account_number || method.account_number}`;
    if (d.till_number) return `Till: ${d.till_number}`;
    if (d.phone_number) return `Phone: ${d.phone_number}`;
    if (d.bank_name) return `${d.bank_name} • ${d.account_number || method.account_number}`;
    return method.account_number;
  };

  const renderInstructions = (method: SellerPaymentMethod) => {
    const d = method.details || {};
    const price = link?.price || 0;
    const currency = link?.currency || 'KES';

    switch (method.payment_type) {
      case 'PAYBILL':
        return (
          <div className="space-y-4">
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
              <p className="text-sm font-bold text-foreground mb-4">📱 M-Pesa Paybill Instructions</p>
              <ol className="space-y-3 text-sm text-foreground">
                <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">1</span>Go to M-Pesa → Lipa Na M-Pesa → Pay Bill</li>
                <li className="flex gap-3 items-center">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">2</span>
                  <span>Business Number: <strong className="font-mono text-primary">{d.paybill_number}</strong></span>
                  <button onClick={() => copyToClipboard(d.paybill_number || '', 'pb')} className="ml-1 p-1 hover:bg-muted rounded transition">
                    {copied === 'pb' ? <CheckCircleIcon size={14} className="text-primary" /> : <Copy size={14} className="text-muted-foreground" />}
                  </button>
                </li>
                <li className="flex gap-3 items-center">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">3</span>
                  <span>Account Number: <strong className="font-mono text-primary">{d.account_number || method.account_number}</strong></span>
                  <button onClick={() => copyToClipboard(d.account_number || method.account_number, 'ac')} className="ml-1 p-1 hover:bg-muted rounded transition">
                    {copied === 'ac' ? <CheckCircleIcon size={14} className="text-primary" /> : <Copy size={14} className="text-muted-foreground" />}
                  </button>
                </li>
                <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">4</span>Amount: <strong className="text-primary">{formatPrice(price, currency)}</strong></li>
                <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">5</span>Enter M-Pesa PIN and confirm</li>
              </ol>
            </div>
          </div>
        );
      case 'TILL':
        return (
          <div className="space-y-4">
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
              <p className="text-sm font-bold text-foreground mb-4">📱 M-Pesa Buy Goods Instructions</p>
              <ol className="space-y-3 text-sm text-foreground">
                <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">1</span>Go to M-Pesa → Lipa Na M-Pesa → Buy Goods</li>
                <li className="flex gap-3 items-center">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">2</span>
                  <span>Till Number: <strong className="font-mono text-primary">{d.till_number}</strong></span>
                  <button onClick={() => copyToClipboard(d.till_number || '', 'tl')} className="ml-1 p-1 hover:bg-muted rounded transition">
                    {copied === 'tl' ? <CheckCircleIcon size={14} className="text-primary" /> : <Copy size={14} className="text-muted-foreground" />}
                  </button>
                </li>
                <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">3</span>Amount: <strong className="text-primary">{formatPrice(price, currency)}</strong></li>
                <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">4</span>Enter M-Pesa PIN and confirm</li>
              </ol>
            </div>
          </div>
        );
      case 'BANK_ACCOUNT':
        return (
          <div className="space-y-4">
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
              <p className="text-sm font-bold text-foreground mb-4">🏦 Bank Transfer Instructions</p>
              <div className="space-y-2 text-sm">
                <p>Bank: <strong>{d.bank_name}</strong></p>
                <p className="flex items-center gap-2">Account: <strong className="font-mono">{d.account_number || method.account_number}</strong>
                  <button onClick={() => copyToClipboard(d.account_number || method.account_number, 'ba')} className="p-1 hover:bg-muted rounded transition">
                    {copied === 'ba' ? <CheckCircleIcon size={14} className="text-primary" /> : <Copy size={14} className="text-muted-foreground" />}
                  </button>
                </p>
                <p>Name: <strong>{d.account_name || method.account_name}</strong></p>
                {d.swift_code && <p>Swift: <strong className="font-mono">{d.swift_code}</strong></p>}
                <p>Amount: <strong className="text-primary">{formatPrice(price, currency)}</strong></p>
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="space-y-4">
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
              <p className="text-sm font-bold text-foreground mb-4">📱 Send Money Instructions</p>
              <ol className="space-y-3 text-sm text-foreground">
                <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">1</span>Open M-Pesa → Send Money</li>
                <li className="flex gap-3 items-center">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">2</span>
                  <span>Send to: <strong className="font-mono text-primary">{d.phone_number || method.account_number}</strong></span>
                  <button onClick={() => copyToClipboard(d.phone_number || method.account_number, 'ph')} className="ml-1 p-1 hover:bg-muted rounded transition">
                    {copied === 'ph' ? <CheckCircleIcon size={14} className="text-primary" /> : <Copy size={14} className="text-muted-foreground" />}
                  </button>
                </li>
                <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">3</span>Name: <strong>{d.account_name || method.account_name}</strong></li>
                <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">4</span>Amount: <strong className="text-primary">{formatPrice(price, currency)}</strong></li>
                <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">5</span>Enter PIN and confirm</li>
              </ol>
            </div>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <LoaderIcon size={48} className="animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading product...</p>
        </div>
      </div>
    );
  }

  if (error || !link) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-lg p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <XIcon size={32} className="text-destructive" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">Link Not Available</h1>
          <p className="text-muted-foreground mb-6">{error || 'This payment link is invalid or has expired.'}</p>
          <Link to="/" className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium">
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  const discount = link.originalPrice ? Math.round(((link.originalPrice - link.price) / link.originalPrice) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-lg font-bold text-foreground">Pay<em className="text-primary not-italic">Loom</em></span>
          </Link>
          <div className="flex items-center gap-2 text-sm text-primary">
            <ShieldIcon size={16} />
            <span>Secure Checkout</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Product Images */}
          <div className="space-y-4">
            <div className="aspect-square bg-card rounded-lg border border-border overflow-hidden">
              {link.images && link.images.length > 0 ? (
                <img src={link.images[activeImage]} alt={link.productName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground">No image</div>
              )}
            </div>
            {link.images && link.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {link.images.map((img, idx) => (
                  <button key={idx} onClick={() => setActiveImage(idx)}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition ${activeImage === idx ? 'border-primary' : 'border-border'}`}>
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 text-sm">
              <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center text-primary font-bold">
                {link.seller.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-foreground">{link.seller.name}</p>
                {link.seller.sellerProfile?.isVerified && (
                  <span className="inline-flex items-center gap-1 text-xs text-primary">
                    <CheckCircleIcon size={12} /> Verified Seller
                  </span>
                )}
              </div>
            </div>

            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">{link.productName}</h1>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-primary">{formatPrice(link.price, link.currency)}</span>
                {link.originalPrice && link.originalPrice > link.price && (
                  <>
                    <span className="text-lg text-muted-foreground line-through">{formatPrice(link.originalPrice, link.currency)}</span>
                    <span className="px-2 py-1 bg-primary/10 text-primary text-sm font-medium rounded">{discount}% OFF</span>
                  </>
                )}
              </div>
            </div>

            {link.productDescription && (
              <div>
                <h3 className="font-medium text-foreground mb-2">Description</h3>
                <p className="text-muted-foreground">{link.productDescription}</p>
              </div>
            )}

            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm"><CheckCircleIcon size={16} className="text-primary" /><span>PayLoom Protection - Secure payment processing</span></div>
              <div className="flex items-center gap-2 text-sm"><CheckCircleIcon size={16} className="text-primary" /><span>Money-back guarantee if item not received</span></div>
              <div className="flex items-center gap-2 text-sm"><CheckCircleIcon size={16} className="text-primary" /><span>Manual verification for fraud protection</span></div>
            </div>

            <button onClick={() => setShowCheckout(true)}
              className="w-full py-4 bg-primary text-primary-foreground rounded-lg font-bold text-lg hover:bg-primary/90 transition flex items-center justify-center gap-2">
              Continue to Pay <ChevronRightIcon size={20} />
            </button>
          </div>
        </div>
      </main>

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !submitting && setShowCheckout(false)} />
          <div className="relative bg-card rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md sm:mx-4 max-h-[92vh] overflow-y-auto border border-border">
            {/* Modal Header */}
            <div className="sticky top-0 bg-card z-10 p-5 border-b border-border flex items-center justify-between rounded-t-2xl">
              <h2 className="text-lg font-bold text-foreground">
                {checkoutStep === 'details' && 'Your Details'}
                {checkoutStep === 'select-method' && 'Choose Payment Method'}
                {checkoutStep === 'instructions' && 'Complete Payment'}
                {checkoutStep === 'submitting' && 'Verifying...'}
                {checkoutStep === 'success' && '🎉 Payment Received!'}
              </h2>
              {!submitting && checkoutStep !== 'success' && (
                <button onClick={() => { setShowCheckout(false); setCheckoutStep('details'); }} className="p-2 hover:bg-muted rounded-full transition">
                  <XIcon size={20} />
                </button>
              )}
            </div>

            <div className="p-5 space-y-5">
              {/* Order Summary (always visible except success) */}
              {checkoutStep !== 'success' && (
                <div className="bg-muted rounded-xl p-4">
                  <div className="flex gap-4">
                    {link.images?.[0] && <img src={link.images[0]} alt="" className="w-16 h-16 object-cover rounded-lg" />}
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{link.productName}</p>
                      <p className="text-xl font-bold text-primary">{formatPrice(link.price, link.currency)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Step: Buyer Details */}
              {checkoutStep === 'details' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Full Name *</label>
                    <input type="text" value={buyerInfo.name} onChange={e => setBuyerInfo({...buyerInfo, name: e.target.value})}
                      placeholder="John Doe" className="w-full px-4 py-3 border border-input rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Phone Number *</label>
                    <input type="tel" value={buyerInfo.phone} onChange={e => setBuyerInfo({...buyerInfo, phone: e.target.value})}
                      placeholder="+254712345678" className="w-full px-4 py-3 border border-input rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Email (Optional)</label>
                    <input type="email" value={buyerInfo.email} onChange={e => setBuyerInfo({...buyerInfo, email: e.target.value})}
                      placeholder="you@example.com" className="w-full px-4 py-3 border border-input rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Delivery Address (Optional)</label>
                    <textarea value={buyerInfo.address} onChange={e => setBuyerInfo({...buyerInfo, address: e.target.value})}
                      placeholder="Enter delivery address" rows={2} className="w-full px-4 py-3 border border-input rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none transition" />
                  </div>
                  <button onClick={handleContinueToPay}
                    className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-bold text-base hover:bg-primary/90 transition">
                    Continue to Pay →
                  </button>
                </div>
              )}

              {/* Step: Select Payment Method */}
              {checkoutStep === 'select-method' && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Select how you'd like to pay:</p>
                  {sellerMethods.map((method, index) => (
                    <button
                      key={method.id}
                      onClick={() => handleSelectMethod(method)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 hover:shadow-md ${
                        selectedMethod?.id === method.id
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl shrink-0">
                          {getMethodIcon(method)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-foreground">{getMethodLabel(method)}</p>
                            {index === 0 && method.is_default && (
                              <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full flex items-center gap-1">
                                <Sparkles size={10} /> Recommended
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">{getMethodSubtext(method)}</p>
                        </div>
                        <ChevronRightIcon size={18} className="text-muted-foreground shrink-0" />
                      </div>
                    </button>
                  ))}
                  <button onClick={() => setCheckoutStep('details')}
                    className="w-full py-3 border border-input rounded-xl text-foreground hover:bg-muted transition text-sm font-medium">
                    ← Back
                  </button>
                </div>
              )}

              {/* Step: Payment Instructions + Transaction Code */}
              {checkoutStep === 'instructions' && selectedMethod && (
                <div className="space-y-4">
                  {renderInstructions(selectedMethod)}

                  <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 text-sm text-foreground">
                    <strong>⚠️ Important:</strong> Pay exactly <strong className="text-primary">{formatPrice(link.price, link.currency)}</strong>. After paying, enter your M-Pesa transaction code below.
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-foreground mb-2">Transaction Code *</label>
                    <input type="text" value={transactionCode}
                      onChange={e => { setTransactionCode(e.target.value.toUpperCase()); setCodeError(null); }}
                      placeholder="e.g. SJK7Y6H4TQ" maxLength={13}
                      className="w-full px-4 py-4 border border-input rounded-xl bg-background text-foreground font-mono text-lg tracking-wider focus:outline-none focus:ring-2 focus:ring-primary/20 uppercase transition" />
                    {codeError && <p className="text-xs text-destructive mt-1">{codeError}</p>}
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setCheckoutStep('select-method')} className="flex-1 py-3 border border-input rounded-xl text-foreground hover:bg-muted transition text-sm font-medium">← Back</button>
                    <button onClick={handleSubmitPayment} disabled={!transactionCode.trim()}
                      className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition disabled:opacity-50">
                      Confirm Payment
                    </button>
                  </div>
                </div>
              )}

              {/* Step: Submitting */}
              {checkoutStep === 'submitting' && (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-6" />
                  <h3 className="font-bold text-foreground text-lg mb-2">Verifying Payment...</h3>
                  <p className="text-sm text-muted-foreground">Checking transaction code <strong className="font-mono text-primary">{transactionCode}</strong></p>
                </div>
              )}

              {/* Step: Success */}
              {checkoutStep === 'success' && (
                <div className="py-4 text-center">
                  {/* Animated checkmark */}
                  <div className="relative w-24 h-24 mx-auto mb-6">
                    <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                    <div className="relative w-24 h-24 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center shadow-lg shadow-primary/30">
                      <CheckCircleIcon size={48} className="text-primary-foreground" />
                    </div>
                  </div>

                  <h3 className="text-2xl font-black text-foreground mb-2">Payment Received!</h3>
                  <p className="text-muted-foreground mb-6">Your payment is being verified by the seller. You'll receive an SMS confirmation once approved.</p>

                  <div className="bg-muted rounded-xl p-4 text-left text-sm space-y-2 mb-6">
                    {transactionId && <div className="flex justify-between"><span className="text-muted-foreground">Order ID:</span><code className="font-mono font-bold text-foreground">{transactionId.slice(0, 16)}...</code></div>}
                    <div className="flex justify-between"><span className="text-muted-foreground">Amount:</span><span className="font-bold text-primary">{formatPrice(link.price, link.currency)}</span></div>
                    {transactionCode && <div className="flex justify-between"><span className="text-muted-foreground">Transaction:</span><code className="font-mono font-bold text-foreground">{transactionCode}</code></div>}
                    <div className="flex justify-between"><span className="text-muted-foreground">Status:</span><span className="px-2 py-0.5 bg-accent/20 text-accent-foreground rounded-full text-xs font-medium">⏳ Under Review</span></div>
                  </div>

                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm text-left mb-6 flex items-start gap-3">
                    <ShieldIcon size={20} className="text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-foreground mb-1">Your funds are protected</p>
                      <p className="text-muted-foreground text-xs">PayLoom holds your payment in escrow until you confirm delivery. Full refund if there's any issue.</p>
                    </div>
                  </div>

                  <button onClick={() => navigate(`/track/${transactionId}`)}
                    className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-bold text-base hover:bg-primary/90 transition flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
                    Track Your Delivery Status →
                  </button>
                  <button onClick={() => { setShowCheckout(false); setCheckoutStep('details'); }}
                    className="w-full py-3 text-muted-foreground hover:text-foreground transition text-sm mt-2">
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
