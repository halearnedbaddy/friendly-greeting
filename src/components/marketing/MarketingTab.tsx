import { useState, useEffect } from "react";
import {
  Mail,
  ShoppingCart,
  Percent,
  Zap,
  Settings,
  Plus,
  Loader2,
  Send,
  ChevronRight,
} from "lucide-react";
import { api } from "@/services/api";
import { cn } from "@/lib/utils";
import type { StoreTab } from "@/components/store/StoreSidebar";

type MarketingSubTab = "email" | "cart" | "discounts" | "workflows" | "settings";

const TAB_MAP: Partial<Record<StoreTab, MarketingSubTab>> = {
  "marketing-email": "email",
  "marketing-cart-recovery": "cart",
  "marketing-discounts": "discounts",
  "marketing-sms": "email",
  "marketing-loyalty": "discounts",
  "marketing-social": "settings",
};

export function MarketingTab({ activeTab = "marketing" }: { activeTab?: StoreTab }) {
  const [subTab, setSubTab] = useState<MarketingSubTab>(TAB_MAP[activeTab || "marketing"] ?? "email");

  useEffect(() => {
    const mapped = TAB_MAP[activeTab || "marketing"];
    if (mapped) setSubTab(mapped);
  }, [activeTab]);

  // Email campaigns
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [campaignForm, setCampaignForm] = useState({
    name: "",
    subject: "",
    from_name: "",
    from_email: "",
    html_content: "",
    segment_id: "",
  });
  const [segments, setSegments] = useState<any[]>([]);

  // Abandoned carts
  const [carts, setCarts] = useState<any[]>([]);
  const [cartAnalytics, setCartAnalytics] = useState<any>(null);

  // Discounts
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [showNewDiscount, setShowNewDiscount] = useState(false);
  const [discountForm, setDiscountForm] = useState({
    code: "",
    discount_type: "percentage",
    discount_value: "10",
    usage_limit_per_customer: "1",
    valid_until: "",
  });

  // Workflows
  const [workflows, setWorkflows] = useState<any[]>([]);

  // Settings
  const [_settings, setSettings] = useState<any>(null);
  const [settingsForm, setSettingsForm] = useState({
    abandoned_cart_recovery_enabled: true,
    abandoned_cart_delay_minutes: 60,
    abandoned_cart_discount_percent: 10,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadCampaigns = async () => {
    setLoading(true);
    const res = await api.getEmailCampaigns?.();
    setLoading(false);
    if (res?.success && res.data) setCampaigns(res.data);
  };
  const loadSegments = async () => {
    const res = await api.getMarketingSegments?.();
    if (res?.success && res.data) setSegments(res.data);
  };
  const loadCarts = async () => {
    setLoading(true);
    const [cartsRes, analyticsRes] = await Promise.all([
      api.getAbandonedCarts?.(),
      api.getAbandonedCartAnalytics?.(),
    ]);
    setLoading(false);
    if (cartsRes?.success && cartsRes.data) setCarts(cartsRes.data);
    if (analyticsRes?.success && analyticsRes.data) setCartAnalytics(analyticsRes.data);
  };
  const loadDiscounts = async () => {
    const res = await api.getDiscountCodes?.();
    if (res?.success && res.data) setDiscounts(res.data);
  };
  const loadWorkflows = async () => {
    const res = await api.getMarketingWorkflows?.();
    if (res?.success && res.data) setWorkflows(res.data);
  };
  const loadSettings = async () => {
    const res = await api.getMarketingSettings?.();
    if (res?.success && res.data) {
      setSettings(res.data);
      setSettingsForm({
        abandoned_cart_recovery_enabled: res.data.abandoned_cart_recovery_enabled ?? true,
        abandoned_cart_delay_minutes: res.data.abandoned_cart_delay_minutes ?? 60,
        abandoned_cart_discount_percent: res.data.abandoned_cart_discount_percent ?? 10,
      });
    }
  };

  useEffect(() => {
    if (subTab === "email") {
      loadCampaigns();
      loadSegments();
    }
  }, [subTab]);
  useEffect(() => {
    if (subTab === "cart") loadCarts();
  }, [subTab]);
  useEffect(() => {
    if (subTab === "discounts") loadDiscounts();
  }, [subTab]);
  useEffect(() => {
    if (subTab === "workflows") loadWorkflows();
  }, [subTab]);
  useEffect(() => {
    if (subTab === "settings") loadSettings();
  }, [subTab]);

  const handleCreateCampaign = async () => {
    if (!campaignForm.name || !campaignForm.subject || !campaignForm.from_name || !campaignForm.from_email) return;
    setSaving(true);
    const res = await api.createEmailCampaign?.({
      ...campaignForm,
      segment_id: campaignForm.segment_id || undefined,
    });
    setSaving(false);
    if (res?.success) {
      setShowNewCampaign(false);
      setCampaignForm({ name: "", subject: "", from_name: "", from_email: "", html_content: "", segment_id: "" });
      loadCampaigns();
    } else alert(res?.error || "Failed");
  };

  const handleCreateDiscount = async () => {
    if (!discountForm.code || !discountForm.discount_value) return;
    setSaving(true);
    const res = await api.createDiscountCode?.({
      code: discountForm.code,
      discount_type: discountForm.discount_type,
      discount_value: parseFloat(discountForm.discount_value),
      usage_limit_per_customer: parseInt(discountForm.usage_limit_per_customer) || 1,
      valid_until: discountForm.valid_until || undefined,
    });
    setSaving(false);
    if (res?.success) {
      setShowNewDiscount(false);
      setDiscountForm({ code: "", discount_type: "percentage", discount_value: "10", usage_limit_per_customer: "1", valid_until: "" });
      loadDiscounts();
    } else alert(res?.error || "Failed");
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    const res = await api.updateMarketingSettings?.(settingsForm);
    setSaving(false);
    if (res?.success) loadSettings();
    else alert(res?.error || "Failed");
  };

  const handleSendRecovery = async (cartId: string) => {
    const res = await api.sendCartRecoveryEmail?.(cartId, true);
    if (res?.success) loadCarts();
    else alert(res?.error || "Failed");
  };

  const subTabs = [
    { id: "email" as MarketingSubTab, label: "Email Campaigns", icon: Mail },
    { id: "cart" as MarketingSubTab, label: "Cart Recovery", icon: ShoppingCart },
    { id: "discounts" as MarketingSubTab, label: "Discount Codes", icon: Percent },
    { id: "workflows" as MarketingSubTab, label: "Automation", icon: Zap },
    { id: "settings" as MarketingSubTab, label: "Settings", icon: Settings },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-foreground">Marketing</h2>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {subTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition", subTab === id ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80")}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>

      {subTab === "email" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowNewCampaign(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
              <Plus size={18} />
              New Campaign
            </button>
          </div>
          {showNewCampaign && (
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <h3 className="font-semibold">Create Email Campaign</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name *</label>
                  <input value={campaignForm.name} onChange={(e) => setCampaignForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-4 py-2 rounded-lg border border-border" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Subject *</label>
                  <input value={campaignForm.subject} onChange={(e) => setCampaignForm((f) => ({ ...f, subject: e.target.value }))} className="w-full px-4 py-2 rounded-lg border border-border" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">From Name *</label>
                  <input value={campaignForm.from_name} onChange={(e) => setCampaignForm((f) => ({ ...f, from_name: e.target.value }))} className="w-full px-4 py-2 rounded-lg border border-border" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">From Email *</label>
                  <input type="email" value={campaignForm.from_email} onChange={(e) => setCampaignForm((f) => ({ ...f, from_email: e.target.value }))} className="w-full px-4 py-2 rounded-lg border border-border" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Segment</label>
                  <select value={campaignForm.segment_id} onChange={(e) => setCampaignForm((f) => ({ ...f, segment_id: e.target.value }))} className="w-full px-4 py-2 rounded-lg border border-border">
                    <option value="">All customers</option>
                    {segments.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">HTML Content</label>
                  <textarea value={campaignForm.html_content} onChange={(e) => setCampaignForm((f) => ({ ...f, html_content: e.target.value }))} className="w-full px-4 py-2 rounded-lg border border-border h-32" placeholder="<p>Hello {{name}}, ...</p>" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreateCampaign} disabled={saving || !campaignForm.name || !campaignForm.subject} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50">
                  {saving ? "Creating..." : "Create Campaign"}
                </button>
                <button onClick={() => setShowNewCampaign(false)} className="px-4 py-2 bg-muted rounded-lg">Cancel</button>
              </div>
            </div>
          )}
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : campaigns.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
              <Mail size={48} className="mx-auto mb-2 opacity-50" />
              <p>No email campaigns yet. Create one to reach your customers.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {campaigns.map((c) => (
                <div key={c.id} className="bg-card border border-border rounded-xl p-4 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-sm text-muted-foreground">{c.subject} • {c.status}</p>
                    {c.recipient_count != null && <p className="text-xs text-muted-foreground">Recipients: {c.recipient_count}</p>}
                  </div>
                  <ChevronRight size={20} className="text-muted-foreground" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === "cart" && (
        <div className="space-y-6">
          {cartAnalytics && (
            <div className="grid md:grid-cols-4 gap-4">
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-sm text-muted-foreground">Abandoned (30d)</p>
                <p className="text-2xl font-bold">{cartAnalytics.total_abandoned ?? 0}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-sm text-muted-foreground">Recovered</p>
                <p className="text-2xl font-bold">{cartAnalytics.total_recovered ?? 0}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-sm text-muted-foreground">Recovery Rate</p>
                <p className="text-2xl font-bold">{cartAnalytics.recovery_rate ?? 0}%</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-sm text-muted-foreground">Value Recovered</p>
                <p className="text-2xl font-bold">{(cartAnalytics.recovered_value ?? 0).toLocaleString()}</p>
              </div>
            </div>
          )}
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : carts.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
              <ShoppingCart size={48} className="mx-auto mb-2 opacity-50" />
              <p>No abandoned carts. Cart recovery tracks visitors who add items but don't complete checkout.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {carts.map((cart) => (
                <div key={cart.id} className="bg-card border border-border rounded-xl p-4 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{cart.customer_name || "Guest"}</p>
                    <p className="text-sm text-muted-foreground">{cart.customer_email || "—"}</p>
                    <p className="text-xs text-muted-foreground">{cart.cart_total} • {new Date(cart.abandoned_at).toLocaleString()} • {cart.status}</p>
                  </div>
                  {cart.status === "abandoned" && (
                    <button onClick={() => handleSendRecovery(cart.id)} className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm">
                      <Send size={14} /> Send Recovery
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === "discounts" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowNewDiscount(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
              <Plus size={18} /> New Discount
            </button>
          </div>
          {showNewDiscount && (
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <h3 className="font-semibold">Create Discount Code</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Code *</label>
                  <input value={discountForm.code} onChange={(e) => setDiscountForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} className="w-full px-4 py-2 rounded-lg border border-border" placeholder="SAVE10" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Type</label>
                  <select value={discountForm.discount_type} onChange={(e) => setDiscountForm((f) => ({ ...f, discount_type: e.target.value }))} className="w-full px-4 py-2 rounded-lg border border-border">
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Value *</label>
                  <input type="number" value={discountForm.discount_value} onChange={(e) => setDiscountForm((f) => ({ ...f, discount_value: e.target.value }))} className="w-full px-4 py-2 rounded-lg border border-border" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Uses per customer</label>
                  <input type="number" value={discountForm.usage_limit_per_customer} onChange={(e) => setDiscountForm((f) => ({ ...f, usage_limit_per_customer: e.target.value }))} className="w-full px-4 py-2 rounded-lg border border-border" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Valid until (optional)</label>
                  <input type="date" value={discountForm.valid_until} onChange={(e) => setDiscountForm((f) => ({ ...f, valid_until: e.target.value }))} className="w-full px-4 py-2 rounded-lg border border-border" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreateDiscount} disabled={saving || !discountForm.code} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50">
                  {saving ? "Creating..." : "Create"}
                </button>
                <button onClick={() => setShowNewDiscount(false)} className="px-4 py-2 bg-muted rounded-lg">Cancel</button>
              </div>
            </div>
          )}
          <div className="grid gap-4">
            {discounts.map((d) => (
              <div key={d.id} className="bg-card border border-border rounded-xl p-4 flex justify-between items-center">
                <div>
                  <p className="font-mono font-medium">{d.code}</p>
                  <p className="text-sm text-muted-foreground">{d.discount_type} • {d.discount_value}{d.discount_type === "percentage" ? "%" : ""} • Used {d.times_used ?? 0}x</p>
                  {d.valid_until && <p className="text-xs text-muted-foreground">Valid until {new Date(d.valid_until).toLocaleDateString()}</p>}
                </div>
                <span className={cn("text-sm px-2 py-1 rounded", d.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600")}>{d.is_active ? "Active" : "Inactive"}</span>
              </div>
            ))}
            {discounts.length === 0 && !showNewDiscount && (
              <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
                <Percent size={48} className="mx-auto mb-2 opacity-50" />
                <p>No discount codes. Create one to offer promotions.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === "workflows" && (
        <div className="space-y-4">
          {workflows.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
              <Zap size={48} className="mx-auto mb-2 opacity-50" />
              <p>No automation workflows yet. Automate welcome emails, abandoned cart sequences, and more.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {workflows.map((w) => (
                <div key={w.id} className="bg-card border border-border rounded-xl p-4">
                  <p className="font-medium">{w.name}</p>
                  <p className="text-sm text-muted-foreground">{w.trigger_type} • {w.is_active ? "Active" : "Inactive"}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === "settings" && (
        <div className="bg-card border border-border rounded-xl p-6 max-w-xl space-y-6">
          <h3 className="font-semibold">Cart Recovery Settings</h3>
          <div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={settingsForm.abandoned_cart_recovery_enabled} onChange={(e) => setSettingsForm((f) => ({ ...f, abandoned_cart_recovery_enabled: e.target.checked }))} />
              Enable abandoned cart recovery
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Delay before first email (minutes)</label>
            <input type="number" value={settingsForm.abandoned_cart_delay_minutes} onChange={(e) => setSettingsForm((f) => ({ ...f, abandoned_cart_delay_minutes: parseInt(e.target.value) || 60 }))} className="w-full px-4 py-2 rounded-lg border border-border" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Discount % in recovery email</label>
            <input type="number" value={settingsForm.abandoned_cart_discount_percent} onChange={(e) => setSettingsForm((f) => ({ ...f, abandoned_cart_discount_percent: parseInt(e.target.value) || 10 }))} className="w-full px-4 py-2 rounded-lg border border-border" />
          </div>
          <button onClick={handleSaveSettings} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50">
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      )}
    </div>
  );
}
