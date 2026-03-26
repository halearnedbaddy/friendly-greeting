import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

interface PaymentMethodOption {
  id: string;
  type: 'mpesa';
  name: string;
  description: string;
  icon: React.ReactNode;
  details?: Record<string, string>;
}

interface PaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: (method: PaymentMethodOption) => void;
  onBack: () => void;
  product: {
    name: string;
    price: number;
    currency?: string;
    image?: string;
  };
  methods?: PaymentMethodOption[];
}

const defaultMethods: PaymentMethodOption[] = [
  {
    id: 'mpesa-paybill',
    type: 'mpesa',
    name: 'Pay via M-Pesa Paybill',
    description: 'Paybill 522522 • Account 1348763280',
    icon: (
      <div className="w-11 h-11 rounded-[10px] flex items-center justify-center font-bold text-xl shrink-0" style={{ background: '#d4f4dd', color: '#00a86b' }}>
        M-P
      </div>
    ),
  },
];

export function PaymentMethodModal({
  isOpen,
  onClose,
  onContinue,
  onBack,
  product,
  methods = defaultMethods,
}: PaymentMethodModalProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  // Reset selection when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelected(null);
      setIsClosing(false);
    }
  }, [isOpen]);

  // Keyboard handling
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  };

  const handleContinue = () => {
    const method = methods.find((m) => m.id === selected);
    if (method) onContinue(method);
  };

  const formatPrice = (price: number) => {
    return `Ksh ${price.toLocaleString()}`;
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-modal-title"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={`relative bg-white rounded-2xl w-full max-w-[480px] shadow-[0_20px_60px_rgba(0,0,0,0.3)] overflow-hidden ${
          isClosing
            ? 'animate-[slideDown_0.2s_ease-in_forwards]'
            : 'animate-[slideUp_0.3s_cubic-bezier(0.16,1,0.3,1)]'
        }`}
        style={{ maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-5 border-b" style={{ borderColor: '#e8e8e8' }}>
          <h2
            id="payment-modal-title"
            className="text-lg font-bold"
            style={{ color: '#1a1a1a' }}
          >
            Choose Payment Method
          </h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-200"
            style={{ background: '#f5f5f5', color: '#666' }}
            aria-label="Close payment modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Product Summary */}
        <div
          className="flex items-center gap-3.5 px-6 py-5 border-b"
          style={{ background: '#f9f9f9', borderColor: '#e8e8e8' }}
        >
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              className="w-[60px] h-[60px] rounded-[10px] object-cover shrink-0"
            />
          ) : (
            <div
              className="w-[60px] h-[60px] rounded-[10px] shrink-0 flex items-center justify-center text-2xl"
              style={{ background: '#e0e0e0' }}
            >
              📦
            </div>
          )}
          <div>
            <p className="text-[15px] font-semibold mb-1" style={{ color: '#1a1a1a' }}>
              {product.name}
            </p>
            <p className="text-xl font-bold" style={{ color: '#2d1b69' }}>
              {formatPrice(product.price)}
            </p>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="px-6 py-6 space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 280px)' }}>
          {methods.map((method) => {
            const isSelected = selected === method.id;
            return (
              <label
                key={method.id}
                className={`flex items-center gap-4 p-[18px] rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? 'border-[#2d1b69] bg-[#f5f3fb]'
                    : 'border-[#e8e8e8] hover:border-[#d0d0d0] hover:bg-[#fafafa]'
                }`}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelected(method.id);
                  }
                }}
              >
                {/* Custom Radio */}
                <div
                  className={`w-[22px] h-[22px] rounded-full border-2 shrink-0 transition-all duration-200 flex items-center justify-center ${
                    isSelected ? 'border-[#2d1b69]' : 'border-[#d0d0d0]'
                  }`}
                >
                  {isSelected && (
                    <div className="w-3 h-3 rounded-full bg-[#2d1b69]" />
                  )}
                </div>
                <input
                  type="radio"
                  name="payment-method"
                  value={method.id}
                  checked={isSelected}
                  onChange={() => setSelected(method.id)}
                  className="sr-only"
                  aria-label={method.name}
                />

                {/* Icon */}
                {method.icon}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold mb-1" style={{ color: '#1a1a1a' }}>
                    {method.name}
                  </p>
                  <p className="text-[13px] leading-snug" style={{ color: '#666' }}>
                    {method.description}
                  </p>
                </div>
              </label>
            );
          })}
        </div>

        {/* Actions */}
        <div
          className="flex gap-3 px-6 pt-5 pb-6 border-t"
          style={{ borderColor: '#e8e8e8' }}
        >
          <button
            onClick={onBack}
            className="flex-1 h-12 rounded-[10px] text-[15px] font-semibold transition-colors"
            style={{ background: '#f5f5f5', color: '#666' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#e8e8e8';
              e.currentTarget.style.color = '#333';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#f5f5f5';
              e.currentTarget.style.color = '#666';
            }}
          >
            Back
          </button>
          <button
            onClick={handleContinue}
            disabled={!selected}
            className="flex-1 h-12 rounded-[10px] text-[15px] font-semibold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:shadow-none disabled:transform-none"
            style={{
              background: selected ? '#2d1b69' : '#d0d0d0',
              color: selected ? 'white' : '#999',
              boxShadow: selected ? '0 4px 16px rgba(45, 27, 105, 0.25)' : 'none',
            }}
            onMouseEnter={(e) => {
              if (selected) {
                e.currentTarget.style.background = '#23154f';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(45, 27, 105, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              if (selected) {
                e.currentTarget.style.background = '#2d1b69';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(45, 27, 105, 0.25)';
              }
            }}
          >
            Continue
          </button>
        </div>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideDown {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(30px); }
        }
        @media (max-width: 520px) {
          [role="dialog"] > div:nth-child(2) {
            border-radius: 20px 20px 0 0 !important;
            align-self: flex-end;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
}
