# FEATURE 2: INVENTORY MANAGEMENT SYSTEM
## Complete Implementation Guide

---

## 📊 **FEATURE OVERVIEW**

**What it does:**
- Real-time stock tracking for all products
- Automatic stock deduction on sales
- Low stock alerts (SMS/Email)
- Restock notifications
- Multi-location inventory
- Barcode/SKU support
- Stock valuation reports
- Expiry date tracking
- Batch/lot management
- Inventory history (audit trail)

**User Flow:**
```
Seller adds product → Sets stock quantity
↓
Customer buys product → Stock auto-deducts
↓
Stock reaches low threshold → Alert sent
↓
Seller restocks → Updates quantity
↓
System tracks all changes
```

---

## 🗄️ **DATABASE SCHEMA**

### **1. Products Table**

```sql
-- Create products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Basic Info
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  
  -- Identification
  sku VARCHAR(50) UNIQUE, -- Stock Keeping Unit
  barcode VARCHAR(50) UNIQUE,
  
  -- Pricing
  cost_price DECIMAL(10,2), -- What seller paid
  selling_price DECIMAL(10,2) NOT NULL,
  compare_at_price DECIMAL(10,2), -- Original price (for discounts)
  
  -- Inventory
  stock_quantity INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 10,
  track_inventory BOOLEAN DEFAULT true,
  allow_backorder BOOLEAN DEFAULT false, -- Sell when out of stock?
  
  -- Physical Details
  weight DECIMAL(10,2), -- in kg
  dimensions JSONB, -- {length, width, height}
  
  -- Status
  status VARCHAR(20) DEFAULT 'active', -- active, draft, archived
  is_featured BOOLEAN DEFAULT false,
  
  -- Media
  images JSONB, -- Array of image URLs
  
  -- SEO
  slug VARCHAR(255) UNIQUE,
  meta_title VARCHAR(255),
  meta_description TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Soft Delete
  deleted_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_products_seller ON products(seller_id);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_stock ON products(stock_quantity);
CREATE INDEX idx_products_created ON products(created_at DESC);

-- Full text search
CREATE INDEX idx_products_search ON products USING gin(
  to_tsvector('english', name || ' ' || COALESCE(description, ''))
);
```

---

### **2. Inventory Transactions Table**

**Track every stock change:**

```sql
CREATE TABLE inventory_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  seller_id UUID REFERENCES users(id),
  
  -- Transaction Details
  type VARCHAR(20) NOT NULL, -- sale, restock, adjustment, return, damage
  quantity INTEGER NOT NULL, -- Positive or negative
  previous_quantity INTEGER NOT NULL,
  new_quantity INTEGER NOT NULL,
  
  -- Related Records
  order_id UUID REFERENCES orders(id),
  purchase_order_id UUID, -- For restocks from suppliers
  
  -- Cost Tracking
  unit_cost DECIMAL(10,2), -- Cost per unit (for valuation)
  total_cost DECIMAL(10,2), -- Total transaction cost
  
  -- Location (if multi-location)
  location_id UUID,
  
  -- Metadata
  reason TEXT, -- Why this adjustment?
  notes TEXT,
  performed_by UUID REFERENCES users(id), -- Who made the change?
  
  -- Timestamp
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_inventory_trans_product ON inventory_transactions(product_id);
CREATE INDEX idx_inventory_trans_seller ON inventory_transactions(seller_id);
CREATE INDEX idx_inventory_trans_type ON inventory_transactions(type);
CREATE INDEX idx_inventory_trans_order ON inventory_transactions(order_id);
CREATE INDEX idx_inventory_trans_created ON inventory_transactions(created_at DESC);
```

---

### **3. Stock Locations Table**

**For multi-location inventory:**

```sql
CREATE TABLE stock_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Location Details
  name VARCHAR(255) NOT NULL, -- "Main Store", "Warehouse 1"
  code VARCHAR(50) UNIQUE, -- "MS", "WH1"
  
  -- Address
  address TEXT,
  city VARCHAR(100),
  county VARCHAR(100),
  
  -- Contact
  phone VARCHAR(15),
  email VARCHAR(255),
  manager_name VARCHAR(255),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_locations_seller ON stock_locations(seller_id);
CREATE INDEX idx_locations_active ON stock_locations(is_active);
```

---

### **4. Product Stock by Location Table**

```sql
CREATE TABLE product_stock_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  location_id UUID REFERENCES stock_locations(id) ON DELETE CASCADE,
  
  -- Stock at this location
  quantity INTEGER DEFAULT 0,
  reserved_quantity INTEGER DEFAULT 0, -- Orders pending fulfillment
  available_quantity INTEGER GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,
  
  -- Timestamps
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Unique constraint
  UNIQUE(product_id, location_id)
);

-- Indexes
CREATE INDEX idx_product_stock_product ON product_stock_locations(product_id);
CREATE INDEX idx_product_stock_location ON product_stock_locations(location_id);
```

---

### **5. Stock Alerts Table**

```sql
CREATE TABLE stock_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  seller_id UUID REFERENCES users(id),
  
  -- Alert Details
  alert_type VARCHAR(20) NOT NULL, -- low_stock, out_of_stock, expiring_soon
  current_quantity INTEGER,
  threshold_quantity INTEGER,
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- pending, sent, acknowledged, resolved
  
  -- Notification
  notification_sent BOOLEAN DEFAULT false,
  notification_sent_at TIMESTAMP,
  
  -- Resolution
  acknowledged_at TIMESTAMP,
  acknowledged_by UUID REFERENCES users(id),
  resolved_at TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_alerts_product ON stock_alerts(product_id);
CREATE INDEX idx_alerts_seller ON stock_alerts(seller_id);
CREATE INDEX idx_alerts_status ON stock_alerts(status);
CREATE INDEX idx_alerts_type ON stock_alerts(alert_type);
```

---

### **6. Product Variants Table**

**For products with variations (size, color, etc.):**

```sql
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  
  -- Variant Details
  variant_name VARCHAR(255) NOT NULL, -- "Red - Large"
  sku VARCHAR(50) UNIQUE,
  barcode VARCHAR(50),
  
  -- Options
  option1_name VARCHAR(50), -- "Color"
  option1_value VARCHAR(50), -- "Red"
  option2_name VARCHAR(50), -- "Size"
  option2_value VARCHAR(50), -- "Large"
  option3_name VARCHAR(50),
  option3_value VARCHAR(50),
  
  -- Pricing
  price DECIMAL(10,2),
  compare_at_price DECIMAL(10,2),
  cost_price DECIMAL(10,2),
  
  -- Inventory
  stock_quantity INTEGER DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_variants_product ON product_variants(product_id);
CREATE INDEX idx_variants_sku ON product_variants(sku);
```

---

## 🔧 **BACKEND IMPLEMENTATION**

### **1. Inventory Service**

**File: `lib/services/inventoryService.ts`**

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface Product {
  id: string;
  seller_id: string;
  name: string;
  description?: string;
  category?: string;
  sku?: string;
  barcode?: string;
  cost_price?: number;
  selling_price: number;
  stock_quantity: number;
  low_stock_threshold: number;
  track_inventory: boolean;
}

interface StockAdjustment {
  productId: string;
  quantity: number; // Can be positive (add) or negative (remove)
  type: 'sale' | 'restock' | 'adjustment' | 'return' | 'damage';
  reason?: string;
  notes?: string;
  orderId?: string;
  performedBy?: string;
  unitCost?: number;
}

class InventoryService {
  /**
   * Create a new product
   */
  async createProduct(productData: Omit<Product, 'id'>): Promise<Product> {
    // Generate SKU if not provided
    const sku = productData.sku || await this.generateSKU(productData.seller_id);

    const { data, error } = await supabase
      .from('products')
      .insert({
        ...productData,
        sku,
        slug: this.generateSlug(productData.name)
      })
      .select()
      .single();

    if (error) throw error;

    // Create initial stock location entry
    await this.initializeStockLocation(data.id, data.seller_id);

    return data;
  }

  /**
   * Generate unique SKU
   */
  private async generateSKU(sellerId: string): Promise<string> {
    const { count } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('seller_id', sellerId);

    const nextNumber = (count || 0) + 1;
    return `SKU-${String(nextNumber).padStart(6, '0')}`;
  }

  /**
   * Generate URL slug
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim() + '-' + Date.now();
  }

  /**
   * Initialize default stock location
   */
  private async initializeStockLocation(productId: string, sellerId: string) {
    // Get or create default location
    let { data: location } = await supabase
      .from('stock_locations')
      .select('id')
      .eq('seller_id', sellerId)
      .eq('is_default', true)
      .single();

    if (!location) {
      const { data: newLocation } = await supabase
        .from('stock_locations')
        .insert({
          seller_id: sellerId,
          name: 'Main Location',
          code: 'MAIN',
          is_default: true,
          is_active: true
        })
        .select()
        .single();

      location = newLocation;
    }

    // Create stock location entry
    await supabase
      .from('product_stock_locations')
      .insert({
        product_id: productId,
        location_id: location!.id,
        quantity: 0
      });
  }

  /**
   * Update stock quantity
   */
  async updateStock(adjustment: StockAdjustment): Promise<void> {
    // Get current product
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', adjustment.productId)
      .single();

    if (productError) throw productError;
    if (!product.track_inventory) return; // Skip if not tracking

    const previousQuantity = product.stock_quantity;
    const newQuantity = previousQuantity + adjustment.quantity;

    // Prevent negative stock (unless backorders allowed)
    if (newQuantity < 0 && !product.allow_backorder) {
      throw new Error('Insufficient stock');
    }

    // Update product stock
    const { error: updateError } = await supabase
      .from('products')
      .update({
        stock_quantity: newQuantity,
        updated_at: new Date().toISOString()
      })
      .eq('id', adjustment.productId);

    if (updateError) throw updateError;

    // Record transaction
    await this.recordTransaction({
      product_id: adjustment.productId,
      seller_id: product.seller_id,
      type: adjustment.type,
      quantity: adjustment.quantity,
      previous_quantity: previousQuantity,
      new_quantity: newQuantity,
      order_id: adjustment.orderId,
      unit_cost: adjustment.unitCost || product.cost_price,
      total_cost: (adjustment.unitCost || product.cost_price || 0) * Math.abs(adjustment.quantity),
      reason: adjustment.reason,
      notes: adjustment.notes,
      performed_by: adjustment.performedBy
    });

    // Check for low stock
    await this.checkLowStock(adjustment.productId, newQuantity, product.low_stock_threshold);
  }

  /**
   * Record inventory transaction
   */
  private async recordTransaction(transaction: any) {
    await supabase
      .from('inventory_transactions')
      .insert(transaction);
  }

  /**
   * Check if stock is low and create alert
   */
  private async checkLowStock(
    productId: string,
    currentQuantity: number,
    threshold: number
  ) {
    if (currentQuantity <= threshold && currentQuantity > 0) {
      await this.createStockAlert(productId, 'low_stock', currentQuantity, threshold);
    } else if (currentQuantity <= 0) {
      await this.createStockAlert(productId, 'out_of_stock', currentQuantity, threshold);
    }
  }

  /**
   * Create stock alert
   */
  private async createStockAlert(
    productId: string,
    alertType: string,
    currentQuantity: number,
    threshold: number
  ) {
    // Get product details
    const { data: product } = await supabase
      .from('products')
      .select('seller_id, name')
      .eq('id', productId)
      .single();

    if (!product) return;

    // Check if alert already exists
    const { data: existingAlert } = await supabase
      .from('stock_alerts')
      .select('id')
      .eq('product_id', productId)
      .eq('alert_type', alertType)
      .eq('status', 'pending')
      .single();

    if (existingAlert) return; // Alert already sent

    // Create alert
    const { data: alert } = await supabase
      .from('stock_alerts')
      .insert({
        product_id: productId,
        seller_id: product.seller_id,
        alert_type: alertType,
        current_quantity: currentQuantity,
        threshold_quantity: threshold,
        status: 'pending'
      })
      .select()
      .single();

    // Send notification (async, don't wait)
    this.sendStockNotification(product, alert).catch(console.error);
  }

  /**
   * Send stock notification (SMS/Email)
   */
  private async sendStockNotification(product: any, alert: any) {
    // Get seller details
    const { data: seller } = await supabase
      .from('users')
      .select('phone, email, name')
      .eq('id', product.seller_id)
      .single();

    if (!seller) return;

    const message = alert.alert_type === 'out_of_stock'
      ? `⚠️ OUT OF STOCK: ${product.name} is out of stock!`
      : `⚠️ LOW STOCK: ${product.name} - Only ${alert.current_quantity} left!`;

    // Send SMS via Africa's Talking
    if (seller.phone) {
      await fetch('https://api.africastalking.com/version1/messaging', {
        method: 'POST',
        headers: {
          'apiKey': process.env.AFRICASTALKING_API_KEY!,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          username: process.env.AFRICASTALKING_USERNAME!,
          to: seller.phone,
          message: message
        })
      });
    }

    // Send Email
    if (seller.email) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'PayLoom Alerts <alerts@payloom.co>',
          to: seller.email,
          subject: alert.alert_type === 'out_of_stock' ? 'Out of Stock Alert' : 'Low Stock Alert',
          html: `
            <h2>${message}</h2>
            <p>Product: <strong>${product.name}</strong></p>
            <p>Current Stock: <strong>${alert.current_quantity}</strong></p>
            <p>Threshold: <strong>${alert.threshold_quantity}</strong></p>
            <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/inventory">Manage Inventory</a></p>
          `
        })
      });
    }

    // Mark notification as sent
    await supabase
      .from('stock_alerts')
      .update({
        notification_sent: true,
        notification_sent_at: new Date().toISOString()
      })
      .eq('id', alert.id);
  }

  /**
   * Process sale (deduct stock)
   */
  async processSale(
    orderId: string,
    items: Array<{ productId: string; quantity: number }>
  ): Promise<void> {
    for (const item of items) {
      await this.updateStock({
        productId: item.productId,
        quantity: -item.quantity, // Negative = remove
        type: 'sale',
        orderId,
        reason: 'Customer purchase'
      });
    }
  }

  /**
   * Restock product
   */
  async restock(
    productId: string,
    quantity: number,
    unitCost?: number,
    notes?: string
  ): Promise<void> {
    await this.updateStock({
      productId,
      quantity, // Positive = add
      type: 'restock',
      reason: 'Inventory restock',
      notes,
      unitCost
    });
  }

  /**
   * Adjust stock (manual correction)
   */
  async adjustStock(
    productId: string,
    newQuantity: number,
    reason: string,
    performedBy: string
  ): Promise<void> {
    const { data: product } = await supabase
      .from('products')
      .select('stock_quantity')
      .eq('id', productId)
      .single();

    if (!product) throw new Error('Product not found');

    const difference = newQuantity - product.stock_quantity;

    await this.updateStock({
      productId,
      quantity: difference,
      type: 'adjustment',
      reason,
      performedBy
    });
  }

  /**
   * Get product by SKU
   */
  async getProductBySKU(sku: string): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('sku', sku)
      .single();

    if (error) return null;
    return data;
  }

  /**
   * Get product by barcode
   */
  async getProductByBarcode(barcode: string): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('barcode', barcode)
      .single();

    if (error) return null;
    return data;
  }

  /**
   * Get inventory report
   */
  async getInventoryReport(sellerId: string) {
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .eq('seller_id', sellerId)
      .eq('track_inventory', true);

    if (!products) return null;

    const totalProducts = products.length;
    const totalValue = products.reduce((sum, p) => 
      sum + (p.stock_quantity * (p.cost_price || 0)), 0
    );
    const lowStockItems = products.filter(p => 
      p.stock_quantity <= p.low_stock_threshold && p.stock_quantity > 0
    );
    const outOfStockItems = products.filter(p => 
      p.stock_quantity <= 0
    );

    return {
      totalProducts,
      totalValue,
      lowStockCount: lowStockItems.length,
      outOfStockCount: outOfStockItems.length,
      lowStockItems,
      outOfStockItems
    };
  }

  /**
   * Get inventory transactions history
   */
  async getTransactionHistory(
    productId: string,
    limit: number = 50
  ) {
    const { data, error } = await supabase
      .from('inventory_transactions')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  /**
   * Get pending alerts
   */
  async getPendingAlerts(sellerId: string) {
    const { data, error } = await supabase
      .from('stock_alerts')
      .select(`
        *,
        products:product_id (
          name,
          sku,
          stock_quantity
        )
      `)
      .eq('seller_id', sellerId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: string, userId: string) {
    await supabase
      .from('stock_alerts')
      .update({
        status: 'acknowledged',
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: userId
      })
      .eq('id', alertId);
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId: string) {
    await supabase
      .from('stock_alerts')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString()
      })
      .eq('id', alertId);
  }

  /**
   * Bulk stock update (CSV import)
   */
  async bulkUpdateStock(
    updates: Array<{
      sku: string;
      quantity: number;
    }>,
    performedBy: string
  ) {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const update of updates) {
      try {
        const product = await this.getProductBySKU(update.sku);
        if (!product) {
          results.failed++;
          results.errors.push(`SKU ${update.sku} not found`);
          continue;
        }

        await this.adjustStock(
          product.id,
          update.quantity,
          'Bulk import',
          performedBy
        );

        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(`SKU ${update.sku}: ${error.message}`);
      }
    }

    return results;
  }
}

export const inventoryService = new InventoryService();
```

---

## 🌐 **API ENDPOINTS**

### **1. Create Product**

**File: `pages/api/inventory/products/create.ts`**

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';
import { inventoryService } from '@/lib/services/inventoryService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const product = await inventoryService.createProduct(req.body);

    return res.status(201).json({
      success: true,
      product
    });

  } catch (error: any) {
    console.error('Create product error:', error);
    return res.status(500).json({
      error: 'Failed to create product',
      details: error.message
    });
  }
}
```

---

### **2. Update Stock**

**File: `pages/api/inventory/stock/update.ts`**

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';
import { inventoryService } from '@/lib/services/inventoryService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { productId, quantity, type, reason, notes } = req.body;

    await inventoryService.updateStock({
      productId,
      quantity,
      type,
      reason,
      notes
    });

    return res.status(200).json({
      success: true,
      message: 'Stock updated successfully'
    });

  } catch (error: any) {
    console.error('Update stock error:', error);
    return res.status(500).json({
      error: 'Failed to update stock',
      details: error.message
    });
  }
}
```

---

### **3. Get Inventory Report**

**File: `pages/api/inventory/report.ts`**

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';
import { inventoryService } from '@/lib/services/inventoryService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sellerId } = req.query;

    const report = await inventoryService.getInventoryReport(
      sellerId as string
    );

    return res.status(200).json({
      success: true,
      report
    });

  } catch (error: any) {
    console.error('Get report error:', error);
    return res.status(500).json({
      error: 'Failed to get report',
      details: error.message
    });
  }
}
```

---

### **4. Scan Barcode**

**File: `pages/api/inventory/scan.ts`**

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';
import { inventoryService } from '@/lib/services/inventoryService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { barcode } = req.body;

    const product = await inventoryService.getProductByBarcode(barcode);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    return res.status(200).json({
      success: true,
      product
    });

  } catch (error: any) {
    console.error('Scan error:', error);
    return res.status(500).json({
      error: 'Failed to scan barcode',
      details: error.message
    });
  }
}
```

---

## 🎨 **FRONTEND COMPONENTS**

### **1. Inventory Dashboard**

**File: `components/InventoryDashboard.tsx`**

```typescript
import React, { useEffect, useState } from 'react';
import { Package, AlertTriangle, TrendingDown, DollarSign } from 'lucide-react';

interface InventoryReport {
  totalProducts: number;
  totalValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  lowStockItems: any[];
  outOfStockItems: any[];
}

export function InventoryDashboard({ sellerId }: { sellerId: string }) {
  const [report, setReport] = useState<InventoryReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReport();
  }, [sellerId]);

  const fetchReport = async () => {
    try {
      const response = await fetch(`/api/inventory/report?sellerId=${sellerId}`);
      const data = await response.json();
      setReport(data.report);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Products */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Products</p>
              <p className="text-3xl font-bold text-gray-900">
                {report?.totalProducts || 0}
              </p>
            </div>
            <Package className="text-teal-600" size={32} />
          </div>
        </div>

        {/* Total Value */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Value</p>
              <p className="text-3xl font-bold text-gray-900">
                KES {report?.totalValue.toLocaleString() || 0}
              </p>
            </div>
            <DollarSign className="text-green-600" size={32} />
          </div>
        </div>

        {/* Low Stock */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Low Stock</p>
              <p className="text-3xl font-bold text-orange-600">
                {report?.lowStockCount || 0}
              </p>
            </div>
            <AlertTriangle className="text-orange-600" size={32} />
          </div>
        </div>

        {/* Out of Stock */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Out of Stock</p>
              <p className="text-3xl font-bold text-red-600">
                {report?.outOfStockCount || 0}
              </p>
            </div>
            <TrendingDown className="text-red-600" size={32} />
          </div>
        </div>
      </div>

      {/* Alerts */}
      {(report?.lowStockItems.length || 0) > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-orange-800 mb-3">
            ⚠️ Low Stock Alert ({report!.lowStockItems.length} items)
          </h3>
          <div className="space-y-2">
            {report!.lowStockItems.slice(0, 5).map((item) => (
              <div 
                key={item.id}
                className="flex justify-between items-center bg-white rounded p-3"
              >
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-sm text-gray-600">SKU: {item.sku}</p>
                </div>
                <div className="text-right">
                  <p className="text-orange-600 font-bold">
                    {item.stock_quantity} left
                  </p>
                  <p className="text-sm text-gray-600">
                    Threshold: {item.low_stock_threshold}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(report?.outOfStockItems.length || 0) > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-red-800 mb-3">
            🔴 Out of Stock ({report!.outOfStockItems.length} items)
          </h3>
          <div className="space-y-2">
            {report!.outOfStockItems.slice(0, 5).map((item) => (
              <div 
                key={item.id}
                className="flex justify-between items-center bg-white rounded p-3"
              >
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-sm text-gray-600">SKU: {item.sku}</p>
                </div>
                <span className="px-3 py-1 bg-red-600 text-white text-sm rounded-full">
                  Out of Stock
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

**I'll continue with more components in the next response due to length limits!**

**Should I continue with:**
- Product List Component
- Add/Edit Product Form
- Stock Adjustment Modal
- Barcode Scanner Component
- Bulk Import Component
- And complete integration code?

**Type "continue" and I'll add the rest!** 🚀

