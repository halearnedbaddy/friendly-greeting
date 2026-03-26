import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useCurrency } from '@/hooks/useCurrency';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/hooks/use-toast';
import {
  Search, ShoppingCart, Star, ChevronDown, Package, Shield, Clock, Heart, Share2,
  CheckCircle, AlertCircle, Store as StoreIcon, ArrowLeft, Filter, X, Grid3X3,
  List, Tag, Zap, TrendingUp, SlidersHorizontal, ChevronRight, MessageCircle, BadgePercent
} from 'lucide-react';
import { StorefrontChatWidget } from '@/components/chat/StorefrontChatWidget';
import { CartDrawer, BuyerDetails } from '@/components/store/CartDrawer';
import { CartItem } from '@/hooks/useCart';

const getApiBase = () => {
  if (typeof window !== 'undefined') {
    try {
      const url = new URL(window.location.href);
      const hostname = url.hostname;
      const protocol = url.protocol;
      if (hostname.includes('replit.dev')) {
        return `${protocol}//${hostname.replace('-5000-', '-8000-')}`;
      }
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:8000';
      }
    } catch {}
  }
  return '';
};

interface StorefrontProduct {
  id: string;
  name: string;
  description?: string;
  price?: number;
  sellingPrice?: number;
  compareAtPrice?: number;
  images?: string[];
  currency?: string;
  isAvailable?: boolean;
  availabilityNote?: string;
  status?: string;
  category?: string;
  stockQuantity?: number;
  sku?: string;
  isFeatured?: boolean;
}

interface SellerProfile {
  rating?: number;
  total_reviews?: number;
  is_verified?: boolean;
  total_sales?: number;
}

interface StorefrontData {
  id: string;
  name: string;
  slug: string;
  status: string;
  bio?: string;
  logo?: string;
  products: StorefrontProduct[];
  seller?: { name: string; email?: string; phone?: string };
  sellerProfile?: SellerProfile;
}

type SortOption = 'newest' | 'price-low' | 'price-high' | 'popular' | 'featured';
type ViewMode = 'grid' | 'list';

const PRICE_RANGES = [
  { label: 'All Prices', min: undefined, max: undefined },
  { label: 'Under KES 100', min: undefined, max: 100 },
  { label: 'KES 100 – 500', min: 100, max: 500 },
  { label: 'KES 500 – 1,000', min: 500, max: 1000 },
  { label: 'KES 1,000 – 5,000', min: 1000, max: 5000 },
  { label: 'Above KES 5,000', min: 5000, max: undefined },
];

function getProductPrice(p: StorefrontProduct): number {
  return Number(p.sellingPrice ?? p.price ?? 0);
}

function getComparePrice(p: StorefrontProduct): number | null {
  const cp = Number(p.compareAtPrice ?? 0);
  return cp > 0 ? cp : null;
}

function getDiscount(p: StorefrontProduct): number {
  const sell = getProductPrice(p);
  const compare = getComparePrice(p);
  if (!compare || compare <= sell) return 0;
  return Math.round(((compare - sell) / compare) * 100);
}

function isInStock(p: StorefrontProduct): boolean {
  if (p.isAvailable === false) return false;
  if (p.stockQuantity !== undefined) return p.stockQuantity > 0;
  return true;
}

export function StoreFrontPage() {
  const { storeSlug } = useParams();
  useNavigate();
  const { formatPrice } = useCurrency();
  const { cart, addToCart } = useCart();
  const { toast } = useToast();

  const [store, setStore] = useState<StorefrontData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [priceRangeIdx, setPriceRangeIdx] = useState(0);
  const [customMin, setCustomMin] = useState('');
  const [customMax, setCustomMax] = useState('');
  const [showInStockOnly, setShowInStockOnly] = useState(false);
  const [showOnSaleOnly, setShowOnSaleOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());

  const cartCount = Object.values(cart).reduce((sum: number, item: CartItem) => sum + item.quantity, 0);

  useEffect(() => {
    if (!storeSlug) return;
    let mounted = true;
    setLoading(true);

    const base = getApiBase();
    fetch(`${base}/api/v1/storefront/${encodeURIComponent(storeSlug)}`)
      .then((r) => r.json())
      .then((res) => {
        if (!mounted) return;
        if (res.success && res.data) {
          setStore(res.data as StorefrontData);
          setError(null);
        } else {
          setError(res.error || 'Failed to load store');
        }
      })
      .catch(() => { if (mounted) setError('Failed to connect to server'); })
      .finally(() => { if (mounted) setLoading(false); });

    return () => { mounted = false; };
  }, [storeSlug]);

  const handlePlaceOrder = async (items: CartItem[], buyerDetails: BuyerDetails) => {
    if (!storeSlug) throw new Error('Store not found');
    const base = getApiBase();
    for (const item of items) {
      const response = await fetch(
        `${base}/api/v1/storefront/${encodeURIComponent(storeSlug)}/products/${encodeURIComponent(item.id)}/checkout`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            buyerName: buyerDetails.name,
            buyerPhone: buyerDetails.phone,
            buyerEmail: buyerDetails.email || undefined,
            deliveryAddress: buyerDetails.address || undefined,
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
    toast({
      title: 'Order Placed!',
      description: "Your order has been sent to the seller for confirmation. You'll be notified when it's accepted.",
    });
  };

  const handleQuickAddToCart = useCallback((e: React.MouseEvent, product: StorefrontProduct) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isInStock(product)) return;
    const price = getProductPrice(product);
    if (!price) return;
    addToCart({
      id: product.id,
      name: product.name,
      price,
      image: product.images?.[0],
      quantity: 1,
      sellerId: store?.id || '',
      sellerName: store?.seller?.name || store?.name || 'Seller',
    });
    toast({ title: 'Added to Cart', description: product.name });
  }, [store, addToCart, toast]);

  const toggleWishlist = useCallback((e: React.MouseEvent, productId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setWishlist((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) { next.delete(productId); } else { next.add(productId); }
      return next;
    });
    toast({ title: wishlist.has(productId) ? 'Removed from wishlist' : 'Added to wishlist ❤️' });
  }, [wishlist, toast]);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: store?.name, url }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Store link copied!' });
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setPriceRangeIdx(0);
    setCustomMin('');
    setCustomMax('');
    setShowInStockOnly(false);
    setShowOnSaleOnly(false);
  };

  const products = store?.products ?? [];
  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))] as string[];

  const activePriceRange = PRICE_RANGES[priceRangeIdx];
  const effectiveMin = customMin ? parseFloat(customMin) : activePriceRange.min;
  const effectiveMax = customMax ? parseFloat(customMax) : activePriceRange.max;

  const hasActiveFilters = !!(
    searchQuery || selectedCategory || priceRangeIdx !== 0 || customMin || customMax || showInStockOnly || showOnSaleOnly
  );

  const filteredProducts = products.filter((p) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!p.name?.toLowerCase().includes(q) && !p.description?.toLowerCase().includes(q) && !p.category?.toLowerCase().includes(q) && !p.sku?.toLowerCase().includes(q)) return false;
    }
    if (selectedCategory && p.category !== selectedCategory) return false;
    const price = getProductPrice(p);
    if (effectiveMin !== undefined && price < effectiveMin) return false;
    if (effectiveMax !== undefined && price > effectiveMax) return false;
    if (showInStockOnly && !isInStock(p)) return false;
    if (showOnSaleOnly && getDiscount(p) === 0) return false;
    return true;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case 'price-low': return getProductPrice(a) - getProductPrice(b);
      case 'price-high': return getProductPrice(b) - getProductPrice(a);
      case 'featured': return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0);
      case 'popular': return 0;
      default: return 0;
    }
  });

  const featuredProducts = products.filter((p) => p.isFeatured && isInStock(p)).slice(0, 4);

  const sellerRating = store?.sellerProfile?.rating ?? 0;
  const totalReviews = store?.sellerProfile?.total_reviews ?? 0;
  const isVerified = store?.sellerProfile?.is_verified ?? false;
  const totalSales = store?.sellerProfile?.total_sales ?? 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-gradient-to-r from-primary to-primary/70 h-48 animate-pulse" />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden bg-card border border-border animate-pulse">
                <div className="aspect-square bg-muted" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                  <div className="h-8 bg-muted rounded mt-3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !store) {
    const isInactive = error?.toLowerCase().includes('inactive') || error?.toLowerCase().includes('activate');
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-2xl p-10 text-center max-w-md shadow-xl">
          <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="w-10 h-10 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {isInactive ? 'Store Not Active' : 'Store Unavailable'}
          </h1>
          <p className="text-muted-foreground mb-6">
            {error || 'This store could not be found or is currently unavailable.'}
          </p>
          {isInactive && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-left text-sm text-primary mb-6">
              <p className="font-semibold mb-2">If you're the store owner:</p>
              <ul className="list-disc list-inside space-y-1 text-primary/80">
                <li>Go to your Seller Dashboard</li>
                <li>Navigate to Store Settings</li>
                <li>Activate your store</li>
              </ul>
            </div>
          )}
          <Link to="/" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition font-medium">
            <ArrowLeft size={18} />
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── HERO HEADER ── */}
      <header className="relative bg-gradient-to-br from-primary via-primary/90 to-primary/70 text-primary-foreground overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDYwIEwgNjAgMCIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMykiIHN0cm9rZS13aWR0aD0iMSIgZmlsbD0ibm9uZSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')]" />

        <div className="relative max-w-7xl mx-auto px-4 py-6">
          {/* Top nav */}
          <div className="flex items-center justify-between mb-6">
            <Link to="/" className="inline-flex items-center gap-2 text-primary-foreground/80 hover:text-primary-foreground transition text-sm font-medium">
              <ArrowLeft size={18} />
              Back to Home
            </Link>
            <div className="flex items-center gap-3">
              <button onClick={handleShare} className="p-2.5 bg-primary-foreground/10 hover:bg-primary-foreground/20 rounded-full transition" title="Share store">
                <Share2 size={18} />
              </button>
              <button onClick={() => setCartOpen(true)} className="relative p-2.5 bg-primary-foreground/10 hover:bg-primary-foreground/20 rounded-full transition" title="Cart">
                <ShoppingCart size={18} />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Store identity */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {store.logo ? (
              <img src={store.logo} alt={store.name} className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover ring-4 ring-primary-foreground/30 shadow-xl flex-shrink-0" />
            ) : (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-primary-foreground/20 flex items-center justify-center ring-4 ring-primary-foreground/20 flex-shrink-0">
                <StoreIcon size={36} className="text-primary-foreground/70" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{store.name}</h1>
                {isVerified && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-primary-foreground/20 rounded-full text-xs font-semibold">
                    <CheckCircle size={12} />
                    Verified
                  </span>
                )}
              </div>
              {store.bio && <p className="text-primary-foreground/80 text-sm mb-3 max-w-xl line-clamp-2">{store.bio}</p>}
              <div className="flex flex-wrap items-center gap-4 text-sm text-primary-foreground/80">
                {sellerRating > 0 && (
                  <div className="flex items-center gap-1">
                    <Star size={14} className="fill-yellow-300 text-yellow-300" />
                    <span className="font-semibold text-primary-foreground">{sellerRating.toFixed(1)}</span>
                    <span>({totalReviews})</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Package size={14} />
                  <span>{products.length} Products</span>
                </div>
                {totalSales > 0 && (
                  <div className="flex items-center gap-1">
                    <TrendingUp size={14} />
                    <span>{totalSales} Sales</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── TRUST BAR ── */}
      <div className="bg-primary/5 border-b border-primary/10">
        <div className="max-w-7xl mx-auto px-4 py-2.5">
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-medium text-primary">
            <span className="flex items-center gap-1.5"><Shield size={13} /> Secure Escrow Payments</span>
            <span className="flex items-center gap-1.5"><Clock size={13} /> Money-back Guarantee</span>
            <span className="flex items-center gap-1.5"><CheckCircle size={13} /> M-Pesa Accepted</span>
          </div>
        </div>
      </div>

      {/* ── STICKY SEARCH & TOOLBAR ── */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex gap-3 items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={17} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${store.name}...`}
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition">
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Sort */}
            <div className="relative hidden sm:block">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="appearance-none pl-3 pr-8 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition cursor-pointer"
              >
                <option value="newest">Newest</option>
                <option value="featured">Featured</option>
                <option value="price-low">Price ↑</option>
                <option value="price-high">Price ↓</option>
                <option value="popular">Popular</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={14} />
            </div>

            {/* View toggle */}
            <div className="hidden sm:flex border border-input rounded-xl overflow-hidden">
              <button onClick={() => setViewMode('grid')} className={`p-2.5 transition ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`} title="Grid view">
                <Grid3X3 size={16} />
              </button>
              <button onClick={() => setViewMode('list')} className={`p-2.5 transition ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`} title="List view">
                <List size={16} />
              </button>
            </div>

            {/* Filter button (mobile) */}
            <button
              onClick={() => setFilterDrawerOpen(true)}
              className={`lg:hidden flex items-center gap-2 px-3 py-2.5 rounded-xl border transition text-sm font-medium ${hasActiveFilters ? 'border-primary bg-primary/10 text-primary' : 'border-input hover:bg-muted'}`}
            >
              <SlidersHorizontal size={16} />
              <span>Filter</span>
              {hasActiveFilters && <span className="w-2 h-2 bg-primary rounded-full" />}
            </button>

            {/* Cart (mobile shortcut) */}
            <button onClick={() => setCartOpen(true)} className="relative sm:hidden p-2.5 rounded-xl border border-input hover:bg-muted transition">
              <ShoppingCart size={17} />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
          </div>

          {/* Active filter chips */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 mt-2.5">
              {searchQuery && (
                <Chip onRemove={() => setSearchQuery('')}>Search: "{searchQuery}"</Chip>
              )}
              {selectedCategory && (
                <Chip onRemove={() => setSelectedCategory('')}>{selectedCategory}</Chip>
              )}
              {(priceRangeIdx !== 0 || customMin || customMax) && (
                <Chip onRemove={() => { setPriceRangeIdx(0); setCustomMin(''); setCustomMax(''); }}>
                  {customMin || customMax
                    ? `KES ${customMin || '0'} – ${customMax || '∞'}`
                    : PRICE_RANGES[priceRangeIdx].label}
                </Chip>
              )}
              {showInStockOnly && <Chip onRemove={() => setShowInStockOnly(false)}>In Stock</Chip>}
              {showOnSaleOnly && <Chip onRemove={() => setShowOnSaleOnly(false)}>On Sale</Chip>}
              <button onClick={clearFilters} className="text-xs text-primary hover:text-primary/80 font-semibold px-2 py-1 transition">
                Clear all
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── MAIN LAYOUT ── */}
      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">
        {/* ── DESKTOP SIDEBAR ── */}
        <aside className="hidden lg:block w-60 flex-shrink-0 space-y-4">
          <FilterSidebar
            categories={categories}
            products={products}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            priceRangeIdx={priceRangeIdx}
            setPriceRangeIdx={setPriceRangeIdx}
            customMin={customMin}
            setCustomMin={setCustomMin}
            customMax={customMax}
            setCustomMax={setCustomMax}
            showInStockOnly={showInStockOnly}
            setShowInStockOnly={setShowInStockOnly}
            showOnSaleOnly={showOnSaleOnly}
            setShowOnSaleOnly={setShowOnSaleOnly}
            hasActiveFilters={hasActiveFilters}
            clearFilters={clearFilters}
          />
        </aside>

        {/* ── PRODUCTS AREA ── */}
        <main className="flex-1 min-w-0">
          {/* Featured strip (only when no filters active) */}
          {!hasActiveFilters && featuredProducts.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Zap size={18} className="text-amber-500" />
                <h2 className="font-bold text-foreground text-base">Featured Products</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {featuredProducts.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    viewMode="grid"
                    storeSlug={store.slug}
                    onAddToCart={(e) => handleQuickAddToCart(e, p)}
                    isWishlisted={wishlist.has(p.id)}
                    onToggleWishlist={(e) => toggleWishlist(e, p.id)}
                    formatPrice={formatPrice}
                    featured
                  />
                ))}
              </div>
            </section>
          )}

          {/* Results header */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{sortedProducts.length}</span>
              {products.length !== sortedProducts.length && (
                <> of <span className="font-semibold text-foreground">{products.length}</span></>
              )} products
            </p>
            {/* Mobile sort */}
            <div className="sm:hidden relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="appearance-none pl-2 pr-6 py-1.5 rounded-lg border border-input bg-background text-xs focus:outline-none"
              >
                <option value="newest">Newest</option>
                <option value="featured">Featured</option>
                <option value="price-low">Price ↑</option>
                <option value="price-high">Price ↓</option>
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={12} />
            </div>
          </div>

          {sortedProducts.length === 0 ? (
            <EmptyState hasFilters={hasActiveFilters} searchQuery={searchQuery} onClearFilters={clearFilters} />
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {sortedProducts.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  viewMode="grid"
                  storeSlug={store.slug}
                  onAddToCart={(e) => handleQuickAddToCart(e, p)}
                  isWishlisted={wishlist.has(p.id)}
                  onToggleWishlist={(e) => toggleWishlist(e, p.id)}
                  formatPrice={formatPrice}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {sortedProducts.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  viewMode="list"
                  storeSlug={store.slug}
                  onAddToCart={(e) => handleQuickAddToCart(e, p)}
                  isWishlisted={wishlist.has(p.id)}
                  onToggleWishlist={(e) => toggleWishlist(e, p.id)}
                  formatPrice={formatPrice}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* ── SELLER INFO ── */}
      {store.seller && (
        <section className="bg-muted/40 border-t border-border mt-8">
          <div className="max-w-7xl mx-auto px-4 py-10">
            <h2 className="text-lg font-bold text-foreground mb-5">About the Seller</h2>
            <div className="bg-card border border-border rounded-2xl p-6 flex items-start gap-4 max-w-xl">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xl flex-shrink-0">
                {store.seller.name?.charAt(0).toUpperCase() || 'S'}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-foreground">{store.seller.name}</h3>
                  {isVerified && <CheckCircle size={15} className="text-primary" />}
                </div>
                {sellerRating > 0 && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
                    <Star size={13} className="fill-primary text-primary" />
                    <span>{sellerRating.toFixed(1)} rating</span>
                    <span>•</span>
                    <span>{totalReviews} reviews</span>
                    {totalSales > 0 && <><span>•</span><span>{totalSales} sales</span></>}
                  </div>
                )}
                {store.seller.phone && (
                  <a href={`https://wa.me/${store.seller.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                    <MessageCircle size={14} />
                    Chat on WhatsApp
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── FOOTER ── */}
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        Powered by <span className="font-semibold text-primary">PayLoom</span> • Secure Payments
      </footer>

      {/* ── MOBILE FILTER DRAWER ── */}
      {filterDrawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setFilterDrawerOpen(false)} />
          <div className="relative ml-auto w-80 max-w-full bg-background h-full overflow-y-auto shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="font-bold text-base">Filters</h2>
              <button onClick={() => setFilterDrawerOpen(false)} className="p-2 hover:bg-muted rounded-full transition">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
              <FilterSidebar
                categories={categories}
                products={products}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                priceRangeIdx={priceRangeIdx}
                setPriceRangeIdx={setPriceRangeIdx}
                customMin={customMin}
                setCustomMin={setCustomMin}
                customMax={customMax}
                setCustomMax={setCustomMax}
                showInStockOnly={showInStockOnly}
                setShowInStockOnly={setShowInStockOnly}
                showOnSaleOnly={showOnSaleOnly}
                setShowOnSaleOnly={setShowOnSaleOnly}
                hasActiveFilters={hasActiveFilters}
                clearFilters={clearFilters}
              />
            </div>
            <div className="p-4 border-t border-border">
              <button
                onClick={() => setFilterDrawerOpen(false)}
                className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition"
              >
                Show {sortedProducts.length} Results
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CART DRAWER ── */}
      <CartDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        onPlaceOrder={handlePlaceOrder}
        storeSlug={storeSlug || ''}
      />

      {/* ── CHAT WIDGET ── */}
      {store.id && (
        <StorefrontChatWidget storeSlug={storeSlug || ''} storeName={store.name} />
      )}
    </div>
  );
}

/* ──────────────────────────── SUB-COMPONENTS ──────────────────────────── */

function Chip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
      {children}
      <button onClick={onRemove} className="hover:text-primary/70 transition ml-0.5">
        <X size={12} />
      </button>
    </span>
  );
}

interface FilterSidebarProps {
  categories: string[];
  products: StorefrontProduct[];
  selectedCategory: string;
  setSelectedCategory: (c: string) => void;
  priceRangeIdx: number;
  setPriceRangeIdx: (i: number) => void;
  customMin: string;
  setCustomMin: (v: string) => void;
  customMax: string;
  setCustomMax: (v: string) => void;
  showInStockOnly: boolean;
  setShowInStockOnly: (v: boolean) => void;
  showOnSaleOnly: boolean;
  setShowOnSaleOnly: (v: boolean) => void;
  hasActiveFilters: boolean;
  clearFilters: () => void;
}

function FilterSidebar({
  categories, products, selectedCategory, setSelectedCategory,
  priceRangeIdx, setPriceRangeIdx, customMin, setCustomMin, customMax, setCustomMax,
  showInStockOnly, setShowInStockOnly, showOnSaleOnly, setShowOnSaleOnly,
  hasActiveFilters, clearFilters,
}: FilterSidebarProps) {
  return (
    <>
      {hasActiveFilters && (
        <button onClick={clearFilters} className="w-full text-sm text-primary font-medium hover:underline text-left mb-1">
          Clear all filters
        </button>
      )}

      {/* Categories */}
      {categories.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Tag size={14} className="text-primary" />
            <h3 className="font-semibold text-sm">Category</h3>
          </div>
          <div className="p-3 space-y-1">
            <CategoryRow
              label="All Products"
              count={products.length}
              selected={!selectedCategory}
              onClick={() => setSelectedCategory('')}
            />
            {categories.map((cat) => (
              <CategoryRow
                key={cat}
                label={cat}
                count={products.filter((p) => p.category === cat).length}
                selected={selectedCategory === cat}
                onClick={() => setSelectedCategory(cat)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Price Range */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <BadgePercent size={14} className="text-primary" />
          <h3 className="font-semibold text-sm">Price Range</h3>
        </div>
        <div className="p-3 space-y-1">
          {PRICE_RANGES.map((range, idx) => (
            <button
              key={idx}
              onClick={() => { setPriceRangeIdx(idx); setCustomMin(''); setCustomMax(''); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition flex items-center justify-between group ${
                priceRangeIdx === idx && !customMin && !customMax
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'hover:bg-muted text-foreground'
              }`}
            >
              {range.label}
              {priceRangeIdx === idx && !customMin && !customMax && <ChevronRight size={14} className="text-primary" />}
            </button>
          ))}
          <div className="pt-2 mt-1 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2 font-medium px-1">Custom range</p>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Min"
                value={customMin}
                onChange={(e) => setCustomMin(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-input rounded-lg focus:outline-none focus:ring-1 focus:ring-primary bg-background"
              />
              <input
                type="number"
                placeholder="Max"
                value={customMax}
                onChange={(e) => setCustomMax(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-input rounded-lg focus:outline-none focus:ring-1 focus:ring-primary bg-background"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Filters */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Filter size={14} className="text-primary" />
          <h3 className="font-semibold text-sm">Quick Filters</h3>
        </div>
        <div className="p-3 space-y-2">
          <ToggleRow label="In Stock Only" value={showInStockOnly} onChange={setShowInStockOnly} />
          <ToggleRow label="On Sale" value={showOnSaleOnly} onChange={setShowOnSaleOnly} />
        </div>
      </div>
    </>
  );
}

function CategoryRow({ label, count, selected, onClick }: { label: string; count: number; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition flex items-center justify-between ${
        selected ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-muted text-foreground'
      }`}
    >
      <span className="truncate">{label}</span>
      <span className={`text-xs ml-2 flex-shrink-0 ${selected ? 'text-primary' : 'text-muted-foreground'}`}>{count}</span>
    </button>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted cursor-pointer transition">
      <span className="text-sm">{label}</span>
      <div
        onClick={() => onChange(!value)}
        className={`relative w-9 h-5 rounded-full transition-colors ${value ? 'bg-primary' : 'bg-muted-foreground/30'}`}
      >
        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-4' : ''}`} />
      </div>
    </label>
  );
}

interface ProductCardProps {
  product: StorefrontProduct;
  viewMode: ViewMode;
  storeSlug: string;
  onAddToCart: (e: React.MouseEvent) => void;
  isWishlisted: boolean;
  onToggleWishlist: (e: React.MouseEvent) => void;
  formatPrice: (price: number, currency?: string) => string;
  featured?: boolean;
}

function ProductCard({ product, viewMode, storeSlug, onAddToCart, isWishlisted, onToggleWishlist, formatPrice, featured }: ProductCardProps) {
  const inStock = isInStock(product);
  const price = getProductPrice(product);
  const comparePrice = getComparePrice(product);
  const discount = getDiscount(product);
  const currency = product.currency || 'KES';

  if (viewMode === 'list') {
    return (
      <Link
        to={`/store/${storeSlug}/product/${product.id}`}
        className="group flex gap-4 bg-card border border-border rounded-2xl overflow-hidden hover:shadow-md hover:border-primary/30 transition-all"
      >
        <div className="w-28 sm:w-36 flex-shrink-0 bg-muted relative overflow-hidden">
          {product.images?.[0] ? (
            <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <div className="w-full h-full flex items-center justify-center"><Package size={28} className="text-muted-foreground/40" /></div>
          )}
          {discount > 0 && (
            <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">-{discount}%</span>
          )}
          {!inStock && (
            <div className="absolute inset-0 bg-background/75 flex items-center justify-center">
              <span className="text-xs font-semibold text-muted-foreground bg-background/90 px-2 py-1 rounded-full">Out of Stock</span>
            </div>
          )}
        </div>
        <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
          <div>
            {product.category && (
              <span className="text-xs text-primary font-medium mb-1 block">{product.category}</span>
            )}
            <h3 className="font-semibold text-foreground group-hover:text-primary transition line-clamp-1 mb-1">{product.name}</h3>
            {product.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">{product.description}</p>
            )}
          </div>
          <div className="flex items-center justify-between mt-3">
            <div>
              <span className="text-base font-bold text-primary">{formatPrice(price, currency)}</span>
              {comparePrice && (
                <span className="text-xs text-muted-foreground line-through ml-2">{formatPrice(comparePrice, currency)}</span>
              )}
            </div>
            <button
              onClick={onAddToCart}
              disabled={!inStock}
              className={`text-xs font-semibold px-4 py-2 rounded-xl transition ${
                inStock
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}
            >
              {inStock ? 'Add to Cart' : 'Out of Stock'}
            </button>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={`/store/${storeSlug}/product/${product.id}`}
      className="group bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all duration-200 flex flex-col"
    >
      {/* Image */}
      <div className="aspect-square relative bg-muted overflow-hidden">
        {product.images?.[0] ? (
          <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <Package size={36} className="text-muted-foreground/40" />
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {discount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow">-{discount}%</span>
          )}
          {featured && (
            <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow flex items-center gap-0.5">
              <Zap size={10} /> Featured
            </span>
          )}
        </div>

        {/* Out of stock overlay */}
        {!inStock && (
          <div className="absolute inset-0 bg-background/75 flex items-center justify-center">
            <span className="text-sm font-semibold text-muted-foreground bg-background/90 px-3 py-1.5 rounded-full border border-border">
              Out of Stock
            </span>
          </div>
        )}

        {/* Hover actions */}
        <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onToggleWishlist}
            className="p-2 bg-background/95 rounded-full shadow hover:scale-110 transition-transform"
            title={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            <Heart size={15} className={isWishlisted ? 'fill-red-500 text-red-500' : 'text-muted-foreground'} />
          </button>
          {inStock && price > 0 && (
            <button
              onClick={onAddToCart}
              className="p-2 bg-primary text-primary-foreground rounded-full shadow hover:scale-110 transition-transform"
              title="Quick add to cart"
            >
              <ShoppingCart size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col flex-1">
        {product.category && (
          <span className="text-xs text-primary font-medium mb-0.5 truncate">{product.category}</span>
        )}
        <h3 className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-primary transition leading-snug mb-2">
          {product.name}
        </h3>

        <div className="mt-auto">
          <div className="flex items-baseline gap-1.5 mb-2">
            <span className="text-base font-bold text-primary">{formatPrice(price, currency)}</span>
            {comparePrice && (
              <span className="text-xs text-muted-foreground line-through">{formatPrice(comparePrice, currency)}</span>
            )}
          </div>

          {inStock ? (
            <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              In Stock
            </div>
          ) : (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full" />
              Out of Stock
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

function EmptyState({ hasFilters, searchQuery, onClearFilters }: { hasFilters: boolean; searchQuery: string; onClearFilters: () => void }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-14 text-center">
      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
        <Search size={28} className="text-muted-foreground/50" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {hasFilters ? 'No products found' : 'No products yet'}
      </h3>
      <p className="text-sm text-muted-foreground mb-5">
        {searchQuery
          ? `No results for "${searchQuery}". Try a different search.`
          : hasFilters
            ? 'Try adjusting your filters to see more products.'
            : 'This store has no products yet. Check back soon!'}
      </p>
      {hasFilters && (
        <button
          onClick={onClearFilters}
          className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition"
        >
          Clear Filters
        </button>
      )}
    </div>
  );
}
