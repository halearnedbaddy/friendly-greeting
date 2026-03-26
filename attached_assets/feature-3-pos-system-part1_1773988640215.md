# FEATURE 3: POS (POINT OF SALE) SYSTEM
## Complete Implementation Guide

---

## 📊 **FEATURE OVERVIEW**

**What it does:**
- In-store checkout interface (like supermarket till)
- Barcode scanner integration
- Quick product search
- Multiple payment methods (M-Pesa, Cash, Card)
- Receipt printing/email
- Cash drawer management
- Shift tracking and reports
- Offline mode (works without internet)
- Multi-cashier support
- End-of-day reconciliation

**User Flow:**
```
Cashier starts shift → Opens till
↓
Customer brings items → Scan/search products
↓
Items added to cart → Calculate total
↓
Customer pays (M-Pesa/Cash/Card)
↓
Receipt printed/emailed
↓
Stock auto-deducted
↓
End of shift → Reconcile cash
```

---

## 🗄️ **DATABASE SCHEMA**

### **1. POS Sessions Table**

```sql
-- Track cashier shifts/sessions
CREATE TABLE pos_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id UUID REFERENCES users(id),
  cashier_id UUID REFERENCES users(id),
  location_id UUID REFERENCES stock_locations(id),
  
  -- Session Details
  session_number VARCHAR(50) UNIQUE, -- SES-2026-001
  status VARCHAR(20) DEFAULT 'open', -- open, closed, suspended
  
  -- Cash Management
  opening_cash DECIMAL(10,2) DEFAULT 0,
  closing_cash DECIMAL(10,2),
  expected_cash DECIMAL(10,2),
  cash_difference DECIMAL(10,2), -- closing - expected
  
  -- Session Stats
  total_sales DECIMAL(10,2) DEFAULT 0,
  total_transactions INTEGER DEFAULT 0,
  cash_sales DECIMAL(10,2) DEFAULT 0,
  mpesa_sales DECIMAL(10,2) DEFAULT 0,
  card_sales DECIMAL(10,2) DEFAULT 0,
  
  -- Timestamps
  opened_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP,
  
  -- Notes
  opening_notes TEXT,
  closing_notes TEXT
);

-- Indexes
CREATE INDEX idx_pos_sessions_seller ON pos_sessions(seller_id);
CREATE INDEX idx_pos_sessions_cashier ON pos_sessions(cashier_id);
CREATE INDEX idx_pos_sessions_status ON pos_sessions(status);
CREATE INDEX idx_pos_sessions_opened ON pos_sessions(opened_at DESC);
```

---

### **2. POS Transactions Table**

```sql
-- Individual sales transactions
CREATE TABLE pos_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES pos_sessions(id),
  seller_id UUID REFERENCES users(id),
  cashier_id UUID REFERENCES users(id),
  order_id UUID REFERENCES orders(id),
  
  -- Transaction Details
  transaction_number VARCHAR(50) UNIQUE, -- TXN-2026-001234
  
  -- Items
  items JSONB NOT NULL, -- Array of cart items
  
  -- Pricing
  subtotal DECIMAL(10,2) NOT NULL,
  tax DECIMAL(10,2) DEFAULT 0,
  discount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  
  -- Payment
  payment_method VARCHAR(20) NOT NULL, -- cash, mpesa, card, split
  payment_details JSONB, -- Method-specific details
  amount_tendered DECIMAL(10,2), -- For cash payments
  change_given DECIMAL(10,2), -- For cash payments
  
  -- Customer
  customer_name VARCHAR(255),
  customer_phone VARCHAR(15),
  customer_email VARCHAR(255),
  
  -- Status
  status VARCHAR(20) DEFAULT 'completed', -- completed, voided, refunded
  
  -- Receipt
  receipt_number VARCHAR(50),
  receipt_printed BOOLEAN DEFAULT false,
  receipt_emailed BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  voided_at TIMESTAMP,
  refunded_at TIMESTAMP,
  
  -- Void/Refund
  void_reason TEXT,
  voided_by UUID REFERENCES users(id),
  refund_amount DECIMAL(10,2),
  refund_method VARCHAR(20)
);

-- Indexes
CREATE INDEX idx_pos_trans_session ON pos_transactions(session_id);
CREATE INDEX idx_pos_trans_seller ON pos_transactions(seller_id);
CREATE INDEX idx_pos_trans_cashier ON pos_transactions(cashier_id);
CREATE INDEX idx_pos_trans_number ON pos_transactions(transaction_number);
CREATE INDEX idx_pos_trans_status ON pos_transactions(status);
CREATE INDEX idx_pos_trans_created ON pos_transactions(created_at DESC);
```

---

### **3. Cash Drawer Movements Table**

```sql
-- Track all cash in/out
CREATE TABLE cash_drawer_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES pos_sessions(id),
  seller_id UUID REFERENCES users(id),
  cashier_id UUID REFERENCES users(id),
  
  -- Movement Details
  type VARCHAR(20) NOT NULL, -- sale, refund, payout, float_in, float_out, opening, closing
  amount DECIMAL(10,2) NOT NULL,
  
  -- Related Records
  transaction_id UUID REFERENCES pos_transactions(id),
  
  -- Details
  reason TEXT,
  notes TEXT,
  
  -- Timestamp
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_cash_movements_session ON cash_drawer_movements(session_id);
CREATE INDEX idx_cash_movements_type ON cash_drawer_movements(type);
CREATE INDEX idx_cash_movements_created ON cash_drawer_movements(created_at DESC);
```

---

### **4. POS Cart (Temporary Storage)**

```sql
-- Temporary cart storage (for offline mode)
CREATE TABLE pos_carts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cashier_id UUID REFERENCES users(id),
  
  -- Cart Details
  items JSONB NOT NULL, -- Array of items
  subtotal DECIMAL(10,2) DEFAULT 0,
  tax DECIMAL(10,2) DEFAULT 0,
  discount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  
  -- Customer (optional)
  customer_name VARCHAR(255),
  customer_phone VARCHAR(15),
  
  -- Status
  status VARCHAR(20) DEFAULT 'active', -- active, parked, abandoned
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Auto-cleanup
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Indexes
CREATE INDEX idx_pos_carts_cashier ON pos_carts(cashier_id);
CREATE INDEX idx_pos_carts_status ON pos_carts(status);
CREATE INDEX idx_pos_carts_expires ON pos_carts(expires_at);

-- Auto-delete expired carts
CREATE OR REPLACE FUNCTION delete_expired_carts()
RETURNS void AS $$
BEGIN
  DELETE FROM pos_carts WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
```

---

### **5. Cashier Accounts Table**

```sql
-- Extend users table or create separate cashier table
CREATE TABLE cashiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id UUID REFERENCES users(id),
  user_id UUID REFERENCES users(id),
  
  -- Cashier Details
  name VARCHAR(255) NOT NULL,
  employee_id VARCHAR(50),
  pin VARCHAR(6), -- Encrypted 4-6 digit PIN
  
  -- Permissions
  can_void_transactions BOOLEAN DEFAULT false,
  can_apply_discounts BOOLEAN DEFAULT false,
  can_open_drawer BOOLEAN DEFAULT false,
  max_discount_percent DECIMAL(5,2) DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_cashiers_seller ON cashiers(seller_id);
CREATE INDEX idx_cashiers_user ON cashiers(user_id);
CREATE INDEX idx_cashiers_active ON cashiers(is_active);
```

---

## 🔧 **BACKEND IMPLEMENTATION**

### **1. POS Service**

**File: `lib/services/posService.ts`**

```typescript
import { createClient } from '@supabase/supabase-js';
import { inventoryService } from './inventoryService';
import { receiptService } from './receiptService';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface CartItem {
  product_id: string;
  name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  total: number;
  discount?: number;
}

interface PaymentDetails {
  method: 'cash' | 'mpesa' | 'card' | 'split';
  cash_amount?: number;
  mpesa_amount?: number;
  mpesa_code?: string;
  card_amount?: number;
  card_last4?: string;
  amount_tendered?: number;
  change_given?: number;
}

class POSService {
  /**
   * Start a new cashier session
   */
  async startSession(
    sellerId: string,
    cashierId: string,
    openingCash: number,
    notes?: string
  ) {
    // Generate session number
    const sessionNumber = await this.generateSessionNumber();

    const { data, error } = await supabase
      .from('pos_sessions')
      .insert({
        seller_id: sellerId,
        cashier_id: cashierId,
        session_number: sessionNumber,
        opening_cash: openingCash,
        status: 'open',
        opened_at: new Date().toISOString(),
        opening_notes: notes
      })
      .select()
      .single();

    if (error) throw error;

    // Record opening cash movement
    await this.recordCashMovement({
      session_id: data.id,
      seller_id: sellerId,
      cashier_id: cashierId,
      type: 'opening',
      amount: openingCash,
      reason: 'Session opening float'
    });

    return data;
  }

  /**
   * Generate session number
   */
  private async generateSessionNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const { count } = await supabase
      .from('pos_sessions')
      .select('*', { count: 'exact', head: true });
    
    const nextNumber = (count || 0) + 1;
    return `SES-${year}-${String(nextNumber).padStart(6, '0')}`;
  }

  /**
   * Process a sale transaction
   */
  async processSale(
    sessionId: string,
    sellerId: string,
    cashierId: string,
    items: CartItem[],
    paymentDetails: PaymentDetails,
    customerInfo?: {
      name?: string;
      phone?: string;
      email?: string;
    }
  ) {
    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const tax = subtotal * 0.16; // 16% VAT
    const discount = items.reduce((sum, item) => sum + (item.discount || 0), 0);
    const total = subtotal + tax - discount;

    // Generate transaction number
    const transactionNumber = await this.generateTransactionNumber();

    // Create order first
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        seller_id: sellerId,
        customer_name: customerInfo?.name,
        customer_phone: customerInfo?.phone,
        customer_email: customerInfo?.email,
        items: items,
        subtotal,
        tax,
        discount,
        total,
        payment_method: paymentDetails.method,
        payment_status: 'completed',
        order_type: 'pos',
        status: 'completed'
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // Create POS transaction
    const { data: transaction, error: transError } = await supabase
      .from('pos_transactions')
      .insert({
        session_id: sessionId,
        seller_id: sellerId,
        cashier_id: cashierId,
        order_id: order.id,
        transaction_number: transactionNumber,
        items,
        subtotal,
        tax,
        discount,
        total,
        payment_method: paymentDetails.method,
        payment_details: paymentDetails,
        amount_tendered: paymentDetails.amount_tendered,
        change_given: paymentDetails.change_given,
        customer_name: customerInfo?.name,
        customer_phone: customerInfo?.phone,
        customer_email: customerInfo?.email,
        status: 'completed'
      })
      .select()
      .single();

    if (transError) throw transError;

    // Deduct inventory
    await inventoryService.processSale(
      order.id,
      items.map(item => ({
        productId: item.product_id,
        quantity: item.quantity
      }))
    );

    // Record cash movement (if cash payment)
    if (paymentDetails.method === 'cash' || paymentDetails.cash_amount) {
      await this.recordCashMovement({
        session_id: sessionId,
        seller_id: sellerId,
        cashier_id: cashierId,
        transaction_id: transaction.id,
        type: 'sale',
        amount: paymentDetails.cash_amount || total,
        reason: `Sale ${transactionNumber}`
      });
    }

    // Update session totals
    await this.updateSessionTotals(
      sessionId,
      total,
      paymentDetails.method,
      paymentDetails
    );

    // Generate receipt
    const receipt = await receiptService.generateReceipt({
      orderId: order.id,
      sellerId,
      customerId: undefined,
      items: items.map(item => ({
        id: item.product_id,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total
      })),
      subtotal,
      tax,
      deliveryFee: 0,
      discount,
      total,
      paymentMethod: paymentDetails.method,
      mpesaCode: paymentDetails.mpesa_code,
      mpesaPhone: customerInfo?.phone,
      paymentTime: new Date(),
      customerName: customerInfo?.name || 'Walk-in Customer',
      customerPhone: customerInfo?.phone || '',
      customerEmail: customerInfo?.email,
      deliveryAddress: undefined,
      sellerName: 'PayLoom Instants', // Get from seller profile
      sellerLogoUrl: undefined,
      sellerColors: { primary: '#00C896', secondary: '#003D29' },
      sellerContact: '0705448355' // Get from seller profile
    });

    // Update transaction with receipt info
    await supabase
      .from('pos_transactions')
      .update({
        receipt_number: receipt.receiptNumber
      })
      .eq('id', transaction.id);

    return {
      transaction,
      receipt,
      order
    };
  }

  /**
   * Generate transaction number
   */
  private async generateTransactionNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const { count } = await supabase
      .from('pos_transactions')
      .select('*', { count: 'exact', head: true });
    
    const nextNumber = (count || 0) + 1;
    return `TXN-${year}-${String(nextNumber).padStart(6, '0')}`;
  }

  /**
   * Record cash drawer movement
   */
  private async recordCashMovement(movement: {
    session_id: string;
    seller_id: string;
    cashier_id: string;
    type: string;
    amount: number;
    reason: string;
    transaction_id?: string;
  }) {
    await supabase
      .from('cash_drawer_movements')
      .insert(movement);
  }

  /**
   * Update session totals
   */
  private async updateSessionTotals(
    sessionId: string,
    amount: number,
    method: string,
    paymentDetails: PaymentDetails
  ) {
    const { data: session } = await supabase
      .from('pos_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (!session) return;

    const updates: any = {
      total_sales: (session.total_sales || 0) + amount,
      total_transactions: (session.total_transactions || 0) + 1
    };

    // Update payment method totals
    if (method === 'cash') {
      updates.cash_sales = (session.cash_sales || 0) + amount;
    } else if (method === 'mpesa') {
      updates.mpesa_sales = (session.mpesa_sales || 0) + amount;
    } else if (method === 'card') {
      updates.card_sales = (session.card_sales || 0) + amount;
    } else if (method === 'split') {
      updates.cash_sales = (session.cash_sales || 0) + (paymentDetails.cash_amount || 0);
      updates.mpesa_sales = (session.mpesa_sales || 0) + (paymentDetails.mpesa_amount || 0);
      updates.card_sales = (session.card_sales || 0) + (paymentDetails.card_amount || 0);
    }

    await supabase
      .from('pos_sessions')
      .update(updates)
      .eq('id', sessionId);
  }

  /**
   * Void a transaction
   */
  async voidTransaction(
    transactionId: string,
    cashierId: string,
    reason: string
  ) {
    // Check cashier permissions
    const { data: cashier } = await supabase
      .from('cashiers')
      .select('can_void_transactions')
      .eq('id', cashierId)
      .single();

    if (!cashier?.can_void_transactions) {
      throw new Error('Not authorized to void transactions');
    }

    // Get transaction
    const { data: transaction } = await supabase
      .from('pos_transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (!transaction) throw new Error('Transaction not found');
    if (transaction.status !== 'completed') {
      throw new Error('Transaction already voided or refunded');
    }

    // Void transaction
    await supabase
      .from('pos_transactions')
      .update({
        status: 'voided',
        voided_at: new Date().toISOString(),
        voided_by: cashierId,
        void_reason: reason
      })
      .eq('id', transactionId);

    // Reverse inventory
    await inventoryService.processSale(
      transaction.order_id,
      transaction.items.map((item: any) => ({
        productId: item.product_id,
        quantity: -item.quantity // Negative to add back
      }))
    );

    // Record cash movement (reverse)
    if (transaction.payment_method === 'cash') {
      await this.recordCashMovement({
        session_id: transaction.session_id,
        seller_id: transaction.seller_id,
        cashier_id: cashierId,
        transaction_id: transactionId,
        type: 'refund',
        amount: -transaction.total,
        reason: `Void: ${reason}`
      });
    }

    // Update session totals
    await this.updateSessionTotals(
      transaction.session_id,
      -transaction.total,
      transaction.payment_method,
      transaction.payment_details
    );
  }

  /**
   * Close session (end of shift)
   */
  async closeSession(
    sessionId: string,
    closingCash: number,
    notes?: string
  ) {
    const { data: session } = await supabase
      .from('pos_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (!session) throw new Error('Session not found');

    // Calculate expected cash
    const expectedCash = (session.opening_cash || 0) + (session.cash_sales || 0);
    const cashDifference = closingCash - expectedCash;

    // Close session
    await supabase
      .from('pos_sessions')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        closing_cash: closingCash,
        expected_cash: expectedCash,
        cash_difference: cashDifference,
        closing_notes: notes
      })
      .eq('id', sessionId);

    // Record closing movement
    await this.recordCashMovement({
      session_id: sessionId,
      seller_id: session.seller_id,
      cashier_id: session.cashier_id,
      type: 'closing',
      amount: closingCash,
      reason: 'Session closing count'
    });

    return {
      session_id: sessionId,
      expected_cash: expectedCash,
      closing_cash: closingCash,
      cash_difference: cashDifference,
      total_sales: session.total_sales,
      total_transactions: session.total_transactions
    };
  }

  /**
   * Get session report
   */
  async getSessionReport(sessionId: string) {
    const { data: session } = await supabase
      .from('pos_sessions')
      .select(`
        *,
        cashier:cashier_id (name),
        transactions:pos_transactions (
          id,
          transaction_number,
          total,
          payment_method,
          created_at,
          status
        ),
        cash_movements:cash_drawer_movements (
          type,
          amount,
          reason,
          created_at
        )
      `)
      .eq('id', sessionId)
      .single();

    if (!session) throw new Error('Session not found');

    // Calculate breakdown
    const breakdown = {
      cash_sales: session.cash_sales || 0,
      mpesa_sales: session.mpesa_sales || 0,
      card_sales: session.card_sales || 0,
      total_sales: session.total_sales || 0,
      total_transactions: session.total_transactions || 0,
      voided_transactions: session.transactions?.filter((t: any) => t.status === 'voided').length || 0,
      cash_difference: session.cash_difference || 0
    };

    return {
      session,
      breakdown
    };
  }

  /**
   * Save cart (park sale)
   */
  async saveCart(
    cashierId: string,
    items: CartItem[],
    customerInfo?: { name?: string; phone?: string }
  ) {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const tax = subtotal * 0.16;
    const discount = items.reduce((sum, item) => sum + (item.discount || 0), 0);
    const total = subtotal + tax - discount;

    const { data, error } = await supabase
      .from('pos_carts')
      .insert({
        cashier_id: cashierId,
        items,
        subtotal,
        tax,
        discount,
        total,
        customer_name: customerInfo?.name,
        customer_phone: customerInfo?.phone,
        status: 'parked'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Load saved cart
   */
  async loadCart(cartId: string) {
    const { data, error } = await supabase
      .from('pos_carts')
      .select('*')
      .eq('id', cartId)
      .single();

    if (error) throw error;

    // Delete cart after loading
    await supabase
      .from('pos_carts')
      .delete()
      .eq('id', cartId);

    return data;
  }

  /**
   * Get parked carts for cashier
   */
  async getParkedCarts(cashierId: string) {
    const { data, error } = await supabase
      .from('pos_carts')
      .select('*')
      .eq('cashier_id', cashierId)
      .eq('status', 'parked')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }
}

export const posService = new POSService();
```

---

## 🌐 **API ENDPOINTS**

### **1. Start Session**

**File: `pages/api/pos/session/start.ts`**

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';
import { posService } from '@/lib/services/posService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sellerId, cashierId, openingCash, notes } = req.body;

    const session = await posService.startSession(
      sellerId,
      cashierId,
      openingCash,
      notes
    );

    return res.status(200).json({
      success: true,
      session
    });

  } catch (error: any) {
    console.error('Start session error:', error);
    return res.status(500).json({
      error: 'Failed to start session',
      details: error.message
    });
  }
}
```

---

### **2. Process Sale**

**File: `pages/api/pos/sale.ts`**

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';
import { posService } from '@/lib/services/posService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      sessionId,
      sellerId,
      cashierId,
      items,
      paymentDetails,
      customerInfo
    } = req.body;

    const result = await posService.processSale(
      sessionId,
      sellerId,
      cashierId,
      items,
      paymentDetails,
      customerInfo
    );

    return res.status(200).json({
      success: true,
      ...result
    });

  } catch (error: any) {
    console.error('Process sale error:', error);
    return res.status(500).json({
      error: 'Failed to process sale',
      details: error.message
    });
  }
}
```

---

### **3. Close Session**

**File: `pages/api/pos/session/close.ts`**

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';
import { posService } from '@/lib/services/posService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionId, closingCash, notes } = req.body;

    const report = await posService.closeSession(
      sessionId,
      closingCash,
      notes
    );

    return res.status(200).json({
      success: true,
      report
    });

  } catch (error: any) {
    console.error('Close session error:', error);
    return res.status(500).json({
      error: 'Failed to close session',
      details: error.message
    });
  }
}
```

---

**I'll continue with the frontend components in the next part due to length. Should I continue?** 🚀

