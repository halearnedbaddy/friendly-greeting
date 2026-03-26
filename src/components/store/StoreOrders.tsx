import { useState, useEffect, useRef, memo } from 'react';
import { ShoppingCart, Search, Clock, Check, X, Truck, Loader2, ChevronDown, Bell, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/hooks/useCurrency';
import { supabase } from '@/integrations/supabase/client';
import {
  getSellerOrders,
  acceptOrder as apiAcceptOrder,
  rejectOrder as apiRejectOrder,
  addShippingInfo as apiAddShippingInfo,
} from '@/services/supabaseApi';

interface Order {
  id: string;
  buyerName: string;
  buyerPhone?: string;
  buyerEmail?: string;
  itemName: string;
  amount: number;
  status: string;
  createdAt: string;
  shippingInfo?: {
    courierName?: string;
    trackingNumber?: string;
    estimatedDelivery?: string;
  };
}

type StatusFilter = 'all' | 'pending' | 'accepted' | 'shipped' | 'completed' | 'disputed';

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  'PENDING_PAYMENT': { label: 'Awaiting Payment', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  'pending': { label: 'Pending Review', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  'PENDING': { label: 'Pending Review', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  'PAID': { label: 'Paid - Action Required', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  'paid': { label: 'Paid - Action Required', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  'ACCEPTED': { label: 'Accepted', color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
  'accepted': { label: 'Accepted', color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
  'SHIPPED': { label: 'Shipped', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  'shipped': { label: 'Shipped', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  'DELIVERED': { label: 'Delivered', color: 'text-teal-700', bgColor: 'bg-teal-100' },
  'delivered': { label: 'Delivered', color: 'text-teal-700', bgColor: 'bg-teal-100' },
  'COMPLETED': { label: 'Completed', color: 'text-green-700', bgColor: 'bg-green-100' },
  'completed': { label: 'Completed', color: 'text-green-700', bgColor: 'bg-green-100' },
  'CANCELLED': { label: 'Cancelled', color: 'text-red-700', bgColor: 'bg-red-100' },
  'cancelled': { label: 'Cancelled', color: 'text-red-700', bgColor: 'bg-red-100' },
  'DISPUTED': { label: 'Disputed', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  'disputed': { label: 'Disputed', color: 'text-orange-700', bgColor: 'bg-orange-100' },
};

async function sendOrderAcceptedSMS(transactionId: string, toast: any) {
  try {
    await supabase.functions.invoke('sms-notifications', {
      body: { action: 'order_accepted', transactionId },
    });
    toast({ title: '📱 SMS sent to buyer', description: 'Buyer has been notified of the acceptance.' });
  } catch (e) {
    console.warn('SMS notification failed (non-critical):', e);
  }
}

async function sendOrderShippedSMS(transactionId: string, trackingNumber: string, toast: any) {
  try {
    await supabase.functions.invoke('sms-notifications', {
      body: { action: 'order_shipped', transactionId, trackingNumber },
    });
    toast({ title: '📱 SMS sent to buyer', description: 'Buyer has been notified that their order has shipped.' });
  } catch (e) {
    console.warn('SMS shipped notification failed (non-critical):', e);
  }
}
// Memoized Order Row component to prevent unnecessary re-renders
interface OrderRowProps {
  order: Order;
  isExpanded: boolean;
  actionLoading: string | null;
  onToggleExpand: (id: string) => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onShip: (order: Order) => void;
  formatCurrency: (amount: number, currency?: string) => string;
  formatDate: (dateStr: string) => string;
}

const OrderRow = memo(function OrderRow({
  order, isExpanded, actionLoading, onToggleExpand, onAccept, onReject, onShip, formatCurrency, formatDate,
}: OrderRowProps) {
  const statusConfig = STATUS_CONFIG[order.status] || { label: order.status, color: 'text-gray-700', bgColor: 'bg-gray-100' };
  const statusNorm = (order.status || '').toLowerCase();
  const needsAction = ['paid', 'pending'].includes(statusNorm);
  const canShip = statusNorm === 'accepted';

  return (
    <div className={`bg-card border rounded-xl transition-all ${needsAction ? 'border-amber-300 shadow-sm shadow-amber-100' : 'border-border'}`}>
      <div className="p-4 cursor-pointer flex items-center gap-4" onClick={() => onToggleExpand(order.id)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-sm text-muted-foreground">#{order.id.slice(0, 8)}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>{statusConfig.label}</span>
            {needsAction && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 animate-pulse">Action Required</span>}
          </div>
          <p className="font-semibold text-foreground truncate">{order.itemName}</p>
          <p className="text-sm text-muted-foreground">{order.buyerName}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-foreground">{formatCurrency(order.amount)}</p>
          <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
        </div>
        <ChevronDown className={`text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} size={20} />
      </div>
      {isExpanded && (
        <div className="border-t border-border p-4 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Buyer Details</p>
              <p className="font-semibold text-foreground">{order.buyerName}</p>
              {order.buyerPhone && <p className="text-sm text-foreground">{order.buyerPhone}</p>}
              {order.buyerEmail && <p className="text-sm text-foreground">{order.buyerEmail}</p>}
            </div>
            {order.shippingInfo && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Shipping Info</p>
                <p className="font-semibold text-foreground">{order.shippingInfo.courierName}</p>
                <p className="text-sm text-foreground">Tracking: {order.shippingInfo.trackingNumber}</p>
                {order.shippingInfo.estimatedDelivery && <p className="text-sm text-muted-foreground">Est. delivery: {order.shippingInfo.estimatedDelivery}</p>}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {needsAction && (
              <>
                <button onClick={() => onAccept(order.id)} disabled={actionLoading === order.id} className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-50">
                  {actionLoading === order.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Accept Order
                </button>
                <button onClick={() => onReject(order.id)} disabled={actionLoading === order.id} className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium disabled:opacity-50">
                  <X size={16} /> Reject
                </button>
              </>
            )}
            {canShip && (
              <button onClick={() => onShip(order)} className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium">
                <Truck size={16} /> Add Shipping Info
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

export function StoreOrders() {
  const { toast } = useToast();
  const { formatPrice } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  // Reset page when filter/search changes
  useEffect(() => { setCurrentPage(1); }, [statusFilter, searchQuery]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [shippingModal, setShippingModal] = useState<Order | null>(null);
  const [shippingForm, setShippingForm] = useState({
    courierName: '',
    trackingNumber: '',
    estimatedDeliveryDate: '',
  });

  // Keep a ref to existing order IDs so realtime can detect genuinely new ones
  const knownOrderIds = useRef<Set<string>>(new Set());

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await getSellerOrders({ limit: 200 });
      if (res.success && res.data) {
        const ordersData = Array.isArray(res.data)
          ? res.data
          : (res.data as any).orders || [];

        const mapped: Order[] = ordersData.map((o: any) => ({
          id: o.id,
          buyerName: o.buyerName || o.buyer?.name || 'Unknown Buyer',
          buyerPhone: o.buyerPhone || o.buyer?.phone,
          buyerEmail: o.buyerEmail || o.buyer?.email,
          itemName: o.itemName || o.item || 'Unknown Item',
          amount: o.amount || 0,
          status: o.status || 'PENDING',
          createdAt: o.createdAt,
          shippingInfo: o.shippingInfo,
        }));

        setOrders(mapped);
        // Initialise known IDs (no badge on first load)
        knownOrderIds.current = new Set(mapped.map((o) => o.id));
      }
    } catch (error) {
      console.error('Failed to load orders:', error);
      toast({ title: 'Failed to load orders', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // ── Supabase Realtime subscription ──────────────────────────────────────────
  useEffect(() => {
    loadOrders();

    let channelRef: ReturnType<typeof supabase.channel> | null = null;

    supabase.auth.getSession().then(({ data: { session } }: any) => {
      if (!session) return;

      const sellerId = session.user.id;

      const channel = supabase
        .channel('seller-orders-realtime')
        .on(
          'postgres_changes' as any,
          {
            event: 'INSERT',
            schema: 'public',
            table: 'transactions',
          },
          (payload: any) => {
            const record = payload.new;
            if (!record) return;
            // Only handle orders for this seller
            if (record.seller_id !== sellerId) return;

            const isNew = !knownOrderIds.current.has(record.id);
            if (isNew) {
              knownOrderIds.current.add(record.id);
              setNewOrderCount((c) => c + 1);

              const newOrder: Order = {
                id: record.id,
                buyerName: record.buyer_name || 'Unknown Buyer',
                buyerPhone: record.buyer_phone,
                buyerEmail: record.buyer_email,
                itemName: record.item_name || 'Unknown Item',
                amount: record.amount || 0,
                status: record.status || 'PENDING',
                createdAt: record.created_at,
                shippingInfo: record.courier_name
                  ? {
                      courierName: record.courier_name,
                      trackingNumber: record.tracking_number,
                      estimatedDelivery: record.estimated_delivery_date,
                    }
                  : undefined,
              };

              setOrders((prev) => [newOrder, ...prev]);

              toast({
                title: '🛒 New Order Received!',
                description: `${newOrder.buyerName} — ${newOrder.itemName} — ${formatPrice(newOrder.amount)}`,
              });
            }
          }
        )
        .on(
          'postgres_changes' as any,
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'transactions',
          },
          (payload: any) => {
            const record = payload.new;
            if (!record) return;
            // Only handle orders for this seller
            if (record.seller_id !== sellerId) return;
            setOrders((prev) =>
              prev.map((o) =>
                o.id === record.id
                  ? {
                      ...o,
                      status: record.status,
                      shippingInfo: record.courier_name
                        ? {
                            courierName: record.courier_name,
                            trackingNumber: record.tracking_number,
                            estimatedDelivery: record.estimated_delivery_date,
                          }
                        : o.shippingInfo,
                    }
                  : o
              )
            );
          }
        )
        .subscribe();

      channelRef = channel;
    });

    return () => {
      if (channelRef) supabase.removeChannel(channelRef);
    };
  }, []);

  const handleAccept = async (orderId: string) => {
    setActionLoading(orderId);
    const res = await apiAcceptOrder(orderId);
    if (res.success) {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: 'accepted' } : o))
      );
      toast({ title: '✅ Order accepted!' });
      // Fire SMS notification to buyer (non-blocking)
      sendOrderAcceptedSMS(orderId, toast);
    } else {
      toast({ title: 'Failed to accept order', description: res.error, variant: 'destructive' });
    }
    setActionLoading(null);
  };

  const handleReject = async (orderId: string) => {
    // Block rejecting an already-accepted order
    const order = orders.find((o) => o.id === orderId);
    const st = (order?.status || '').toLowerCase();
    if (order && ['accepted', 'shipped', 'delivered', 'completed'].includes(st)) {
      toast({ title: 'Cannot reject this order', description: 'This order has already been accepted.', variant: 'destructive' });
      return;
    }
    setActionLoading(orderId);
    const res = await apiRejectOrder(orderId, 'Seller rejected order');
    if (res.success) {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: 'cancelled' } : o))
      );
      toast({ title: 'Order rejected' });
    } else {
      toast({ title: 'Failed to reject order', description: res.error, variant: 'destructive' });
    }
    setActionLoading(null);
  };

  const handleAddShipping = async () => {
    if (!shippingModal) return;
    if (!shippingForm.courierName || !shippingForm.trackingNumber) {
      toast({ title: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    const orderId = shippingModal.id;
    setActionLoading(orderId);
    const res = await apiAddShippingInfo(orderId, shippingForm);
    if (res.success) {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                status: 'shipped',
                shippingInfo: {
                  courierName: shippingForm.courierName,
                  trackingNumber: shippingForm.trackingNumber,
                  estimatedDelivery: shippingForm.estimatedDeliveryDate,
                },
              }
            : o
        )
      );
      toast({ title: '📦 Shipping info added!' });
      setShippingModal(null);
      setShippingForm({ courierName: '', trackingNumber: '', estimatedDeliveryDate: '' });
      // Fire SMS notification to buyer (non-blocking)
      sendOrderShippedSMS(orderId, shippingForm.trackingNumber, toast);
    } else {
      toast({ title: 'Failed to add shipping info', description: res.error, variant: 'destructive' });
    }
    setActionLoading(null);
  };

  const handleDismissNewOrderBadge = () => setNewOrderCount(0);

  const getFilteredOrders = () => {
    let filtered = orders;

    if (statusFilter !== 'all') {
      const statusMap: Record<StatusFilter, string[]> = {
        all: [],
        pending: ['PENDING_PAYMENT', 'PAID', 'PENDING', 'pending', 'paid'],
        accepted: ['ACCEPTED', 'accepted'],
        shipped: ['SHIPPED', 'DELIVERED', 'shipped', 'delivered'],
        completed: ['COMPLETED', 'completed'],
        disputed: ['DISPUTED', 'CANCELLED', 'disputed', 'cancelled'],
      };
      filtered = filtered.filter((o) => statusMap[statusFilter].includes(o.status));
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.buyerName.toLowerCase().includes(query) ||
          o.itemName.toLowerCase().includes(query) ||
          o.id.toLowerCase().includes(query)
      );
    }

    return filtered.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  };

  const formatCurrency = (amount: number, currency?: string) =>
    formatPrice(amount, currency || 'KES');
  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const allFilteredOrders = getFilteredOrders();
  const totalPages = Math.ceil(allFilteredOrders.length / ITEMS_PER_PAGE);
  const filteredOrders = allFilteredOrders.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const statusCounts = {
    all: orders.length,
    pending: orders.filter((o) =>
      ['PENDING_PAYMENT', 'PAID', 'PENDING', 'pending', 'paid'].includes(o.status)
    ).length,
    accepted: orders.filter((o) => ['ACCEPTED', 'accepted'].includes(o.status)).length,
    shipped: orders.filter((o) =>
      ['SHIPPED', 'DELIVERED', 'shipped', 'delivered'].includes(o.status)
    ).length,
    completed: orders.filter((o) => ['COMPLETED', 'completed'].includes(o.status)).length,
    disputed: orders.filter((o) =>
      ['DISPUTED', 'CANCELLED', 'disputed', 'cancelled'].includes(o.status)
    ).length,
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="bg-muted h-8 w-24 rounded animate-pulse" />
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-muted h-8 w-20 rounded animate-pulse" />
            ))}
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-muted h-24 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-foreground">Orders</h2>
          {newOrderCount > 0 && (
            <button
              onClick={handleDismissNewOrderBadge}
              className="flex items-center gap-1.5 px-3 py-1 bg-primary text-primary-foreground rounded-full text-sm font-semibold animate-bounce"
              title="Click to dismiss"
            >
              <Bell size={14} />
              {newOrderCount} new
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {(['all', 'pending', 'accepted', 'shipped', 'completed', 'disputed'] as StatusFilter[]).map(
            (status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition capitalize relative ${
                  statusFilter === status
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {status} ({statusCounts[status]})
                {status === 'pending' && newOrderCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-destructive rounded-full" />
                )}
              </button>
            )
          )}
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by buyer, item, or order ID..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-xl font-bold text-foreground mb-2">No orders found</h3>
          <p className="text-muted-foreground mb-4 max-w-md mx-auto">
            {orders.length === 0
              ? 'When customers place orders, they will appear here. Share your store to start getting orders!'
              : 'No orders match your current filters.'}
          </p>
          {orders.length === 0 && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Clock size={16} />
              <span>Waiting for your first order</span>
            </div>
          )}
        </div>
      ) : (
        <>
        <div className="space-y-3">
          {filteredOrders.map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              isExpanded={expandedOrder === order.id}
              actionLoading={actionLoading}
              onToggleExpand={(id) => setExpandedOrder(expandedOrder === id ? null : id)}
              onAccept={handleAccept}
              onReject={handleReject}
              onShip={setShippingModal}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
            />
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4">
            <p className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, allFilteredOrders.length)} of {allFilteredOrders.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-input hover:bg-muted disabled:opacity-50 transition"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-medium px-2">Page {currentPage} of {totalPages}</span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-input hover:bg-muted disabled:opacity-50 transition"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
        </>
      )}

      {/* Shipping Modal */}
      {shippingModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground">Add Shipping Info</h3>
              <button
                onClick={() => setShippingModal(null)}
                className="p-1 hover:bg-muted rounded-lg transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Courier/Shipping Company *
                </label>
                <input
                  type="text"
                  value={shippingForm.courierName}
                  onChange={(e) =>
                    setShippingForm((prev) => ({ ...prev, courierName: e.target.value }))
                  }
                  placeholder="e.g., G4S, DHL, Wells Fargo"
                  className="w-full px-4 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Tracking Number *
                </label>
                <input
                  type="text"
                  value={shippingForm.trackingNumber}
                  onChange={(e) =>
                    setShippingForm((prev) => ({ ...prev, trackingNumber: e.target.value }))
                  }
                  placeholder="Enter tracking number"
                  className="w-full px-4 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Estimated Delivery Date
                </label>
                <input
                  type="date"
                  value={shippingForm.estimatedDeliveryDate}
                  onChange={(e) =>
                    setShippingForm((prev) => ({
                      ...prev,
                      estimatedDeliveryDate: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShippingModal(null)}
                className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAddShipping}
                disabled={actionLoading === shippingModal.id}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium disabled:opacity-50"
              >
                {actionLoading === shippingModal.id ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Truck size={16} />
                )}
                Save Shipping Info
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
