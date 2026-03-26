import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { CopyIcon, CheckIcon, RefreshCwIcon, LoaderIcon, PackageIcon, ShareIcon } from '@/components/icons';
import { MessageCircle } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
  images?: string[];
}

interface SalesPack {
  id: string;
  product_id: string;
  whatsapp_launch: string;
  whatsapp_followup: string;
  whatsapp_urgency: string;
  instagram_caption: string;
  instagram_hashtags: string;
  quick_replies: string[];
  created_at: string;
}

interface SalesPackTabProps {
  storeSlug: string;
  storeName: string;
}

export function SalesPackTab({ storeSlug, storeName }: SalesPackTabProps) {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [salesPack, setSalesPack] = useState<SalesPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'whatsapp' | 'instagram' | 'replies'>('whatsapp');

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('seller_id', user.id)
        .maybeSingle();

      if (!store) { setLoading(false); return; }

      const { data } = await supabase
        .from('products')
        .select('id, name, price, description, images')
        .eq('store_id', store.id)
        .in('status', ['PUBLISHED', 'DRAFT'])
        .order('created_at', { ascending: false });

      setProducts(data || []);
      if (data && data.length > 0) {
        setSelectedProduct(data[0]);
        await loadSalesPack(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSalesPack = async (productId: string) => {
    const { data } = await supabase
      .from('sales_packs')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    setSalesPack(data);
  };

  const generateSalesPack = async () => {
    if (!selectedProduct) return;
    setGenerating(true);

    try {
      const productLink = `${window.location.origin}/store/${storeSlug}/product/${selectedProduct.id}`;
      const price = `KES ${selectedProduct.price?.toLocaleString() || '0'}`;

      // Generate sales content locally (no AI dependency)
      const pack = {
        whatsapp_launch: `🚀 *NEW DROP!*\n\n${selectedProduct.name}\n💰 ${price}\n\n${selectedProduct.description || 'Check it out!'}\n\n🛒 Order now: ${productLink}\n\n— ${storeName}`,
        whatsapp_followup: `Hey! 👋\n\nJust checking in — did you see *${selectedProduct.name}*?\n\nStill available at ${price} ✨\n\n🛒 ${productLink}\n\nLet me know if you have any questions!`,
        whatsapp_urgency: `⚡ *LAST CHANCE!*\n\n${selectedProduct.name} is selling fast!\n💰 ${price}\n\n🔥 Don't miss out — grab yours now!\n🛒 ${productLink}`,
        instagram_caption: `✨ ${selectedProduct.name} ✨\n\n${selectedProduct.description || 'Available now!'}\n\n💰 ${price}\n🛒 Link in bio to order\n\n— ${storeName}`,
        instagram_hashtags: `#${storeName.replace(/\s+/g, '')} #ShopNow #OnlineShopping #NewArrival #${selectedProduct.name.replace(/\s+/g, '')} #KenyanBusiness #SupportLocal`,
        quick_replies: [
          `Hi! Yes, ${selectedProduct.name} is available at ${price}. Want to order?`,
          `Delivery is available within Nairobi (1-2 days) and countrywide (3-5 days).`,
          `You can pay via M-Pesa or card. I'll send you a payment link!`,
          `Great choice! Here's the link to order: ${productLink}`,
          `We accept returns within 7 days if the item is unused.`,
          `Let me check stock and get back to you shortly!`,
          `Bulk orders get a discount! How many do you need?`,
          `Thanks for your interest! Feel free to ask any questions 😊`,
        ],
      };

      // Save to database
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: saved, error } = await supabase
          .from('sales_packs')
          .upsert({
            product_id: selectedProduct.id,
            seller_id: user.id,
            ...pack,
          }, { onConflict: 'product_id' })
          .select()
          .single();

        if (error) {
          console.error('Save error:', error);
          // Still show generated content even if save fails
          setSalesPack({ id: 'temp', product_id: selectedProduct.id, created_at: new Date().toISOString(), ...pack });
        } else {
          setSalesPack(saved);
        }
      }

      toast({ title: '🎉 Sales pack generated!' });
    } catch (err) {
      console.error('Generation error:', err);
      toast({ title: 'Failed to generate', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast({ title: 'Copied!' });
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast({ title: 'Failed to copy', variant: 'destructive' });
    }
  };

  const shareToWhatsApp = (text: string) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const CopyButton = ({ text, field }: { text: string; field: string }) => (
    <div className="flex gap-2">
      <button
        onClick={() => copyToClipboard(text, field)}
        className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition"
        title="Copy"
      >
        {copiedField === field ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
      </button>
      <button
        onClick={() => shareToWhatsApp(text)}
        className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 rounded-lg transition"
        title="Share to WhatsApp"
      >
        <MessageCircle size={16} />
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoaderIcon size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-12 text-center">
        <PackageIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
        <h3 className="text-xl font-bold text-foreground mb-2">No products yet</h3>
        <p className="text-muted-foreground">Add products first to generate sales packs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">📦 Sales Packs</h2>
          <p className="text-muted-foreground text-sm">Auto-generated marketing content for your products</p>
        </div>
      </div>

      {/* Product Selector */}
      <div className="bg-card border border-border rounded-xl p-4">
        <label className="block text-sm font-medium text-foreground mb-2">Select Product</label>
        <div className="flex gap-3 items-center">
          <select
            value={selectedProduct?.id || ''}
            onChange={async (e) => {
              const p = products.find(x => x.id === e.target.value);
              setSelectedProduct(p || null);
              if (p) await loadSalesPack(p.id);
            }}
            className="flex-1 px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name} — KES {p.price?.toLocaleString()}</option>
            ))}
          </select>
          <button
            onClick={generateSalesPack}
            disabled={generating}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium disabled:opacity-50"
          >
            {generating ? <LoaderIcon size={18} className="animate-spin" /> : <RefreshCwIcon size={18} />}
            {salesPack ? 'Regenerate' : 'Generate'}
          </button>
        </div>
      </div>

      {/* Generated Content */}
      {salesPack ? (
        <div className="space-y-4">
          {/* Section Tabs */}
          <div className="flex gap-2 bg-muted p-1 rounded-lg">
            {([
              { key: 'whatsapp', label: '💬 WhatsApp', emoji: '💬' },
              { key: 'instagram', label: '📸 Instagram', emoji: '📸' },
              { key: 'replies', label: '⚡ Quick Replies', emoji: '⚡' },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveSection(tab.key)}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition ${
                  activeSection === tab.key
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* WhatsApp Messages */}
          {activeSection === 'whatsapp' && (
            <div className="space-y-4">
              {[
                { label: '🚀 Launch Message', text: salesPack.whatsapp_launch, field: 'launch' },
                { label: '👋 Follow-up', text: salesPack.whatsapp_followup, field: 'followup' },
                { label: '⚡ Urgency', text: salesPack.whatsapp_urgency, field: 'urgency' },
              ].map(msg => (
                <div key={msg.field} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-semibold text-foreground">{msg.label}</h4>
                    <CopyButton text={msg.text} field={msg.field} />
                  </div>
                  <pre className="whitespace-pre-wrap text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg font-sans">
                    {msg.text}
                  </pre>
                </div>
              ))}
            </div>
          )}

          {/* Instagram Content */}
          {activeSection === 'instagram' && (
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold text-foreground">📸 Caption</h4>
                  <CopyButton text={salesPack.instagram_caption} field="ig-caption" />
                </div>
                <pre className="whitespace-pre-wrap text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg font-sans">
                  {salesPack.instagram_caption}
                </pre>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold text-foreground"># Hashtags</h4>
                  <CopyButton text={salesPack.instagram_hashtags} field="ig-hashtags" />
                </div>
                <p className="text-sm text-primary bg-muted/50 p-3 rounded-lg">
                  {salesPack.instagram_hashtags}
                </p>
              </div>
            </div>
          )}

          {/* Quick Replies */}
          {activeSection === 'replies' && (
            <div className="space-y-3">
              {(salesPack.quick_replies || []).map((reply, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-4 flex justify-between items-start gap-3">
                  <p className="text-sm text-foreground flex-1">{reply}</p>
                  <CopyButton text={reply} field={`reply-${i}`} />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <ShareIcon className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
          <h3 className="font-bold text-foreground mb-1">No sales pack yet</h3>
          <p className="text-muted-foreground text-sm mb-4">Click "Generate" to create marketing content for this product</p>
        </div>
      )}
    </div>
  );
}
