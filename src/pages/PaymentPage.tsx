import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, Star, Phone, CheckCircle, Package, AlertCircle, Lock, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/useCurrency";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { validateTransactionCode } from "@/lib/transactionValidation";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabaseProject";
import { supabase } from "@/integrations/supabase/client";

interface PaymentLinkData {
  id: string;
  productName: string;
  productDescription?: string | null;
  price: number | string;
  currency: string;
  images: string[];
  status: string;
  seller: {
    id: string;
    name: string;
    sellerProfile?: {
      isVerified: boolean;
      rating: number;
      totalReviews: number;
    };
  };
}

interface SellerPaymentMethod {
  id: string;
  provider: string;
  type: string;
  account_name: string;
  account_number: string;
  payment_type?: string;
  details?: Record<string, string> | null;
  is_active: boolean | null;
}

type Step = 'otp' | 'verify' | 'checkout' | 'payment' | 'submitting' | 'success';

const PaymentPage = () => {
  const { linkId, transactionId } = useParams<{ linkId?: string; transactionId?: string }>();
  const { toast } = useToast();
  const { formatPrice } = useCurrency();
  const { requestOTP, login, isAuthenticated, user } = useSupabaseAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentLink, setPaymentLink] = useState<PaymentLinkData | null>(null);
  const [processing, setProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>('otp');

  // OTP state
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // Form state
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerAddress, setBuyerAddress] = useState("");

  // Payment state
  const [sellerMethods, setSellerMethods] = useState<SellerPaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<SellerPaymentMethod | null>(null);
  const [txCode, setTxCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [createdTxId, setCreatedTxId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (linkId) fetchPaymentLink();
    else if (transactionId) {
      setError("Please use the payment link URL provided by the seller");
      setLoading(false);
    } else {
      setError("Invalid payment link");
      setLoading(false);
    }
  }, [linkId, transactionId]);

  useEffect(() => {
    if (isAuthenticated && user && paymentLink && currentStep === 'otp') {
      setPhone(user.phone || "");
      setCurrentStep('checkout');
    }
  }, [isAuthenticated, user, paymentLink]);

  const fetchPaymentLink = async () => {
    if (!linkId) return;
    try {
      setLoading(true);
      const response = await fetch(`${SUPABASE_URL}/functions/v1/links-api/${linkId}`, {
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      });
      const result = await response.json();
      if (result.success && result.data) {
        setPaymentLink(result.data);
        if (result.data.seller?.id) loadSellerMethods(result.data.seller.id);
      } else {
        setError(result.error || "Payment link not found");
      }
    } catch {
      setError("Failed to load payment link.");
    } finally {
      setLoading(false);
    }
  };

  const loadSellerMethods = async (sellerId: string) => {
    const { data } = await (supabase
      .from('payment_methods' as any)
      .select('*')
      .eq('user_id', sellerId)
      .eq('is_active', true)
      .order('is_default', { ascending: false }) as any);
    if (data) setSellerMethods(data.map((m: any) => ({ ...m, payment_type: m.payment_type || m.type || 'MPESA', details: m.details || {} })) as SellerPaymentMethod[]);
  };

  const copyText = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    let norm = phone.trim();
    if (!norm.startsWith('+')) {
      norm = norm.startsWith('0') ? '+254' + norm.substring(1) : norm.startsWith('254') ? '+' + norm : '+254' + norm;
    }
    setSendingOtp(true);
    setError(null);
    try {
      const result = await requestOTP(norm, 'LOGIN');
      if (result.success) {
        setCurrentStep('verify');
        setPhone(norm);
        toast({ title: "OTP Sent!", description: result.otp ? `Dev OTP: ${result.otp}` : "Check your phone" });
      } else setError(result.error || "Failed to send OTP");
    } catch (err: any) { setError(err.message); }
    finally { setSendingOtp(false); }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length !== 6) return;
    setVerifyingOtp(true);
    setError(null);
    try {
      const result = await login(phone, otpCode);
      if (result.success) { setCurrentStep('checkout'); toast({ title: "Verified!" }); }
      else setError(result.error || "Invalid OTP");
    } catch (err: any) { setError(err.message); }
    finally { setVerifyingOtp(false); }
  };

  const handleProceedToPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyerName.trim() || !linkId || !paymentLink) return;
    if (sellerMethods.length === 0) {
      toast({ title: "No Payment Methods", description: "Seller hasn't configured payment methods", variant: "destructive" });
      return;
    }
    // Auto-select first method if only one
    if (sellerMethods.length === 1) setSelectedMethod(sellerMethods[0]);
    setCurrentStep('payment');
  };

  const handleSubmitPayment = async () => {
    if (!selectedMethod) { toast({ title: "Select a method", variant: "destructive" }); return; }
    const validation = validateTransactionCode(txCode, selectedMethod.payment_type);
    if (!validation.valid) { setCodeError(validation.error || 'Invalid code'); return; }
    setCodeError(null);
    setProcessing(true);
    setCurrentStep('submitting');

    try {
      // Create order
      const orderRes = await fetch(`${SUPABASE_URL}/functions/v1/links-api/${linkId}/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({
          buyerName, buyerPhone: phone, buyerEmail: buyerEmail || undefined,
          deliveryAddress: buyerAddress || undefined,
          paymentMethod: selectedMethod.payment_type,
        }),
      });
      const orderResult = await orderRes.json();
      if (!orderResult.success) throw new Error(orderResult.error || "Failed to create order");
      const orderId = orderResult.data?.transactionId || orderResult.data?.id;
      setCreatedTxId(orderId);

      // Submit for validation
      const valRes = await fetch(`${SUPABASE_URL}/functions/v1/validate-payment/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({
          transactionId: orderId,
          transactionCode: txCode.trim().toUpperCase(),
          payerPhone: phone, payerName: buyerName,
          paymentMethod: selectedMethod.payment_type,
          amountPaid: typeof paymentLink!.price === 'string' ? parseFloat(paymentLink!.price) : paymentLink!.price,
        }),
      });
      const valResult = await valRes.json();
      if (!valResult.success) throw new Error(valResult.error || "Submission failed");
      setCurrentStep('success');
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setCurrentStep('payment');
    } finally { setProcessing(false); }
  };

  const getInstructions = (method: SellerPaymentMethod) => {
    const d = method.details || {};
    const price = paymentLink ? (typeof paymentLink.price === 'string' ? parseFloat(paymentLink.price) : paymentLink.price) : 0;
    const currency = paymentLink?.currency || 'KES';

    switch (method.payment_type) {
      case 'PAYBILL':
        return (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2 text-sm">
            <p className="font-bold">📱 M-Pesa Paybill:</p>
            <ol className="space-y-1">
              <li>1. M-Pesa → Lipa Na M-Pesa → Pay Bill</li>
              <li className="flex items-center gap-1">2. Business: <strong className="text-primary font-mono">{d.paybill_number}</strong>
                <button onClick={() => copyText(d.paybill_number || '', 'pb')} className="p-0.5 hover:bg-muted rounded">
                  {copied === 'pb' ? <CheckCircle size={12} className="text-primary" /> : <Copy size={12} />}
                </button>
              </li>
              <li className="flex items-center gap-1">3. Account: <strong className="text-primary font-mono">{d.account_number}</strong>
                <button onClick={() => copyText(d.account_number || '', 'ac')} className="p-0.5 hover:bg-muted rounded">
                  {copied === 'ac' ? <CheckCircle size={12} className="text-primary" /> : <Copy size={12} />}
                </button>
              </li>
              <li>4. Amount: <strong className="text-primary">{formatPrice(price, currency)}</strong></li>
            </ol>
          </div>
        );
      case 'TILL':
        return (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2 text-sm">
            <p className="font-bold">📱 M-Pesa Buy Goods:</p>
            <ol className="space-y-1">
              <li>1. M-Pesa → Lipa Na M-Pesa → Buy Goods</li>
              <li className="flex items-center gap-1">2. Till: <strong className="text-primary font-mono">{d.till_number}</strong>
                <button onClick={() => copyText(d.till_number || '', 'tl')} className="p-0.5 hover:bg-muted rounded">
                  {copied === 'tl' ? <CheckCircle size={12} className="text-primary" /> : <Copy size={12} />}
                </button>
              </li>
              <li>3. Amount: <strong className="text-primary">{formatPrice(price, currency)}</strong></li>
            </ol>
          </div>
        );
      case 'BANK_ACCOUNT':
        return (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-sm space-y-1">
            <p className="font-bold">🏦 Bank Transfer:</p>
            <p>Bank: <strong>{d.bank_name}</strong></p>
            <p>Account: <strong className="font-mono">{d.account_number || method.account_number}</strong></p>
            <p>Name: <strong>{d.account_name || method.account_name}</strong></p>
            <p>Amount: <strong className="text-primary">{formatPrice(price, currency)}</strong></p>
          </div>
        );
      default:
        return (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-sm space-y-1">
            <p className="font-bold">📱 Send Money:</p>
            <p>Send to: <strong className="font-mono text-primary">{d.phone_number}</strong></p>
            <p>Name: <strong>{d.account_name || method.account_name}</strong></p>
            <p>Amount: <strong className="text-primary">{formatPrice(price, currency)}</strong></p>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 animate-pulse">
        <div className="w-full max-w-md space-y-6">
          <div className="h-8 w-48 bg-muted rounded mx-auto" />
          <div className="h-48 bg-muted rounded-xl" />
          <div className="space-y-3">
            <div className="h-4 w-full bg-muted rounded" />
            <div className="h-4 w-3/4 bg-muted rounded" />
            <div className="h-12 w-full bg-muted rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !paymentLink) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-6">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-4" />
            <h2 className="mb-2 text-xl font-semibold">Link Unavailable</h2>
            <p className="mb-6 text-muted-foreground">{error || "Payment link not found."}</p>
            <Button asChild className="w-full"><Link to="/">Home</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (paymentLink.status !== 'ACTIVE') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-6">
            <Package className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
            <h2 className="mb-2 text-xl font-semibold">Unavailable</h2>
            <p className="mb-6 text-muted-foreground">This item is no longer available.</p>
            <Button asChild className="w-full"><Link to="/">Home</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const price = typeof paymentLink.price === 'string' ? parseFloat(paymentLink.price) : paymentLink.price;
  const sellerRating = paymentLink.seller.sellerProfile?.rating || 0;
  const sellerReviews = paymentLink.seller.sellerProfile?.totalReviews || 0;
  const isVerified = paymentLink.seller.sellerProfile?.isVerified || false;

  const showProductPreview = currentStep === 'otp' || currentStep === 'verify';

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="mx-auto max-w-lg">
        {/* Product Preview */}
        {showProductPreview && (
          <Card className="mb-6">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{paymentLink.productName}</CardTitle>
                  {isVerified && <div className="mt-1 flex items-center gap-1 text-sm text-primary"><ShieldCheck className="h-4 w-4" /><span>Verified</span></div>}
                </div>
                <Badge variant="secondary" className="text-lg font-semibold">{formatPrice(price, paymentLink.currency)}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {paymentLink.images?.[0] && <img src={paymentLink.images[0]} alt="" className="h-48 w-full object-cover rounded-lg mb-4" />}
              {paymentLink.productDescription && <p className="mb-4 text-sm text-muted-foreground">{paymentLink.productDescription}</p>}
              <div className="flex items-center gap-3 rounded-lg bg-muted p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">{paymentLink.seller.name.charAt(0).toUpperCase()}</div>
                <div>
                  <p className="font-medium">{paymentLink.seller.name}</p>
                  {sellerRating > 0 && <div className="flex items-center gap-1 text-sm text-muted-foreground"><Star className="h-3 w-3 fill-primary text-primary" /><span>{sellerRating.toFixed(1)} ({sellerReviews})</span></div>}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* OTP Step */}
        {currentStep === 'otp' && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2"><Lock className="h-5 w-5 text-primary" /><CardTitle>Verify Your Phone</CardTitle></div>
            </CardHeader>
            <CardContent>
              {error && <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">{error}</div>}
              <form onSubmit={handleSendOTP} className="space-y-4">
                <div className="space-y-2">
                  <Label>Phone Number *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input type="tel" placeholder="0712345678" value={phone} onChange={e => setPhone(e.target.value)} className="pl-10" disabled={sendingOtp} />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={sendingOtp}>
                  {sendingOtp ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</> : 'Send Verification Code'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* OTP Verify Step */}
        {currentStep === 'verify' && (
          <Card>
            <CardHeader>
              <CardTitle>Enter Code</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Sent to {phone}</p>
            </CardHeader>
            <CardContent>
              {error && <div className="mb-4 p-3 bg-destructive/10 rounded-lg text-destructive text-sm">{error}</div>}
              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <Input type="text" placeholder="000000" value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="text-center text-2xl tracking-widest font-mono" maxLength={6} autoFocus />
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => { setCurrentStep('otp'); setOtpCode(''); }}>Change</Button>
                  <Button type="submit" className="flex-1" disabled={verifyingOtp || otpCode.length !== 6}>
                    {verifyingOtp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Verify
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Checkout (buyer details) */}
        {currentStep === 'checkout' && (
          <Card>
            <CardHeader>
              <CardTitle>Your Details</CardTitle>
              <p className="text-sm text-muted-foreground">Verified: {phone}</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProceedToPayment} className="space-y-4">
                <div className="space-y-2"><Label>Full Name *</Label><Input value={buyerName} onChange={e => setBuyerName(e.target.value)} required /></div>
                <div className="space-y-2"><Label>Email (Optional)</Label><Input type="email" value={buyerEmail} onChange={e => setBuyerEmail(e.target.value)} /></div>
                <div className="space-y-2"><Label>Delivery Address</Label><Textarea value={buyerAddress} onChange={e => setBuyerAddress(e.target.value)} /></div>
                <div className="bg-muted rounded-lg p-3 flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="text-lg font-bold">{formatPrice(price, paymentLink.currency)}</span>
                </div>
                <Button type="submit" className="w-full" size="lg">Continue to Payment →</Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Payment step - select method & enter code */}
        {currentStep === 'payment' && (
          <Card>
            <CardHeader><CardTitle>Complete Payment</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {/* Method selection */}
              {!selectedMethod ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Choose payment method:</p>
                  {sellerMethods.map(m => (
                    <button key={m.id} onClick={() => setSelectedMethod(m)}
                      className="w-full flex items-center gap-3 p-4 border-2 border-border rounded-lg hover:border-primary/60 hover:bg-primary/5 transition text-left">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                        {m.payment_type === 'PAYBILL' ? 'PB' : m.payment_type === 'TILL' ? 'TL' : m.payment_type === 'BANK_ACCOUNT' ? '🏦' : '📱'}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-sm">{m.provider}</p>
                        <p className="text-xs text-muted-foreground">{m.account_name}</p>
                      </div>
                    </button>
                  ))}
                  <Button variant="outline" className="w-full" onClick={() => setCurrentStep('checkout')}>← Back</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {getInstructions(selectedMethod)}
                  <div className="bg-accent/10 border border-accent/20 rounded-lg p-3 text-sm">
                    <strong>⚠️</strong> Pay exactly <strong>{formatPrice(price, paymentLink.currency)}</strong>, then enter the code below.
                  </div>
                  <div>
                    <Label>Transaction Code *</Label>
                    <Input type="text" value={txCode} onChange={e => { setTxCode(e.target.value.toUpperCase()); setCodeError(null); }}
                      placeholder="e.g. SJK7Y6H4TQ" maxLength={13} className="font-mono text-lg tracking-wider uppercase mt-1" />
                    {codeError && <p className="text-xs text-destructive mt-1">{codeError}</p>}
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => { setSelectedMethod(null); if (sellerMethods.length <= 1) setCurrentStep('checkout'); }}>← Back</Button>
                    <Button className="flex-1" disabled={!txCode.trim() || processing} onClick={handleSubmitPayment}>Submit Payment</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Submitting */}
        {currentStep === 'submitting' && (
          <div className="py-16 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <h3 className="text-lg font-bold text-foreground mb-2">Verifying Payment...</h3>
            <p className="text-sm text-muted-foreground">Checking code <strong className="font-mono">{txCode}</strong></p>
          </div>
        )}

        {/* Success */}
        {currentStep === 'success' && (
          <Card>
            <CardContent className="pt-8 pb-6 text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-bold mb-2">Payment Submitted!</h2>
              <p className="text-muted-foreground mb-4">Your payment is being reviewed. You'll be notified once approved.</p>
              <div className="bg-muted rounded-lg p-4 text-left text-sm space-y-2 mb-4">
                {createdTxId && <p>Order: <span className="font-mono font-bold">{createdTxId}</span></p>}
                <p>Code: <span className="font-mono font-bold">{txCode}</span></p>
                <p>Status: <Badge variant="secondary">Under Review</Badge></p>
              </div>
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm text-left mb-4 flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>Your payment is protected by PayLoom. Funds are held securely until delivery.</span>
              </div>
              <Button asChild className="w-full"><Link to="/">Done</Link></Button>
            </CardContent>
          </Card>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">Protected by PayLoom • Secure Transactions</p>
      </div>
    </div>
  );
};

export { PaymentPage };
