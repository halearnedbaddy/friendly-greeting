import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useCurrency } from '@/hooks/useCurrency';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, Package, CheckCircle, Star, Share2, Heart, ChevronRight, ShoppingCart, Plus, Minus
} from 'lucide-react';
import { ReviewWidget } from '@/components/reviews/ReviewWidget';
import { ProductQA } from '@/components/reviews/ProductQA';
import { StorefrontChatWidget } from '@/components/chat/StorefrontChatWidget';
import { CartDrawer, BuyerDetails } from '@/components/store/CartDrawer';
import { CartItem } from '@/hooks/useCart';
import { ProductSkeleton } from '@/components/skeletons';
import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabaseProject';
interface ProductData {
  id: string;
  name: string;
  description?: string;
  price?: number;
  images?: string[];
  currency?: string;
  status: string;
  is_available?: boolean;
  availability_note?: string;
  stock?: number;
  store?: {
    id: string;
    name: string;
    slug: string;
  };
  seller?: {
    name: string;
  };
  sellerProfile?: {
    rating?: number;
    total_reviews?: number;
    is_verified?: boolean;
  };
}

export function ProductDetailPage() {
  const { storeSlug, productId } = useParams();
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const { cart, addToCart } = useCart();
  const { toast } = useToast();
  const [product, setProduct] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [cartOpen, setCartOpen] = useState(false);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!storeSlug || !productId) return;
      setLoading(true);
      
      try {
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/storefront-api/product/${encodeURIComponent(storeSlug)}/${productId}`,
          {
            headers: {
              'Content-Type': 'application/json',
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            }
          }
        );
        
        const res = await response.json();
        
        if (!mounted) return;
        if (res.success && res.data) {
          setProduct(res.data as ProductData);
          setError(null);
        } else {
          setError(res.error || 'Product not found');
        }
      } catch (err) {
        if (mounted) setError('Failed to connect to server');
      }
      setLoading(false);
    }
    load();
    return () => { mounted = false; };
  }, [storeSlug, productId]);

  const handleAddToCart = () => {
    if (!product || !product.price) return;
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.images?.[0],
      quantity,
      sellerId: product.store?.id || '',
      sellerName: product.seller?.name || 'Seller',
    });
    toast({
      title: "Added to Cart ✓",
      description: `${quantity}× ${product.name} added to your cart`,
    });
  };

  const handleBuyNow = () => {
    if (!product || !product.price) return;
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.images?.[0],
      quantity,
      sellerId: product.store?.id || '',
      sellerName: product.seller?.name || 'Seller',
    });
    setCartOpen(true);
  };

  const handlePlaceOrder = async (items: CartItem[], buyerDetails: BuyerDetails) => {
    if (!storeSlug) throw new Error('Store not found');
    for (const item of items) {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/storefront-api/checkout/${encodeURIComponent(storeSlug)}/${encodeURIComponent(item.id)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            buyerName: buyerDetails.name,
            buyerPhone: buyerDetails.phone,
            buyerEmail: buyerDetails.email || undefined,
            deliveryAddress: buyerDetails.address || undefined,
            orderNotes: buyerDetails.notes || undefined,
            paymentMethod: 'PENDING_CONFIRMATION',
            quantity: item.quantity,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || `Failed to place order for ${item.name}`);
      }
    }
    // Send SMS notifications (best-effort)
    try {
      for (const item of items) {
        await supabase.functions.invoke('sms-notifications', {
          body: {
            action: 'order_placed',
            transactionId: item.id,
            buyerPhone: buyerDetails.phone,
            buyerName: buyerDetails.name,
            itemName: item.name,
            amount: item.price * item.quantity,
            currency: 'KES',
          },
        });
      }
    } catch (e) {
      console.warn('SMS notification failed (non-blocking):', e);
    }
    toast({
      title: "Order Placed! 🎉",
      description: "Your order has been sent to the seller for confirmation. You'll be notified when it's accepted.",
    });
  };

  const maxQuantity = product?.stock ?? 99;

  if (loading) return <ProductSkeleton />;

  if (error || !product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-xl p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-destructive" />
          </div>
          <p className="font-bold text-foreground mb-2">Product Unavailable</p>
          <p className="text-sm text-muted-foreground mb-6">{error || 'The product could not be found.'}</p>
          <Link
            to={storeSlug ? `/store/${storeSlug}` : '/'}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium"
          >
            <ArrowLeft size={18} />
            Back to Store
          </Link>
        </div>
      </div>
    );
  }

  const isUnavailable = product.is_available === false || (product.stock !== undefined && product.stock <= 0);
  const sellerRating = product.sellerProfile?.rating || 0;
  const isVerified = product.sellerProfile?.is_verified || false;
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <button 
            onClick={() => navigate(-1)} 
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft size={20} />
            <span className="hidden sm:inline">Back</span>
          </button>
          {product.store && (
            <Link 
              to={`/store/${product.store.slug}`}
              className="text-sm text-primary hover:underline"
            >
              View Store
            </Link>
          )}
          <button
            onClick={() => setCartOpen(true)}
            className="relative flex items-center gap-1 text-muted-foreground hover:text-foreground transition"
          >
            <ShoppingCart size={22} />
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Product Images */}
          <div className="space-y-4">
            <div className="aspect-square bg-card border border-border rounded-xl overflow-hidden relative">
              {product.images && product.images.length > 0 ? (
                <img src={product.images[activeImage]} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <Package size={64} className="text-muted-foreground/40" />
                </div>
              )}
              
              {isUnavailable && (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                  <span className="px-4 py-2 bg-muted text-muted-foreground rounded-full font-medium">Out of Stock</span>
                </div>
              )}

              <div className="absolute top-4 right-4 flex flex-col gap-2">
                <button 
                  onClick={() => {
                    setLiked(prev => !prev);
                    toast({ title: liked ? "Removed from wishlist" : "Added to wishlist ❤️" });
                  }}
                  className="p-2 bg-background/90 rounded-full hover:bg-background transition shadow-sm"
                >
                  <Heart size={20} className={liked ? "fill-red-500 text-red-500" : "text-muted-foreground"} />
                </button>
                <button 
                  onClick={async () => {
                    const url = window.location.href;
                    if (navigator.share) {
                      try {
                        await navigator.share({ title: product?.name, text: product?.description || '', url });
                      } catch { /* user cancelled */ }
                    } else {
                      await navigator.clipboard.writeText(url);
                      toast({ title: "Link copied!", description: "Share it with friends" });
                    }
                  }}
                  className="p-2 bg-background/90 rounded-full hover:bg-background transition shadow-sm"
                >
                  <Share2 size={20} className="text-muted-foreground" />
                </button>
              </div>
            </div>

            {product.images && product.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {product.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImage(idx)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition ${
                      activeImage === idx ? 'border-primary' : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Seller Info */}
            {product.seller && (
              <div className="flex items-center gap-3 text-sm">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                  {product.seller.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{product.seller.name}</p>
                    {isVerified && <CheckCircle size={14} className="text-primary" />}
                  </div>
                  {sellerRating > 0 && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Star size={12} className="fill-primary text-primary" />
                      <span>{sellerRating.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Product Name & Price */}
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-3">{product.name}</h1>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-primary">
                  {typeof product.price === 'number' 
                    ? formatPrice(product.price, product.currency || 'KES')
                    : 'Price on request'}
                </span>
              </div>
            </div>

            {/* Description */}
            {product.description && (
              <div>
                <h3 className="font-medium text-foreground mb-2">Description</h3>
                <p className="text-muted-foreground whitespace-pre-line">{product.description}</p>
              </div>
            )}

            {/* Stock Info */}
            {product.stock !== undefined && (
              <div className="flex items-center gap-2 text-sm">
                <Package size={16} className={product.stock > 0 ? 'text-primary' : 'text-destructive'} />
                {product.stock > 10 ? (
                  <span className="text-primary font-medium">In Stock</span>
                ) : product.stock > 0 ? (
                  <span className="text-amber-600 font-medium">Only {product.stock} left in stock</span>
                ) : (
                  <span className="text-destructive font-medium">Out of Stock</span>
                )}
              </div>
            )}

            {/* Availability Note */}
            {isUnavailable && product.availability_note && (
              <div className="bg-muted border border-border rounded-lg p-4">
                <p className="text-muted-foreground text-sm">{product.availability_note}</p>
              </div>
            )}

            {/* Security Features */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle size={16} className="text-primary" />
                <span>PayLoom Protection - Order confirmed by seller before payment</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle size={16} className="text-primary" />
                <span>Money-back guarantee if item not received</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle size={16} className="text-primary" />
                <span>Secure M-Pesa & Bank Transfer payments</span>
              </div>
            </div>

            {/* Quantity Selector & Buttons */}
            {!isUnavailable && product.price ? (
              <div className="space-y-3">
                {/* Quantity */}
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground">Quantity:</span>
                  <div className="flex items-center border border-border rounded-lg overflow-hidden">
                    <button
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      className="px-3 py-2 hover:bg-muted transition"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="px-4 py-2 font-medium text-foreground border-x border-border min-w-[48px] text-center">
                      {quantity}
                    </span>
                    <button
                      onClick={() => setQuantity(q => Math.min(maxQuantity, q + 1))}
                      className="px-3 py-2 hover:bg-muted transition"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  {product.stock !== undefined && product.stock <= 10 && product.stock > 0 && (
                    <span className="text-xs text-muted-foreground">Max: {product.stock}</span>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleAddToCart}
                    className="flex-1 py-4 border-2 border-primary text-primary rounded-lg font-bold text-lg hover:bg-primary/5 transition flex items-center justify-center gap-2"
                  >
                    <ShoppingCart size={20} />
                    Add to Cart
                  </button>
                  <button
                    onClick={handleBuyNow}
                    className="flex-1 py-4 bg-primary text-primary-foreground rounded-lg font-bold text-lg hover:bg-primary/90 transition flex items-center justify-center gap-2"
                  >
                    Buy Now
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-muted border border-border rounded-lg p-4 text-center">
                <p className="text-muted-foreground">
                  {isUnavailable ? 'This product is currently unavailable' : 'Price not available. Please contact the seller.'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Reviews */}
        {storeSlug && product && (
          <ReviewWidget storeSlug={storeSlug} productId={product.id} />
        )}

        {/* Product Q&A */}
        {storeSlug && product && (
          <ProductQA storeSlug={storeSlug} productId={product.id} />
        )}
      </main>

      {storeSlug && (
        <StorefrontChatWidget storeSlug={storeSlug} storeName={product?.store?.name} />
      )}

      {/* Floating Cart Button */}
      {cart.length > 0 && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-primary text-primary-foreground p-4 rounded-full shadow-lg hover:bg-primary/90 transition flex items-center gap-2"
        >
          <ShoppingCart size={24} />
          <span className="bg-primary-foreground text-primary text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
            {cartCount}
          </span>
        </button>
      )}

      {/* Cart Drawer */}
      {storeSlug && (
        <CartDrawer
          isOpen={cartOpen}
          onClose={() => setCartOpen(false)}
          storeSlug={storeSlug}
          onPlaceOrder={handlePlaceOrder}
        />
      )}
    </div>
  );
}

export default ProductDetailPage;
