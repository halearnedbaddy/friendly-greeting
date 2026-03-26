import { useState } from 'react';
import { X, Minus, Plus, ShoppingCart, Trash2, Loader2 } from 'lucide-react';
import { useCart, CartItem } from '@/hooks/useCart';
import { useCurrency } from '@/hooks/useCurrency';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  storeSlug: string;
  onPlaceOrder: (items: CartItem[], buyerDetails: BuyerDetails) => Promise<void>;
}

export interface BuyerDetails {
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

export function CartDrawer({ isOpen, onClose, storeSlug: _storeSlug, onPlaceOrder }: CartDrawerProps) {
  const { cart, removeFromCart, clearCart, total, addToCart } = useCart();
  const { formatPrice } = useCurrency();
  const [step, setStep] = useState<'cart' | 'details'>('cart');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buyerDetails, setBuyerDetails] = useState<BuyerDetails>({
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  });

  const storeItems = cart;

  const updateQuantity = (item: CartItem, delta: number) => {
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      removeFromCart(item.id);
    } else {
      removeFromCart(item.id);
      addToCart({ ...item, quantity: newQty });
    }
  };

  const handlePlaceOrder = async () => {
    if (!buyerDetails.name || !buyerDetails.phone) {
      setError('Please fill in your name and phone number');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await onPlaceOrder(storeItems, buyerDetails);
      clearCart();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card h-full overflow-y-auto shadow-2xl animate-in slide-in-from-right">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <ShoppingCart size={20} />
            {step === 'cart' ? `Cart (${storeItems.length})` : 'Checkout Details'}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={24} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {step === 'cart' && (
            <>
              {storeItems.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart size={48} className="mx-auto text-muted-foreground/40 mb-4" />
                  <p className="text-muted-foreground">Your cart is empty</p>
                </div>
              ) : (
                <>
                  {storeItems.map((item) => (
                    <div key={item.id} className="flex gap-3 p-3 bg-muted/30 border border-border rounded-lg">
                      {item.image && (
                        <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded-lg" />
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-foreground text-sm truncate">{item.name}</h4>
                        <p className="text-primary font-bold text-sm">{formatPrice(item.price, 'KES')}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            onClick={() => updateQuantity(item, -1)}
                            className="w-6 h-6 rounded bg-muted flex items-center justify-center hover:bg-muted-foreground/20"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item, 1)}
                            className="w-6 h-6 rounded bg-muted flex items-center justify-center hover:bg-muted-foreground/20"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col items-end justify-between">
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 size={14} />
                        </button>
                        <span className="text-sm font-bold text-foreground">
                          {formatPrice(item.price * item.quantity, 'KES')}
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Subtotal */}
                  <div className="border-t border-border pt-4">
                    <div className="flex justify-between text-sm text-muted-foreground mb-1">
                      <span>Subtotal ({storeItems.reduce((s, i) => s + i.quantity, 0)} items)</span>
                      <span>{formatPrice(total, 'KES')}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold">
                      <span className="text-foreground">Order Total</span>
                      <span className="text-primary">{formatPrice(total, 'KES')}</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={clearCart}
                      className="flex-1 py-3 border border-border rounded-lg text-muted-foreground hover:bg-muted transition text-sm font-medium"
                    >
                      Clear Cart
                    </button>
                    <button
                      onClick={() => setStep('details')}
                      className="flex-1 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition"
                    >
                      Proceed to Checkout
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {step === 'details' && (
            <>
              {/* Order Summary */}
              <div className="bg-muted/30 border border-border rounded-lg p-3 space-y-1 text-sm">
                <p className="font-medium text-foreground">Order Summary</p>
                {storeItems.map(item => (
                  <div key={item.id} className="flex justify-between text-muted-foreground">
                    <span className="flex items-center gap-2">
                      {item.image && <img src={item.image} alt="" className="w-8 h-8 rounded object-cover" />}
                      {item.name} × {item.quantity}
                    </span>
                    <span>{formatPrice(item.price * item.quantity, 'KES')}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold text-foreground border-t border-border pt-1 mt-1">
                  <span>Total</span>
                  <span className="text-primary">{formatPrice(total, 'KES')}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={buyerDetails.name}
                    onChange={(e) => setBuyerDetails(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter your name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    value={buyerDetails.phone}
                    onChange={(e) => setBuyerDetails(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="+254712345678"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Email (optional)</label>
                  <input
                    type="email"
                    value={buyerDetails.email}
                    onChange={(e) => setBuyerDetails(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="your@email.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Delivery Address</label>
                  <textarea
                    value={buyerDetails.address}
                    onChange={(e) => setBuyerDetails(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    rows={2}
                    placeholder="Enter delivery address"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Order Notes (optional)</label>
                  <textarea
                    value={buyerDetails.notes}
                    onChange={(e) => setBuyerDetails(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    rows={2}
                    placeholder="Any special instructions for your order..."
                  />
                </div>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm text-primary">
                <p className="font-semibold mb-1">📦 How it works:</p>
                <ol className="list-decimal pl-4 space-y-1 text-primary/80">
                  <li>Your order will be sent to the seller for review</li>
                  <li>Seller accepts or modifies your order</li>
                  <li>You'll be notified to proceed with payment</li>
                  <li>Pay only after seller confirms — no upfront charge</li>
                </ol>
              </div>

              {error && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setStep('cart'); setError(null); }}
                  className="flex-1 py-3 border border-border rounded-lg text-muted-foreground hover:bg-muted transition font-medium"
                >
                  Back
                </button>
                <button
                  onClick={handlePlaceOrder}
                  disabled={loading}
                  className="flex-1 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><Loader2 size={16} className="animate-spin" /> Placing Order...</>
                  ) : (
                    'Place Order'
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default CartDrawer;
