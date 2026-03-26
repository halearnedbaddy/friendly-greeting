/**
 * Country-specific payment method configurations
 * Supports KE, TZ, UG, RW with dynamic field definitions
 */

export interface FieldDefinition {
  name: string;
  label: string;
  type: 'text' | 'tel' | 'number';
  placeholder: string;
  validation: {
    required: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
  helperText?: string;
}

export interface PaymentMethodDefinition {
  id: string;
  name: string;
  displayName: string;
  provider: string;
  type: 'MOBILE_MONEY' | 'BANK' | 'PAYBILL' | 'TILL';
  icon: string;
  fields: FieldDefinition[];
  instructions: string;
  isPopular: boolean;
}

export interface CountryPaymentConfig {
  countryCode: string;
  countryName: string;
  currency: string;
  currencySymbol: string;
  flag: string;
  phoneFormat: string;
  paymentMethods: PaymentMethodDefinition[];
}

export const KENYA_CONFIG: CountryPaymentConfig = {
  countryCode: 'KE',
  countryName: 'Kenya',
  currency: 'KES',
  currencySymbol: 'KSh',
  flag: '🇰🇪',
  phoneFormat: '+254XXXXXXXXX',
  paymentMethods: [
    {
      id: 'mpesa_paybill_ke',
      name: 'M-Pesa Paybill',
      displayName: 'M-Pesa Paybill (Lipa na M-Pesa)',
      provider: 'Safaricom',
      type: 'PAYBILL',
      icon: '📱',
      isPopular: true,
      fields: [
        {
          name: 'paybill_number',
          label: 'Paybill Number',
          type: 'number',
          placeholder: 'e.g., 247247',
          validation: { required: true, minLength: 5, maxLength: 7, pattern: '^[0-9]+$' },
          helperText: 'Your business paybill number from Safaricom'
        },
        {
          name: 'account_number',
          label: 'Account Number',
          type: 'text',
          placeholder: 'e.g., SHOP001',
          validation: { required: true, minLength: 1, maxLength: 20 },
          helperText: 'Account number customers will use'
        },
        {
          name: 'account_name',
          label: 'Account Name',
          type: 'text',
          placeholder: 'Your Business Name',
          validation: { required: true, minLength: 2, maxLength: 50 }
        }
      ],
      instructions: 'Customers pay via: Lipa na M-Pesa → Paybill → Enter business number & account number.'
    },
    {
      id: 'mpesa_till_ke',
      name: 'M-Pesa Till Number',
      displayName: 'M-Pesa Till (Buy Goods)',
      provider: 'Safaricom',
      type: 'TILL',
      icon: '📱',
      isPopular: true,
      fields: [
        {
          name: 'till_number',
          label: 'Till Number',
          type: 'number',
          placeholder: 'e.g., 123456',
          validation: { required: true, minLength: 5, maxLength: 7, pattern: '^[0-9]+$' },
          helperText: 'Your M-Pesa till number for Buy Goods and Services'
        },
        {
          name: 'account_name',
          label: 'Business Name',
          type: 'text',
          placeholder: 'Your Shop Name',
          validation: { required: true, minLength: 2, maxLength: 50 }
        }
      ],
      instructions: 'Customers pay via: Lipa na M-Pesa → Buy Goods and Services → Enter till number.'
    },
    {
      id: 'mpesa_send_money_ke',
      name: 'M-Pesa Send Money',
      displayName: 'M-Pesa Phone Number',
      provider: 'Safaricom',
      type: 'MOBILE_MONEY',
      icon: '📱',
      isPopular: false,
      fields: [
        {
          name: 'phone_number',
          label: 'M-Pesa Phone Number',
          type: 'tel',
          placeholder: '+254712345678',
          validation: { required: true, pattern: '^\\+254[17]\\d{8}$' },
          helperText: 'Phone number registered with M-Pesa'
        },
        {
          name: 'account_name',
          label: 'Account Holder Name',
          type: 'text',
          placeholder: 'John Doe',
          validation: { required: true, minLength: 2, maxLength: 50 }
        }
      ],
      instructions: 'Customers send money directly to your M-Pesa number.'
    },
    {
      id: 'airtel_money_ke',
      name: 'Airtel Money',
      displayName: 'Airtel Money',
      provider: 'Airtel',
      type: 'MOBILE_MONEY',
      icon: '🔴',
      isPopular: false,
      fields: [
        {
          name: 'phone_number',
          label: 'Airtel Money Phone Number',
          type: 'tel',
          placeholder: '+254732123456',
          validation: { required: true, pattern: '^\\+254[17]\\d{8}$' }
        },
        {
          name: 'account_name',
          label: 'Account Holder Name',
          type: 'text',
          placeholder: 'Jane Doe',
          validation: { required: true }
        }
      ],
      instructions: 'Customers send money to your Airtel Money number.'
    },
    {
      id: 'pochi_la_biashara_ke',
      name: 'Pochi La Biashara',
      displayName: 'Pochi La Biashara (M-Pesa Business Wallet)',
      provider: 'Safaricom',
      type: 'TILL',
      icon: '📱',
      isPopular: true,
      fields: [
        {
          name: 'till_number',
          label: 'Pochi La Biashara Till Number',
          type: 'number',
          placeholder: 'e.g., 567890',
          validation: { required: true, minLength: 5, maxLength: 7 },
          helperText: 'Your Pochi La Biashara till number'
        },
        {
          name: 'account_name',
          label: 'Business Name',
          type: 'text',
          placeholder: 'My Business',
          validation: { required: true }
        }
      ],
      instructions: 'Pochi La Biashara: Lower fees, higher limits. Customers pay via Buy Goods.'
    },
    {
      id: 'bank_transfer_ke',
      name: 'Bank Transfer',
      displayName: 'Bank Transfer',
      provider: 'Bank',
      type: 'BANK',
      icon: '🏦',
      isPopular: false,
      fields: [
        {
          name: 'bank_name',
          label: 'Bank Name',
          type: 'text',
          placeholder: 'e.g., Equity Bank',
          validation: { required: true }
        },
        {
          name: 'account_number',
          label: 'Account Number',
          type: 'text',
          placeholder: 'e.g., 0123456789',
          validation: { required: true }
        },
        {
          name: 'account_name',
          label: 'Account Holder Name',
          type: 'text',
          placeholder: 'e.g., John Doe',
          validation: { required: true }
        },
        {
          name: 'swift_code',
          label: 'Swift Code (Optional)',
          type: 'text',
          placeholder: 'e.g., EABORBI',
          validation: { required: false }
        }
      ],
      instructions: 'Customers transfer money to your bank account.'
    }
  ]
};

export const TANZANIA_CONFIG: CountryPaymentConfig = {
  countryCode: 'TZ',
  countryName: 'Tanzania',
  currency: 'TZS',
  currencySymbol: 'TSh',
  flag: '🇹🇿',
  phoneFormat: '+255XXXXXXXXX',
  paymentMethods: [
    {
      id: 'mpesa_lipa_namba_tz',
      name: 'M-Pesa Lipa Namba',
      displayName: 'Vodacom M-Pesa Lipa Namba',
      provider: 'Vodacom',
      type: 'PAYBILL',
      icon: '📱',
      isPopular: true,
      fields: [
        {
          name: 'business_number',
          label: 'Business Number (Lipa Namba)',
          type: 'number',
          placeholder: 'e.g., 123456',
          validation: { required: true, minLength: 5, maxLength: 7 }
        },
        {
          name: 'account_number',
          label: 'Reference Number',
          type: 'text',
          placeholder: 'e.g., ORDER',
          validation: { required: false },
          helperText: 'Optional reference for customers to use'
        }
      ],
      instructions: 'M-Pesa Lipa Namba for Tanzania businesses.'
    },
    {
      id: 'mpesa_send_tz',
      name: 'M-Pesa Send Money',
      displayName: 'Vodacom M-Pesa Phone',
      provider: 'Vodacom',
      type: 'MOBILE_MONEY',
      icon: '📱',
      isPopular: false,
      fields: [
        {
          name: 'phone_number',
          label: 'M-Pesa Phone Number',
          type: 'tel',
          placeholder: '+255XXXXXXXXX',
          validation: { required: true, pattern: '^\\+255\\d{9}$' }
        },
        {
          name: 'account_name',
          label: 'Account Name',
          type: 'text',
          placeholder: 'Business Name',
          validation: { required: true }
        }
      ],
      instructions: 'Customers send money to your M-Pesa number in Tanzania.'
    },
    {
      id: 'tigopesa_tz',
      name: 'TigoPesa',
      displayName: 'TigoPesa',
      provider: 'Tigo',
      type: 'MOBILE_MONEY',
      icon: '📱',
      isPopular: true,
      fields: [
        {
          name: 'phone_number',
          label: 'TigoPesa Phone Number',
          type: 'tel',
          placeholder: '+255XXXXXXXXX',
          validation: { required: true, pattern: '^\\+255\\d{9}$' }
        },
        {
          name: 'account_name',
          label: 'Account Name',
          type: 'text',
          placeholder: 'Business Name',
          validation: { required: true }
        }
      ],
      instructions: 'TigoPesa mobile money for Tanzania.'
    },
    {
      id: 'airtel_money_tz',
      name: 'Airtel Money',
      displayName: 'Airtel Money Tanzania',
      provider: 'Airtel',
      type: 'MOBILE_MONEY',
      icon: '🔴',
      isPopular: true,
      fields: [
        {
          name: 'phone_number',
          label: 'Airtel Money Number',
          type: 'tel',
          placeholder: '+255XXXXXXXXX',
          validation: { required: true, pattern: '^\\+255\\d{9}$' }
        },
        {
          name: 'account_name',
          label: 'Account Name',
          type: 'text',
          placeholder: 'Business Name',
          validation: { required: true }
        }
      ],
      instructions: 'Airtel Money for Tanzania.'
    }
  ]
};

export const UGANDA_CONFIG: CountryPaymentConfig = {
  countryCode: 'UG',
  countryName: 'Uganda',
  currency: 'UGX',
  currencySymbol: 'USh',
  flag: '🇺🇬',
  phoneFormat: '+256XXXXXXXXX',
  paymentMethods: [
    {
      id: 'mtn_momo_ug',
      name: 'MTN Mobile Money',
      displayName: 'MTN Mobile Money Uganda',
      provider: 'MTN',
      type: 'MOBILE_MONEY',
      icon: '🟡',
      isPopular: true,
      fields: [
        {
          name: 'phone_number',
          label: 'MTN Mobile Money Number',
          type: 'tel',
          placeholder: '+256XXXXXXXXX',
          validation: { required: true, pattern: '^\\+256\\d{9}$' }
        },
        {
          name: 'account_name',
          label: 'Account Name',
          type: 'text',
          placeholder: 'Business Name',
          validation: { required: true }
        }
      ],
      instructions: 'MTN Mobile Money is Uganda\'s most popular mobile money service.'
    },
    {
      id: 'airtel_money_ug',
      name: 'Airtel Money',
      displayName: 'Airtel Money Uganda',
      provider: 'Airtel',
      type: 'MOBILE_MONEY',
      icon: '🔴',
      isPopular: true,
      fields: [
        {
          name: 'phone_number',
          label: 'Airtel Money Number',
          type: 'tel',
          placeholder: '+256XXXXXXXXX',
          validation: { required: true, pattern: '^\\+256\\d{9}$' }
        },
        {
          name: 'account_name',
          label: 'Account Name',
          type: 'text',
          placeholder: 'Business Name',
          validation: { required: true }
        }
      ],
      instructions: 'Airtel Money for Uganda.'
    }
  ]
};

export const RWANDA_CONFIG: CountryPaymentConfig = {
  countryCode: 'RW',
  countryName: 'Rwanda',
  currency: 'RWF',
  currencySymbol: 'FRw',
  flag: '🇷🇼',
  phoneFormat: '+250XXXXXXXXX',
  paymentMethods: [
    {
      id: 'mtn_momo_rw',
      name: 'MTN Mobile Money',
      displayName: 'MTN Mobile Money Rwanda',
      provider: 'MTN',
      type: 'MOBILE_MONEY',
      icon: '🟡',
      isPopular: true,
      fields: [
        {
          name: 'phone_number',
          label: 'MTN Mobile Money Number',
          type: 'tel',
          placeholder: '+250XXXXXXXXX',
          validation: { required: true, pattern: '^\\+250[78]\\d{8}$' }
        },
        {
          name: 'account_name',
          label: 'Account Name',
          type: 'text',
          placeholder: 'Business Name',
          validation: { required: true }
        }
      ],
      instructions: 'MTN Mobile Money for Rwanda.'
    },
    {
      id: 'airtel_money_rw',
      name: 'Airtel Money',
      displayName: 'Airtel Money Rwanda',
      provider: 'Airtel',
      type: 'MOBILE_MONEY',
      icon: '🔴',
      isPopular: true,
      fields: [
        {
          name: 'phone_number',
          label: 'Airtel Money Number',
          type: 'tel',
          placeholder: '+250XXXXXXXXX',
          validation: { required: true, pattern: '^\\+250[78]\\d{8}$' }
        },
        {
          name: 'account_name',
          label: 'Account Name',
          type: 'text',
          placeholder: 'Business Name',
          validation: { required: true }
        }
      ],
      instructions: 'Airtel Money for Rwanda.'
    }
  ]
};

export const COUNTRY_CONFIGS: Record<string, CountryPaymentConfig> = {
  KE: KENYA_CONFIG,
  TZ: TANZANIA_CONFIG,
  UG: UGANDA_CONFIG,
  RW: RWANDA_CONFIG,
};

export function getCountryConfig(countryCode: string): CountryPaymentConfig | null {
  return COUNTRY_CONFIGS[countryCode.toUpperCase()] || null;
}

export function getAllCountries(): CountryPaymentConfig[] {
  return Object.values(COUNTRY_CONFIGS);
}

export function getPaymentMethodById(countryCode: string, methodId: string): PaymentMethodDefinition | null {
  const config = getCountryConfig(countryCode);
  if (!config) return null;
  return config.paymentMethods.find(m => m.id === methodId) || null;
}

/** SMS event types */
export const SMS_EVENTS = {
  DISPUTE_CREATED: 'dispute_created',
  DISPUTE_MESSAGE: 'dispute_message',
  DISPUTE_RESOLVED: 'dispute_resolved',
  DISPUTE_REJECTED: 'dispute_rejected',
  PAYMENT_SUBMITTED: 'payment_submitted',
  PAYMENT_APPROVED: 'payment_approved',
  PAYMENT_REJECTED: 'payment_rejected',
  ORDER_CREATED: 'order_created',
  ORDER_SHIPPED: 'order_shipped',
  ORDER_DELIVERED: 'order_delivered',
} as const;

/** Dispute types */
export const DISPUTE_TYPES = [
  { id: 'payment_not_received', label: 'Payment Not Received', icon: '💸' },
  { id: 'wrong_amount', label: 'Wrong Amount Charged', icon: '💰' },
  { id: 'product_not_received', label: 'Product Not Received', icon: '📦' },
  { id: 'quality_issue', label: 'Product Quality Issue', icon: '⚠️' },
  { id: 'refund_request', label: 'Refund Request', icon: '🔄' },
  { id: 'other', label: 'Other', icon: '❓' },
] as const;
