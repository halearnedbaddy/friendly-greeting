import { useState } from 'react';
import { CheckIcon, XIcon } from '@/components/icons';
import { SUBSCRIPTION_PLANS, getAnnualSavings, type SubscriptionPlan } from '@/config/subscriptionPlans';

interface PricingPlansProps {
  currentPlanId: string;
  onSelectPlan: (planId: string, billing: 'monthly' | 'annual') => void;
  onStartTrial: (planId: string) => void;
  onBack?: () => void;
}

export function PricingPlans({ currentPlanId, onSelectPlan, onStartTrial, onBack }: PricingPlansProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  const renderPrice = (plan: SubscriptionPlan) => {
    if (plan.customPricing) {
      return (
        <div className="text-center mb-5">
          <span className="text-2xl font-black text-foreground">Custom</span>
          <p className="text-xs text-muted-foreground mt-1">Tailored to your business</p>
        </div>
      );
    }
    const price = billingCycle === 'monthly' ? plan.monthlyPrice : plan.annualPrice;
    const savings = getAnnualSavings(plan);
    return (
      <div className="text-center mb-5">
        <span className="text-3xl font-black text-foreground">
          {plan.monthlyPrice === 0 ? 'Free' : `KES ${price.toLocaleString()}`}
        </span>
        {plan.monthlyPrice > 0 && (
          <span className="text-sm text-muted-foreground">
            /{billingCycle === 'monthly' ? 'mo' : 'yr'}
          </span>
        )}
        {billingCycle === 'annual' && savings > 0 && (
          <p className="text-xs text-green-600 font-medium mt-1">
            Save KES {savings.toLocaleString()}/year (2 months free)
          </p>
        )}
        <p className="text-[11px] text-muted-foreground mt-1.5 font-medium">
          No transaction fees — ever
        </p>
      </div>
    );
  };

  const renderCTA = (plan: SubscriptionPlan) => {
    const isCurrent = plan.id === currentPlanId;
    const price = billingCycle === 'monthly' ? plan.monthlyPrice : plan.annualPrice;

    if (isCurrent) {
      return (
        <button disabled className="w-full px-4 py-3 bg-muted text-muted-foreground rounded-lg font-medium text-sm cursor-default">
          Current Plan
        </button>
      );
    }
    if (plan.id === 'free') {
      return (
        <button disabled className="w-full px-4 py-3 bg-muted text-muted-foreground rounded-lg font-medium text-sm cursor-default">
          Free Forever
        </button>
      );
    }
    if (plan.customPricing) {
      return (
        <button
          onClick={() => onSelectPlan(plan.id, billingCycle)}
          className="w-full px-4 py-3 bg-foreground text-background rounded-lg hover:opacity-90 transition font-medium text-sm"
        >
          Contact Sales →
        </button>
      );
    }
    return (
      <div className="space-y-2">
        <button
          onClick={() => onSelectPlan(plan.id, billingCycle)}
          className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium text-sm"
        >
          Pay KES {price.toLocaleString()} →
        </button>
        <button
          onClick={() => onStartTrial(plan.id)}
          className="w-full px-4 py-2.5 border border-input text-foreground rounded-lg hover:bg-muted transition font-medium text-sm"
        >
          Try 14 Days Free
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        {onBack && (
          <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">
            ← Back to Products
          </button>
        )}
        <h2 className="text-2xl font-bold text-foreground">Simple, Transparent Pricing</h2>
        <p className="text-muted-foreground mt-1">No transaction fees. No surprises. Just a flat monthly subscription.</p>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-3 mt-5">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition ${
              billingCycle === 'monthly'
                ? 'bg-primary text-primary-foreground shadow'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('annual')}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition ${
              billingCycle === 'annual'
                ? 'bg-primary text-primary-foreground shadow'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            Annual
            <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded-full font-bold">
              2 months free
            </span>
          </button>
        </div>
      </div>

      {/* Plans Grid — 4 columns on large screens */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
        {SUBSCRIPTION_PLANS.map(plan => (
          <div
            key={plan.id}
            className={`rounded-xl border-2 p-6 transition-all relative flex flex-col ${
              plan.popular
                ? 'border-primary shadow-xl shadow-primary/10 scale-[1.02]'
                : plan.bestValue
                  ? 'border-blue-500/50 shadow-lg shadow-blue-500/5'
                  : 'border-border hover:border-primary/30'
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="px-3 py-1 text-xs font-bold bg-primary text-primary-foreground rounded-full shadow whitespace-nowrap">
                  ⭐ Most Popular
                </span>
              </div>
            )}
            {plan.bestValue && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="px-3 py-1 text-xs font-bold bg-blue-600 text-white rounded-full shadow whitespace-nowrap">
                  🚀 Best Value
                </span>
              </div>
            )}

            <div className="text-center mb-4">
              <span className="text-2xl">{plan.icon}</span>
              <h3 className="text-lg font-bold text-foreground uppercase mt-1">{plan.name}</h3>
              <p className="text-xs text-muted-foreground">{plan.tagline}</p>
            </div>

            {renderPrice(plan)}

            <ul className="space-y-2.5 mb-6 flex-1">
              {plan.features.map((f, i) => (
                <li key={i} className={`flex items-start gap-2 text-sm ${f.included ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                  {f.included ? (
                    <CheckIcon size={16} className="text-green-600 shrink-0 mt-0.5" />
                  ) : (
                    <XIcon size={16} className="text-muted-foreground/30 shrink-0 mt-0.5" />
                  )}
                  {f.text}
                </li>
              ))}
            </ul>

            {renderCTA(plan)}
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        💡 All plans include M-Pesa & card payments with zero transaction fees. Annual plans save you 2 months!
      </p>
    </div>
  );
}
