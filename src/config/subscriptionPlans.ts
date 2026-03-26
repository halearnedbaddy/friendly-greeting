/**
 * PayLoom Subscription Plans Configuration
 * New model: Flat monthly fees, NO transaction fees, 4 tiers
 */

export interface PlanFeature {
  text: string;
  included: boolean;
}

export interface SubscriptionPlan {
  id: 'free' | 'seller' | 'business' | 'enterprise';
  name: string;
  tagline: string;
  icon: string;
  monthlyPrice: number;
  annualPrice: number;
  currency: string;
  productLimit: number | null; // null = unlimited
  features: PlanFeature[];
  popular?: boolean;
  bestValue?: boolean;
  customPricing?: boolean;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free Starter',
    tagline: 'Forever Free',
    icon: '🆓',
    monthlyPrice: 0,
    annualPrice: 0,
    currency: 'KES',
    productLimit: 20,
    features: [
      { text: '20 products', included: true },
      { text: 'M-Pesa + card payments', included: true },
      { text: 'Custom branding included', included: true },
      { text: 'Order management + SMS alerts', included: true },
      { text: 'Basic sales dashboard', included: true },
      { text: 'Community support', included: true },
      { text: 'No transaction fees — ever', included: true },
      { text: 'Discount codes & promos', included: false },
      { text: 'Email & SMS marketing', included: false },
    ],
  },
  {
    id: 'seller',
    name: 'Seller',
    tagline: 'Most Popular',
    icon: '💼',
    monthlyPrice: 899,
    annualPrice: 8990,
    currency: 'KES',
    productLimit: 100,
    popular: true,
    features: [
      { text: '100 products', included: true },
      { text: 'Advanced analytics & insights', included: true },
      { text: 'Discount codes & promos', included: true },
      { text: 'Email & SMS marketing (500/mo)', included: true },
      { text: 'Priority 24hr support', included: true },
      { text: 'No transaction fees — flat fee only', included: true },
      { text: 'Custom domain', included: false },
      { text: 'Team accounts', included: false },
      { text: 'API access', included: false },
    ],
  },
  {
    id: 'business',
    name: 'Business',
    tagline: 'Best Value',
    icon: '🚀',
    monthlyPrice: 2499,
    annualPrice: 24990,
    currency: 'KES',
    productLimit: null,
    bestValue: true,
    features: [
      { text: 'Unlimited products', included: true },
      { text: 'Custom domain (yourstore.co.ke)', included: true },
      { text: 'Team accounts (up to 3 staff)', included: true },
      { text: 'Inventory management', included: true },
      { text: 'White-label (no PayLoom branding)', included: true },
      { text: 'Financial reports & tax tools', included: true },
      { text: 'No transaction fees — flat fee only', included: true },
      { text: 'API access', included: false },
      { text: 'Dedicated account manager', included: false },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Custom Pricing',
    icon: '🏢',
    monthlyPrice: 0,
    annualPrice: 0,
    currency: 'KES',
    productLimit: null,
    customPricing: true,
    features: [
      { text: 'All Business features', included: true },
      { text: 'API access for integrations', included: true },
      { text: 'Dedicated account manager', included: true },
      { text: 'SLA guarantees', included: true },
      { text: 'Custom integrations (ERP, QuickBooks)', included: true },
      { text: 'Unlimited team accounts', included: true },
      { text: 'No transaction fees — negotiated contract', included: true },
    ],
  },
];

export function getPlanById(id: string): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find(p => p.id === id);
}

export function getNextPlan(currentPlanId: string): SubscriptionPlan | undefined {
  const idx = SUBSCRIPTION_PLANS.findIndex(p => p.id === currentPlanId);
  if (idx < SUBSCRIPTION_PLANS.length - 1) {
    return SUBSCRIPTION_PLANS[idx + 1];
  }
  return undefined;
}

export function getAnnualSavings(plan: SubscriptionPlan): number {
  if (plan.customPricing) return 0;
  return (plan.monthlyPrice * 12) - plan.annualPrice;
}

/** Store sidebar tier: free < seller < business < enterprise */
export type StorePlanTier = 'free' | 'seller' | 'business' | 'enterprise';

/** Maps subscription plan to store tier level. */
const tierLevel: Record<StorePlanTier, number> = {
  free: 0,
  seller: 1,
  business: 2,
  enterprise: 3,
};

/** Returns true if user's plan can access a feature requiring the given store tier. */
export function canAccessStoreFeature(
  requiredTier: StorePlanTier | undefined,
  userPlanId: string
): boolean {
  if (!requiredTier || requiredTier === 'free') return true;
  const userTierLevel = tierLevel[userPlanId as StorePlanTier] ?? 0;
  return userTierLevel >= tierLevel[requiredTier];
}
