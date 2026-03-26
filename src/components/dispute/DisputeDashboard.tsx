import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { Plus, Loader2, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';
import { CreateDisputeModal } from './CreateDisputeModal';
import { DisputeMessaging } from './DisputeMessaging';

interface Dispute {
  id: string;
  opened_by_id: string;
  transaction_id: string | null;
  reason: string;
  dispute_type: string | null;
  description: string | null;
  status: string;
  evidence: string[];
  resolution: string | null;
  created_at: string;
  updated_at: string;
}

interface DisputeDashboardProps {
  userType: 'CUSTOMER' | 'SELLER' | 'ADMIN';
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  under_review: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  awaiting_seller: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  awaiting_buyer: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  resolved_buyer: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  resolved_seller: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  closed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

export function DisputeDashboard({ userType }: DisputeDashboardProps) {
  const { user } = useSupabaseAuth();
  
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');

  useEffect(() => { loadDisputes(); }, []);

  const loadDisputes = async () => {
    if (!user) return;
    setLoading(true);
    
    const { data, error } = await (supabase as any)
      .from('disputes')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setDisputes(data as unknown as Dispute[]);
    }
    setLoading(false);
  };

  const filteredDisputes = disputes.filter(d => {
    if (filter === 'open') return ['open', 'under_review', 'awaiting_seller', 'awaiting_buyer'].includes(d.status || '');
    if (filter === 'resolved') return ['resolved_buyer', 'resolved_seller', 'closed'].includes(d.status || '');
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Disputes</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {disputes.length} total • {disputes.filter(d => d.status === 'open').length} open
          </p>
        </div>
        {(userType === 'CUSTOMER' || userType === 'SELLER') && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm font-semibold hover:bg-destructive/90 transition"
          >
            <Plus size={16} />
            New Dispute
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'open', 'resolved'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Disputes List */}
      {filteredDisputes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-medium">No disputes found</p>
          <p className="text-sm mt-1">
            {filter !== 'all' ? 'Try changing the filter.' : 'All clear!'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDisputes.map((dispute) => {
            const isExpanded = expandedId === dispute.id;
            return (
              <div key={dispute.id} className="bg-card border border-border rounded-lg overflow-hidden">
                {/* Header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : dispute.id)}
                  className="w-full text-left p-4 hover:bg-muted/30 transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground">
                          Dispute #{dispute.id.slice(0, 8).toUpperCase()}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          STATUS_COLORS[dispute.status || 'open'] || STATUS_COLORS.open
                        }`}>
                          {(dispute.status || 'open').replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{dispute.reason}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(dispute.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <MessageCircle size={16} className="text-muted-foreground" />
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-border p-4 space-y-4">
                    {/* Description */}
                    {dispute.description && (
                      <div>
                        <p className="text-sm font-medium text-foreground mb-1">Description:</p>
                        <p className="text-sm text-muted-foreground">{dispute.description}</p>
                      </div>
                    )}

                    {/* Resolution */}
                    {dispute.resolution && (
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                        <p className="text-sm font-medium text-green-800 dark:text-green-200">Resolution:</p>
                        <p className="text-sm text-green-700 dark:text-green-300">{dispute.resolution}</p>
                      </div>
                    )}

                    {/* Messaging */}
                    <div>
                      <p className="text-sm font-medium text-foreground mb-2">Messages</p>
                      <DisputeMessaging disputeId={dispute.id} userType={userType} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Dispute Modal */}
      {showCreate && (
        <CreateDisputeModal
          onClose={() => setShowCreate(false)}
          onCreated={loadDisputes}
        />
      )}
    </div>
  );
}
