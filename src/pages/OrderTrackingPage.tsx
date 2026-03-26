import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  CheckCircle, Clock, Package, Truck, MapPin,
  AlertCircle, Loader2, RefreshCw, Shield,
  ChevronLeft, Star, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCurrency } from "@/hooks/useCurrency";
import { supabase } from "@/integrations/supabase/client";

interface OrderDetails {
  id: string;
  item_name: string;
  item_description?: string;
  item_images?: string[];
  amount: number;
  currency: string;
  status: string;
  verification_status?: string;
  buyer_name?: string;
  buyer_phone?: string;
  buyer_address?: string;
  payment_method?: string;
  transaction_code?: string;
  tracking_number?: string;
  courier_name?: string;
  shipping_notes?: string;
  rejection_reason?: string;
  created_at: string;
  paid_at?: string;
  shipped_at?: string;
  delivered_at?: string;
  completed_at?: string;
  accepted_at?: string;
  estimated_delivery_date?: string;
  seller_id: string;
}

type TimelineStep = {
  id: string;
  label: string;
  description: string;
  date?: string;
  status: 'completed' | 'current' | 'pending';
  icon: React.ReactNode;
};

export function OrderTrackingPage() {
  const { transactionId } = useParams();
  const { formatPrice } = useCurrency();
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [disputeReason, setDisputeReason] = useState('');

  useEffect(() => {
    if (transactionId) {
      fetchOrder();
      const interval = setInterval(() => {
        fetchOrder();
        setLastUpdated(new Date());
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [transactionId]);

  const fetchOrder = async () => {
    try {
      if (!transactionId) return;
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', transactionId)
        .maybeSingle();

      if (!error && data) setOrder(data as unknown as OrderDetails);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelivery = async () => {
    if (!transactionId) return;
    setIsConfirming(true);
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          buyer_confirmed_at: new Date().toISOString(),
        } as any)
        .eq('id', transactionId);

      if (!error) {
        // Send delivery confirmed SMS (best-effort)
        try {
          await supabase.functions.invoke('sms-notifications', {
            body: {
              action: 'delivery_confirmed',
              transactionId,
              sellerPayout: order ? (order.amount * 0.95) : undefined,
            },
          });
        } catch (e) {
          console.warn('SMS notification failed (non-blocking):', e);
        }
        setShowConfirmModal(false);
        fetchOrder();
      }
    } catch {
    } finally {
      setIsConfirming(false);
    }
  };

  const getTimeline = (): TimelineStep[] => {
    if (!order) return [];
    const s = order.status?.toLowerCase();
    const v = order.verification_status?.toLowerCase();

    const isRejected = v === 'rejected';
    const isPendingApproval = s === 'processing' || s === 'pending';
    const isPaid = s === 'paid' || s === 'shipped' || s === 'delivered' || s === 'completed';
    const isShipped = s === 'shipped' || s === 'delivered' || s === 'completed';
    const isDelivered = s === 'delivered' || s === 'completed';
    const isCompleted = s === 'completed';

    const steps: TimelineStep[] = [
      {
        id: 'placed',
        label: 'Order Placed',
        description: 'Your order has been received',
        date: order.created_at,
        status: 'completed',
        icon: <Package size={18} />,
      },
      {
        id: 'verification',
        label: isRejected ? 'Payment Rejected' : 'Payment Verification',
        description: isRejected
          ? order.rejection_reason || 'Payment could not be verified'
          : isPaid
            ? 'Payment verified and approved'
            : "Waiting for seller approval. You'll receive SMS confirmation.",
        date: order.paid_at,
        status: isRejected ? 'current' : isPaid ? 'completed' : isPendingApproval ? 'current' : 'pending',
        icon: isRejected ? <AlertCircle size={18} /> : <Clock size={18} />,
      },
      {
        id: 'confirmed',
        label: 'Payment Confirmed',
        description: isPaid ? 'Funds held securely in escrow' : 'Pending',
        date: order.paid_at,
        status: isPaid ? 'completed' : 'pending',
        icon: <CheckCircle size={18} />,
      },
      {
        id: 'processing',
        label: 'Order Processing',
        description: isPaid && !isShipped ? 'Seller is preparing your order' : isShipped ? 'Order prepared and handed to courier' : 'Not started',
        date: order.accepted_at,
        status: isPaid && !isShipped ? 'current' : isShipped ? 'completed' : 'pending',
        icon: <Package size={18} />,
      },
      {
        id: 'shipped',
        label: 'Out for Delivery',
        description: isShipped
          ? `${order.courier_name ? `Courier: ${order.courier_name}` : 'On the way'}${order.tracking_number ? ` • Tracking: ${order.tracking_number}` : ''}`
          : 'Not started',
        date: order.shipped_at,
        status: isShipped && !isDelivered ? 'current' : isDelivered ? 'completed' : 'pending',
        icon: <Truck size={18} />,
      },
      {
        id: 'delivered',
        label: 'Delivered',
        description: isDelivered ? 'Order delivered successfully!' : 'Not started',
        date: order.delivered_at || order.completed_at,
        status: isCompleted ? 'completed' : isDelivered ? 'current' : 'pending',
        icon: <CheckCircle size={18} />,
      },
    ];

    return steps;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6 animate-pulse">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <div className="h-6 w-full bg-muted rounded" />
            <div className="h-4 w-3/4 bg-muted rounded" />
            <div className="h-32 bg-muted rounded-lg mt-4" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-10 h-10 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Order Not Found</h2>
        <p className="text-muted-foreground mb-6 max-w-sm">We couldn't find an order with this ID. Please check the link and try again.</p>
        <Button asChild><Link to="/">Back to Home</Link></Button>
      </div>
    );
  }

  const timeline = getTimeline();
  const isRejected = order.verification_status?.toLowerCase() === 'rejected';
  const statusLabel = isRejected ? 'Rejected' : order.status?.toUpperCase() || 'PENDING';

  const getStatusColor = () => {
    if (isRejected) return 'bg-destructive/10 text-destructive';
    switch (order.status?.toLowerCase()) {
      case 'completed': return 'bg-primary/10 text-primary';
      case 'paid': case 'shipped': case 'delivered': return 'bg-primary/10 text-primary';
      case 'processing': return 'bg-accent/10 text-accent-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-30">
        <div className="max-w-xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => window.history.back()} className="p-2 -ml-2 hover:bg-muted rounded-full transition">
            <ChevronLeft size={24} className="text-foreground" />
          </button>
          <div className="text-center">
            <h1 className="font-bold text-foreground text-sm">Track Your Order</h1>
            <p className="text-[10px] text-muted-foreground font-mono">{order.id.slice(0, 16).toUpperCase()}</p>
          </div>
          <button onClick={fetchOrder} className="p-2 -mr-2 hover:bg-muted rounded-full transition">
            <RefreshCw size={18} className="text-muted-foreground" />
          </button>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
        {/* Order Summary Card */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="p-5">
            <div className="flex gap-4">
              {order.item_images && order.item_images.length > 0 ? (
                <img src={order.item_images[0]} alt="" className="w-20 h-20 rounded-xl object-cover shrink-0" />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <Package size={28} className="text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-foreground text-lg leading-tight truncate">{order.item_name}</h2>
                <p className="text-2xl font-black text-primary mt-1">{formatPrice(order.amount, order.currency || 'KES')}</p>
                <div className="mt-2">
                  <Badge className={`${getStatusColor()} border-none font-bold text-xs`}>
                    {statusLabel}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Order meta */}
          <div className="border-t border-border bg-muted/50 px-5 py-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span>Ordered: {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            {order.transaction_code && <span>Ref: <strong className="font-mono text-foreground">{order.transaction_code}</strong></span>}
            {order.payment_method && <span>Via: {order.payment_method}</span>}
          </div>
        </div>

        {/* Order Timeline */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 pt-5 pb-2">
            <h3 className="text-xs uppercase tracking-widest font-black text-muted-foreground">Order Timeline</h3>
          </div>
          <div className="px-5 pb-5">
            <div className="relative">
              {timeline.map((step, i) => {
                const isLast = i === timeline.length - 1;
                return (
                  <div key={step.id} className="flex gap-4 relative">
                    {/* Connector line */}
                    {!isLast && (
                      <div className={`absolute left-[15px] top-[36px] w-[2px] h-[calc(100%-20px)] ${
                        step.status === 'completed' ? 'bg-primary' : 'bg-border'
                      }`} />
                    )}

                    {/* Icon */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 transition-all ${
                      step.status === 'completed'
                        ? 'bg-primary text-primary-foreground'
                        : step.status === 'current'
                          ? isRejected && step.id === 'verification'
                            ? 'bg-destructive text-destructive-foreground ring-4 ring-destructive/20'
                            : 'bg-primary/20 text-primary ring-4 ring-primary/10 animate-pulse'
                          : 'bg-muted text-muted-foreground'
                    }`}>
                      {step.icon}
                    </div>

                    {/* Content */}
                    <div className={`flex-1 pb-8 ${isLast ? 'pb-0' : ''}`}>
                      <p className={`font-bold text-sm ${
                        step.status === 'pending' ? 'text-muted-foreground' : 'text-foreground'
                      }`}>
                        {step.label}
                      </p>
                      <p className={`text-xs mt-0.5 ${
                        step.status === 'pending' ? 'text-muted-foreground/60' : 'text-muted-foreground'
                      }`}>
                        {step.description}
                      </p>
                      {step.date && step.status !== 'pending' && (
                        <p className="text-[10px] text-muted-foreground/50 mt-1 font-mono">
                          {new Date(step.date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Delivery Info */}
        {order.buyer_address && (
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <MapPin size={18} className="text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-foreground text-sm mb-1">Delivery Address</p>
                <p className="text-muted-foreground text-sm">{order.buyer_address}</p>
                {order.buyer_phone && <p className="text-muted-foreground text-xs mt-1">Phone: {order.buyer_phone}</p>}
                {order.estimated_delivery_date && (
                  <p className="text-xs text-primary font-medium mt-2">
                    Est. Delivery: {new Date(order.estimated_delivery_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Last updated */}
        <p className="text-center text-xs text-muted-foreground">
          Last updated: {lastUpdated.toLocaleTimeString()} • Auto-refreshes every 30s
        </p>

        {/* Action Buttons */}
        <div className="space-y-3">
          {['shipped', 'delivered'].includes(order.status?.toLowerCase()) && (
            <Button
              onClick={() => setShowConfirmModal(true)}
              className="w-full py-6 rounded-2xl font-black text-lg shadow-lg shadow-primary/20"
            >
              ✅ Confirm Delivery & Release Payment
            </Button>
          )}

          {['paid', 'shipped', 'delivered'].includes(order.status?.toLowerCase()) && (
            <Button
              variant="outline"
              onClick={() => setShowDisputeModal(true)}
              className="w-full py-5 rounded-2xl font-bold border-2"
            >
              ⚠️ Report an Issue
            </Button>
          )}
        </div>

        {/* Security Footer */}
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 flex items-start gap-4">
          <Shield size={24} className="text-primary mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-foreground text-sm">PayLoom Buyer Protection</p>
            <p className="text-xs text-muted-foreground mt-1">
              Your payment is held in escrow until you confirm delivery. If there's a problem, we'll help resolve it or issue a full refund.
            </p>
          </div>
        </div>

        {/* Confirm Delivery Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-2xl p-6 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-foreground">Confirm Delivery</h3>
                <button onClick={() => setShowConfirmModal(false)} className="p-2 bg-muted rounded-full">
                  <X size={20} />
                </button>
              </div>
              <p className="text-sm text-muted-foreground">Have you received your order and is it as described?</p>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">Rate your experience</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(s => (
                    <button key={s} onClick={() => setRating(s)}
                      className={`w-12 h-12 rounded-xl flex items-center justify-center transition ${rating >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      <Star size={24} fill="currentColor" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Leave a review (Optional)</label>
                <textarea value={review} onChange={e => setReview(e.target.value)}
                  placeholder="Great product! Fast delivery..."
                  className="w-full p-4 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition h-24 resize-none" />
              </div>

              <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 text-xs text-accent-foreground">
                <p className="font-bold mb-1">⚠️ IMPORTANT</p>
                Once confirmed, funds will be released to the seller. This action cannot be undone.
              </div>

              <Button onClick={handleConfirmDelivery} disabled={isConfirming} className="w-full py-6 rounded-xl font-black text-lg">
                {isConfirming ? <Loader2 className="animate-spin" /> : 'Confirm & Release Payment'}
              </Button>
            </div>
          </div>
        )}

        {/* Dispute Modal */}
        {showDisputeModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-2xl p-6 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-foreground">Report an Issue</h3>
                <button onClick={() => setShowDisputeModal(false)} className="p-2 bg-muted rounded-full">
                  <X size={20} />
                </button>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">What is the issue?</label>
                <select value={disputeReason} onChange={e => setDisputeReason(e.target.value)}
                  className="w-full p-4 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition">
                  <option value="">Select a reason</option>
                  <option value="item_not_received">Item not received</option>
                  <option value="item_not_as_described">Item not as described</option>
                  <option value="item_damaged">Item arrived damaged</option>
                  <option value="wrong_item">Received wrong item</option>
                  <option value="other">Other issue</option>
                </select>
              </div>

              <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 text-xs text-destructive">
                <p className="font-bold mb-1">🛡️ YOUR FUNDS ARE SAFE</p>
                Opening a dispute will hold the funds until our team reviews the case.
              </div>

              <Button variant="destructive" disabled={!disputeReason} className="w-full py-6 rounded-xl font-black text-lg">
                Open Dispute
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
