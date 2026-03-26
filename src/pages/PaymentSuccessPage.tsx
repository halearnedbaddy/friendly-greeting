import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, Clock, AlertCircle, Loader2, RefreshCw, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TransactionData {
  id: string;
  payment_reference: string | null;
  status: string;
  verification_status: string | null;
  amount: number;
  currency: string | null;
  transaction_code: string | null;
  buyer_name: string | null;
  buyer_phone: string | null;
  item_name: string;
  created_at: string | null;
  rejection_reason: string | null;
  seller_id: string;
}

export function PaymentSuccessPage() {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [transaction, setTransaction] = useState<TransactionData | null>(null);

  useEffect(() => {
    if (transactionId) {
      fetchTransaction();
      const interval = setInterval(fetchTransaction, 10000);
      return () => clearInterval(interval);
    }
  }, [transactionId]);

  const fetchTransaction = async () => {
    try {
      if (!transactionId) return;
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', transactionId!)
        .maybeSingle();

      if (error) throw error;
      if (data) setTransaction(data as unknown as TransactionData);
    } catch (error) {
      console.error('Error fetching transaction:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Transaction Not Found</h2>
            <p className="text-muted-foreground mb-6">We couldn't find this transaction.</p>
            <Button onClick={() => navigate('/')}>Go Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const verificationStatus = transaction.verification_status?.toLowerCase() || 'pending';
  const isApproved = verificationStatus === 'approved';
  const isRejected = verificationStatus === 'rejected';
  const isPending = !isApproved && !isRejected;

  const getStatusIcon = () => {
    if (isApproved) return <CheckCircle className="w-16 h-16 text-primary" />;
    if (isRejected) return <AlertCircle className="w-16 h-16 text-destructive" />;
    return <Clock className="w-16 h-16 text-accent-foreground" />;
  };

  const getStatusBadge = () => {
    if (isApproved) return <Badge className="bg-primary text-primary-foreground">Approved</Badge>;
    if (isRejected) return <Badge className="bg-destructive text-destructive-foreground">Rejected</Badge>;
    return <Badge className="bg-accent text-accent-foreground">Pending Approval</Badge>;
  };

  const getStatusMessage = () => {
    if (isApproved) return { title: 'Payment Approved! ✓', description: 'Your payment has been verified. Thank you!' };
    if (isRejected) return { title: 'Payment Rejected', description: transaction.rejection_reason || 'Your payment could not be verified. Please contact the seller.' };
    return { title: 'Payment Submitted Successfully', description: "Your payment is being reviewed. You'll be notified once approved." };
  };

  const status = getStatusMessage();

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <div className="text-center space-y-4">
              {getStatusIcon()}
              <div>
                <CardTitle className="text-2xl mb-2">{status.title}</CardTitle>
                <p className="text-muted-foreground">{status.description}</p>
              </div>
              {getStatusBadge()}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-foreground">Transaction Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order ID:</span>
                  <code className="font-mono text-foreground">{transaction.id}</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-semibold text-foreground">
                    {transaction.currency || 'KES'} {transaction.amount?.toLocaleString()}
                  </span>
                </div>
                {transaction.transaction_code && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Transaction Code:</span>
                    <code className="font-mono text-foreground">{transaction.transaction_code}</code>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Product:</span>
                  <span className="text-foreground">{transaction.item_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
                  <span className="text-foreground">
                    {transaction.created_at ? new Date(transaction.created_at).toLocaleString() : '-'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {isApproved && (
                <Button
                  onClick={() => navigate(`/receipt/${transactionId}`)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Receipt className="w-4 h-4 mr-2" />
                  View Receipt
                </Button>
              )}
              {isPending && (
                <Button onClick={fetchTransaction} variant="outline" className="w-full">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Status
                </Button>
              )}
              <Button onClick={() => navigate('/')} variant={isApproved ? 'outline' : 'default'} className="w-full">
                {isApproved ? 'Done' : isRejected ? 'Go Home' : 'Return Home'}
              </Button>
            </div>

            {isPending && (
              <p className="text-center text-sm text-muted-foreground">
                Status updates automatically every 10 seconds
              </p>
            )}
          </CardContent>
        </Card>
        <div className="mt-6 text-center text-sm text-muted-foreground">
          Powered by Halearnedu Web • Secure Payment Processing
        </div>
      </div>
    </div>
  );
}
