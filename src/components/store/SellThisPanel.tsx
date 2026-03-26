import { useState } from 'react';
import { CopyIcon, CheckIcon, ExternalLinkIcon, ShareIcon } from '@/components/icons';
import { MessageCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
  images?: string[];
}

interface SellThisPanelProps {
  product: Product;
  storeSlug: string;
  storeName: string;
  onClose: () => void;
}

type MessageStyle = 'new-arrival' | 'flash-sale' | 'low-stock' | 'followup';

const MESSAGE_STYLES: { key: MessageStyle; label: string; emoji: string }[] = [
  { key: 'new-arrival', label: 'New Arrival', emoji: '✨' },
  { key: 'flash-sale', label: 'Flash Sale', emoji: '⚡' },
  { key: 'low-stock', label: 'Low Stock', emoji: '🔥' },
  { key: 'followup', label: 'Follow-up', emoji: '👋' },
];

export function SellThisPanel({ product, storeSlug, storeName, onClose }: SellThisPanelProps) {
  const { toast } = useToast();
  const [style, setStyle] = useState<MessageStyle>('new-arrival');
  const [copied, setCopied] = useState(false);

  const productLink = `${window.location.origin}/store/${storeSlug}/product/${product.id}`;
  const price = `KES ${product.price?.toLocaleString() || '0'}`;

  const getMessage = (): string => {
    switch (style) {
      case 'new-arrival':
        return `✨ *NEW IN!*\n\n${product.name}\n💰 ${price}\n\n${product.description || 'Available now!'}\n\n🛒 Order here: ${productLink}\n\n— ${storeName}`;
      case 'flash-sale':
        return `⚡ *FLASH SALE!*\n\n${product.name}\n💰 Was ~~${Math.round(product.price * 1.3).toLocaleString()}~~ Now ${price}!\n\n⏰ Limited time only!\n🛒 ${productLink}`;
      case 'low-stock':
        return `🔥 *SELLING FAST!*\n\n${product.name} — Only a few left!\n💰 ${price}\n\nDon't miss out! 🛒 ${productLink}`;
      case 'followup':
        return `Hey! 👋\n\nStill thinking about *${product.name}*?\n\nIt's still available at ${price} ✨\n\n🛒 ${productLink}\n\nLet me know if you have any questions!`;
    }
  };

  const message = getMessage();

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(productLink);
      setCopied(true);
      toast({ title: 'Link copied!' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Failed to copy', variant: 'destructive' });
    }
  };

  const shareToWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.name,
          text: message.replace(/\*/g, ''),
          url: productLink,
        });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(message);
      toast({ title: 'Message copied!' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex justify-between items-center">
          <div>
            <h3 className="font-bold text-foreground text-lg">🚀 Sell This</h3>
            <p className="text-sm text-muted-foreground">{product.name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition text-muted-foreground">
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Style Selector */}
          <div className="grid grid-cols-2 gap-2">
            {MESSAGE_STYLES.map(s => (
              <button
                key={s.key}
                onClick={() => setStyle(s.key)}
                className={`p-3 rounded-lg text-sm font-medium text-left transition border ${
                  style === s.key
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border hover:border-primary/30 text-muted-foreground'
                }`}
              >
                <span className="text-lg mr-1">{s.emoji}</span> {s.label}
              </button>
            ))}
          </div>

          {/* Preview */}
          <div className="bg-muted/50 rounded-lg p-4">
            <pre className="whitespace-pre-wrap text-sm text-foreground font-sans leading-relaxed">
              {message}
            </pre>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={shareToWhatsApp}
              className="flex flex-col items-center gap-1.5 p-3 bg-green-600 hover:bg-green-700 text-white rounded-xl transition"
            >
              <MessageCircle size={22} />
              <span className="text-xs font-medium">WhatsApp</span>
            </button>
            <button
              onClick={copyLink}
              className="flex flex-col items-center gap-1.5 p-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition"
            >
              {copied ? <CheckIcon size={22} /> : <CopyIcon size={22} />}
              <span className="text-xs font-medium">Copy Link</span>
            </button>
            <button
              onClick={nativeShare}
              className="flex flex-col items-center gap-1.5 p-3 bg-muted text-foreground rounded-xl hover:bg-muted/80 transition border border-border"
            >
              <ShareIcon size={22} />
              <span className="text-xs font-medium">Share</span>
            </button>
          </div>

          {/* Product Link */}
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <input
              type="text"
              readOnly
              value={productLink}
              className="flex-1 text-xs bg-transparent text-muted-foreground truncate outline-none"
            />
            <a href={productLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
              <ExternalLinkIcon size={16} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
