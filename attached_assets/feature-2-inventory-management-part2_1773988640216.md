# FEATURE 2: INVENTORY MANAGEMENT - PART 2
## Frontend Components & Integration

---

## 🎨 **FRONTEND COMPONENTS (CONTINUED)**

### **2. Product List Component**

**File: `components/ProductList.tsx`**

```typescript
import React, { useEffect, useState } from 'react';
import { Search, Plus, Edit, Trash2, Package, AlertCircle } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  selling_price: number;
  stock_quantity: number;
  low_stock_threshold: number;
  status: string;
}

export function ProductList({ sellerId }: { sellerId: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all'); // all, low_stock, out_of_stock

  useEffect(() => {
    fetchProducts();
  }, [sellerId]);

  const fetchProducts = async () => {
    try {
      const response = await fetch(`/api/inventory/products?sellerId=${sellerId}`);
      const data = await response.json();
      setProducts(data.products);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(product => {
    // Search filter
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.sku.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Status filter
    let matchesFilter = true;
    if (filter === 'low_stock') {
      matchesFilter = product.stock_quantity <= product.low_stock_threshold && product.stock_quantity > 0;
    } else if (filter === 'out_of_stock') {
      matchesFilter = product.stock_quantity <= 0;
    }

    return matchesSearch && matchesFilter;
  });

  const getStockStatus = (product: Product) => {
    if (product.stock_quantity <= 0) {
      return { text: 'Out of Stock', color: 'text-red-600 bg-red-50', icon: '🔴' };
    } else if (product.stock_quantity <= product.low_stock_threshold) {
      return { text: 'Low Stock', color: 'text-orange-600 bg-orange-50', icon: '🟡' };
    }
    return { text: 'In Stock', color: 'text-green-600 bg-green-50', icon: '🟢' };
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Products</h2>
        <button
          onClick={() => window.location.href = '/dashboard/inventory/add'}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
        >
          <Plus size={20} />
          Add Product
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search products by name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>

        {/* Filter */}
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
        >
          <option value="all">All Products</option>
          <option value="low_stock">Low Stock</option>
          <option value="out_of_stock">Out of Stock</option>
        </select>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Product
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                SKU
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Stock
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredProducts.map((product) => {
              const status = getStockStatus(product);
              return (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Package className="text-gray-400 mr-3" size={20} />
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {product.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {product.category}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {product.sku}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    KES {product.selling_price.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900">
                      {product.stock_quantity}
                    </div>
                    <div className="text-xs text-gray-500">
                      Threshold: {product.low_stock_threshold}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${status.color}`}>
                      {status.icon} {status.text}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => window.location.href = `/dashboard/inventory/edit/${product.id}`}
                      className="text-teal-600 hover:text-teal-900 mr-4"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(product.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <Package className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-500">No products found</p>
          </div>
        )}
      </div>
    </div>
  );

  async function handleDelete(productId: string) {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      const response = await fetch(`/api/inventory/products/${productId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setProducts(products.filter(p => p.id !== productId));
      }
    } catch (error) {
      alert('Failed to delete product');
    }
  }
}
```

---

### **3. Add/Edit Product Form**

**File: `components/ProductForm.tsx`**

```typescript
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Save, X } from 'lucide-react';

interface ProductFormData {
  name: string;
  description: string;
  category: string;
  sku: string;
  barcode: string;
  cost_price: number;
  selling_price: number;
  compare_at_price: number;
  stock_quantity: number;
  low_stock_threshold: number;
  track_inventory: boolean;
  allow_backorder: boolean;
  weight: number;
  status: string;
}

export function ProductForm({ 
  productId, 
  sellerId 
}: { 
  productId?: string;
  sellerId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    description: '',
    category: '',
    sku: '',
    barcode: '',
    cost_price: 0,
    selling_price: 0,
    compare_at_price: 0,
    stock_quantity: 0,
    low_stock_threshold: 10,
    track_inventory: true,
    allow_backorder: false,
    weight: 0,
    status: 'active'
  });

  useEffect(() => {
    if (productId) {
      fetchProduct();
    }
  }, [productId]);

  const fetchProduct = async () => {
    try {
      const response = await fetch(`/api/inventory/products/${productId}`);
      const data = await response.json();
      setFormData(data.product);
    } catch (error) {
      console.error('Fetch error:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = productId 
        ? `/api/inventory/products/${productId}`
        : '/api/inventory/products/create';
      
      const method = productId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          seller_id: sellerId
        })
      });

      if (response.ok) {
        router.push('/dashboard/inventory');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to save product');
      }
    } catch (error) {
      alert('Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' 
        ? (e.target as HTMLInputElement).checked
        : type === 'number'
        ? parseFloat(value) || 0
        : value
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto bg-white rounded-lg shadow p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">
          {productId ? 'Edit Product' : 'Add New Product'}
        </h2>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-gray-500 hover:text-gray-700"
        >
          <X size={24} />
        </button>
      </div>

      {/* Basic Information */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              placeholder="e.g., Rice 2kg"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              placeholder="Product description..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <input
              type="text"
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              placeholder="e.g., Groceries"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
      </div>

      {/* Identification */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Identification</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              SKU (Stock Keeping Unit)
            </label>
            <input
              type="text"
              name="sku"
              value={formData.sku}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              placeholder="Auto-generated if empty"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Barcode
            </label>
            <input
              type="text"
              name="barcode"
              value={formData.barcode}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              placeholder="Barcode number"
            />
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Pricing</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cost Price (What you paid)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">KES</span>
              <input
                type="number"
                name="cost_price"
                value={formData.cost_price}
                onChange={handleChange}
                step="0.01"
                className="w-full pl-14 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selling Price *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">KES</span>
              <input
                type="number"
                name="selling_price"
                value={formData.selling_price}
                onChange={handleChange}
                required
                step="0.01"
                className="w-full pl-14 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Compare At Price (Original)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">KES</span>
              <input
                type="number"
                name="compare_at_price"
                value={formData.compare_at_price}
                onChange={handleChange}
                step="0.01"
                className="w-full pl-14 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Inventory */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Inventory</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <input
              type="checkbox"
              name="track_inventory"
              checked={formData.track_inventory}
              onChange={handleChange}
              className="w-4 h-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
            />
            <label className="text-sm font-medium text-gray-700">
              Track inventory for this product
            </label>
          </div>

          {formData.track_inventory && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stock Quantity *
                </label>
                <input
                  type="number"
                  name="stock_quantity"
                  value={formData.stock_quantity}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Low Stock Threshold
                </label>
                <input
                  type="number"
                  name="low_stock_threshold"
                  value={formData.low_stock_threshold}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Alert when stock falls below this number
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-4">
            <input
              type="checkbox"
              name="allow_backorder"
              checked={formData.allow_backorder}
              onChange={handleChange}
              className="w-4 h-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
            />
            <label className="text-sm font-medium text-gray-700">
              Allow customers to buy when out of stock (backorder)
            </label>
          </div>
        </div>
      </div>

      {/* Physical Details */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Physical Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Weight (kg)
            </label>
            <input
              type="number"
              name="weight"
              value={formData.weight}
              onChange={handleChange}
              step="0.01"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4 pt-4 border-t">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-gray-400"
        >
          <Save size={20} />
          {loading ? 'Saving...' : 'Save Product'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
```

---

### **4. Stock Adjustment Modal**

**File: `components/StockAdjustmentModal.tsx`**

```typescript
import React, { useState } from 'react';
import { X } from 'lucide-react';

interface StockAdjustmentModalProps {
  product: {
    id: string;
    name: string;
    sku: string;
    stock_quantity: number;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export function StockAdjustmentModal({ 
  product, 
  onClose, 
  onSuccess 
}: StockAdjustmentModalProps) {
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'remove' | 'set'>('add');
  const [quantity, setQuantity] = useState(0);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let finalQuantity = quantity;
      
      if (adjustmentType === 'remove') {
        finalQuantity = -quantity;
      } else if (adjustmentType === 'set') {
        finalQuantity = quantity - product.stock_quantity;
      }

      const response = await fetch('/api/inventory/stock/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          quantity: finalQuantity,
          type: 'adjustment',
          reason
        })
      });

      if (response.ok) {
        onSuccess();
        onClose();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to adjust stock');
      }
    } catch (error) {
      alert('Failed to adjust stock');
    } finally {
      setLoading(false);
    }
  };

  const getNewQuantity = () => {
    if (adjustmentType === 'add') {
      return product.stock_quantity + quantity;
    } else if (adjustmentType === 'remove') {
      return product.stock_quantity - quantity;
    } else {
      return quantity;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-900">Adjust Stock</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <div className="mb-4 p-4 bg-gray-50 rounded">
          <p className="text-sm text-gray-600">Product</p>
          <p className="font-semibold">{product.name}</p>
          <p className="text-sm text-gray-600 mt-1">SKU: {product.sku}</p>
          <p className="text-sm text-gray-600">Current Stock: <span className="font-semibold">{product.stock_quantity}</span></p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Adjustment Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAdjustmentType('add')}
                className={`py-2 px-4 rounded-lg border-2 ${
                  adjustmentType === 'add'
                    ? 'border-teal-600 bg-teal-50 text-teal-700'
                    : 'border-gray-300 text-gray-700'
                }`}
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setAdjustmentType('remove')}
                className={`py-2 px-4 rounded-lg border-2 ${
                  adjustmentType === 'remove'
                    ? 'border-orange-600 bg-orange-50 text-orange-700'
                    : 'border-gray-300 text-gray-700'
                }`}
              >
                Remove
              </button>
              <button
                type="button"
                onClick={() => setAdjustmentType('set')}
                className={`py-2 px-4 rounded-lg border-2 ${
                  adjustmentType === 'set'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-300 text-gray-700'
                }`}
              >
                Set
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {adjustmentType === 'set' ? 'New Quantity' : 'Quantity'}
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
              min="0"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-600">New Stock Quantity</p>
            <p className="text-2xl font-bold text-blue-600">{getNewQuantity()}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              placeholder="e.g., Restock from supplier, Inventory count correction, Damaged items"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-gray-400"
            >
              {loading ? 'Updating...' : 'Update Stock'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

---

### **5. Barcode Scanner Component**

**File: `components/BarcodeScanner.tsx`**

```typescript
import React, { useState, useRef, useEffect } from 'react';
import { Camera, X } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const [manualBarcode, setManualBarcode] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (error) {
      console.error('Camera error:', error);
      alert('Failed to access camera');
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      setCameraActive(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualBarcode.trim()) {
      onScan(manualBarcode.trim());
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-900">Scan Barcode</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Camera Scanner */}
          <div>
            <button
              onClick={cameraActive ? stopCamera : startCamera}
              className="w-full flex items-center justify-center gap-2 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              <Camera size={20} />
              {cameraActive ? 'Stop Camera' : 'Start Camera'}
            </button>

            {cameraActive && (
              <div className="mt-4 relative">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full rounded-lg"
                />
                <div className="absolute inset-0 border-4 border-red-500 rounded-lg pointer-events-none">
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500"></div>
                </div>
              </div>
            )}
          </div>

          {/* Manual Entry */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">OR</span>
            </div>
          </div>

          <form onSubmit={handleManualSubmit}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter Barcode Manually
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                placeholder="Enter barcode number"
                autoFocus
              />
              <button
                type="submit"
                className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
              >
                Scan
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
```

---

### **6. Bulk Import Component**

**File: `components/BulkImport.tsx`**

```typescript
import React, { useState } from 'react';
import { Upload, Download, FileSpreadsheet } from 'lucide-react';

export function BulkImport({ sellerId }: { sellerId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const downloadTemplate = () => {
    const csvContent = 'SKU,Quantity\nSKU-000001,100\nSKU-000002,50';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory-template.csv';
    a.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sellerId', sellerId);

    try {
      const response = await fetch('/api/inventory/bulk-import', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      alert('Import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Bulk Stock Update
      </h3>

      <div className="space-y-4">
        {/* Download Template */}
        <div>
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 text-teal-600 hover:text-teal-700"
          >
            <Download size={20} />
            Download CSV Template
          </button>
          <p className="text-sm text-gray-500 mt-1">
            Download the template, fill it out, then upload it here
          </p>
        </div>

        {/* Upload File */}
        <div>
          <label className="block">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-teal-500 cursor-pointer">
              <FileSpreadsheet className="mx-auto text-gray-400 mb-2" size={48} />
              <p className="text-sm text-gray-600">
                {file ? file.name : 'Click to upload CSV file'}
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </label>
        </div>

        {/* Upload Button */}
        {file && (
          <button
            onClick={handleUpload}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-gray-400"
          >
            <Upload size={20} />
            {loading ? 'Uploading...' : 'Upload & Update Stock'}
          </button>
        )}

        {/* Results */}
        {result && (
          <div className={`p-4 rounded-lg ${
            result.failed === 0 ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
          }`}>
            <p className="font-semibold">Import Complete</p>
            <p className="text-sm mt-1">✅ Success: {result.success}</p>
            <p className="text-sm">❌ Failed: {result.failed}</p>
            
            {result.errors && result.errors.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-semibold">Errors:</p>
                <ul className="text-sm mt-1 space-y-1">
                  {result.errors.map((error: string, index: number) => (
                    <li key={index} className="text-red-600">• {error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## 🔄 **INTEGRATION WITH ORDER SYSTEM**

### **Auto-deduct stock on order completion**

**File: `pages/api/orders/complete.ts`**

```typescript
import { inventoryService } from '@/lib/services/inventoryService';

async function completeOrder(orderId: string) {
  // ... existing order logic ...

  // Get order items
  const { data: order } = await supabase
    .from('orders')
    .select(`
      *,
      order_items (
        product_id,
        quantity
      )
    `)
    .eq('id', orderId)
    .single();

  // Deduct stock for each item
  await inventoryService.processSale(
    orderId,
    order.order_items.map((item: any) => ({
      productId: item.product_id,
      quantity: item.quantity
    }))
  );

  // ... rest of order completion logic ...
}
```

---

## ✅ **TESTING CHECKLIST**

### **Unit Tests:**
- [ ] Product creation
- [ ] SKU generation
- [ ] Stock update
- [ ] Low stock detection
- [ ] Alert creation
- [ ] Transaction recording

### **Integration Tests:**
- [ ] Full product lifecycle
- [ ] Order stock deduction
- [ ] Alert notifications
- [ ] Bulk import
- [ ] Multi-location

### **UI Tests:**
- [ ] Product list display
- [ ] Add/Edit forms
- [ ] Stock adjustment modal
- [ ] Barcode scanner
- [ ] Responsive design

---

## 🚀 **DEPLOYMENT STEPS**

**1. Install Dependencies:**
```bash
npm install date-fns
```

**2. Run Database Migrations:**
```sql
-- Run all SQL from Part 1
```

**3. Set Environment Variables:**
```env
AFRICASTALKING_API_KEY=your_key
AFRICASTALKING_USERNAME=your_username
RESEND_API_KEY=your_key
```

**4. Deploy:**
```bash
npm run build
vercel deploy --prod
```

---

## 📊 **ANALYTICS TO TRACK**

- Stock turnover rate
- Most/least sold products
- Alert frequency
- Stock adjustment reasons
- Low stock trends
- Restock frequency
- Inventory value trends

---

**FEATURE 2 COMPLETE!** 🎉

**Next Features Available:**
- Feature 3: POS System
- Feature 4: Multi-Payment Methods
- Feature 5: Customer Accounts

**Should I continue with Feature 3 (POS System)?** 🚀