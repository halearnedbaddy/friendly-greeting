import { useState, useEffect, useRef, memo } from 'react';
import { PackageIcon, SearchIcon, EditIcon, ArchiveIcon, ExternalLinkIcon, ImageIcon, RefreshCwIcon, LoaderIcon, CheckIcon, XIcon, InstagramIcon, FacebookIcon, LinkedInIcon, PlusIcon, LinkIcon, ImagePlusIcon, TrashIcon, CopyIcon, CheckCircleIcon, UploadIcon, ShareIcon, BarChartIcon } from '@/components/icons';
import { Download, Copy, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/hooks/useCurrency';
import { useSubscription } from '@/hooks/useSubscription';
import { PlanBanner } from './PlanBanner';
import { NearLimitBanner } from './NearLimitBanner';
import { UpgradeModal } from './UpgradeModal';
import { PricingPlans } from './PricingPlans';
import { SubscriptionPaymentFlow } from './SubscriptionPaymentFlow';

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  images?: string[];
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | string;
  sourceUrl?: string;
  sourcePlatform?: string;
  createdAt?: string;
  updatedAt?: string;
  sku?: string;
  compare_at_price?: number;
  cost?: number;
  category_id?: number;
  quantity?: number;
  [key: string]: unknown;
}

interface StoreProductsProps {
  storeSlug?: string;
  bulkMode?: boolean;
}

interface GeneratedLink {
  id: string;
  linkUrl: string;
  productName: string;
  price: number;
  currency: string;
}

// Memoized Product Card to prevent re-renders
interface ProductCardProps {
  product: Product;
  paymentLink: string | null;
  isDeleting: boolean;
  isCopied: boolean;
  isSelected: boolean;
  bulkMode: boolean;
  publishing: string | null;
  duplicatingId: string | null;
  onEdit: (product: Product) => void;
  onPublish: (product: Product) => void;
  onArchive: (product: Product) => void;
  onDelete: (product: Product) => void;
  onDuplicate: (product: Product) => void;
  onToggleSelect: (id: string) => void;
  onCopyLink: (product: Product) => void;
  formatCurrency: (amount: number, currency?: string) => string;
  getPlatformIcon: (platform?: string) => React.ReactNode;
}

const ProductCard = memo(function ProductCard({
  product, paymentLink, isDeleting, isCopied, isSelected, bulkMode, publishing, duplicatingId,
  onEdit, onPublish, onArchive, onDelete, onDuplicate, onToggleSelect, onCopyLink, formatCurrency, getPlatformIcon,
}: ProductCardProps) {
  return (
    <div className={`bg-card border rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 group relative ${isSelected ? 'ring-2 ring-primary' : 'border-border'}`}>
      <div className="relative aspect-square bg-muted">
        {bulkMode && (
          <div className="absolute top-3 left-3 z-10">
            <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(product.id)} className="rounded bg-card w-5 h-5 cursor-pointer" onClick={e => e.stopPropagation()} />
          </div>
        )}
        {product.images?.[0] ? (
          <img src={product.images[0]} alt={product.name} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon size={48} className="text-muted-foreground/30" />
          </div>
        )}
        <div className={`absolute top-3 left-3 px-2 py-1 rounded-full text-xs font-medium ${
          product.status === 'PUBLISHED' ? 'bg-green-100 text-green-800' : product.status === 'DRAFT' ? 'bg-amber-100 text-amber-800' : 'bg-muted text-muted-foreground'
        }`}>{product.status}</div>
        {product.sourcePlatform && (
          <div className="absolute top-3 right-3 px-2 py-1 bg-card/90 rounded-full flex items-center gap-1">{getPlatformIcon(product.sourcePlatform)}</div>
        )}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button onClick={() => onEdit(product)} className="p-2 bg-card rounded-full hover:bg-muted transition" title="Edit"><EditIcon size={18} className="text-foreground" /></button>
          {product.status === 'DRAFT' && <button onClick={() => onPublish(product)} className="p-2 bg-green-500 rounded-full hover:bg-green-600 transition" title="Publish"><CheckIcon size={18} className="text-white" /></button>}
          {product.status === 'PUBLISHED' && <button onClick={() => onArchive(product)} className="p-2 bg-amber-500 rounded-full hover:bg-amber-600 transition" title="Archive"><ArchiveIcon size={18} className="text-white" /></button>}
          <button onClick={() => onDelete(product)} disabled={isDeleting} className="p-2 bg-destructive rounded-full hover:bg-destructive/90 transition disabled:opacity-50" title="Delete">
            {isDeleting ? <LoaderIcon size={18} className="text-white animate-spin" /> : <TrashIcon size={18} className="text-white" />}
          </button>
          <button onClick={() => onDuplicate(product)} disabled={duplicatingId === product.id} className="p-2 bg-card rounded-full hover:bg-muted transition" title="Duplicate">
            {duplicatingId === product.id ? <Loader2 size={18} className="animate-spin text-foreground" /> : <Copy size={18} className="text-foreground" />}
          </button>
          {product.sourceUrl && <a href={product.sourceUrl} target="_blank" rel="noopener noreferrer" className="p-2 bg-card rounded-full hover:bg-muted transition" title="View Source"><ExternalLinkIcon size={18} className="text-foreground" /></a>}
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-foreground mb-1 truncate">{product.name}</h3>
        {product.description && <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{product.description}</p>}
        <p className="text-lg font-bold text-primary mb-3">{formatCurrency(product.price)}</p>
        {paymentLink ? (
          <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
            <LinkIcon size={14} className="text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground truncate flex-1">{paymentLink}</span>
            <button onClick={() => onCopyLink(product)} className="p-1 hover:bg-muted rounded transition flex-shrink-0" title="Copy link">
              {isCopied ? <CheckCircleIcon size={14} className="text-green-500" /> : <CopyIcon size={14} className="text-muted-foreground" />}
            </button>
          </div>
        ) : product.status === 'DRAFT' ? (
          <button onClick={() => onPublish(product)} disabled={publishing === product.id} className="w-full text-sm px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition font-medium flex items-center justify-center gap-2 disabled:opacity-70">
            {publishing === product.id ? <LoaderIcon size={14} className="animate-spin" /> : <CheckIcon size={14} />}
            {publishing === product.id ? 'Publishing...' : 'Publish to Get Link'}
          </button>
        ) : null}
      </div>
    </div>
  );
});

export function StoreProducts({ storeSlug, bulkMode: bulkModeProp }: StoreProductsProps) {
  const { toast } = useToast();
  const { formatPrice, selectedCountry } = useCurrency();
  const { subscription, currentPlan, getProductUsage, isNearLimit, isAtLimit, upgradePlan, startTrial } = useSubscription();

  const [bulkMode, setBulkMode] = useState(!!bulkModeProp);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<any[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;
  const [drafts, setDrafts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<'all' | 'published' | 'drafts'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Reset page when filter/search changes
  useEffect(() => { setCurrentPage(1); }, [filter, searchQuery]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', price: '', imageUrl: '', sku: '', compareAtPrice: '', cost: '', categoryId: '', quantity: '' });
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);
  
  // Link Success Modal State
  const [generatedLink, setGeneratedLink] = useState<GeneratedLink | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  
  // Add Product Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', price: '', description: '', imageUrl: '', sku: '', compareAtPrice: '', cost: '', categoryId: '', quantity: '' });
  const [addingProduct, setAddingProduct] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Subscription UI State
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [showNearLimitBanner, setShowNearLimitBanner] = useState(true);
  const [paymentFlow, setPaymentFlow] = useState<{ open: boolean; planId: string; billing: 'monthly' | 'annual'; mode: 'payment' | 'trial' }>({
    open: false, planId: '', billing: 'monthly', mode: 'payment',
  });

  const totalProductCount = products.length + drafts.length;
  const usage = getProductUsage(totalProductCount);
  const nearLimit = isNearLimit(totalProductCount);
  const atLimit = isAtLimit(totalProductCount);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const [publishedRes, draftsRes] = await Promise.all([
        api.listPublishedProducts(),
        api.listDraftProducts(),
      ]);
      if (publishedRes.success && publishedRes.data) {
        setProducts(Array.isArray(publishedRes.data) ? publishedRes.data : []);
      }
      if (draftsRes.success && draftsRes.data) {
        setDrafts(Array.isArray(draftsRes.data) ? draftsRes.data : []);
      }
    } catch (error) {
      console.error('Failed to load products:', error);
      toast({ title: 'Failed to load products', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProducts(); }, []);
  useEffect(() => { setBulkMode(!!bulkModeProp); }, [bulkModeProp]);
  useEffect(() => {
    api.getProductCategories?.().then((r: any) => {
      if (r?.success && r.data) setCategories(Array.isArray(r.data) ? r.data : []);
    });
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProducts.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredProducts.map((p: Product) => p.id)));
  };
  const handleBulkUpdateStatus = async (status: string) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkActionLoading(true);
    const res = await api.bulkUpdateProducts?.(ids, { status: status.toLowerCase() });
    setBulkActionLoading(false);
    if (res?.success) {
      setSelectedIds(new Set());
      loadProducts();
      toast({ title: `Updated ${ids.length} products to ${status}` });
    } else toast({ title: 'Bulk update failed', variant: 'destructive' });
  };
  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0 || !confirm(`Delete ${ids.length} product(s)? This cannot be undone.`)) return;
    setBulkActionLoading(true);
    const res = await api.bulkDeleteProducts?.(ids);
    setBulkActionLoading(false);
    if (res?.success) {
      setSelectedIds(new Set());
      loadProducts();
      toast({ title: `Deleted ${ids.length} product(s)` });
    } else toast({ title: 'Bulk delete failed', variant: 'destructive' });
  };
  const handleDuplicate = async (product: Product) => {
    setDuplicatingId(product.id);
    try {
      const res = await api.duplicateProduct?.(product.id);
      if (res?.success && res.data) {
        const dup = res.data as Product;
        setDrafts(prev => [dup, ...prev]);
        toast({ title: 'Product duplicated!', description: `"${product.name}" (Copy) saved as draft` });
      } else toast({ title: 'Failed to duplicate', variant: 'destructive' });
    } catch { toast({ title: 'Failed to duplicate', variant: 'destructive' }); }
    finally { setDuplicatingId(null); }
  };
  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.exportProducts?.();
      if (res?.success && res.data) {
        const blob = new Blob([res.data], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
        toast({ title: 'Products exported!' });
      } else toast({ title: 'Export failed', variant: 'destructive' });
    } catch { toast({ title: 'Export failed', variant: 'destructive' }); }
    finally { setExporting(false); }
  };

  const handleAddClick = () => {
    if (atLimit) {
      setShowUpgradeModal(true);
    } else {
      setShowAddModal(true);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await api.triggerStoreRescan();
      if (res.success) {
        toast({ title: 'Sync started', description: 'Products will be updated from your social accounts' });
        setTimeout(loadProducts, 3000);
      } else {
        toast({ title: 'Sync failed', description: res.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Sync failed', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file type', description: 'Please select an image file', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Please select an image under 5MB', variant: 'destructive' });
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      if (isEdit) {
        setEditForm(prev => ({ ...prev, imageUrl: base64 }));
      } else {
        setAddForm(prev => ({ ...prev, imageUrl: base64 }));
      }
      toast({ title: 'Image added!', description: 'Your image has been uploaded' });
    };
    reader.readAsDataURL(file);
  };

  const handleAddProduct = async () => {
    if (!addForm.name.trim() || !addForm.price) {
      toast({ title: 'Please fill in product name and price', variant: 'destructive' });
      return;
    }
    setAddingProduct(true);
    try {
      const payload = {
        name: addForm.name.trim(),
        description: addForm.description.trim() || undefined,
        price: parseFloat(addForm.price) || 0,
        images: addForm.imageUrl.trim() ? [addForm.imageUrl.trim()] : [],
        sku: addForm.sku.trim() || undefined,
        compare_at_price: addForm.compareAtPrice ? parseFloat(addForm.compareAtPrice) : undefined,
        cost: addForm.cost ? parseFloat(addForm.cost) : undefined,
        category_id: addForm.categoryId ? parseInt(addForm.categoryId) : undefined,
        quantity: addForm.quantity ? parseInt(addForm.quantity) : 0,
      };
      const basicPayload = { name: payload.name, description: payload.description, price: payload.price, images: payload.images };
      let res = api.createProductFull ? await api.createProductFull(payload) : await api.createProduct(basicPayload);
      // Fallback to direct Supabase createProduct if store-api edge function fails (e.g. not deployed)
      if (!res.success && api.createProduct) {
        res = await api.createProduct(basicPayload);
      }
      if (res.success && res.data) {
        const newProduct = res.data as Product;
        setDrafts(prev => [newProduct, ...prev]);
        setShowAddModal(false);
        setAddForm({ name: '', price: '', description: '', imageUrl: '', sku: '', compareAtPrice: '', cost: '', categoryId: '', quantity: '' });
        toast({ title: 'Product added!', description: 'Your product is saved as a draft. Publish it to make it visible.' });
      } else {
        const errMsg = (res as any).error || 'Please create a store first, then try again.';
        toast({ title: 'Failed to add product', description: errMsg, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Failed to add product', description: (error as Error)?.message, variant: 'destructive' });
    } finally {
      setAddingProduct(false);
    }
  };

  const handlePublish = async (product: Product) => {
    setPublishing(product.id);
    try {
      const publishRes = await api.publishProduct(product.id);
      if (!publishRes.success) {
        toast({ title: 'Failed to publish', description: publishRes.error, variant: 'destructive' });
        return;
      }
      const linkRes = await api.createPaymentLink({
        productName: product.name,
        productDescription: product.description,
        price: product.price,
        images: product.images || [],
        currency: selectedCountry.currencyCode || 'KES',
      });
      if (linkRes.success && linkRes.data) {
        const data = linkRes.data as { id: string; linkUrl?: string; product_name?: string; productName?: string; price: number; currency: string };
        const linkUrl = data.linkUrl || `${window.location.origin}/buy/${data.id}`;
        setDrafts(prev => prev.filter(p => p.id !== product.id));
        setProducts(prev => [...prev, { ...product, status: 'PUBLISHED' }]);
        setGeneratedLink({
          id: data.id, linkUrl,
          productName: data.productName || data.product_name || product.name,
          price: data.price || product.price,
          currency: data.currency || 'KES',
        });
      } else {
        setDrafts(prev => prev.filter(p => p.id !== product.id));
        setProducts(prev => [...prev, { ...product, status: 'PUBLISHED' }]);
        toast({ title: 'Product published!', description: 'But payment link creation failed. You can create it from My Links.' });
      }
    } catch (error) {
      console.error('Publish error:', error);
      toast({ title: 'Failed to publish', variant: 'destructive' });
    } finally {
      setPublishing(null);
    }
  };

  const handleArchive = async (product: Product) => {
    const res = await api.archiveProduct(product.id);
    if (res.success) {
      setProducts(prev => prev.filter(p => p.id !== product.id));
      toast({ title: 'Product archived' });
    } else {
      toast({ title: 'Failed to archive', description: res.error, variant: 'destructive' });
    }
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`Are you sure you want to delete "${product.name}"? This action cannot be undone.`)) return;
    setDeletingId(product.id);
    try {
      const res = await api.deleteProduct(product.id);
      if (res.success) {
        setProducts(prev => prev.filter(p => p.id !== product.id));
        setDrafts(prev => prev.filter(p => p.id !== product.id));
        toast({ title: 'Product deleted' });
      } else {
        toast({ title: 'Failed to delete', description: res.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Failed to delete product', variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  const getPaymentLink = (product: Product) => {
    if (!storeSlug || product.status !== 'PUBLISHED') return null;
    return `${window.location.origin}/store/${storeSlug}/product/${product.id}`;
  };

  const copyPaymentLink = async (product: Product) => {
    const link = getPaymentLink(product);
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(product.id);
      toast({ title: 'Link copied!', description: 'Share this link with your customers' });
      setTimeout(() => setCopiedId(null), 2000);
    } catch { toast({ title: 'Failed to copy', variant: 'destructive' }); }
  };

  const startEdit = (product: Product) => {
    setEditingProduct(product);
    const imgs = product.images ?? (product as any).images ?? [];
    setEditForm({
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      imageUrl: (Array.isArray(imgs) ? imgs[0] : '') || '',
      sku: (product as any).sku || '',
      compareAtPrice: (product as any).compare_at_price != null ? String((product as any).compare_at_price) : '',
      cost: (product as any).cost != null ? String((product as any).cost) : '',
      categoryId: (product as any).category_id != null ? String((product as any).category_id) : '',
      quantity: (product as any).quantity != null ? String((product as any).quantity) : '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingProduct) return;
    setSaving(true);
    const updates: Record<string, unknown> = {
      name: editForm.name,
      description: editForm.description || undefined,
      price: parseFloat(editForm.price) || 0,
      images: editForm.imageUrl.trim() ? [editForm.imageUrl.trim()] : (editingProduct.images ?? []),
    };
    if (editForm.sku !== undefined) updates.sku = editForm.sku || null;
    if (editForm.compareAtPrice) updates.compare_at_price = parseFloat(editForm.compareAtPrice);
    if (editForm.cost) updates.cost = parseFloat(editForm.cost);
    if (editForm.categoryId) updates.category_id = parseInt(editForm.categoryId) || null;
    if (editForm.quantity !== undefined) updates.quantity = parseInt(editForm.quantity) || 0;
    const res = api.updateProductFull ? await api.updateProductFull(editingProduct.id, updates) : await api.updateProductDetails(editingProduct.id, { name: updates.name, description: updates.description, price: updates.price, images: updates.images } as any);
    if (res.success) {
      const updated = { ...editingProduct, name: editForm.name, description: editForm.description, price: parseFloat(editForm.price) || 0, images: editForm.imageUrl.trim() ? [editForm.imageUrl.trim()] : editingProduct.images, sku: editForm.sku || undefined, compare_at_price: editForm.compareAtPrice ? parseFloat(editForm.compareAtPrice) : undefined, cost: editForm.cost ? parseFloat(editForm.cost) : undefined, category_id: editForm.categoryId ? parseInt(editForm.categoryId) : undefined, quantity: editForm.quantity ? parseInt(editForm.quantity) : undefined };
      const updateFn = (prev: Product[]) => prev.map(p => p.id === editingProduct.id ? { ...p, ...updated } : p);
      setProducts(updateFn);
      setDrafts(updateFn);
      setEditingProduct(null);
      toast({ title: 'Product updated!' });
    } else {
      toast({ title: 'Failed to update', description: res.error, variant: 'destructive' });
    }
    setSaving(false);
  };

  const getPlatformIcon = (platform?: string) => {
    switch (platform?.toUpperCase()) {
      case 'INSTAGRAM': return <InstagramIcon size={14} className="text-pink-500" />;
      case 'FACEBOOK': return <FacebookIcon size={14} className="text-blue-600" />;
      case 'LINKEDIN': return <LinkedInIcon size={14} className="text-blue-700" />;
      default: return null;
    }
  };

  // Subscription handlers
  const handleSelectPlan = (planId: string, billing: 'monthly' | 'annual') => {
    setShowUpgradeModal(false);
    setShowPricing(false);
    setPaymentFlow({ open: true, planId, billing, mode: 'payment' });
  };

  const handleStartTrial = (planId: string) => {
    setShowUpgradeModal(false);
    setShowPricing(false);
    setPaymentFlow({ open: true, planId, billing: 'monthly', mode: 'trial' });
  };

  const handlePaymentComplete = async () => {
    if (paymentFlow.mode === 'trial') {
      await startTrial(paymentFlow.planId);
    } else {
      await upgradePlan(paymentFlow.planId, paymentFlow.billing);
    }
    toast({ title: '🎉 Plan upgraded!', description: 'You now have access to more features.' });
  };

  const allProducts = filter === 'all'
    ? [...products, ...drafts]
    : filter === 'published'
      ? products
      : drafts;

  const filteredProducts = allProducts.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (amount: number, currency?: string) => formatPrice(amount, currency || 'KES');

  // Show pricing page
  if (showPricing) {
    return (
      <PricingPlans
        currentPlanId={subscription.planId}
        onSelectPlan={handleSelectPlan}
        onStartTrial={handleStartTrial}
        onBack={() => setShowPricing(false)}
      />
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="bg-muted h-8 w-32 rounded animate-pulse" />
          <div className="bg-muted h-10 w-32 rounded animate-pulse" />
        </div>
        <div className="bg-muted h-24 rounded-xl animate-pulse" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="bg-muted h-64 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Plan Status Banner */}
      <PlanBanner
        currentPlan={currentPlan}
        productCount={totalProductCount}
        nextBillingDate={subscription.nextBillingDate}
        status={subscription.status}
        onUpgrade={() => setShowUpgradeModal(true)}
        onManage={() => setShowPricing(true)}
      />

      {/* Near Limit Warning */}
      {nearLimit && showNearLimitBanner && usage.limit !== null && (
        <NearLimitBanner
          currentPlan={currentPlan}
          remaining={(usage.limit || 0) - usage.used}
          onViewPlans={() => setShowPricing(true)}
          onDismiss={() => setShowNearLimitBanner(false)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-bold text-foreground">Products</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleAddClick}
            disabled={atLimit}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            title={atLimit ? 'Upgrade to add more products' : 'Add new product'}
          >
            <PlusIcon size={18} />
            Add Product
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-4 py-2 border border-input rounded-lg hover:bg-muted transition font-medium text-foreground"
          >
            <RefreshCwIcon size={18} className={syncing ? 'animate-spin' : ''} />
            Sync from Social
          </button>
          <button
            onClick={() => setShowPricing(true)}
            className="inline-flex items-center gap-2 px-4 py-2 border border-input rounded-lg hover:bg-muted transition font-medium text-foreground"
          >
            <BarChartIcon size={18} />
            Pricing Plans
          </button>
          <button onClick={handleExport} disabled={exporting || totalProductCount === 0} className="inline-flex items-center gap-2 px-4 py-2 border border-input rounded-lg hover:bg-muted transition font-medium text-foreground disabled:opacity-50">
            {exporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            Export CSV
          </button>
          <button onClick={() => { setBulkMode(!bulkMode); if (!bulkMode) setSelectedIds(new Set()); }} className="inline-flex items-center gap-2 px-4 py-2 border border-input rounded-lg hover:bg-muted transition font-medium text-foreground">
            {bulkMode ? 'Cancel' : 'Bulk Actions'}
          </button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {bulkMode && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
          <span className="font-medium">{selectedIds.size} selected</span>
          <button onClick={() => handleBulkUpdateStatus('published')} disabled={bulkActionLoading} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">Publish</button>
          <button onClick={() => handleBulkUpdateStatus('archived')} disabled={bulkActionLoading} className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50">Archive</button>
          <button onClick={handleBulkDelete} disabled={bulkActionLoading} className="px-3 py-1.5 text-sm bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:opacity-50">Delete</button>
          {bulkActionLoading && <Loader2 size={16} className="animate-spin" />}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2 items-center">
          {bulkMode && filteredProducts.length > 0 && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={selectedIds.size === filteredProducts.length} onChange={toggleSelectAll} className="rounded" />
              <span className="text-sm">Select all</span>
            </label>
          )}
          {(['all', 'published', 'drafts'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition capitalize ${
                filter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {f} {f === 'all' ? `(${products.length + drafts.length})` : f === 'published' ? `(${products.length})` : `(${drafts.length})`}
            </button>
          ))}
        </div>
        <div className="flex-1 relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Products Grid or Empty State */}
      {filteredProducts.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <PackageIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-xl font-bold text-foreground mb-2">No products yet</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Add products manually or sync from your connected social accounts.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={handleAddClick}
              disabled={atLimit}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium disabled:opacity-50"
            >
              <PlusIcon size={20} />
              Add Product Manually
            </button>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-input text-foreground rounded-lg hover:bg-muted transition font-medium"
            >
              <RefreshCwIcon size={20} className={syncing ? 'animate-spin' : ''} />
              Sync from Social
            </button>
          </div>
        </div>
      ) : (
        <>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(() => {
            const paginatedProducts = filteredProducts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
            return paginatedProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                paymentLink={getPaymentLink(product)}
                isDeleting={deletingId === product.id}
                isCopied={copiedId === product.id}
                isSelected={selectedIds.has(product.id)}
                bulkMode={bulkMode}
                publishing={publishing}
                duplicatingId={duplicatingId}
                onEdit={startEdit}
                onPublish={handlePublish}
                onArchive={handleArchive}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
                onToggleSelect={toggleSelect}
                onCopyLink={copyPaymentLink}
                formatCurrency={formatCurrency}
                getPlatformIcon={getPlatformIcon}
              />
            ));
          })()}
        </div>

        {/* Pagination */}
        {Math.ceil(filteredProducts.length / ITEMS_PER_PAGE) > 1 && (
          <div className="flex items-center justify-between pt-4">
            <p className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)} of {filteredProducts.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-input hover:bg-muted disabled:opacity-50 transition"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-medium px-2">Page {currentPage} of {Math.ceil(filteredProducts.length / ITEMS_PER_PAGE)}</span>
              <button
                onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredProducts.length / ITEMS_PER_PAGE), p + 1))}
                disabled={currentPage === Math.ceil(filteredProducts.length / ITEMS_PER_PAGE)}
                className="p-2 rounded-lg border border-input hover:bg-muted disabled:opacity-50 transition"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
        </>
      )}

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-foreground">Add New Product</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-muted rounded-lg transition">
                <XIcon size={20} />
              </button>
            </div>

            {/* Product slot info */}
            {usage.limit !== null && (
              <div className="bg-muted/50 rounded-lg p-3 mb-5 text-xs text-muted-foreground">
                Using {usage.used} of {usage.limit} product slots ({Math.round(usage.percentage)}%)
              </div>
            )}

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Product Name</label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Vintage Denim Jacket"
                  className="w-full px-4 py-3 rounded-xl border border-input bg-muted/50 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Price ({selectedCountry.currencyCode})</label>
                  <input type="number" value={addForm.price} onChange={(e) => setAddForm(prev => ({ ...prev, price: e.target.value }))} placeholder="5000" className="w-full px-4 py-3 rounded-xl border border-input bg-muted/50 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Compare at (optional)</label>
                  <input type="number" value={addForm.compareAtPrice} onChange={(e) => setAddForm(prev => ({ ...prev, compareAtPrice: e.target.value }))} placeholder="6000" className="w-full px-4 py-3 rounded-xl border border-input bg-muted/50 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">SKU</label>
                  <input type="text" value={addForm.sku} onChange={(e) => setAddForm(prev => ({ ...prev, sku: e.target.value }))} placeholder="SKU-001" className="w-full px-4 py-3 rounded-xl border border-input bg-muted/50 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Quantity</label>
                  <input type="number" value={addForm.quantity} onChange={(e) => setAddForm(prev => ({ ...prev, quantity: e.target.value }))} placeholder="0" className="w-full px-4 py-3 rounded-xl border border-input bg-muted/50 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>
              {categories.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Category</label>
                  <select value={addForm.categoryId} onChange={(e) => setAddForm(prev => ({ ...prev, categoryId: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-input bg-muted/50 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20">
                    <option value="">None</option>
                    {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Product Image</label>
                <div className="flex gap-3 mb-3">
                  {addForm.imageUrl ? (
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-border">
                      <img src={addForm.imageUrl} alt="Preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      <button onClick={() => setAddForm(prev => ({ ...prev, imageUrl: '' }))} className="absolute top-1 right-1 p-1 bg-destructive rounded-full hover:bg-destructive/90 transition">
                        <XIcon size={12} className="text-destructive-foreground" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-xl border-2 border-dashed border-border flex items-center justify-center">
                      <ImagePlusIcon size={24} className="text-muted-foreground/50" />
                    </div>
                  )}
                  <div className="flex-1 flex flex-col gap-2">
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => handleImageUpload(e, false)} className="hidden" />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-input rounded-lg hover:bg-muted transition text-sm font-medium text-foreground">
                      <UploadIcon size={16} /> Upload Image
                    </button>
                    <button type="button" className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-cyan-400 to-pink-400 rounded-lg hover:opacity-90 transition text-sm font-medium text-white" onClick={() => toast({ title: 'Magic Studio coming soon', description: 'AI-powered image generation' })}>
                      Magic Studio ✨
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <input type="url" value={addForm.imageUrl} onChange={(e) => setAddForm(prev => ({ ...prev, imageUrl: e.target.value }))} placeholder="Or paste image URL..." className="w-full pl-10 pr-4 py-3 rounded-xl border border-input bg-muted/50 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Description</label>
                <textarea value={addForm.description} onChange={(e) => setAddForm(prev => ({ ...prev, description: e.target.value }))} placeholder="Describe your product..." rows={3} className="w-full px-4 py-3 rounded-xl border border-input bg-muted/50 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition resize-none" />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-3 border border-input rounded-xl hover:bg-muted transition font-medium text-foreground">Cancel</button>
              <button onClick={handleAddProduct} disabled={addingProduct || !addForm.name.trim() || !addForm.price} className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {addingProduct ? <LoaderIcon size={18} className="animate-spin" /> : null}
                Add to Store
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground">Edit Product</h3>
              <button onClick={() => setEditingProduct(null)} className="p-1 hover:bg-muted rounded-lg transition">
                <XIcon size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Product Image</label>
                <div className="flex gap-3">
                  {editForm.imageUrl ? (
                    <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-border">
                      <img src={editForm.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                      <button onClick={() => setEditForm(prev => ({ ...prev, imageUrl: '' }))} className="absolute top-1 right-1 p-0.5 bg-destructive rounded-full hover:bg-destructive/90 transition">
                        <XIcon size={10} className="text-destructive-foreground" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
                      <ImagePlusIcon size={20} className="text-muted-foreground/50" />
                    </div>
                  )}
                  <div className="flex-1">
                    <input ref={editFileInputRef} type="file" accept="image/*" onChange={(e) => handleImageUpload(e, true)} className="hidden" />
                    <button type="button" onClick={() => editFileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-input rounded-lg hover:bg-muted transition text-sm font-medium text-foreground">
                      <UploadIcon size={14} /> Change Image
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Product Name</label>
                <input type="text" value={editForm.name} onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))} className="w-full px-4 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Description</label>
                <textarea value={editForm.description} onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))} rows={3} className="w-full px-4 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Price ({selectedCountry.currencyCode})</label>
                <input type="number" value={editForm.price} onChange={(e) => setEditForm(prev => ({ ...prev, price: e.target.value }))} className="w-full px-4 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">SKU</label>
                  <input type="text" value={editForm.sku} onChange={(e) => setEditForm(prev => ({ ...prev, sku: e.target.value }))} className="w-full px-4 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Quantity</label>
                  <input type="number" value={editForm.quantity} onChange={(e) => setEditForm(prev => ({ ...prev, quantity: e.target.value }))} className="w-full px-4 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>
              {categories.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Category</label>
                  <select value={editForm.categoryId} onChange={(e) => setEditForm(prev => ({ ...prev, categoryId: e.target.value }))} className="w-full px-4 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20">
                    <option value="">None</option>
                    {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditingProduct(null)} className="flex-1 px-4 py-2 border border-input rounded-lg hover:bg-muted transition font-medium text-foreground">Cancel</button>
              <button onClick={handleSaveEdit} disabled={saving} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium flex items-center justify-center gap-2">
                {saving ? <LoaderIcon size={18} className="animate-spin" /> : null}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link Success Modal */}
      {generatedLink && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircleIcon size={32} className="text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-1">Product Published!</h3>
              <p className="text-muted-foreground text-sm">Your payment link is ready to share</p>
            </div>

            <div className="bg-muted/50 rounded-xl p-4 mb-4">
              <p className="font-semibold text-foreground mb-1">{generatedLink.productName}</p>
              <p className="text-lg font-bold text-primary">{formatPrice(generatedLink.price, generatedLink.currency)}</p>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Payment Link</label>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-xl border border-input">
                <LinkIcon size={16} className="text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-foreground truncate flex-1">{generatedLink.linkUrl}</span>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(generatedLink.linkUrl);
                    setLinkCopied(true);
                    toast({ title: 'Link copied!' });
                    setTimeout(() => setLinkCopied(false), 2000);
                  }}
                  className="p-2 hover:bg-background rounded-lg transition flex-shrink-0"
                >
                  {linkCopied ? <CheckCircleIcon size={18} className="text-green-500" /> : <CopyIcon size={18} className="text-muted-foreground" />}
                </button>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Share via</label>
              <div className="grid grid-cols-4 gap-2">
                <a href={`https://wa.me/?text=${encodeURIComponent(`Check out ${generatedLink.productName}! ${generatedLink.linkUrl}`)}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 p-3 bg-green-500 hover:bg-green-600 rounded-xl transition">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  <span className="text-xs text-white font-medium">WhatsApp</span>
                </a>
                <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(generatedLink.linkUrl)}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 p-3 bg-blue-600 hover:bg-blue-700 rounded-xl transition">
                  <FacebookIcon size={24} className="text-white" />
                  <span className="text-xs text-white font-medium">Facebook</span>
                </a>
                <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out ${generatedLink.productName}!`)}&url=${encodeURIComponent(generatedLink.linkUrl)}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 p-3 bg-foreground hover:opacity-80 rounded-xl transition">
                  <svg className="w-6 h-6 text-background" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  <span className="text-xs text-background font-medium">X</span>
                </a>
                <button
                  onClick={async () => {
                    if (navigator.share) {
                      await navigator.share({ title: generatedLink.productName, text: `Check out ${generatedLink.productName}!`, url: generatedLink.linkUrl });
                    } else {
                      await navigator.clipboard.writeText(generatedLink.linkUrl);
                      toast({ title: 'Link copied!' });
                    }
                  }}
                  className="flex flex-col items-center gap-1 p-3 bg-primary hover:bg-primary/90 rounded-xl transition"
                >
                  <ShareIcon size={24} className="text-primary-foreground" />
                  <span className="text-xs text-primary-foreground font-medium">More</span>
                </button>
              </div>
            </div>

            <button onClick={() => { setGeneratedLink(null); setLinkCopied(false); }} className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition font-medium">
              Done
            </button>
          </div>
        </div>
      )}

      {/* Upgrade Modal */}
      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        currentPlanId={subscription.planId}
        onSelectPlan={handleSelectPlan}
        onStartTrial={handleStartTrial}
      />

      {/* Payment Flow */}
      <SubscriptionPaymentFlow
        open={paymentFlow.open}
        onClose={() => setPaymentFlow(prev => ({ ...prev, open: false }))}
        planId={paymentFlow.planId}
        billingCycle={paymentFlow.billing}
        mode={paymentFlow.mode}
        onComplete={handlePaymentComplete}
      />
    </div>
  );
}
