import { AlertTriangleIcon } from '@/components/icons';
import { SubscriptionPlan } from '@/config/subscriptionPlans';

interface NearLimitBannerProps {
  currentPlan: SubscriptionPlan;
  remaining: number;
  onViewPlans: () => void;
  onDismiss: () => void;
}

export function NearLimitBanner({ currentPlan, remaining, onViewPlans, onDismiss }: NearLimitBannerProps) {
  if (remaining > 1 || currentPlan.productLimit === null) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangleIcon size={20} className="text-amber-600 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            You have {remaining} product slot{remaining !== 1 ? 's' : ''} remaining
          </p>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
            Upgrade to Seller Plan (KES 899/month) for 100 products or Business Plan (KES 2,499/month) for unlimited.
          </p>
          <div className="flex gap-3 mt-3">
            <button
              onClick={onViewPlans}
              className="text-sm font-medium text-primary hover:underline"
            >
              View Plans & Pricing →
            </button>
            <button
              onClick={onDismiss}
              className="text-sm text-muted-foreground hover:underline"
            >
              Remind Me Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
