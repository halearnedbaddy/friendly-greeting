import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Download, Share2, Printer, CheckCircle, Clock, ArrowLeft, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ReceiptItem {
  name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  total: number;
  sku?: string;
}

interface ReceiptData {
  id: string;
  receiptNumber: string;
  storeId: string;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  deliveryFee: number;
  discount: number;
  total: number;
  paymentMethod?: string;
  mpesaCode?: string;
  mpesaPhone?: string;
  paymentVerified: boolean;
  paymentTime?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  deliveryAddress?: string;
  sellerName?: string;
  sellerContact?: string;
  status: string;
  createdAt: string;
}

const getApiBase = () => {
  if (typeof window === 'undefined') return 'http://127.0.0.1:8000';
  const { hostname, protocol } = window.location;
  if (hostname.includes('replit.dev')) return `${protocol}//${hostname.replace('5000', '8000')}`;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return `${protocol}//127.0.0.1:8000`;
  return `${protocol}//${hostname}:8000`;
};

export function ReceiptPage() {
  const { receiptId } = useParams<{ receiptId: string }>();
  const navigate = useNavigate();
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReceipt = useCallback(async () => {
    if (!receiptId) return;
    try {
      const base = getApiBase();
      const res = await fetch(`${base}/api/v1/receipts/by-order/${receiptId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Receipt not found');
      setReceipt(json.data);
    } catch (err: any) {
      // Try fetching by receipt ID directly (public endpoint)
      try {
        const base = getApiBase();
        const res2 = await fetch(`${base}/api/v1/receipts/by-order/${receiptId}`);
        const json2 = await res2.json();
        if (res2.ok) {
          setReceipt(json2.data);
          return;
        }
      } catch {}
      setError(err.message || 'Failed to load receipt');
    } finally {
      setLoading(false);
    }
  }, [receiptId]);

  useEffect(() => {
    fetchReceipt();
  }, [fetchReceipt]);

  const handleDownloadPdf = () => {
    if (!receipt) return;
    const base = getApiBase();
    window.open(`${base}/api/v1/receipts/download/${receipt.id}`, '_blank');
  };

  const handlePrint = () => {
    if (!receipt) return;
    const base = getApiBase();
    window.open(`${base}/api/v1/receipts/view/${receipt.id}`, '_blank');
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Receipt ${receipt?.receiptNumber}`,
          text: 'View your PayLoom receipt',
          url,
        });
      } catch {}
    } else {
      await navigator.clipboard.writeText(url).catch(() => {});
      alert('Link copied to clipboard!');
    }
  };

  const fmt = (n: number) =>
    `KES ${Number(n).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading receipt…</p>
        </div>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 text-center space-y-4">
            <Receipt className="w-14 h-14 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-semibold">Receipt Not Found</h2>
            <p className="text-muted-foreground text-sm">{error || 'This receipt could not be found.'}</p>
            <Button onClick={() => navigate('/')} variant="outline" className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" /> Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const items: ReceiptItem[] = Array.isArray(receipt.items) ? (receipt.items as any[]).map((it: any) => ({
    name: it.name || '',
    description: it.description,
    quantity: Number(it.quantity) || 1,
    unit_price: Number(it.unit_price || it.unitPrice || 0),
    total: Number(it.total || 0),
    sku: it.sku,
  })) : [];

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4 print:p-0 print:bg-white">
      <div className="max-w-xl mx-auto space-y-4">

        {/* Action bar */}
        <div className="flex items-center justify-between print:hidden">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-1" /> Print
            </Button>
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Share2 className="w-4 h-4 mr-1" /> Share
            </Button>
            <Button size="sm" onClick={handleDownloadPdf} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Download className="w-4 h-4 mr-1" /> PDF
            </Button>
          </div>
        </div>

        {/* Receipt card */}
        <Card className="shadow-lg print:shadow-none print:border-0">
          {/* Header */}
          <div className="bg-emerald-700 text-white rounded-t-lg px-6 py-5 text-center">
            <p className="text-sm font-medium tracking-widest uppercase opacity-80">PAYLOOM INSTANTS</p>
            <h1 className="text-2xl font-bold mt-1">{receipt.sellerName || 'Store Receipt'}</h1>
            {receipt.sellerContact && (
              <p className="text-sm opacity-70 mt-0.5">Contact: {receipt.sellerContact}</p>
            )}
          </div>

          <CardContent className="px-6 py-5 space-y-5">
            {/* Meta */}
            <div className="flex justify-between items-start text-sm border-b pb-4">
              <div>
                <p className="text-muted-foreground">Receipt #</p>
                <p className="font-mono font-bold text-foreground">{receipt.receiptNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground">Date</p>
                <p className="font-medium text-foreground">
                  {new Date(receipt.createdAt).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
            </div>

            {/* Items */}
            <div>
              <h3 className="font-semibold text-sm uppercase text-muted-foreground mb-3 tracking-wide">Items Purchased</h3>
              <div className="space-y-0">
                <div className="grid grid-cols-12 text-xs font-medium text-muted-foreground pb-1 border-b">
                  <span className="col-span-5">Item</span>
                  <span className="col-span-2 text-center">Qty</span>
                  <span className="col-span-2 text-right">Price</span>
                  <span className="col-span-3 text-right">Total</span>
                </div>
                {items.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 text-sm py-2 border-b border-dashed last:border-0">
                    <div className="col-span-5">
                      <p className="font-medium text-foreground">{item.name}</p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      )}
                      {item.sku && <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>}
                    </div>
                    <span className="col-span-2 text-center text-foreground">{item.quantity}</span>
                    <span className="col-span-2 text-right text-muted-foreground">
                      {fmt(item.unit_price)}
                    </span>
                    <span className="col-span-3 text-right font-medium text-foreground">
                      {fmt(item.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="space-y-1.5 border-t pt-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{fmt(receipt.subtotal)}</span>
              </div>
              {Number(receipt.tax) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax (16% VAT)</span>
                  <span>{fmt(receipt.tax)}</span>
                </div>
              )}
              {Number(receipt.deliveryFee) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Delivery Fee</span>
                  <span>{fmt(receipt.deliveryFee)}</span>
                </div>
              )}
              {Number(receipt.discount) > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>Discount</span>
                  <span>-{fmt(receipt.discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg pt-2 border-t border-emerald-600">
                <span className="text-emerald-700">TOTAL</span>
                <span className="text-emerald-700">{fmt(receipt.total)}</span>
              </div>
            </div>

            {/* Payment details */}
            <div className="bg-muted rounded-lg p-4 space-y-1.5">
              <h3 className="font-semibold text-sm uppercase text-muted-foreground tracking-wide mb-2">Payment</h3>
              {receipt.paymentMethod && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Method</span>
                  <span className="font-medium">{receipt.paymentMethod}</span>
                </div>
              )}
              {receipt.mpesaCode && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">M-Pesa Code</span>
                  <code className="font-mono font-bold text-foreground">{receipt.mpesaCode}</code>
                </div>
              )}
              {receipt.mpesaPhone && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Phone</span>
                  <span>{receipt.mpesaPhone}</span>
                </div>
              )}
              {receipt.paymentTime && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Time</span>
                  <span>{new Date(receipt.paymentTime).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 pt-1">
                {receipt.paymentVerified ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Clock className="w-4 h-4 text-amber-500" />
                )}
                <span className={`text-sm font-semibold ${receipt.paymentVerified ? 'text-emerald-600' : 'text-amber-500'}`}>
                  {receipt.paymentVerified ? 'Payment Verified' : 'Payment Pending'}
                </span>
              </div>
            </div>

            {/* Customer */}
            {(receipt.customerName || receipt.customerPhone) && (
              <div className="space-y-1.5">
                <h3 className="font-semibold text-sm uppercase text-muted-foreground tracking-wide">Customer</h3>
                {receipt.customerName && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Name</span>
                    <span>{receipt.customerName}</span>
                  </div>
                )}
                {receipt.customerPhone && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Phone</span>
                    <span>{receipt.customerPhone}</span>
                  </div>
                )}
                {receipt.deliveryAddress && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Delivery</span>
                    <span className="text-right max-w-[200px]">{receipt.deliveryAddress}</span>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="border-t pt-4 text-center text-xs text-muted-foreground space-y-1">
              <p className="font-medium">Thank you for shopping with us!</p>
              {receipt.sellerContact && <p>Questions? Contact: {receipt.sellerContact}</p>}
              <p className="text-muted-foreground/60 mt-2">Powered by PayLoom Instants</p>
            </div>
          </CardContent>
        </Card>

        {/* Download CTA */}
        <div className="flex flex-col sm:flex-row gap-3 print:hidden">
          <Button onClick={handleDownloadPdf} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
            <Download className="w-4 h-4 mr-2" /> Download PDF Receipt
          </Button>
          <Button onClick={handlePrint} variant="outline" className="flex-1">
            <Printer className="w-4 h-4 mr-2" /> View Printable Version
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground print:hidden">
          Receipt ID: <code className="font-mono">{receipt.id}</code>
        </p>
      </div>
    </div>
  );
}
