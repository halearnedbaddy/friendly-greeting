/**
 * Global Payment Providers Configuration
 * Multi-country support for payout methods
 */

export interface PaymentProvider {
  name: string;
  type: 'MOBILE_MONEY' | 'BANK_TRANSFER' | 'DIGITAL_WALLET';
  validation?: {
    regex?: string;
    length?: [number, number];
  };
  fields: string[];
  format?: string;
}

export interface CountryConfig {
  currency: string;
  currencySymbol: string;
  providers: PaymentProvider[];
}

export const GLOBAL_PAYMENT_PROVIDERS: Record<string, CountryConfig> = {
  // East Africa - Mobile Money
  'KE': {
    currency: 'KES',
    currencySymbol: 'KSh',
    providers: [
      {
        name: 'M-Pesa',
        type: 'MOBILE_MONEY',
        validation: { regex: '^(254|\\+254|0)?[17]\\d{8}$', length: [10, 13] },
        fields: ['phone_number', 'account_name'],
        format: '+254XXXXXXXXX'
      },
      {
        name: 'Airtel Money',
        type: 'MOBILE_MONEY',
        validation: { regex: '^(254|\\+254|0)?[17]\\d{8}$', length: [10, 13] },
        fields: ['phone_number', 'account_name'],
        format: '+254XXXXXXXXX'
      },
      {
        name: 'T-Kash',
        type: 'MOBILE_MONEY',
        validation: { regex: '^(254|\\+254|0)?[17]\\d{8}$', length: [10, 13] },
        fields: ['phone_number', 'account_name'],
        format: '+254XXXXXXXXX'
      }
    ]
  },
  'TZ': {
    currency: 'TZS',
    currencySymbol: 'TSh',
    providers: [
      {
        name: 'M-Pesa',
        type: 'MOBILE_MONEY',
        validation: { regex: '^(255|\\+255|0)?[67]\\d{8}$', length: [10, 13] },
        fields: ['phone_number', 'account_name'],
        format: '+255XXXXXXXXX'
      },
      {
        name: 'Tigo Pesa',
        type: 'MOBILE_MONEY',
        validation: { regex: '^(255|\\+255|0)?[67]\\d{8}$', length: [10, 13] },
        fields: ['phone_number', 'account_name'],
        format: '+255XXXXXXXXX'
      },
      {
        name: 'Airtel Money',
        type: 'MOBILE_MONEY',
        validation: { regex: '^(255|\\+255|0)?[67]\\d{8}$', length: [10, 13] },
        fields: ['phone_number', 'account_name'],
        format: '+255XXXXXXXXX'
      },
      {
        name: 'Halopesa',
        type: 'MOBILE_MONEY',
        validation: { regex: '^(255|\\+255|0)?[67]\\d{8}$', length: [10, 13] },
        fields: ['phone_number', 'account_name'],
        format: '+255XXXXXXXXX'
      }
    ]
  },
  'UG': {
    currency: 'UGX',
    currencySymbol: 'USh',
    providers: [
      {
        name: 'MTN Mobile Money',
        type: 'MOBILE_MONEY',
        validation: { regex: '^(256|\\+256|0)?[37]\\d{8}$', length: [10, 13] },
        fields: ['phone_number', 'account_name'],
        format: '+256XXXXXXXXX'
      },
      {
        name: 'Airtel Money',
        type: 'MOBILE_MONEY',
        validation: { regex: '^(256|\\+256|0)?[37]\\d{8}$', length: [10, 13] },
        fields: ['phone_number', 'account_name'],
        format: '+256XXXXXXXXX'
      }
    ]
  },
  'RW': {
    currency: 'RWF',
    currencySymbol: 'FRw',
    providers: [
      {
        name: 'MTN Mobile Money',
        type: 'MOBILE_MONEY',
        validation: { regex: '^(250|\\+250|0)?[78]\\d{8}$', length: [10, 13] },
        fields: ['phone_number', 'account_name'],
        format: '+250XXXXXXXXX'
      },
      {
        name: 'Airtel Money',
        type: 'MOBILE_MONEY',
        validation: { regex: '^(250|\\+250|0)?[78]\\d{8}$', length: [10, 13] },
        fields: ['phone_number', 'account_name'],
        format: '+250XXXXXXXXX'
      }
    ]
  },

  // West Africa
  'NG': {
    currency: 'NGN',
    currencySymbol: '₦',
    providers: [
      {
        name: 'Bank Transfer',
        type: 'BANK_TRANSFER',
        validation: { length: [10, 10] },
        fields: ['account_number', 'account_name', 'bank_name']
      },
      {
        name: 'Paystack',
        type: 'DIGITAL_WALLET',
        fields: ['email', 'account_name']
      },
      {
        name: 'Flutterwave',
        type: 'DIGITAL_WALLET',
        fields: ['email', 'account_name']
      }
    ]
  },
  'GH': {
    currency: 'GHS',
    currencySymbol: 'GH₵',
    providers: [
      {
        name: 'MTN Mobile Money',
        type: 'MOBILE_MONEY',
        validation: { regex: '^(233|\\+233|0)?[25]\\d{8}$', length: [10, 13] },
        fields: ['phone_number', 'account_name'],
        format: '+233XXXXXXXXX'
      },
      {
        name: 'Vodafone Cash',
        type: 'MOBILE_MONEY',
        validation: { regex: '^(233|\\+233|0)?[25]\\d{8}$', length: [10, 13] },
        fields: ['phone_number', 'account_name'],
        format: '+233XXXXXXXXX'
      },
      {
        name: 'AirtelTigo Money',
        type: 'MOBILE_MONEY',
        validation: { regex: '^(233|\\+233|0)?[25]\\d{8}$', length: [10, 13] },
        fields: ['phone_number', 'account_name'],
        format: '+233XXXXXXXXX'
      }
    ]
  },

  // North America & Europe
  'US': {
    currency: 'USD',
    currencySymbol: '$',
    providers: [
      {
        name: 'ACH Transfer',
        type: 'BANK_TRANSFER',
        fields: ['routing_number', 'account_number', 'account_name', 'account_type']
      },
      {
        name: 'PayPal',
        type: 'DIGITAL_WALLET',
        validation: { regex: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' },
        fields: ['email', 'account_name']
      },
      {
        name: 'Stripe',
        type: 'DIGITAL_WALLET',
        fields: ['email', 'account_name']
      }
    ]
  },
  'GB': {
    currency: 'GBP',
    currencySymbol: '£',
    providers: [
      {
        name: 'Bank Transfer',
        type: 'BANK_TRANSFER',
        fields: ['sort_code', 'account_number', 'account_name']
      },
      {
        name: 'PayPal',
        type: 'DIGITAL_WALLET',
        validation: { regex: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' },
        fields: ['email', 'account_name']
      }
    ]
  },

  // Asia
  'IN': {
    currency: 'INR',
    currencySymbol: '₹',
    providers: [
      {
        name: 'UPI',
        type: 'DIGITAL_WALLET',
        validation: { regex: '^[\\w.-]+@[\\w.-]+$' },
        fields: ['upi_id', 'account_name'],
        format: 'yourname@upi'
      },
      {
        name: 'Bank Transfer',
        type: 'BANK_TRANSFER',
        fields: ['account_number', 'ifsc_code', 'account_name']
      },
      {
        name: 'Paytm',
        type: 'DIGITAL_WALLET',
        validation: { regex: '^[6-9]\\d{9}$' },
        fields: ['phone_number', 'account_name']
      }
    ]
  },
  'PH': {
    currency: 'PHP',
    currencySymbol: '₱',
    providers: [
      {
        name: 'GCash',
        type: 'DIGITAL_WALLET',
        validation: { regex: '^(63|\\+63|0)?9\\d{9}$', length: [10, 13] },
        fields: ['phone_number', 'account_name'],
        format: '+639XXXXXXXXX'
      },
      {
        name: 'PayMaya',
        type: 'DIGITAL_WALLET',
        validation: { regex: '^(63|\\+63|0)?9\\d{9}$', length: [10, 13] },
        fields: ['phone_number', 'account_name'],
        format: '+639XXXXXXXXX'
      },
      {
        name: 'Bank Transfer',
        type: 'BANK_TRANSFER',
        fields: ['account_number', 'account_name', 'bank_name']
      }
    ]
  },

  // Southern Africa
  'ZA': {
    currency: 'ZAR',
    currencySymbol: 'R',
    providers: [
      {
        name: 'Bank Transfer',
        type: 'BANK_TRANSFER',
        fields: ['account_number', 'account_name', 'bank_name', 'branch_code']
      },
      {
        name: 'PayFast',
        type: 'DIGITAL_WALLET',
        fields: ['email', 'account_name']
      }
    ]
  }
};

/**
 * Get providers for a specific country
 */
export function getProvidersForCountry(countryCode: string): CountryConfig | null {
  return GLOBAL_PAYMENT_PROVIDERS[countryCode.toUpperCase()] || null;
}

/**
 * Get all supported countries
 */
export function getSupportedCountries(): string[] {
  return Object.keys(GLOBAL_PAYMENT_PROVIDERS);
}

/**
 * Validate payment identifier based on provider validation rules
 */
export function validatePaymentIdentifier(
  countryCode: string,
  providerName: string,
  identifier: string
): { valid: boolean; error?: string } {
  const countryConfig = GLOBAL_PAYMENT_PROVIDERS[countryCode];
  if (!countryConfig) {
    return { valid: false, error: `Country ${countryCode} not supported` };
  }

  const provider = countryConfig.providers.find(p => p.name === providerName);
  if (!provider) {
    return { valid: false, error: `Provider ${providerName} not available in ${countryCode}` };
  }

  if (provider.validation?.regex) {
    const regex = new RegExp(provider.validation.regex);
    if (!regex.test(identifier)) {
      return { 
        valid: false, 
        error: `Invalid format. Expected: ${provider.format || 'valid format'}` 
      };
    }
  }

  if (provider.validation?.length) {
    const [min, max] = provider.validation.length;
    if (identifier.length < min || identifier.length > max) {
      return { 
        valid: false, 
        error: `Length must be between ${min} and ${max} characters` 
      };
    }
  }

  return { valid: true };
}

/**
 * Convert frontend type to database enum value
 */
export function toDbPaymentMethodType(type: string): 'mobile_money' | 'bank_account' {
  const upperType = type.toUpperCase();
  if (upperType === 'MOBILE_MONEY' || upperType === 'DIGITAL_WALLET') {
    return 'mobile_money';
  }
  return 'bank_account';
}
