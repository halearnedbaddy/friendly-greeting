import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/hooks/use-toast';
import { X, Loader2 } from 'lucide-react';
import { DISPUTE_TYPES } from '@/config/countryPaymentConfig';

interface CreateDisputeModalProps {
  onClose: () => void;
  onCreated?: () => void;
}

interface OrderOption {
  id: string;
  item_name: string;
  amount: number;
  currency: string;
  seller_id: string;
  status: string;
  created_at: string;
}

export function CreateDisputeModal({ onClose, onCreated }: CreateDisputeModalProps) {
  const { user } = useSupabaseAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderOption | null>(null);
  const [disputeType, setDisputeType] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    if (!user) return;
    setLoadingOrders(true);
    const { data, error } = await supabase
      .from('transactions')
      .select('id, item_name, amount, currency, seller_id, status, created_at')
      .eq('buyer_id', user.id)
      .in('status', ['pending', 'completed'] as any[])
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      setOrders((data as unknown as OrderOption[]) || []);
    }
    setLoadingOrders(false);
  };

  const createDispute = async () => {
    if (!user || !selectedOrder || !description.trim()) return;

    setLoading(true);
    try {
      const { error } = await (supabase as any)
        .from('disputes')
        .insert({
          opened_by_id: user.id,
          transaction_id: selectedOrder.id,
          reason: DISPUTE_TYPES.find(t => t.id === disputeType)?.label || disputeType,
          dispute_type: disputeType,
          description,
          status: 'open',
        } as any);

      if (error) throw error;

      // Trigger SMS notifications
      try {
        await supabase.functions.invoke('sms-notifications', {
          body: {
            action: 'dispute_created',
            transactionId: selectedOrder.id,
            disputeType,
            description: description.substring(0, 100),
          }
        });
      } catch {
        // SMS is best-effort
      }

      toast({
        title: 'Dispute Created',
        description: 'Your dispute has been submitted. All parties have been notified.',
      });
      onCreated?.();
      onClose();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to create dispute', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-card-foreground">Create Dispute</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {s}
                </div>
                {s < 3 && <div className={`w-12 h-0.5 mx-1 ${step > s ? 'bg-primary' : 'bg-muted'}`} />}
              </div>
            ))}
          </div>

          {/* Step 1: Select Order */}
          {step === 1 && (
            <div>
              <h3 className="font-semibold text-foreground mb-4">Select Order</h3>
              {loadingOrders ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="animate-spin text-primary" size={24} /></div>
              ) : orders.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No eligible orders found.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {orders.map((order) => (
                    <button
                      key={order.id}
                      onClick={() => { setSelectedOrder(order); setStep(2); }}
                      className="w-full text-left p-3 border border-border rounded-lg hover:border-primary transition bg-background"
                    >
                      <p className="font-medium text-foreground">{order.item_name}</p>
                      <div className="flex justify-between text-sm text-muted-foreground mt-1">
                        <span>{order.currency} {order.amount.toLocaleString()}</span>
                        <span className="capitalize">{order.status}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(order.created_at || '').toLocaleDateString()}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Dispute Type */}
          {step === 2 && (
            <div>
              <h3 className="font-semibold text-foreground mb-4">What's the issue?</h3>
              <div className="grid grid-cols-2 gap-3">
                {DISPUTE_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => { setDisputeType(type.id); setStep(3); }}
                    className="text-left p-4 border border-border rounded-lg hover:border-primary transition bg-background"
                  >
                    <span className="text-2xl block mb-2">{type.icon}</span>
                    <p className="font-medium text-foreground text-sm">{type.label}</p>
                  </button>
                ))}
              </div>
              <button onClick={() => setStep(1)} className="mt-4 text-primary text-sm hover:underline">← Back</button>
            </div>
          )}

          {/* Step 3: Details */}
          {step === 3 && (
            <div>
              <h3 className="font-semibold text-foreground mb-4">Provide Details</h3>
              
              {/* Selected order summary */}
              {selectedOrder && (
                <div className="bg-muted/50 rounded-lg p-3 mb-4 text-sm">
                  <p className="text-foreground font-medium">{selectedOrder.item_name}</p>
                  <p className="text-muted-foreground">{selectedOrder.currency} {selectedOrder.amount.toLocaleString()}</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Description *</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Explain the issue in detail..."
                    rows={5}
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(2)}
                    className="flex-1 bg-muted text-foreground py-3 rounded-lg font-semibold hover:bg-muted/80 transition"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={createDispute}
                    disabled={!description.trim() || loading}
                    className="flex-1 bg-destructive text-destructive-foreground py-3 rounded-lg font-semibold hover:bg-destructive/90 disabled:opacity-50 transition flex items-center justify-center gap-2"
                  >
                    {loading && <Loader2 size={16} className="animate-spin" />}
                    Create Dispute
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
