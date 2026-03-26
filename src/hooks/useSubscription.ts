import { useState, useCallback } from 'react';
import { SUBSCRIPTION_PLANS, getPlanById } from '@/config/subscriptionPlans';

export interface SubscriptionState {
  planId: 'free' | 'seller' | 'business' | 'enterprise';
  status: 'active' | 'trialing' | 'past_due' | 'cancelled';
  billingCycle: 'monthly' | 'annual';
  nextBillingDate: string | null;
  paymentMethod: string | null;
  paymentPhone: string | null;
  trialEndsAt: string | null;
}

export function useSubscription() {
  // In production, this would fetch from Supabase. For now, default to free plan.
  const [subscription, setSubscription] = useState<SubscriptionState>({
    planId: 'free',
    status: 'active',
    billingCycle: 'monthly',
    nextBillingDate: null,
    paymentMethod: null,
    paymentPhone: null,
    trialEndsAt: null,
  });

  const currentPlan = getPlanById(subscription.planId) || SUBSCRIPTION_PLANS[0];

  const canAddProduct = useCallback((currentCount: number) => {
    if (currentPlan.productLimit === null) return true;
    return currentCount < currentPlan.productLimit;
  }, [currentPlan]);

  const getProductUsage = useCallback((currentCount: number) => {
    const limit = currentPlan.productLimit;
    if (limit === null) return { used: currentCount, limit: null, percentage: 0 };
    return {
      used: currentCount,
      limit,
      percentage: Math.min((currentCount / limit) * 100, 100),
    };
  }, [currentPlan]);

  const isNearLimit = useCallback((currentCount: number) => {
    if (currentPlan.productLimit === null) return false;
    return currentCount >= currentPlan.productLimit - 1;
  }, [currentPlan]);

  const isAtLimit = useCallback((currentCount: number) => {
    if (currentPlan.productLimit === null) return false;
    return currentCount >= currentPlan.productLimit;
  }, [currentPlan]);

  const upgradePlan = useCallback(async (planId: string, billingCycle: 'monthly' | 'annual') => {
    // In production, this would initiate M-Pesa STK push via edge function
    // For now, simulate upgrade
    setSubscription(prev => ({
      ...prev,
      planId: planId as 'free' | 'seller' | 'business' | 'enterprise',
      status: 'active',
      billingCycle,
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }));
    return { success: true };
  }, []);

  const startTrial = useCallback(async (planId: string) => {
    setSubscription(prev => ({
      ...prev,
      planId: planId as 'free' | 'seller' | 'business' | 'enterprise',
      status: 'trialing',
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      nextBillingDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    }));
    return { success: true };
  }, []);

  const cancelSubscription = useCallback(async () => {
    setSubscription(prev => ({
      ...prev,
      status: 'cancelled',
    }));
    return { success: true };
  }, []);

  return {
    subscription,
    currentPlan,
    canAddProduct,
    getProductUsage,
    isNearLimit,
    isAtLimit,
    upgradePlan,
    startTrial,
    cancelSubscription,
  };
}
