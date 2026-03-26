# FEATURE 8: CUSTOMER STOREFRONT WITH SEARCH & FILTERS
## Complete Implementation Guide

---

## 🎯 **WHAT WE'RE BUILDING:**

### **Customer Journey:**
```
1. Seller shares link: payloom.co/store/mama-pendo
2. Customer clicks link
3. Customer sees beautiful storefront with:
   ✅ Search bar at top
   ✅ Categories on left/top
   ✅ Price filters
   ✅ Sort options
   ✅ All products (grid view)
   ✅ Quick add to cart
   ✅ Responsive mobile design
```

---

## 🎨 **COMPLETE STOREFRONT PAGE:**

**File: `pages/store/[slug].tsx`**

```typescript
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Search, ShoppingCart, Filter, X, Grid, List, ChevronDown, Mic } from 'lucide-react';
import Image from 'next/image';

interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  selling_price: number;
  compare_at_price?: number;
  stock_quantity: number;
  images: string[];
  sku: string;
}

interface Seller {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  banner_url?: string;
  description?: string;
  phone: string;
  colors?: {
    primary: string;
    secondary: string;
  };
}

export default function StorefrontPage() {
  const router = useRouter();
  const { slug } = router.query;

  // State
  const [seller, setSeller] = useState<Seller | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [priceRange, setPriceRange] = useState<{ min?: number; max?: number }>({});
  const [sortBy, setSortBy] = useState<string>('recommended');
  const [showInStockOnly, setShowInStockOnly] = useState(false);
  const [showOnSaleOnly, setShowOnSaleOnly] = useState(false);
  
  // UI State
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [cart, setCart] = useState<{[key: string]: number}>({});

  // Derived Data
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
  const cartCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  const primaryColor = seller?.colors?.primary || '#00C896';

  // Fetch seller and products
  useEffect(() => {
    if (slug) {
      fetchStoreData();
    }
  }, [slug]);

  // Apply filters when state changes
  useEffect(() => {
    applyFilters();
  }, [products, searchQuery, selectedCategory, priceRange, sortBy, showInStockOnly, showOnSaleOnly]);

  const fetchStoreData = async () => {
    try {
      const response = await fetch(`/api/store/${slug}`);
      const data = await response.json();
      
      if (data.seller) {
        setSeller(data.seller);
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...products];

    // Search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.category?.toLowerCase().includes(query) ||
        p.sku?.toLowerCase().includes(query)
      );
    }

    // Category
    if (selectedCategory) {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    // Price Range
    if (priceRange.min !== undefined) {
      filtered = filtered.filter(p => p.selling_price >= priceRange.min!);
    }
    if (priceRange.max !== undefined) {
      filtered = filtered.filter(p => p.selling_price <= priceRange.max!);
    }

    // In Stock Only
    if (showInStockOnly) {
      filtered = filtered.filter(p => p.stock_quantity > 0);
    }

    // On Sale Only
    if (showOnSaleOnly) {
      filtered = filtered.filter(p => p.compare_at_price && p.compare_at_price > p.selling_price);
    }

    // Sorting
    switch (sortBy) {
      case 'price_asc':
        filtered.sort((a, b) => a.selling_price - b.selling_price);
        break;
      case 'price_desc':
        filtered.sort((a, b) => b.selling_price - a.selling_price);
        break;
      case 'name':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'newest':
        // Products are already sorted by created_at DESC from API
        break;
      default:
        // Recommended: in stock first, then by popularity/date
        filtered.sort((a, b) => {
          if (a.stock_quantity > 0 && b.stock_quantity === 0) return -1;
          if (a.stock_quantity === 0 && b.stock_quantity > 0) return 1;
          return 0;
        });
    }

    setFilteredProducts(filtered);
  };

  const addToCart = (productId: string) => {
    setCart(prev => ({
      ...prev,
      [productId]: (prev[productId] || 0) + 1
    }));
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setPriceRange({});
    setShowInStockOnly(false);
    setShowOnSaleOnly(false);
  };

  const hasActiveFilters = searchQuery || selectedCategory || priceRange.min || priceRange.max || showInStockOnly || showOnSaleOnly;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading store...</p>
        </div>
      </div>
    );
  }

  if (!seller) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Store Not Found</h1>
          <p className="text-gray-600">This store doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header/Banner */}
      <div 
        className="bg-gradient-to-r from-teal-600 to-teal-700 text-white"
        style={{ 
          background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%)`
        }}
      >
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {seller.logo_url && (
                <img 
                  src={seller.logo_url} 
                  alt={seller.name}
                  className="w-16 h-16 rounded-full bg-white p-1"
                />
              )}
              <div>
                <h1 className="text-3xl font-bold">{seller.name}</h1>
                {seller.description && (
                  <p className="text-teal-100 mt-1">{seller.description}</p>
                )}
              </div>
            </div>

            {/* Cart Icon */}
            <button 
              onClick={() => router.push(`/store/${slug}/cart`)}
              className="relative p-3 bg-white bg-opacity-20 rounded-full hover:bg-opacity-30 transition"
            >
              <ShoppingCart size={24} />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white border-b sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex gap-3">
            {/* Search Input */}
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products... (e.g., rice, cooking oil)"
                className="w-full pl-12 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={20} />
                </button>
              )}
            </div>

            {/* Filter Button (Mobile) */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="lg:hidden px-4 py-3 border border-gray-300 rounded-lg flex items-center gap-2 hover:bg-gray-50"
            >
              <Filter size={20} />
              Filters
              {hasActiveFilters && (
                <span className="bg-teal-600 text-white text-xs px-2 py-0.5 rounded-full">
                  Active
                </span>
              )}
            </button>
          </div>

          {/* Active Filters */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 mt-3">
              {searchQuery && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-teal-100 text-teal-800 rounded-full text-sm">
                  Search: "{searchQuery}"
                  <button onClick={() => setSearchQuery('')}>
                    <X size={14} />
                  </button>
                </span>
              )}
              {selectedCategory && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-teal-100 text-teal-800 rounded-full text-sm">
                  {selectedCategory}
                  <button onClick={() => setSelectedCategory('')}>
                    <X size={14} />
                  </button>
                </span>
              )}
              {(priceRange.min || priceRange.max) && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-teal-100 text-teal-800 rounded-full text-sm">
                  KES {priceRange.min || 0} - {priceRange.max || '∞'}
                  <button onClick={() => setPriceRange({})}>
                    <X size={14} />
                  </button>
                </span>
              )}
              {showInStockOnly && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-teal-100 text-teal-800 rounded-full text-sm">
                  In Stock Only
                  <button onClick={() => setShowInStockOnly(false)}>
                    <X size={14} />
                  </button>
                </span>
              )}
              {showOnSaleOnly && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-teal-100 text-teal-800 rounded-full text-sm">
                  On Sale
                  <button onClick={() => setShowOnSaleOnly(false)}>
                    <X size={14} />
                  </button>
                </span>
              )}
              <button
                onClick={clearFilters}
                className="text-sm text-teal-600 hover:text-teal-700 font-medium"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar Filters (Desktop) */}
          <aside className={`
            w-64 flex-shrink-0 space-y-6
            ${showFilters ? 'block' : 'hidden lg:block'}
          `}>
            {/* Categories */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Categories</h3>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!selectedCategory}
                    onChange={() => setSelectedCategory('')}
                    className="text-teal-600"
                  />
                  <span className="text-sm">All Products ({products.length})</span>
                </label>
                {categories.map((category) => {
                  const count = products.filter(p => p.category === category).length;
                  return (
                    <label key={category} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={selectedCategory === category}
                        onChange={() => setSelectedCategory(category)}
                        className="text-teal-600"
                      />
                      <span className="text-sm">{category} ({count})</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Price Range */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Price Range</h3>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!priceRange.min && !priceRange.max}
                    onChange={() => setPriceRange({})}
                    className="text-teal-600"
                  />
                  <span className="text-sm">All Prices</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={priceRange.max === 100}
                    onChange={() => setPriceRange({ max: 100 })}
                    className="text-teal-600"
                  />
                  <span className="text-sm">Under KES 100</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={priceRange.min === 100 && priceRange.max === 500}
                    onChange={() => setPriceRange({ min: 100, max: 500 })}
                    className="text-teal-600"
                  />
                  <span className="text-sm">KES 100 - 500</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={priceRange.min === 500 && priceRange.max === 1000}
                    onChange={() => setPriceRange({ min: 500, max: 1000 })}
                    className="text-teal-600"
                  />
                  <span className="text-sm">KES 500 - 1,000</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={priceRange.min === 1000 && !priceRange.max}
                    onChange={() => setPriceRange({ min: 1000 })}
                    className="text-teal-600"
                  />
                  <span className="text-sm">Above KES 1,000</span>
                </label>
              </div>

              {/* Custom Range */}
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-gray-600 mb-2">Custom Range</p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={priceRange.min || ''}
                    onChange={(e) => setPriceRange({ ...priceRange, min: parseFloat(e.target.value) || undefined })}
                    className="w-full px-2 py-1 text-sm border rounded"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={priceRange.max || ''}
                    onChange={(e) => setPriceRange({ ...priceRange, max: parseFloat(e.target.value) || undefined })}
                    className="w-full px-2 py-1 text-sm border rounded"
                  />
                </div>
              </div>
            </div>

            {/* Quick Filters */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Quick Filters</h3>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showInStockOnly}
                    onChange={(e) => setShowInStockOnly(e.target.checked)}
                    className="text-teal-600"
                  />
                  <span className="text-sm">In Stock Only</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showOnSaleOnly}
                    onChange={(e) => setShowOnSaleOnly(e.target.checked)}
                    className="text-teal-600"
                  />
                  <span className="text-sm">On Sale</span>
                </label>
              </div>
            </div>
          </aside>

          {/* Products Grid */}
          <main className="flex-1">
            {/* Toolbar */}
            <div className="flex justify-between items-center mb-6">
              <p className="text-gray-600">
                Showing <strong>{filteredProducts.length}</strong> of <strong>{products.length}</strong> products
              </p>

              <div className="flex items-center gap-3">
                {/* Sort */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                >
                  <option value="recommended">Recommended</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="name">Name: A to Z</option>
                  <option value="newest">Newest First</option>
                </select>

                {/* View Mode */}
                <div className="hidden sm:flex border border-gray-300 rounded-lg">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 ${viewMode === 'grid' ? 'bg-gray-100' : ''}`}
                  >
                    <Grid size={20} />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 ${viewMode === 'list' ? 'bg-gray-100' : ''}`}
                  >
                    <List size={20} />
                  </button>
                </div>
              </div>
            </div>

            {/* Products */}
            {filteredProducts.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-gray-400 mb-4">
                  <Search size={64} className="mx-auto" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No products found
                </h3>
                <p className="text-gray-600 mb-4">
                  Try adjusting your search or filters
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            ) : (
              <div className={`
                ${viewMode === 'grid' 
                  ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4' 
                  : 'space-y-4'
                }
              `}>
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    viewMode={viewMode}
                    onAddToCart={() => addToCart(product.id)}
                    primaryColor={primaryColor}
                  />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

// Product Card Component
function ProductCard({ 
  product, 
  viewMode, 
  onAddToCart,
  primaryColor 
}: { 
  product: Product; 
  viewMode: 'grid' | 'list';
  onAddToCart: () => void;
  primaryColor: string;
}) {
  const discount = product.compare_at_price 
    ? Math.round(((product.compare_at_price - product.selling_price) / product.compare_at_price) * 100)
    : 0;

  const isOutOfStock = product.stock_quantity === 0;

  if (viewMode === 'list') {
    return (
      <div className="bg-white rounded-lg shadow hover:shadow-lg transition p-4 flex gap-4">
        {/* Image */}
        <div className="w-32 h-32 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden relative">
          {product.images?.[0] ? (
            <img 
              src={product.images[0]} 
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              No Image
            </div>
          )}
          {discount > 0 && (
            <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
              -{discount}%
            </span>
          )}
          {isOutOfStock && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <span className="text-white font-semibold">Out of Stock</span>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-1">{product.name}</h3>
          <p className="text-sm text-gray-600 mb-2 line-clamp-2">{product.description}</p>
          <p className="text-xs text-gray-500 mb-2">Category: {product.category}</p>
          
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl font-bold" style={{ color: primaryColor }}>
              KES {product.selling_price.toLocaleString()}
            </span>
            {product.compare_at_price && (
              <span className="text-sm text-gray-400 line-through">
                KES {product.compare_at_price.toLocaleString()}
              </span>
            )}
          </div>

          <button
            onClick={onAddToCart}
            disabled={isOutOfStock}
            className={`px-6 py-2 rounded-lg font-semibold transition ${
              isOutOfStock
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'text-white hover:opacity-90'
            }`}
            style={{ backgroundColor: isOutOfStock ? undefined : primaryColor }}
          >
            {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-lg transition overflow-hidden">
      {/* Image */}
      <div className="aspect-square bg-gray-100 relative">
        {product.images?.[0] ? (
          <img 
            src={product.images[0]} 
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            No Image
          </div>
        )}
        {discount > 0 && (
          <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
            -{discount}%
          </span>
        )}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <span className="text-white font-semibold">Out of Stock</span>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">{product.name}</h3>
        <p className="text-xs text-gray-500 mb-2">{product.category}</p>
        
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg font-bold" style={{ color: primaryColor }}>
            KES {product.selling_price.toLocaleString()}
          </span>
          {product.compare_at_price && (
            <span className="text-xs text-gray-400 line-through">
              KES {product.compare_at_price.toLocaleString()}
            </span>
          )}
        </div>

        <button
          onClick={onAddToCart}
          disabled={isOutOfStock}
          className={`w-full py-2 rounded-lg font-semibold transition ${
            isOutOfStock
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'text-white hover:opacity-90'
          }`}
          style={{ backgroundColor: isOutOfStock ? undefined : primaryColor }}
        >
          {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
        </button>
      </div>
    </div>
  );
}
```

---

**This is Part 1! Should I continue with:**

**Part 2:**
- API endpoint to fetch seller + products
- Mobile filter drawer
- Voice search
- Recent searches
- Loading states
- SEO optimization
- Analytics tracking

**Let me know!** 🚀

