import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/hooks/useCurrency';
import { SUPABASE_URL } from '@/lib/supabaseProject';
import { Check, X, RefreshCw, Clock, AlertTriangle, Eye, Search, FileText } from 'lucide-react';

interface PendingTransaction {
  id: string;
  item_name: string;
  amount: number;
  currency: string;
  status: string;
  buyer_name: string | null;
  buyer_phone: string | null;
  buyer_email: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  transaction_code: string | null;
  screenshot_url: string | null;
  verification_status: string | null;
  verification_details: any;
  seller_id: string;
  seller_name?: string;
  escrow_status: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
}

export function AdminPendingPayments() {
  const { formatPrice } = useCurrency();
  const [transactions, setTransactions] = useState<PendingTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTx, setSelectedTx] = useState<PendingTransaction | null>(null);

  useEffect(() => { fetchPendingPayments(); }, []);

  const getAuthToken = async () => {
    const { data: session } = await supabase.auth.getSession();
    return session.session?.access_token;
  };

  const fetchPendingPayments = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('status', 'processing' as any)
        .order('created_at', { ascending: false });

      if (txError) throw txError;

      const sellerIds = [...new Set((txData || []).map((tx: any) => tx.seller_id))];
      let sellerProfiles: Record<string, string> = {};
      if (sellerIds.length > 0) {
        const { data: profiles } = await (supabase as any)
          .from('profiles')
          .select('user_id, name')
          .in('user_id', sellerIds);
        (profiles || []).forEach((p: any) => { sellerProfiles[p.user_id] = p.name; });
      }

      const combined: PendingTransaction[] = (txData || []).map((tx: any) => ({
        ...tx,
        seller_name: sellerProfiles[tx.seller_id] || 'Unknown Seller',
      }));

      setTransactions(combined);
    } catch (err) {
      console.error('Failed to fetch pending payments:', err);
      setError('Failed to load pending payments');
    } finally {
      setLoading(false);
    }
  };

  const approvePayment = async (orderId: string) => {
    setActionLoading(orderId);
    setError(null);
    setSuccessMessage(null);
    try {
      const token = await getAuthToken();
      const response = await fetch(`${SUPABASE_URL}/functions/v1/validate-payment/approve/${orderId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Approved by admin' }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to approve');
      setSuccessMessage(`Payment approved for order ${orderId.slice(0, 12)}`);
      await fetchPendingPayments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setActionLoading(null);
    }
  };

  const rejectPayment = async (orderId: string) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;
    setActionLoading(orderId);
    setError(null);
    try {
      const token = await getAuthToken();
      const response = await fetch(`${SUPABASE_URL}/functions/v1/validate-payment/reject/${orderId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to reject');
      setSuccessMessage('Payment rejected. Buyer notified.');
      await fetchPendingPayments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleString() : 'N/A';

  const getValidationChecks = (tx: PendingTransaction) => {
    const details = tx.verification_details;
    if (!details?.validations) return null;
    return details.validations as Array<{ type: string; status: string }>;
  };

  const filteredTransactions = transactions.filter(tx => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      tx.id.toLowerCase().includes(term) ||
      tx.item_name.toLowerCase().includes(term) ||
      (tx.buyer_name?.toLowerCase().includes(term) ?? false) ||
      (tx.buyer_phone?.includes(term) ?? false) ||
      (tx.transaction_code?.toLowerCase().includes(term) ?? false) ||
      (tx.seller_name?.toLowerCase().includes(term) ?? false)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Pending Payment Approvals</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {transactions.length} payment{transactions.length !== 1 ? 's' : ''} awaiting admin approval
          </p>
        </div>
        <button onClick={fetchPendingPayments}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {successMessage && (
        <div className="bg-primary/10 border border-primary/30 text-primary px-4 py-3 rounded-lg flex items-center gap-2">
          <Check size={16} /> {successMessage}
          <button onClick={() => setSuccessMessage(null)} className="ml-auto"><X size={16} /></button>
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertTriangle size={16} /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={16} /></button>
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
        <input type="text" placeholder="Search by ID, buyer, code, seller..."
          value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm" />
      </div>

      {filteredTransactions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Clock size={48} className="mx-auto mb-4 opacity-50" />
          <p className="font-medium">No pending payment approvals</p>
          <p className="text-sm mt-2">All payments have been processed</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTransactions.map((tx) => {
            const checks = getValidationChecks(tx);
            return (
              <div key={tx.id} className="border border-border rounded-lg bg-card shadow-sm overflow-hidden">
                <div className="p-4 flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        tx.verification_status === 'flagged' ? 'bg-destructive/10 text-destructive' : 'bg-accent/10 text-accent'
                      }`}>
                        {tx.verification_status === 'flagged' ? '🚨 FLAGGED' : '🟡 PENDING APPROVAL'}
                      </span>
                      <span className="text-sm text-muted-foreground font-mono">{tx.id.slice(0, 16)}...</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground block text-xs">Item</span>
                        <span className="font-semibold text-foreground">{tx.item_name}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-xs">Amount</span>
                        <span className="font-bold text-primary">{formatPrice(tx.amount, tx.currency || 'KES')}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-xs">Buyer</span>
                        <span className="font-medium text-foreground">{tx.buyer_name || 'N/A'}</span>
                        <span className="block text-xs text-muted-foreground">{tx.buyer_phone || ''}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-xs">Seller</span>
                        <span className="font-medium text-foreground">{tx.seller_name}</span>
                      </div>
                    </div>

                    {/* Payment Details */}
                    <div className="bg-muted rounded-lg p-3 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Payment Details</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground text-xs">Method:</span>
                          <span className="ml-1 font-medium text-foreground">{tx.payment_method || 'Manual'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs">Transaction Code:</span>
                          <span className="ml-1 font-mono font-bold text-primary">{tx.transaction_code || tx.payment_reference || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs">Submitted:</span>
                          <span className="ml-1 text-foreground">{formatDate(tx.updated_at)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Validation Checks */}
                    {checks && (
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Validation Checks</p>
                        <div className="flex flex-wrap gap-2">
                          {checks.map((check, i) => (
                            <span key={i} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                              check.status === 'passed' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
                            }`}>
                              {check.status === 'passed' ? <Check size={12} /> : <X size={12} />}
                              {check.type.replace('_', ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {tx.screenshot_url && (
                      <a href={tx.screenshot_url} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                        <FileText size={14} /> View Screenshot
                      </a>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    <button onClick={() => approvePayment(tx.id)} disabled={actionLoading === tx.id}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition flex items-center gap-2 text-sm font-medium disabled:opacity-50">
                      {actionLoading === tx.id ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />} Approve
                    </button>
                    <button onClick={() => rejectPayment(tx.id)} disabled={actionLoading === tx.id}
                      className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition flex items-center gap-2 text-sm font-medium disabled:opacity-50">
                      <X size={14} /> Reject
                    </button>
                    <button onClick={() => setSelectedTx(selectedTx?.id === tx.id ? null : tx)}
                      className="px-4 py-2 border border-input text-foreground rounded-lg hover:bg-muted transition flex items-center gap-2 text-sm font-medium">
                      <Eye size={14} /> Details
                    </button>
                  </div>
                </div>

                {selectedTx?.id === tx.id && (
                  <div className="border-t border-border bg-muted p-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div><span className="text-muted-foreground block text-xs">Buyer Email</span><span className="text-foreground">{tx.buyer_email || 'N/A'}</span></div>
                      <div><span className="text-muted-foreground block text-xs">Verification Status</span><span className="font-medium text-foreground">{tx.verification_status || 'Pending'}</span></div>
                      <div><span className="text-muted-foreground block text-xs">Created</span><span className="text-foreground">{formatDate(tx.created_at)}</span></div>
                      <div><span className="text-muted-foreground block text-xs">Last Updated</span><span className="text-foreground">{formatDate(tx.updated_at)}</span></div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
