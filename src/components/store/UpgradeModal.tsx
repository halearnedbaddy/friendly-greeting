import { useState } from 'react';
import { XIcon, CheckIcon } from '@/components/icons';
import { SUBSCRIPTION_PLANS, getAnnualSavings } from '@/config/subscriptionPlans';

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  currentPlanId: string;
  onSelectPlan: (planId: string, billing: 'monthly' | 'annual') => void;
  onStartTrial: (planId: string) => void;
}

export function UpgradeModal({ open, onClose, currentPlanId, onSelectPlan, onStartTrial }: UpgradeModalProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  if (!open) return null;

  const upgradablePlans = SUBSCRIPTION_PLANS.filter(p => p.id !== 'free' && p.id !== currentPlanId);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground">🚀 Upgrade Your Store</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Unlock more products, lower fees, and premium features.
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition">
              <XIcon size={20} />
            </button>
          </div>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                billingCycle === 'monthly'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                billingCycle === 'annual'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              Annual
              <span className="ml-1 text-xs opacity-80">Save 2 months</span>
            </button>
          </div>
        </div>

        {/* Plan Cards */}
        <div className="p-6 grid sm:grid-cols-3 gap-4">
          {upgradablePlans.map(plan => {
            const price = billingCycle === 'monthly' ? plan.monthlyPrice : plan.annualPrice;
            const savings = getAnnualSavings(plan);

            return (
              <div
                key={plan.id}
                className={`rounded-xl border-2 p-5 transition-all ${
                  plan.popular
                    ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                {plan.popular && (
                  <span className="inline-block px-2 py-0.5 text-xs font-bold bg-primary text-primary-foreground rounded-full mb-3">
                    ⭐ Most Popular
                  </span>
                )}
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{plan.icon}</span>
                  <h3 className="text-lg font-bold text-foreground uppercase">{plan.name}</h3>
                </div>

                <div className="mb-4">
                  <span className="text-2xl font-black text-foreground">
                    KES {price.toLocaleString()}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    /{billingCycle === 'monthly' ? 'month' : 'year'}
                  </span>
                  {billingCycle === 'annual' && savings > 0 && (
                    <p className="text-xs text-green-600 font-medium mt-1">
                      Save KES {savings.toLocaleString()} per year!
                    </p>
                  )}
                </div>

                <ul className="space-y-2 mb-5">
                  {plan.features.filter(f => f.included).slice(0, 6).map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-foreground">
                      <CheckIcon size={16} className="text-green-600 shrink-0" />
                      {f.text}
                    </li>
                  ))}
                </ul>

                <div className="space-y-2">
                  <button
                    onClick={() => onSelectPlan(plan.id, billingCycle)}
                    className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium text-sm"
                  >
                    Upgrade → KES {price.toLocaleString()}
                  </button>
                  <button
                    onClick={() => onStartTrial(plan.id)}
                    className="w-full px-4 py-2.5 border border-input text-foreground rounded-lg hover:bg-muted transition font-medium text-sm"
                  >
                    Try Free 14 Days
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Payment Methods Info */}
        <div className="px-6 pb-4">
          <div className="bg-muted/50 rounded-xl p-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm" style={{ background: '#d4f4dd', color: '#00a86b' }}>M-P</div>
              <span className="text-sm text-foreground font-medium">M-Pesa Paybill</span>
            </div>
            <span className="text-xs text-muted-foreground ml-auto">Payment option available</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex items-center justify-between">
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground transition">
            Maybe Later
          </button>
          <p className="text-xs text-muted-foreground">
            💡 Annual plans save you 2 months!
          </p>
        </div>
      </div>
    </div>
  );
}