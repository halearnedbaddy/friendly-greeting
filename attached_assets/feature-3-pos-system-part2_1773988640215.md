# FEATURE 3: POS SYSTEM - PART 2
## Frontend Components & Integration

---

## 🎨 **FRONTEND COMPONENTS**

### **1. POS Checkout Interface**

**File: `components/POSCheckout.tsx`**

```typescript
import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Minus, Trash2, ShoppingCart, DollarSign, Barcode, Save, X } from 'lucide-react';
import { PaymentModal } from './PaymentModal';
import { BarcodeScanner } from './BarcodeScanner';

interface CartItem {
  product_id: string;
  name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  total: number;
  stock_quantity: number;
  discount?: number;
}

interface POSCheckoutProps {
  sessionId: string;
  sellerId: string;
  cashierId: string;
}

export function POSCheckout({ sessionId, sellerId, cashierId }: POSCheckoutProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '', email: '' });
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus search input
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Search products
  useEffect(() => {
    if (searchTerm.length >= 2) {
      searchProducts();
    } else {
      setSearchResults([]);
    }
  }, [searchTerm]);

  const searchProducts = async () => {
    try {
      const response = await fetch(
        `/api/inventory/products/search?q=${searchTerm}&sellerId=${sellerId}`
      );
      const data = await response.json();
      setSearchResults(data.products || []);
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  const addToCart = (product: any) => {
    const existingItem = cart.find(item => item.product_id === product.id);

    if (existingItem) {
      // Increase quantity
      updateQuantity(existingItem.product_id, existingItem.quantity + 1);
    } else {
      // Add new item
      const newItem: CartItem = {
        product_id: product.id,
        name: product.name,
        sku: product.sku,
        quantity: 1,
        unit_price: product.selling_price,
        total: product.selling_price,
        stock_quantity: product.stock_quantity,
        discount: 0
      };
      setCart([...cart, newItem]);
    }

    // Clear search
    setSearchTerm('');
    setSearchResults([]);
    searchInputRef.current?.focus();
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart(cart.map(item => {
      if (item.product_id === productId) {
        // Check stock
        if (newQuantity > item.stock_quantity) {
          alert(`Only ${item.stock_quantity} in stock!`);
          return item;
        }
        
        return {
          ...item,
          quantity: newQuantity,
          total: newQuantity * item.unit_price - (item.discount || 0)
        };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  const applyDiscount = (productId: string, discountAmount: number) => {
    setCart(cart.map(item => {
      if (item.product_id === productId) {
        return {
          ...item,
          discount: discountAmount,
          total: (item.quantity * item.unit_price) - discountAmount
        };
      }
      return item;
    }));
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    if (confirm('Clear all items from cart?')) {
      setCart([]);
    }
  };

  const parkSale = async () => {
    if (cart.length === 0) {
      alert('Cart is empty!');
      return;
    }

    try {
      const response = await fetch('/api/pos/cart/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cashierId,
          items: cart,
          customerInfo: customerInfo.name ? customerInfo : undefined
        })
      });

      if (response.ok) {
        alert('Sale parked successfully!');
        setCart([]);
        setCustomerInfo({ name: '', phone: '', email: '' });
      }
    } catch (error) {
      alert('Failed to park sale');
    }
  };

  const handleBarcodeScan = async (barcode: string) => {
    try {
      const response = await fetch('/api/inventory/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode })
      });

      const data = await response.json();
      if (data.success && data.product) {
        addToCart(data.product);
      } else {
        alert('Product not found!');
      }
    } catch (error) {
      alert('Scan failed');
    }
  };

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const totalDiscount = cart.reduce((sum, item) => sum + (item.discount || 0), 0);
  const tax = (subtotal - totalDiscount) * 0.16; // 16% VAT
  const total = subtotal + tax - totalDiscount;

  return (
    <div className="h-screen flex bg-gray-100">
      {/* Left Side - Product Search & Cart */}
      <div className="flex-1 flex flex-col">
        {/* Search Bar */}
        <div className="bg-white border-b p-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search products by name or SKU... (F2)"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <button
              onClick={() => setShowScanner(true)}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2"
            >
              <Barcode size={20} />
              Scan
            </button>
          </div>

          {/* Search Results Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute z-10 mt-2 w-full max-w-2xl bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
              {searchResults.map((product) => (
                <div
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="p-4 hover:bg-gray-50 cursor-pointer border-b"
                >
                  <div className="flex justify-between">
                    <div>
                      <p className="font-semibold">{product.name}</p>
                      <p className="text-sm text-gray-600">SKU: {product.sku}</p>
                      <p className="text-sm text-gray-600">Stock: {product.stock_quantity}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-teal-600">
                        KES {product.selling_price.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto bg-white">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <ShoppingCart size={64} className="mb-4" />
              <p className="text-xl">Cart is empty</p>
              <p className="text-sm">Scan or search for products to add</p>
            </div>
          ) : (
            <div className="divide-y">
              {cart.map((item) => (
                <div key={item.product_id} className="p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-sm text-gray-600">SKU: {item.sku}</p>
                      <p className="text-sm text-gray-600">
                        KES {item.unit_price.toLocaleString()} each
                      </p>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.product_id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    {/* Quantity Controls */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                        className="p-1 bg-gray-200 rounded hover:bg-gray-300"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="w-12 text-center font-semibold">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                        className="p-1 bg-gray-200 rounded hover:bg-gray-300"
                      >
                        <Plus size={16} />
                      </button>
                    </div>

                    {/* Item Total */}
                    <div className="text-right">
                      <p className="text-lg font-bold">
                        KES {item.total.toLocaleString()}
                      </p>
                      {item.discount && item.discount > 0 && (
                        <p className="text-sm text-red-600">
                          -KES {item.discount.toLocaleString()} discount
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Discount Input */}
                  <div className="mt-2">
                    <input
                      type="number"
                      placeholder="Discount amount"
                      value={item.discount || ''}
                      onChange={(e) => applyDiscount(item.product_id, parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-1 text-sm border border-gray-300 rounded"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart Actions */}
        <div className="bg-white border-t p-4">
          <div className="flex gap-2">
            <button
              onClick={clearCart}
              className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
            >
              <X size={18} />
              Clear
            </button>
            <button
              onClick={parkSale}
              className="flex-1 py-2 border border-teal-600 text-teal-600 rounded-lg hover:bg-teal-50 flex items-center justify-center gap-2"
            >
              <Save size={18} />
              Park
            </button>
          </div>
        </div>
      </div>

      {/* Right Side - Totals & Payment */}
      <div className="w-96 bg-white border-l flex flex-col">
        {/* Customer Info */}
        <div className="p-4 border-b">
          <h3 className="font-semibold mb-3">Customer (Optional)</h3>
          <input
            type="text"
            placeholder="Name"
            value={customerInfo.name}
            onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
            className="w-full px-3 py-2 mb-2 border border-gray-300 rounded-lg"
          />
          <input
            type="tel"
            placeholder="Phone"
            value={customerInfo.phone}
            onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        {/* Totals */}
        <div className="flex-1 p-4">
          <div className="space-y-3 text-lg">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-semibold">KES {subtotal.toLocaleString()}</span>
            </div>

            {totalDiscount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Discount:</span>
                <span className="font-semibold">-KES {totalDiscount.toLocaleString()}</span>
              </div>
            )}

            <div className="flex justify-between">
              <span className="text-gray-600">Tax (16%):</span>
              <span className="font-semibold">KES {tax.toLocaleString()}</span>
            </div>

            <div className="border-t-2 border-gray-300 pt-3"></div>

            <div className="flex justify-between text-2xl">
              <span className="font-bold">TOTAL:</span>
              <span className="font-bold text-teal-600">
                KES {total.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Payment Button */}
        <div className="p-4 border-t">
          <button
            onClick={() => setShowPayment(true)}
            disabled={cart.length === 0}
            className="w-full py-4 bg-teal-600 text-white text-xl font-semibold rounded-lg hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <DollarSign size={24} />
            Charge KES {total.toLocaleString()}
          </button>
        </div>
      </div>

      {/* Modals */}
      {showScanner && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      {showPayment && (
        <PaymentModal
          total={total}
          items={cart}
          customerInfo={customerInfo}
          sessionId={sessionId}
          sellerId={sellerId}
          cashierId={cashierId}
          onSuccess={() => {
            setCart([]);
            setCustomerInfo({ name: '', phone: '', email: '' });
            setShowPayment(false);
          }}
          onClose={() => setShowPayment(false)}
        />
      )}
    </div>
  );
}
```

---

### **2. Payment Modal**

**File: `components/PaymentModal.tsx`**

```typescript
import React, { useState } from 'react';
import { CreditCard, Smartphone, DollarSign, SplitSquare, X, Loader2 } from 'lucide-react';

interface PaymentModalProps {
  total: number;
  items: any[];
  customerInfo: any;
  sessionId: string;
  sellerId: string;
  cashierId: string;
  onSuccess: () => void;
  onClose: () => void;
}

export function PaymentModal({
  total,
  items,
  customerInfo,
  sessionId,
  sellerId,
  cashierId,
  onSuccess,
  onClose
}: PaymentModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mpesa' | 'card' | 'split'>('cash');
  const [loading, setLoading] = useState(false);

  // Cash payment state
  const [amountTendered, setAmountTendered] = useState<number>(total);
  const change = amountTendered - total;

  // M-Pesa payment state
  const [mpesaPhone, setMpesaPhone] = useState(customerInfo.phone || '');
  const [mpesaCode, setMpesaCode] = useState('');

  // Split payment state
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [mpesaAmount, setMpesaAmount] = useState<number>(0);
  const [cardAmount, setCardAmount] = useState<number>(0);
  const splitTotal = cashAmount + mpesaAmount + cardAmount;
  const splitRemaining = total - splitTotal;

  const quickAmounts = [
    { label: 'Exact', value: total },
    { label: `${Math.ceil(total / 100) * 100}`, value: Math.ceil(total / 100) * 100 },
    { label: `${Math.ceil(total / 500) * 500}`, value: Math.ceil(total / 500) * 500 },
    { label: `${Math.ceil(total / 1000) * 1000}`, value: Math.ceil(total / 1000) * 1000 }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let paymentDetails: any = { method: paymentMethod };

      if (paymentMethod === 'cash') {
        if (amountTendered < total) {
          alert('Insufficient amount!');
          setLoading(false);
          return;
        }
        paymentDetails.amount_tendered = amountTendered;
        paymentDetails.change_given = change;
        paymentDetails.cash_amount = total;

      } else if (paymentMethod === 'mpesa') {
        if (!mpesaCode) {
          alert('Please enter M-Pesa code!');
          setLoading(false);
          return;
        }
        paymentDetails.mpesa_code = mpesaCode;
        paymentDetails.mpesa_amount = total;

      } else if (paymentMethod === 'card') {
        // Card payment integration would go here
        paymentDetails.card_amount = total;

      } else if (paymentMethod === 'split') {
        if (Math.abs(splitRemaining) > 0.01) {
          alert(`Remaining: KES ${splitRemaining.toFixed(2)}`);
          setLoading(false);
          return;
        }
        paymentDetails.cash_amount = cashAmount;
        paymentDetails.mpesa_amount = mpesaAmount;
        paymentDetails.mpesa_code = mpesaAmount > 0 ? mpesaCode : undefined;
        paymentDetails.card_amount = cardAmount;
      }

      // Process sale
      const response = await fetch('/api/pos/sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          sellerId,
          cashierId,
          items,
          paymentDetails,
          customerInfo: customerInfo.name ? customerInfo : undefined
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Print/show receipt
        if (data.receipt) {
          window.open(data.receipt.pdfUrl, '_blank');
        }
        
        onSuccess();
      } else {
        alert(data.error || 'Payment failed');
      }

    } catch (error) {
      alert('Payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Payment</h2>
              <p className="text-3xl font-bold text-teal-600 mt-1">
                KES {total.toLocaleString()}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X size={24} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* Payment Method Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select Payment Method
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`p-4 border-2 rounded-lg flex items-center gap-3 ${
                  paymentMethod === 'cash'
                    ? 'border-teal-600 bg-teal-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <DollarSign size={24} />
                <span className="font-semibold">Cash</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('mpesa')}
                className={`p-4 border-2 rounded-lg flex items-center gap-3 ${
                  paymentMethod === 'mpesa'
                    ? 'border-teal-600 bg-teal-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <Smartphone size={24} />
                <span className="font-semibold">M-Pesa</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`p-4 border-2 rounded-lg flex items-center gap-3 ${
                  paymentMethod === 'card'
                    ? 'border-teal-600 bg-teal-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <CreditCard size={24} />
                <span className="font-semibold">Card</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('split')}
                className={`p-4 border-2 rounded-lg flex items-center gap-3 ${
                  paymentMethod === 'split'
                    ? 'border-teal-600 bg-teal-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <SplitSquare size={24} />
                <span className="font-semibold">Split</span>
              </button>
            </div>
          </div>

          {/* Cash Payment */}
          {paymentMethod === 'cash' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount Tendered
                </label>
                <input
                  type="number"
                  value={amountTendered}
                  onChange={(e) => setAmountTendered(parseFloat(e.target.value) || 0)}
                  step="0.01"
                  className="w-full px-4 py-3 text-2xl border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  autoFocus
                />
              </div>

              {/* Quick Amount Buttons */}
              <div className="grid grid-cols-4 gap-2">
                {quickAmounts.map((amt) => (
                  <button
                    key={amt.value}
                    type="button"
                    onClick={() => setAmountTendered(amt.value)}
                    className="py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 font-semibold"
                  >
                    {amt.label}
                  </button>
                ))}
              </div>

              {/* Change Display */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Change:</span>
                  <span className={`text-3xl font-bold ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    KES {Math.max(0, change).toLocaleString()}
                  </span>
                </div>
                {change < 0 && (
                  <p className="text-sm text-red-600 mt-2">
                    Insufficient! Need KES {Math.abs(change).toLocaleString()} more
                  </p>
                )}
              </div>
            </div>
          )}

          {/* M-Pesa Payment */}
          {paymentMethod === 'mpesa' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer Phone Number
                </label>
                <input
                  type="tel"
                  value={mpesaPhone}
                  onChange={(e) => setMpesaPhone(e.target.value)}
                  placeholder="254712345678"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  M-Pesa Transaction Code
                </label>
                <input
                  type="text"
                  value={mpesaCode}
                  onChange={(e) => setMpesaCode(e.target.value.toUpperCase())}
                  placeholder="QGH7XYZ123"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 uppercase"
                  required
                  autoFocus
                />
                <p className="text-sm text-gray-500 mt-1">
                  Ask customer for the M-Pesa code they received
                </p>
              </div>
            </div>
          )}

          {/* Card Payment */}
          {paymentMethod === 'card' && (
            <div className="p-4 bg-blue-50 rounded-lg text-center">
              <CreditCard size={48} className="mx-auto mb-3 text-blue-600" />
              <p className="font-semibold mb-2">Insert or Tap Card</p>
              <p className="text-sm text-gray-600">Card terminal integration coming soon</p>
            </div>
          )}

          {/* Split Payment */}
          {paymentMethod === 'split' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cash Amount
                </label>
                <input
                  type="number"
                  value={cashAmount || ''}
                  onChange={(e) => setCashAmount(parseFloat(e.target.value) || 0)}
                  step="0.01"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  M-Pesa Amount
                </label>
                <input
                  type="number"
                  value={mpesaAmount || ''}
                  onChange={(e) => setMpesaAmount(parseFloat(e.target.value) || 0)}
                  step="0.01"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
                {mpesaAmount > 0 && (
                  <input
                    type="text"
                    value={mpesaCode}
                    onChange={(e) => setMpesaCode(e.target.value.toUpperCase())}
                    placeholder="M-Pesa Code"
                    className="w-full px-4 py-2 mt-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 uppercase"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Card Amount
                </label>
                <input
                  type="number"
                  value={cardAmount || ''}
                  onChange={(e) => setCardAmount(parseFloat(e.target.value) || 0)}
                  step="0.01"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Split Total */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between mb-2">
                  <span>Total Entered:</span>
                  <span className="font-semibold">KES {splitTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Remaining:</span>
                  <span className={splitRemaining > 0 ? 'text-red-600' : 'text-green-600'}>
                    KES {Math.abs(splitRemaining).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Complete Sale
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

---

**Due to length, I'll create the remaining components in a Part 3 file. Should I continue with:**

- Session Management (Start/Close Shift)
- Parked Sales List
- End of Day Report
- Keyboard Shortcuts
- Offline Mode Implementation
- Testing & Deployment Guide

**Type "continue" and I'll finish Feature 3!** 🚀

