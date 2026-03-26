/**
 * Transaction Code Validation Utilities
 * Format validation and duplicate detection for manual payment verification
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

/**
 * Validate M-Pesa transaction code format
 * Format: Alphanumeric, 10 characters (e.g., "QGH2KPM123")
 */
export function validateMpesaCode(code: string): ValidationResult {
  const cleaned = code.trim().toUpperCase();
  if (!cleaned) return { valid: false, error: 'Transaction code is required' };
  if (cleaned.length < 8 || cleaned.length > 12) {
    return { valid: false, error: 'M-Pesa code should be 8-12 characters (e.g., SJK7Y6H4TQ)' };
  }
  if (!/^[A-Z0-9]+$/.test(cleaned)) {
    return { valid: false, error: 'M-Pesa code should only contain letters and numbers' };
  }
  // M-Pesa codes typically start with a letter
  if (!/^[A-Z]/.test(cleaned)) {
    return { valid: false, warnings: ['M-Pesa codes usually start with a letter'] };
  }
  return { valid: true };
}

/**
 * Validate Airtel Money transaction code
 * Format: Numeric, 10-13 digits
 */
export function validateAirtelCode(code: string): ValidationResult {
  const cleaned = code.trim();
  if (!cleaned) return { valid: false, error: 'Transaction code is required' };
  if (!/^\d{10,13}$/.test(cleaned)) {
    return { valid: false, error: 'Airtel Money code should be 10-13 digits' };
  }
  return { valid: true };
}

/**
 * Validate any transaction code based on payment method
 */
export function validateTransactionCode(code: string, paymentType?: string): ValidationResult {
  if (!code || !code.trim()) {
    return { valid: false, error: 'Transaction code is required' };
  }

  const cleaned = code.trim().toUpperCase();

  switch (paymentType?.toUpperCase()) {
    case 'AIRTEL_MONEY':
    case 'AIRTEL':
      return validateAirtelCode(cleaned);
    case 'MPESA':
    case 'PAYBILL':
    case 'TILL':
    case 'MPESA_PAYBILL':
    case 'M-PESA':
    default:
      return validateMpesaCode(cleaned);
  }
}

/**
 * Validate payment amount matches expected
 */
export function validateAmount(paid: number, expected: number, tolerance: number = 0): ValidationResult {
  if (paid <= 0) return { valid: false, error: 'Payment amount must be greater than 0' };
  if (expected <= 0) return { valid: false, error: 'Expected amount is invalid' };

  const diff = Math.abs(paid - expected);
  if (diff > tolerance) {
    if (paid < expected) {
      return { valid: false, error: `Underpayment: paid ${paid}, expected ${expected}. Short by ${(expected - paid).toFixed(2)}` };
    }
    return { valid: false, error: `Overpayment: paid ${paid}, expected ${expected}. Over by ${(paid - expected).toFixed(2)}` };
  }
  return { valid: true };
}

/**
 * Validate phone number format
 */
export function validatePhone(phone: string): ValidationResult {
  const cleaned = phone.replace(/[\s-]/g, '');
  if (!cleaned) return { valid: false, error: 'Phone number is required' };
  if (!/^(\+?\d{10,15})$/.test(cleaned)) {
    return { valid: false, error: 'Invalid phone number format' };
  }
  return { valid: true };
}
