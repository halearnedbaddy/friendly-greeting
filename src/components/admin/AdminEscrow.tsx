import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/hooks/useCurrency';
import { Check, X, RefreshCw, Clock, AlertTriangle, ShieldCheck, DollarSign, TrendingUp } from 'lucide-react';
import { SUPABASE_URL } from '@/lib/supabaseProject';

interface EscrowWallet {
  id: string;
  wallet_ref: string;
  order_id: string | null;
  gross_amount: number;
  platform_fee: number;
  net_amount: number;
  currency: string | null;
  status: string | null;
  requires_buyer_confirmation: boolean | null;
  auto_release_date: string | null;
  locked_at: string | null;
  released_at: string | null;
  released_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface PlatformAccount {
  account_type: string;
  balance: number;
  currency: string;
}

export function AdminEscrow() {
  const { formatPrice } = useCurrency();
  const [escrows, setEscrows] = useState<EscrowWallet[]>([]);
  const [platformAccounts, setPlatformAccounts] = useState<PlatformAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'locked' | 'released'>('all');

  useEffect(() => {
    fetchEscrows();
    fetchPlatformAccounts();
  }, [filter]);

  const getAuthToken = async () => {
    const { data: session } = await supabase.auth.getSession();
    return session.session?.access_token;
  };

  const fetchEscrows = async () => {
    setLoading(true);
    try {
      const token = await getAuthToken();
      const statusParam = filter === 'all' ? '' : `?status=${filter}`;
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/escrow-api/list${statusParam}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();
      if (result.success) {
        setEscrows(result.data || []);
      } else {
        throw new Error(result.error || 'Failed to fetch escrows');
      }
    } catch (err) {
      console.error('Failed to fetch escrows:', err);
      setError('Failed to load escrow wallets');
    } finally {
      setLoading(false);
    }
  };

  const fetchPlatformAccounts = async () => {
    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/escrow-api/platform-summary`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();
      if (result.success) {
        setPlatformAccounts(result.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch platform accounts:', err);
    }
  };

  const releaseFunds = async (walletId: string) => {
    setActionLoading(walletId);
    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/escrow-api/release/${walletId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ adminNotes: 'Funds released by admin' }),
        }
      );

      const result = await response.json();
      if (!result.success) throw new Error(result.error);

      await fetchEscrows();
      await fetchPlatformAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to release funds');
    } finally {
      setActionLoading(null);
    }
  };

  const refundPayment = async (walletId: string) => {
    const reason = prompt('Enter refund reason:');
    if (!reason) return;

    setActionLoading(walletId);
    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/escrow-api/refund/${walletId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ reason }),
        }
      );

      const result = await response.json();
      if (!result.success) throw new Error(result.error);

      await fetchEscrows();
      await fetchPlatformAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process refund');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      locked: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
      released: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      refunded: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      disputed: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-muted text-muted-foreground'}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'escrow_pool': return <ShieldCheck className="text-amber-500" size={24} />;
      case 'platform_fees': return <TrendingUp className="text-green-500" size={24} />;
      case 'payout_pending': return <DollarSign className="text-blue-500" size={24} />;
      default: return <DollarSign size={24} />;
    }
  };

  const getAccountLabel = (type: string) => {
    switch (type) {
      case 'escrow_pool': return 'Escrow Pool';
      case 'platform_fees': return 'Platform Fees';
      case 'payout_pending': return 'Pending Payouts';
      default: return type;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Platform Accounts Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {platformAccounts.map((account) => (
          <div key={account.account_type} className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-3">
              {getAccountIcon(account.account_type)}
              <div>
                <p className="text-sm text-muted-foreground">{getAccountLabel(account.account_type)}</p>
                <p className="text-xl font-bold text-foreground">
                  {formatPrice(account.balance || 0, account.currency || 'KES')}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Escrow Management</h2>
        <div className="flex items-center gap-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="px-3 py-2 border border-input rounded-lg bg-background text-foreground"
          >
            <option value="all">All Escrows</option>
            <option value="locked">Locked (In Escrow)</option>
            <option value="released">Released</option>
          </select>
          <button
            onClick={() => { fetchEscrows(); fetchPlatformAccounts(); }}
            className="p-2 hover:bg-muted rounded-lg transition"
          >
            <RefreshCw size={20} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertTriangle size={16} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X size={16} />
          </button>
        </div>
      )}

      {escrows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Clock size={48} className="mx-auto mb-4 opacity-50" />
          <p>No escrow wallets found</p>
          <p className="text-sm mt-2">Escrow wallets are created when buyers make payments</p>
        </div>
      ) : (
        <div className="space-y-4">
          {escrows.map((escrow) => (
            <div key={escrow.id} className="border border-border rounded-lg p-4 bg-card">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    {getStatusBadge(escrow.status || 'locked')}
                    <span className="text-sm text-muted-foreground font-mono">
                      {escrow.wallet_ref}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {formatDate(escrow.created_at)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Gross Amount:</span>
                      <span className="ml-2 font-bold text-primary">
                        {formatPrice(escrow.gross_amount, escrow.currency || 'KES')}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Platform Fee:</span>
                      <span className="ml-2 font-medium text-foreground">
                        {formatPrice(escrow.platform_fee, escrow.currency || 'KES')}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Net Amount:</span>
                      <span className="ml-2 font-bold text-green-600">
                        {formatPrice(escrow.net_amount, escrow.currency || 'KES')}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Order ID:</span>
                      <span className="ml-2 font-mono text-foreground text-xs">
                        {escrow.order_id?.slice(0, 12) || 'N/A'}...
                      </span>
                    </div>
                  </div>
                  {escrow.auto_release_date && escrow.status === 'locked' && (
                    <p className="text-xs text-muted-foreground">
                      Auto-release: {formatDate(escrow.auto_release_date)}
                    </p>
                  )}
                  {escrow.released_at && (
                    <p className="text-xs text-green-600">
                      Released: {formatDate(escrow.released_at)} by {escrow.released_by || 'system'}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  {escrow.status === 'locked' && (
                    <>
                      <button
                        onClick={() => releaseFunds(escrow.id)}
                        disabled={actionLoading === escrow.id}
                        className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2 disabled:opacity-50"
                      >
                        {actionLoading === escrow.id ? (
                          <RefreshCw size={16} className="animate-spin" />
                        ) : (
                          <Check size={16} />
                        )}
                        Release
                      </button>
                      <button
                        onClick={() => refundPayment(escrow.id)}
                        disabled={actionLoading === escrow.id}
                        className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-2 disabled:opacity-50"
                      >
                        <X size={16} />
                        Refund
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
