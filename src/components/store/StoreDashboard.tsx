import { useState, lazy, Suspense, useCallback, useMemo } from 'react';
import { StoreSidebar, StoreTab } from './StoreSidebar';
import { TabSkeleton } from './TabSkeleton';
import { UpgradeModal } from './UpgradeModal';
import { SubscriptionPaymentFlow } from './SubscriptionPaymentFlow';
import { useSubscription } from '@/hooks/useSubscription';
import { Menu, X, Bell, ArrowLeft, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Lazy load ALL tab components for code splitting
const StoreOverview = lazy(() => import('./StoreOverview').then(m => ({ default: m.StoreOverview })));
const StoreOrders = lazy(() => import('./StoreOrders').then(m => ({ default: m.StoreOrders })));
const ProductsTab = lazy(() => import('@/components/products/ProductsTab').then(m => ({ default: m.ProductsTab })));
const InventoryTab = lazy(() => import('@/components/inventory/InventoryTab').then(m => ({ default: m.InventoryTab })));
const CustomersTab = lazy(() => import('@/components/customers/CustomersTab').then(m => ({ default: m.CustomersTab })));
const AnalyticsTab = lazy(() => import('@/components/analytics/AnalyticsTab').then(m => ({ default: m.AnalyticsTab })));
const ReviewsTab = lazy(() => import('@/components/reviews/ReviewsTab').then(m => ({ default: m.ReviewsTab })));
const FinancialTab = lazy(() => import('@/components/financial/FinancialTab').then(m => ({ default: m.FinancialTab })));
const MarketingTab = lazy(() => import('@/components/marketing/MarketingTab').then(m => ({ default: m.MarketingTab })));
const LiveChatTab = lazy(() => import('@/components/chat/LiveChatTab').then(m => ({ default: m.LiveChatTab })));
const SupportTab = lazy(() => import('@/components/support/SupportTab').then(m => ({ default: m.SupportTab })));
const StoreSettingsTab = lazy(() => import('./StoreSettingsTab').then(m => ({ default: m.StoreSettingsTab })));

interface StoreData {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  bio?: string | null;
  visibility?: string;
  status?: string;
}

interface StoreDashboardProps {
  store: StoreData;
  onStoreUpdate: (data: Partial<StoreData>) => void;
  onBack: () => void;
}

export function StoreDashboard({ store, onStoreUpdate, onBack }: StoreDashboardProps) {
  const navigate = useNavigate();
  const { subscription } = useSubscription();
  const [activeTab, setActiveTab] = useState<StoreTab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [paymentFlow, setPaymentFlow] = useState<{ open: boolean; planId: string; billing: 'monthly' | 'annual'; mode: 'payment' | 'trial' }>({ open: false, planId: '', billing: 'monthly', mode: 'payment' });

  const handleTabChange = useCallback((tab: StoreTab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  }, []);

  const handleNavigate = useCallback((tab: string) => {
    setActiveTab(tab as StoreTab);
  }, []);

  const content = useMemo(() => {
    switch (activeTab) {
      case 'dashboard':
        return <StoreOverview storeName={store.name} storeSlug={store.slug} storeId={store.id} onNavigate={handleNavigate} />;
      case 'orders':
        return <StoreOrders />;
      case 'products':
      case 'products-all':
      case 'products-categories':
      case 'products-bulk':
      case 'products-recommendations':
        return <ProductsTab activeTab={activeTab} storeSlug={store.slug} />;
      case 'inventory':
      case 'inventory-stock':
      case 'inventory-locations':
      case 'inventory-transfers':
      case 'inventory-suppliers':
      case 'inventory-reorder':
        return <InventoryTab activeTab={activeTab} />;
      case 'customers':
      case 'customers-all':
      case 'customers-segments':
      case 'customers-analytics':
      case 'customers-loyalty':
        return <CustomersTab activeTab={activeTab} />;
      case 'marketing':
      case 'marketing-email':
      case 'marketing-sms':
      case 'marketing-cart-recovery':
      case 'marketing-loyalty':
      case 'marketing-discounts':
      case 'marketing-social':
        return <MarketingTab activeTab={activeTab} />;
      case 'analytics':
      case 'analytics-overview':
      case 'analytics-forecasting':
      case 'analytics-customer-insights':
      case 'analytics-traffic':
      case 'analytics-insights':
      case 'analytics-market-intelligence':
      case 'analytics-custom-reports':
        return <AnalyticsTab activeTab={activeTab} />;
      case 'financial':
      case 'financial-accounting':
        return <FinancialTab initialSubTab="dashboard" />;
      case 'financial-tax':
        return <FinancialTab initialSubTab="tax" />;
      case 'financial-payment-options':
        return <FinancialTab initialSubTab="payment-options" />;
      case 'financial-health':
        return <FinancialTab initialSubTab="health" />;
      case 'live-chat':
        return <LiveChatTab />;
      case 'reviews':
        return <ReviewsTab />;
      case 'store-settings':
      case 'store-settings-general':
      case 'store-settings-domain':
      case 'store-settings-theme':
      case 'store-settings-seo':
      case 'store-settings-payment':
      case 'store-settings-shipping':
      case 'store-settings-tax':
      case 'store-settings-integrations':
      case 'store-settings-legal':
      case 'store-settings-webhooks':
      case 'store-settings-languages':
      case 'store-settings-invoices':
        return <StoreSettingsTab store={store} onUpdate={onStoreUpdate} activeTab={activeTab} />;
      case 'support':
      case 'support-help':
      case 'support-tickets':
      case 'support-account-manager':
        return <SupportTab activeTab={activeTab} />;
      default:
        return <StoreOverview storeName={store.name} />;
    }
  }, [activeTab, store, onStoreUpdate, handleNavigate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <nav className="bg-card border-b border-border sticky top-0 z-40">
        <div className="px-4 md:px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)} 
              className="md:hidden text-foreground p-2 hover:bg-muted rounded transition"
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition"
            >
              <ArrowLeft size={20} />
              <span className="hidden sm:inline">Back to Dashboard</span>
            </button>
            <div className="hidden md:block w-px h-6 bg-border" />
            <div
              className="text-xl font-black bg-gradient-to-r from-[#5d2ba3] to-[#3d1a7a] bg-clip-text text-transparent cursor-pointer"
              onClick={() => navigate('/')}
            >
              PayLoom
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setUpgradeOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-full font-semibold text-sm hover:opacity-90 transition shadow-md"
            >
              <Zap size={16} />
              Upgrade
            </button>
            <button className="relative p-2 text-foreground hover:bg-muted rounded-full transition">
              <Bell size={24} />
            </button>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-bold flex items-center justify-center">
              {store.name.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        {/* Sidebar */}
        <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:sticky top-16 h-[calc(100vh-64px)] z-30 transition-transform duration-300`}>
          <StoreSidebar 
            activeTab={activeTab} 
            onTabChange={handleTabChange}
            storeName={store.name}
            currentPlanId={subscription.planId}
            onUpgrade={() => setUpgradeOpen(true)}
          />
        </div>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-20 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content with Suspense for lazy-loaded tabs */}
        <div className="flex-1 p-3 sm:p-4 md:p-6 min-h-[calc(100vh-64px)] min-w-0 overflow-x-hidden">
          <Suspense fallback={<TabSkeleton />}>
            {content}
          </Suspense>
        </div>
      </div>

      {/* Upgrade Modal */}
      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        currentPlanId={subscription.planId}
        onSelectPlan={(planId, billing) => {
          setUpgradeOpen(false);
          setPaymentFlow({ open: true, planId, billing, mode: 'payment' });
        }}
        onStartTrial={(planId) => {
          setUpgradeOpen(false);
          setPaymentFlow({ open: true, planId, billing: 'monthly', mode: 'trial' });
        }}
      />

      {/* Subscription Payment Flow */}
      <SubscriptionPaymentFlow
        open={paymentFlow.open}
        onClose={() => setPaymentFlow(prev => ({ ...prev, open: false }))}
        planId={paymentFlow.planId}
        billingCycle={paymentFlow.billing}
        mode={paymentFlow.mode}
        onComplete={() => setPaymentFlow(prev => ({ ...prev, open: false }))}
      />
    </div>
  );
}
