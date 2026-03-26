import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import * as supabaseApi from '@/services/supabaseApi';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useCurrency } from '@/hooks/useCurrency';
import { getProvidersForCountry, type PaymentProvider } from '@/config/paymentProviders';
import {
  WalletIcon, SettingsIcon, PlusIcon, StoreIcon,
  ChevronRightIcon, BellIcon, XIcon,
  ArrowUpRightIcon, ArrowDownLeftIcon,
  MenuIcon
} from '@/components/icons';
import { WithdrawalModal } from '@/components/WithdrawalModal';
import { CreateStoreModal } from '@/components/store/CreateStoreModal';
import { StoreDashboard } from '@/components/store/StoreDashboard';
import { CreateLinkTab } from '@/components/seller/CreateLinkTab';
import { CurrencySelector } from '@/components/CurrencySelector';
import { useTranslations } from '@/hooks/useTranslations';

// Types
interface Order {
  id: string;
  buyer: string;
  amount: number;
  item: string;
  status: 'pending' | 'shipped' | 'completed' | 'dispute';
  timeLeft: string;
  rating: number;
  reviews: number;
}

interface Transaction {
  type: 'deposit' | 'withdrawal';
  amount: number;
  desc: string;
  date: string;
}

interface WalletData {
  available: number;
  pending: number;
  total: number;
}

interface SellerProfile {
  name: string;
  verified: boolean;
  memberSince: string;
  isActive: boolean;
  taxId?: string;
  businessRegNumber?: string;
  isBusiness?: boolean;
}

export function SellerDashboard() {
  const navigate = useNavigate();
  const { t } = useTranslations();
  const { logout, isAuthenticated, isLoading: authLoading } = useSupabaseAuth();
  const { selectedCountry, formatPrice } = useCurrency();
  const [activeTab, setActiveTab] = useState('wallet');
  const [withdrawalModal, setWithdrawalModal] = useState(false);
  const [shareModal, setShareModal] = useState(false);
  const [showCreateStoreModal, setShowCreateStoreModal] = useState(false);
  const [showStoreDashboard, setShowStoreDashboard] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Real data states loaded from Supabase
  const [orders] = useState<Order[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wallet, setWallet] = useState<WalletData>({ available: 0, pending: 0, total: 0 });
  const [profile, setProfile] = useState<SellerProfile>({ name: 'Seller', verified: false, memberSince: '', isActive: false });

  // Load profile and transactions from Supabase
  useEffect(() => {
    async function loadProfileAndTransactions() {
      // Load profile
      const statsRes = await supabaseApi.getSellerStats();
      if (statsRes.success && statsRes.data) {
        const d = statsRes.data as any;
        setProfile(prev => ({
          ...prev,
          name: d.profile?.businessName || prev.name,
        }));
      }

      // Load seller's profile name directly
      const { supabase: sb } = await import('@/lib/supabase');
      const { data: { session } } = await sb.auth.getSession();
      if (session) {
        const { data: profileData } = await sb.from('profiles').select('name, business_name, created_at').eq('user_id', session.user.id).maybeSingle();
        if (profileData) {
          setProfile(prev => ({
            ...prev,
            name: (profileData as any).business_name || (profileData as any).name || session.user.email || 'Seller',
            memberSince: new Date((profileData as any).created_at).toLocaleDateString(),
          }));
        }

        // Load transaction history for wallet tab
        const { data: txData } = await sb.from('transactions')
          .select('*')
          .or(`seller_id.eq.${session.user.id}`)
          .order('created_at', { ascending: false })
          .limit(50);
        
        if (txData) {
          const mapped: Transaction[] = (txData as any[]).map(tx => ({
            type: 'deposit' as const,
            amount: tx.amount,
            desc: tx.item_name || tx.description || 'Transaction',
            date: new Date(tx.created_at).toLocaleDateString(),
            platformFee: tx.platform_fee,
            sellerPayout: tx.seller_payout,
            platformFeePercent: tx.fee_percentage,
            itemName: tx.item_name,
            createdAt: tx.created_at,
          }));
          setTransactions(mapped);
        }
      }
    }
    if (isAuthenticated) loadProfileAndTransactions();
  }, [isAuthenticated]);

  // Store settings state
  const [storeData, setStoreData] = useState<{
    id?: string;
    name?: string;
    slug?: string;
    logo?: string | null;
    bio?: string | null;
    visibility?: string;
    status?: string;
  } | null>(null);
  const [storeLoading, setStoreLoading] = useState(true);
  const [storefrontCopied, setStorefrontCopied] = useState(false);

  // Share URL for Share modal (store link to copy)
  const shareUrl = storeData?.slug && typeof window !== 'undefined' ? `${window.location.origin}/store/${storeData.slug}` : '';

  // Load wallet from Supabase (so escrow releases reflect immediately)
  useEffect(() => {
    async function loadWallet() {
      const res = await supabaseApi.getWallet();
      if (res.success && res.data) {
        const w = res.data as any;
        setWallet({
          available: Number(w.available_balance ?? w.available ?? 0),
          pending: Number(w.pending_balance ?? w.pending ?? 0),
          total: Number(w.total_earned ?? w.total ?? 0),
        });
      }
    }
    loadWallet();
  }, [activeTab, withdrawalModal]);

  // Load store data when store tab is active
  useEffect(() => {
    async function loadStore() {
      if (activeTab === 'store') {
        setStoreLoading(true);
        const res = await supabaseApi.getMyStore();
        if (res.success && res.data) {
          setStoreData(res.data as any);
        }
        setStoreLoading(false);
      }
    }
    loadStore();
  }, [activeTab]);

  const navItems = [
    { id: 'wallet', label: t('seller.wallet'), icon: WalletIcon },
    { id: 'create_link', label: t('seller.createLink'), icon: PlusIcon },
    { id: 'store', label: t('seller.storeSettings'), icon: SettingsIcon },
  ];

  // CREATE LINK TAB - Merges Create Link + My Links
  const renderCreateLink = () => <CreateLinkTab />;

  // WALLET TAB
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [showAddPayoutMethod, setShowAddPayoutMethod] = useState(false);
  
  // Get providers for the selected country
  const countryConfig = getProvidersForCountry(selectedCountry.code);
  const availableProviders = countryConfig?.providers || [];
  
  // Get unique payment types from available providers
  const availableTypes = [...new Set(availableProviders.map(p => p.type))] as PaymentProvider['type'][];
  
  // Default to first available provider
  const getDefaultProvider = (type: PaymentProvider['type']) => {
    const provider = availableProviders.find(p => p.type === type);
    return provider?.name || '';
  };
  
  const [payoutForm, setPayoutForm] = useState({
    type: availableTypes[0] || 'MOBILE_MONEY' as PaymentProvider['type'],
    provider: getDefaultProvider(availableTypes[0] || 'MOBILE_MONEY'),
    accountNumber: '',
    accountName: '',
    isDefault: false,
  });

  // Update provider when type or country changes
  useEffect(() => {
    const config = getProvidersForCountry(selectedCountry.code);
    if (config) {
      const types = [...new Set(config.providers.map(p => p.type))] as PaymentProvider['type'][];
      const defaultType = types[0] || 'MOBILE_MONEY';
      const defaultProvider = config.providers.find(p => p.type === defaultType)?.name || '';
      setPayoutForm(prev => ({
        ...prev,
        type: defaultType,
        provider: defaultProvider,
      }));
    }
  }, [selectedCountry.code]);

  useEffect(() => {
    async function loadPaymentMethods() {
      const res = await supabaseApi.getPaymentMethods();
      if (res.success && res.data) {
        setPaymentMethods(Array.isArray(res.data) ? res.data : []);
      }
    }
    loadPaymentMethods();
  }, []);

  const handleAddPayoutMethod = async () => {
    if (!payoutForm.accountNumber || !payoutForm.accountName) {
      alert('Please fill in all required fields');
      return;
    }
    const res = await supabaseApi.addPaymentMethod(payoutForm);
    if (res.success) {
      const defaultType = availableTypes[0] || 'MOBILE_MONEY';
      setPayoutForm({ 
        type: defaultType, 
        provider: getDefaultProvider(defaultType), 
        accountNumber: '', 
        accountName: '', 
        isDefault: false 
      });
      setShowAddPayoutMethod(false);
      const updatedRes = await supabaseApi.getPaymentMethods();
      if (updatedRes.success && updatedRes.data) {
        setPaymentMethods(Array.isArray(updatedRes.data) ? updatedRes.data : []);
      }
      alert('Payout method added successfully!');
    } else {
      alert(res.error || 'Failed to add payout method');
    }
  };

  const renderWallet = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-[#3d1a7a]">💼 Wallet & Balance</h2>

      {/* Payout Methods Section */}
      <div className="bg-white rounded-nullxl border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-[#3d1a7a]">💰 Payout Methods</h3>
          <button
            onClick={() => setShowAddPayoutMethod(!showAddPayoutMethod)}
            className="px-4 py-2 rounded-null-lg bg-[#3d1a7a] text-white hover:bg-[#250e52] transition text-sm font-semibold"
          >
            {showAddPayoutMethod ? 'Cancel' : '+ Add Payout Method'}
          </button>
        </div>

        {paymentMethods.length === 0 && !showAddPayoutMethod && (
          <div className="bg-[#6E6658]/10 border border-[#6E6658]/30 rounded-null-lg p-4 mb-4">
            <p className="text-[#4F4A41] font-semibold mb-1">⚠️ No Payout Method Added</p>
            <p className="text-sm text-[#6E6658]">You need to add a payout method before you can activate your store or withdraw funds.</p>
          </div>
        )}

        {showAddPayoutMethod && (
          <div className="bg-[#5d2ba3]/5 rounded-null-lg p-4 mb-4 space-y-4">
            {/* Country Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
              <p className="text-sm text-blue-800">
                <strong>Selected Country:</strong> {selectedCountry.name} ({selectedCountry.code})
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Currency: {countryConfig?.currency || selectedCountry.currencyCode}
              </p>
            </div>

            {availableProviders.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800 font-medium">
                  ⚠️ Payment providers not yet available for {selectedCountry.name}
                </p>
                <p className="text-sm text-yellow-600 mt-1">
                  Please select a supported country from the currency selector above.
                </p>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-[#250e52] mb-1">Payment Type *</label>
                  <select
                    value={payoutForm.type}
                    onChange={(e) => {
                      const newType = e.target.value as PaymentProvider['type'];
                      const defaultProvider = availableProviders.find(p => p.type === newType)?.name || '';
                      setPayoutForm({ ...payoutForm, type: newType, provider: defaultProvider });
                    }}
                    className="w-full px-4 py-2 rounded-null-lg border border-[#5d2ba3]/30 focus:outline-none focus:border-[#3d1a7a]"
                  >
                    {availableTypes.map(type => (
                      <option key={type} value={type}>
                        {type === 'MOBILE_MONEY' ? 'Mobile Money' : 
                         type === 'BANK_TRANSFER' ? 'Bank Transfer' : 
                         type === 'DIGITAL_WALLET' ? 'Digital Wallet' : type}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Provider *</label>
                  <select
                    value={payoutForm.provider}
                    onChange={(e) => setPayoutForm({ ...payoutForm, provider: e.target.value })}
                    className="w-full px-4 py-2 rounded-null-lg border border-[#5d2ba3]/30 focus:outline-none focus:border-[#3d1a7a]"
                  >
                    {availableProviders
                      .filter(p => p.type === payoutForm.type)
                      .map(provider => (
                        <option key={provider.name} value={provider.name}>
                          {provider.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {payoutForm.type === 'MOBILE_MONEY' || payoutForm.type === 'DIGITAL_WALLET' 
                      ? 'Phone Number / Account ID' 
                      : 'Account Number'} *
                  </label>
                  <input
                    type="text"
                    value={payoutForm.accountNumber}
                    onChange={(e) => setPayoutForm({ ...payoutForm, accountNumber: e.target.value })}
                    placeholder={
                      availableProviders.find(p => p.name === payoutForm.provider)?.format || 
                      (payoutForm.type === 'MOBILE_MONEY' ? `${selectedCountry.phonePrefix} XXX XXX XXX` : 'Account number')
                    }
                    className="w-full px-4 py-2 rounded-null-lg border border-[#5d2ba3]/30 focus:outline-none focus:border-[#3d1a7a]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Name *</label>
                  <input
                    type="text"
                    value={payoutForm.accountName}
                    onChange={(e) => setPayoutForm({ ...payoutForm, accountName: e.target.value })}
                    placeholder="Full name as on account"
                    className="w-full px-4 py-2 rounded-null-lg border border-[#5d2ba3]/30 focus:outline-none focus:border-[#3d1a7a]"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isDefault"
                    checked={payoutForm.isDefault}
                    onChange={(e) => setPayoutForm({ ...payoutForm, isDefault: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label htmlFor="isDefault" className="text-sm text-gray-700">Set as default payout method</label>
                </div>
                <button
                  onClick={handleAddPayoutMethod}
                  className="w-full px-4 py-2 rounded-null-lg bg-[#3d1a7a] text-white hover:bg-[#250e52] transition font-semibold"
                >
                  Add Payout Method
                </button>
              </>
            )}
          </div>
        )}

        {paymentMethods.length > 0 && (
          <div className="space-y-3">
            {paymentMethods.map((method) => (
              <div key={method.id} className="flex items-center justify-between p-4 bg-[#5d2ba3]/5 rounded-null-lg border border-[#5d2ba3]/20">
                <div>
                  <p className="font-semibold text-[#250e52]">{method.provider}</p>
                  <p className="text-sm text-[#6E6658]">{method.accountNumber}</p>
                  <p className="text-xs text-[#6E6658]/70">{method.accountName}</p>
                </div>
                <div className="flex items-center gap-2">
                  {method.isDefault && (
                    <span className="px-2 py-1 bg-[#5d2ba3]/20 text-[#3d1a7a] rounded-null-full text-xs font-semibold">Default</span>
                  )}
                  <span className={`px-2 py-1 rounded-null-full text-xs font-semibold ${method.isActive ? 'bg-[#5d2ba3]/20 text-[#3d1a7a]' : 'bg-[#6E6658]/20 text-[#6E6658]'
                    }`}>
                    {method.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-[#5d2ba3] rounded-nullxl p-8 text-white">
          <p className="text-white mb-2">Available to Withdraw</p>
          <p className="text-4xl font-bold mb-4 ">{formatPrice(wallet.available, 'KES')}</p>
          <button
            onClick={() => setWithdrawalModal(true)}
            disabled={paymentMethods.length === 0}
            className="w-full bg-[#250e52] text-white py-3 rounded-nulllg hover:bg-[#3d1a7a] transition font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            💸 Withdraw
          </button>
          {paymentMethods.length === 0 && (
            <p className="text-xs text-white mt-2 text-center">Add payout method first</p>
          )}
        </div>

        <div className="bg-[#6E6658] rounded-nullxl p-8 text-white">
          <p className="text-white/90 mb-2">Pending PayLoom</p>
          <p className="text-4xl font-bold mb-2">{formatPrice(wallet.pending, 'KES')}</p>
          <p className="text-sm text-white/80">({orders.filter(o => o.status !== 'completed').length} orders pending)</p>
        </div>

        <div className="bg-[#3d1a7a] rounded-nullxl p-8 text-white">
          <p className="text-white mb-2">Total Earnings</p>
          <p className="text-4xl font-bold mb-2">{formatPrice(wallet.total, 'KES')}</p>
          <p className="text-sm text-white">All time</p>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white rounded-nullxl border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-[#3d1a7a] mb-6">📝 Transaction History</h3>
        {transactions.length === 0 ? (
          <div className="text-center py-12 text-[#6E6658]">
            <WalletIcon className="w-16 h-16 mx-auto mb-4 text-[#5d2ba3]/50" />
            <p className="text-lg">No transactions yet</p>
            <p className="text-sm">Your transaction history will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {transactions.map((tx: any, idx: number) => {
              // If transaction has fee breakdown, show it
              const hasFeeBreakdown = tx.platformFee !== undefined && tx.sellerPayout !== undefined;
              const grossAmount = hasFeeBreakdown ? (tx.platformFee + tx.sellerPayout) : tx.amount;

              return (
                <div key={idx} className="p-4 bg-[#5d2ba3]/5 rounded-nulllg border border-[#5d2ba3]/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-nullfull ${tx.type === 'deposit' ? 'bg-[#5d2ba3]/20' : 'bg-[#4F4A41]/20'}`}>
                        {tx.type === 'deposit' ? (
                          <ArrowDownLeftIcon className="text-white" size={20} />
                        ) : (
                          <ArrowUpRightIcon className="text-white" size={20} />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-[#250e52]">{tx.desc || tx.itemName || 'Transaction'}</p>
                        <p className="text-sm text-[#6E6658]">{tx.date || new Date(tx.createdAt || Date.now()).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {hasFeeBreakdown ? (
                        <div>
                          <p className="text-lg font-bold text-[#5d2ba3]">+{formatPrice(tx.sellerPayout, 'KES')}</p>
                          <p className="text-xs text-[#6E6658]">Net (after fees)</p>
                        </div>
                      ) : (
                        <p className={`text-xl font-bold ${tx.type === 'deposit' ? 'text-[#5d2ba3]' : 'text-[#4F4A41]'}`}>
                          {tx.type === 'deposit' ? '+' : '-'}{formatPrice(tx.amount, 'KES')}
                        </p>
                      )}
                    </div>
                  </div>
                  {hasFeeBreakdown && (
                    <div className="mt-3 pt-3 border-t border-[#5d2ba3]/20 text-xs text-[#6E6658] space-y-1">
                      <div className="flex justify-between">
                        <span>Gross Amount:</span>
                        <span className="font-semibold">{formatPrice(grossAmount, 'KES')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Platform Fee ({tx.platformFeePercent || 5}%):</span>
                        <span className="text-[#4F4A41]">-{formatPrice(tx.platformFee, 'KES')}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-[#5d2ba3]">
                        <span>Your Payout:</span>
                        <span>{formatPrice(tx.sellerPayout, 'KES')}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // STORE SETTINGS TAB
  const renderStore = () => {
    if (storeLoading) {
      return (
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="h-16 w-16 bg-muted rounded-xl" />
              <div className="space-y-2 flex-1">
                <div className="h-6 w-40 bg-muted rounded" />
                <div className="h-4 w-24 bg-muted rounded" />
              </div>
            </div>
            <div className="h-12 w-full bg-muted rounded-xl" />
          </div>
        </div>
      );
    }

    if (!storeData) {
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-[#3d1a7a]">🏬 Create Your Store</h2>
          <div className="bg-card rounded-null-xl border border-border p-8 text-center">
            <StoreIcon className="w-16 h-16 mx-auto mb-4 text-[#5d2ba3]/50" size={64} />
            <h3 className="text-xl font-bold text-[#3d1a7a] mb-2">You don't have a store yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Create your store to start selling products and managing orders. It only takes a minute!
            </p>
            <button
              onClick={() => setShowCreateStoreModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-null-xl bg-primary text-primary-foreground hover:bg-primary/90 transition font-semibold"
            >
              <PlusIcon size={20} />
              Create Store
            </button>
          </div>
        </div>
      );
    }

    // If store exists, show button to open store dashboard
    const storefrontUrl = storeData.slug ? `${window.location.origin}/store/${storeData.slug}` : '';
    const copyStorefrontLink = () => {
      if (!storefrontUrl) return;
      navigator.clipboard.writeText(storefrontUrl);
      setStorefrontCopied(true);
      setTimeout(() => setStorefrontCopied(false), 2000);
    };

    return (
      <div className="space-y-4 sm:space-y-6 w-full min-w-0 overflow-hidden">
        <h2 className="text-xl sm:text-2xl font-bold text-primary">🏬 Your Store</h2>
        <div className="bg-card rounded-xl border border-border p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 mb-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0 w-full sm:w-auto">
              {storeData.logo ? (
                <img src={storeData.logo} alt="Store logo" className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded-xl flex-shrink-0" />
              ) : (
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-muted rounded-xl flex items-center justify-center flex-shrink-0">
                  <StoreIcon size={24} className="text-primary/70" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="text-lg sm:text-xl font-bold text-primary truncate">{storeData.name}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">/store/{storeData.slug}</p>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs sm:text-sm font-bold flex-shrink-0 ${storeData.status === 'ACTIVE' ? 'bg-primary/20 text-primary' :
              storeData.status === 'FROZEN' ? 'bg-destructive/20 text-destructive' :
                'bg-muted text-muted-foreground'
              }`}>
              {storeData.status || 'INACTIVE'}
            </span>
          </div>
          {storefrontUrl && (
            <div className="mb-4 p-3 bg-muted/50 rounded-lg border border-border overflow-hidden">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Storefront link (share with customers)</p>
              <div className="flex flex-col sm:flex-row gap-2 min-w-0">
                <code className="flex-1 min-w-0 truncate block text-xs sm:text-sm py-2 px-3 bg-background rounded border border-border overflow-hidden text-ellipsis whitespace-nowrap">{storefrontUrl}</code>
                <button
                  type="button"
                  onClick={copyStorefrontLink}
                  className="flex-shrink-0 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition text-sm font-semibold whitespace-nowrap w-full sm:w-auto"
                >
                  {storefrontCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {storeData.status === 'ACTIVE' ? 'Your storefront is live.' : 'Activate your store in Store Dashboard → Settings to make this link live.'}
              </p>
            </div>
          )}
          <button
            onClick={() => setShowStoreDashboard(true)}
            className="w-full px-4 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition font-semibold text-sm sm:text-base"
          >
            Open Store Dashboard
          </button>
        </div>
      </div>
    );
  };

  // If store dashboard is open, show it instead
  if (showStoreDashboard && storeData) {
    return (
      <StoreDashboard
        store={{
          id: storeData.id || '',
          name: storeData.name || '',
          slug: storeData.slug || '',
          logo: storeData.logo,
          bio: storeData.bio,
          visibility: storeData.visibility,
          status: storeData.status,
        }}
        onStoreUpdate={(data) => setStoreData(prev => prev ? { ...prev, ...data } : null)}
        onBack={() => setShowStoreDashboard(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 w-72 bg-[#250e52] flex flex-col z-50 transform transition-transform duration-300 lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-[#3d1a7a] flex items-center justify-between">
          <div className="flex items-center justify-center w-full">
            <img 
              src="/logo.jpeg" 
              alt="PayLoom Logo" 
              className="w-40 h-auto object-contain"
            />
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-[#5d2ba3] p-2 hover:bg-[#3d1a7a]/30 rounded-null-lg">
            <XIcon size={24} />
          </button>
        </div>

        <nav className="flex-1 py-6 px-4 space-y-1 overflow-y-auto sidebar-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (window.innerWidth < 1024) setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-null-xl text-sm font-bold transition-all duration-200 ${
                  isActive
                    ? 'bg-[#5d2ba3] text-white shadow-lg shadow-[#5d2ba3]/20'
                    : 'text-white hover:bg-[#5d2ba3]/50 hover:text-white'
                }`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
                {isActive && <ChevronRightIcon className="ml-auto text-white" size={16} />}
              </button>
            );
          })}
        </nav>

        {/* Profile/Footer Area */}
        <div className="p-4 border-t border-[#3d1a7a] bg-[#250e52]/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-[#3d1a7a] rounded-null-full flex items-center justify-center text-white font-bold">
              {profile.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-bold truncate">{profile.name}</p>
              <p className="text-white/70 text-xs truncate">Seller Account</p>
            </div>
          </div>
          <button
            onClick={async () => {
              await logout();
              navigate('/');
            }}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm font-bold text-[#6E6658] hover:text-[#4F4A41] transition"
          >
            {t('seller.logout')}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 lg:ml-72 min-h-screen">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 h-14 md:h-16 flex items-center justify-between px-3 sm:px-4 md:px-8 sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-3 min-h-[44px] min-w-[44px] text-gray-500 hover:bg-gray-100 rounded-null-lg transition touch-target"
              aria-label="Open menu"
            >
              <MenuIcon size={24} />
            </button>
            <h1 className="text-xl font-black text-[#250e52] hidden md:block">
              {navItems.find(i => i.id === activeTab)?.label}
            </h1>
          </div>

          <div className="flex items-center gap-3 md:gap-6">
            <CurrencySelector />
            <button className="p-2 text-[#3d1a7a] hover:bg-gray-100 rounded-full transition relative">
              <BellIcon size={24} />
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-[#5d2ba3] border-2 border-white rounded-full"></span>
            </button>
            <div className="h-8 w-px bg-gray-200 hidden md:block"></div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden md:block">
                <p className="text-sm font-bold text-[#250e52]">{profile.name}</p>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#5d2ba3]"></div>
                  <p className="text-[10px] text-gray-500 font-medium">ONLINE</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="p-3 sm:p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'wallet' && renderWallet()}
            {activeTab === 'create_link' && renderCreateLink()}
            {activeTab === 'store' && renderStore()}
          </div>
        </main>
      </div>

      {/* Withdrawal Modal */}
      <WithdrawalModal
        isOpen={withdrawalModal}
        onClose={() => {
          setWithdrawalModal(false);
          // Refresh wallet balance when modal closes
          supabaseApi.getWallet().then((res: any) => {
            if (res.success && res.data) {
              const w = res.data as any;
              setWallet({
                available: Number(w.available_balance ?? w.available ?? 0),
                pending: Number(w.pending_balance ?? w.pending ?? 0),
                total: Number(w.total_earned ?? w.total ?? 0),
              });
            }
          });
        }}
        onRequestAddMethod={() => {
          setWithdrawalModal(false);
          setActiveTab('wallet');
          setShowAddPayoutMethod(true);
        }}
        availableBalance={wallet.available}
        paymentMethods={paymentMethods.map((m: any) => ({
          id: m.id,
          type: (m.type === 'BANK_ACCOUNT' ? 'bank' : m.provider?.toLowerCase().includes('airtel') ? 'airtel' : 'mpesa') as 'mpesa' | 'bank' | 'airtel',
          name: m.provider || m.type || 'Payout',
          icon: m.type === 'BANK_ACCOUNT' ? '🏦' : '📱',
          accountNumber: m.account_number ?? m.accountNumber ?? '',
          accountName: m.account_name ?? m.accountName ?? '',
          bankName: m.type === 'BANK_ACCOUNT' ? m.provider : undefined,
          fee: 0,
          feeType: 'fixed' as const,
          processingTime: '1-2 business days',
          processingTimeValue: 1,
          limits: { min: 100, max: 500000 },
          verified: true,
        }))}
      />

      {/* Create Store Modal */}
      <CreateStoreModal
        isOpen={showCreateStoreModal}
        onClose={() => setShowCreateStoreModal(false)}
        onStoreCreated={(store) => {
          setStoreData(store);
          setShowCreateStoreModal(false);
          setShowStoreDashboard(true);
        }}
      />

      {/* Share Modal */}
      {shareModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-null-xl max-w-md w-full p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-[#3d1a7a]">🔗 Share on Social</h3>
              <button onClick={() => setShareModal(false)} className="text-gray-500 hover:text-gray-700">
                <XIcon size={24} />
              </button>
            </div>
            <div className="bg-[#5d2ba3]/10 p-4 rounded-null-lg mb-6 border border-[#5d2ba3]/30">
              <p className="text-sm font-mono text-gray-900 break-all">Create a payment link first to share</p>
            </div>
            <div className="space-y-3 mb-6">
              <button
                type="button"
                onClick={() => { if (shareUrl) { navigator.clipboard.writeText(shareUrl); setStorefrontCopied(true); setTimeout(() => setStorefrontCopied(false), 2000); } setShareModal(false); }}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-null-lg bg-[#5d2ba3] text-white hover:bg-[#3d1a7a] transition font-semibold"
              >
                📸 Share on Instagram
              </button>
              <button
                type="button"
                onClick={() => { if (shareUrl) { navigator.clipboard.writeText(shareUrl); setStorefrontCopied(true); setTimeout(() => setStorefrontCopied(false), 2000); } setShareModal(false); }}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-null-lg bg-[#5d2ba3] text-white hover:bg-[#3d1a7a] transition font-semibold"
              >
                💬 Share on WhatsApp
              </button>
              <button
                type="button"
                onClick={() => { if (shareUrl) { navigator.clipboard.writeText(shareUrl); setStorefrontCopied(true); setTimeout(() => setStorefrontCopied(false), 2000); } setShareModal(false); }}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-null-lg bg-[#5d2ba3] text-white hover:bg-[#3d1a7a] transition font-semibold"
              >
                👍 Share on Facebook
              </button>
            </div>
            <button onClick={() => setShareModal(false)} className="w-full px-4 py-3 rounded-null-lg bg-gray-100 text-gray-900 hover:bg-gray-200 transition font-semibold">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}