import { SubscriptionPlan, getNextPlan } from '@/config/subscriptionPlans';
import { ArrowRightIcon } from '@/components/icons';

interface PlanBannerProps {
  currentPlan: SubscriptionPlan;
  productCount: number;
  nextBillingDate?: string | null;
  status: string;
  onUpgrade: () => void;
  onManage?: () => void;
}

export function PlanBanner({ currentPlan, productCount, nextBillingDate, status, onUpgrade, onManage }: PlanBannerProps) {
  const limit = currentPlan.productLimit;
  const percentage = limit ? Math.min((productCount / limit) * 100, 100) : 0;
  const nextPlan = getNextPlan(currentPlan.id);
  const isFree = currentPlan.id === 'free';

  return (
    <div className={`rounded-xl border p-5 ${
      isFree 
        ? 'bg-muted/50 border-border' 
        : 'bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20'
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{currentPlan.icon}</span>
            <h3 className="font-bold text-foreground uppercase tracking-wide text-sm">
              {currentPlan.name} Plan
            </h3>
            {status === 'trialing' && (
              <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">
                Trial
              </span>
            )}
            {status === 'active' && !isFree && (
              <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                Active
              </span>
            )}
          </div>

          {/* Usage Bar */}
          {limit !== null && (
            <div className="mb-3">
              <p className="text-sm text-muted-foreground mb-1.5">
                You're using <span className="font-semibold text-foreground">{productCount}</span> of <span className="font-semibold text-foreground">{limit}</span> product slots
              </p>
              <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    percentage >= 90 ? 'bg-red-500' :
                    percentage >= 70 ? 'bg-amber-500' :
                    'bg-primary'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{Math.round(percentage)}% used</p>
            </div>
          )}

          {limit === null && (
            <p className="text-sm text-muted-foreground mb-2">
              <span className="font-semibold text-foreground">{productCount}</span> products · Unlimited slots
            </p>
          )}

          {/* Billing info for paid plans */}
          {!isFree && nextBillingDate && (
            <p className="text-xs text-muted-foreground">
              Next billing: {new Date(nextBillingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              {onManage && (
                <button onClick={onManage} className="ml-2 text-primary hover:underline font-medium">
                  Manage Subscription
                </button>
              )}
            </p>
          )}
        </div>

        {/* Upgrade CTA */}
        {nextPlan && (
          <button
            onClick={onUpgrade}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium text-sm whitespace-nowrap shrink-0"
          >
            Upgrade to {nextPlan.name} – KES {nextPlan.monthlyPrice}/mo
            <ArrowRightIcon size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
