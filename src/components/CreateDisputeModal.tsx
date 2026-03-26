import { useState, useEffect } from 'react';
import { XIcon, LoaderIcon, AlertTriangleIcon } from '@/components/icons';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/hooks/useCurrency';

interface CreateDisputeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userRole: 'buyer' | 'seller';
}

interface OrderOption {
  id: string;
  item_name: string;
  amount: number;
  created_at: string | null;
  seller_id?: string | null;
  buyer_id?: string | null;
}

const DISPUTE_TYPES = {
  buyer: [
    { value: 'ITEM_NOT_RECEIVED', label: 'Item Not Received' },
    { value: 'NOT_AS_DESCRIBED', label: 'Not As Described' },
    { value: 'DAMAGED', label: 'Item Damaged' },
    { value: 'WRONG_ITEM', label: 'Wrong Item Received' },
    { value: 'REFUND_REQUEST', label: 'Refund Request' },
    { value: 'OTHER', label: 'Other' },
  ],
  seller: [
    { value: 'BUYER_NOT_RESPONDING', label: 'Buyer Not Responding' },
    { value: 'PAYMENT_ISSUE', label: 'Payment Issue' },
    { value: 'RETURN_REQUEST', label: 'Return Request' },
    { value: 'FALSE_CLAIM', label: 'False Claim by Buyer' },
    { value: 'OTHER', label: 'Other' },
  ],
};

export function CreateDisputeModal({ isOpen, onClose, onSuccess, userRole }: CreateDisputeModalProps) {
  const { formatPrice } = useCurrency();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [form, setForm] = useState({
    transactionId: '',
    reason: '',
    description: '',
  });

  useEffect(() => {
    if (isOpen) {
      loadOrders();
    }
  }, [isOpen, userRole]);

  const loadOrders = async () => {
    setLoadingOrders(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get transactions based on user role
      const query = supabase
        .from('transactions')
        .select('id, item_name, amount, created_at, seller_id, buyer_id')
        .in('status', ['pending', 'completed'] as any[]);

      if (userRole === 'buyer') {
        query.eq('buyer_id', user.id);
      } else {
        query.eq('seller_id', user.id);
      }

      const { data, error } = await query.order('created_at', { ascending: false }).limit(50);

      if (error) throw error;
      setOrders((data as any) || []);
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Only require transactionId if orders are available
    const hasOrders = orders.length > 0;
    if (hasOrders && !form.transactionId) {
      toast({
        title: 'Error',
        description: 'Please select an order',
        variant: 'destructive',
      });
      return;
    }

    if (!form.reason || !form.description) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    if (form.description.length < 20) {
      toast({
        title: 'Error',
        description: 'Description must be at least 20 characters',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create dispute via edge function (handles notifications + avoids 409 conflicts)
      const { data, error } = await supabase.functions.invoke('disputes-api', {
        body: {
          transactionId: form.transactionId || null,
          reason: form.reason,
          description: form.description,
        },
      });

      if (error) throw error;

      if (!data?.success && data?.code === 'DISPUTE_EXISTS') {
        toast({
          title: 'Dispute already exists',
          description: `A dispute is already open for this order (Case #${String(data.disputeId).slice(0, 8)}).`,
        });
        onSuccess();
        onClose();
        return;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to create dispute');
      }

      const disputeId = String(data?.data?.disputeId || '');

      // Trigger SMS notifications (best-effort)
      try {
        await supabase.functions.invoke('sms-notifications', {
          body: {
            action: 'dispute_created',
            transactionId: form.transactionId || null,
            disputeType: form.reason,
            description: form.description,
          },
        });
      } catch {
        // SMS is best-effort, don't block
      }

      toast({
        title: 'Dispute Submitted Successfully!',
        description: `Your dispute (Case #${disputeId.slice(0, 8)}) has been sent to our admin team for review. You'll receive updates via notifications and SMS.`,
      });

      onSuccess();
      onClose();
      setForm({ transactionId: '', reason: '', description: '' });
    } catch (err: any) {
      console.error('Failed to create dispute:', err);
      toast({
        title: 'Error',
        description: err?.message || err?.details || 'Failed to create dispute',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#5d2ba3]/20 rounded-full flex items-center justify-center">
              <AlertTriangleIcon className="text-[#5d2ba3]" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#3d1a7a]">Create New Dispute</h2>
              <p className="text-sm text-gray-500">Report an issue with your {userRole === 'buyer' ? 'purchase' : 'sale'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition">
            <XIcon size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Order Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Select Order {orders.length > 0 ? '*' : '(Optional)'}
            </label>
            {loadingOrders ? (
              <div className="flex items-center justify-center py-4">
                <LoaderIcon size={24} className="animate-spin text-[#5d2ba3]" />
              </div>
            ) : orders.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center text-amber-700">
                <p className="text-sm font-medium">No orders available</p>
                <p className="text-xs mt-1">You can still submit a general dispute below.</p>
              </div>
            ) : (
              <select
                value={form.transactionId}
                onChange={(e) => setForm({ ...form, transactionId: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3d1a7a] bg-white"
              >
                <option value="">Select an order...</option>
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.item_name} - {formatPrice(order.amount, (order as any).currency || 'KES')} ({order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A'})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Dispute Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Dispute Type *
            </label>
            <select
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3d1a7a] bg-white"
              required
            >
              <option value="">Select type...</option>
              {DISPUTE_TYPES[userRole].map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Description * <span className="font-normal text-gray-400">(min 20 characters)</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe your issue in detail. Include relevant dates, what went wrong, and what resolution you're seeking..."
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3d1a7a] resize-none"
              rows={5}
              maxLength={1000}
              required
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{form.description.length}/1000</p>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>What happens next?</strong><br />
              Our team will review your dispute within 24-48 hours. You'll receive updates via the messaging system and notifications.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-200 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (orders.length > 0 && !form.transactionId) || !form.reason || form.description.length < 20}
              className="flex-1 px-4 py-3 bg-[#3d1a7a] text-white rounded-lg font-medium hover:bg-[#250e52] disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <LoaderIcon size={18} className="animate-spin" />
                  Creating...
                </>
              ) : (
                'Submit Dispute'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
