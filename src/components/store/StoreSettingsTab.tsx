import { useState, useEffect } from "react";
import {
  Settings,
  Globe,
  Languages,
  FileText,
  Palette,
  Search,
  CreditCard,
  Truck,
  Receipt,
  Plug,
  Scale,
  Webhook,
  Loader2,
  Plus,
  Save,
} from "lucide-react";
import { api } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { StoreSettings } from "./StoreSettings";
import type { StoreTab } from "./StoreSidebar";

type SettingsSubTab =
  | "general"
  | "domain"
  | "theme"
  | "seo"
  | "payment"
  | "shipping"
  | "tax"
  | "integrations"
  | "legal"
  | "webhooks"
  | "languages"
  | "invoices";

const TAB_MAP: Partial<Record<StoreTab, SettingsSubTab>> = {
  "store-settings": "general",
  "store-settings-general": "general",
  "store-settings-domain": "domain",
  "store-settings-theme": "theme",
  "store-settings-seo": "seo",
  "store-settings-payment": "payment",
  "store-settings-shipping": "shipping",
  "store-settings-tax": "tax",
  "store-settings-integrations": "integrations",
  "store-settings-legal": "legal",
  "store-settings-webhooks": "webhooks",
  "store-settings-languages": "languages",
  "store-settings-invoices": "invoices",
};

const LEGAL_PAGE_TYPES = [
  { type: "terms", label: "Terms of Service" },
  { type: "privacy", label: "Privacy Policy" },
  { type: "shipping", label: "Shipping Policy" },
  { type: "returns", label: "Returns & Refunds" },
];

const WEBHOOK_EVENTS = [
  "order.created",
  "order.updated",
  "product.created",
  "product.updated",
  "customer.created",
  "payment.completed",
];

interface StoreSettingsTabProps {
  store: { id?: string; name: string; slug: string; logo?: string | null; bio?: string | null; visibility?: string; status?: string };
  onUpdate: (data: Partial<StoreSettingsTabProps["store"]>) => void;
  activeTab?: StoreTab;
}

export function StoreSettingsTab({ store, onUpdate, activeTab = "store-settings-general" }: StoreSettingsTabProps) {
  const { toast } = useToast();
  const [subTab, setSubTab] = useState<SettingsSubTab>(TAB_MAP[activeTab] ?? "general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Settings data
  const [_general, setGeneral] = useState<any>(null);
  const [theme, setTheme] = useState<any>(null);
  const [domains, setDomains] = useState<any[]>([]);
  const [seo, setSEO] = useState<any>(null);
  const [payment, setPayment] = useState<any>(null);
  const [shipping, setShipping] = useState<any>(null);
  const [tax, setTax] = useState<any>(null);
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [legalPages, setLegalPages] = useState<any[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);

  // Form state
  const [domainInput, setDomainInput] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEvents, setWebhookEvents] = useState<string[]>([]);
  const [editingLegalPage, setEditingLegalPage] = useState<any>(null);
  const [legalForm, setLegalForm] = useState({ title: "", content: "", slug: "", meta_description: "" });
  const [newTaxRate, setNewTaxRate] = useState({ name: "", country: "", state: "", rate: "" });
  const [newZoneName, setNewZoneName] = useState("");

  useEffect(() => {
    const mapped = TAB_MAP[activeTab];
    if (mapped) setSubTab(mapped);
  }, [activeTab]);

  // @ts-ignore - available for manual use
  const loadSettings = async () => {
    const res = await api.getStoreSettings?.();
    if (res?.success && res.data) {
      const d = res.data as any;
      setGeneral(d.general);
      setTheme(d.theme);
      setSEO(d.seo);
      setPayment(d.payment);
      if (d.shipping?.settings) setShipping(d.shipping);
      else if (d.shipping?.settings === null) setShipping({ settings: null, zones: [] });
      if (d.tax?.settings) setTax(d.tax);
      else if (d.tax?.settings === null) setTax({ settings: null, rates: [] });
    }
  };

  const loadDomains = async () => {
    const res = await api.getStoreDomains?.();
    if (res?.success && res.data) setDomains(res.data as any[]);
  };

  const loadShipping = async () => {
    const res = await api.getStoreShippingSettings?.();
    if (res?.success && res.data) setShipping(res.data as any);
  };

  const loadTax = async () => {
    const res = await api.getStoreTaxSettings?.();
    if (res?.success && res.data) setTax(res.data as any);
  };

  const loadIntegrations = async () => {
    const res = await api.getStoreIntegrations?.();
    if (res?.success && res.data) setIntegrations(res.data as any[]);
  };

  const loadLegalPages = async () => {
    const res = await api.getStoreLegalPages?.();
    if (res?.success && res.data) setLegalPages(res.data as any[]);
  };

  const loadWebhooks = async () => {
    const res = await api.getStoreWebhooks?.();
    if (res?.success && res.data) setWebhooks(res.data as any[]);
  };

  useEffect(() => {
    setLoading(true);
    if (subTab === "general") setLoading(false);
    else if (subTab === "domain") loadDomains().then(() => setLoading(false));
    else if (subTab === "theme") {
      api.getStoreTheme?.().then((r: any) => {
        if (r?.success) setTheme(r.data);
        setLoading(false);
      });
    } else if (subTab === "seo") {
      api.getStoreSEOSettings?.().then((r: any) => {
        if (r?.success) setSEO(r.data);
        setLoading(false);
      });
    } else if (subTab === "payment") {
      api.getStorePaymentSettings?.().then((r: any) => {
        if (r?.success) setPayment(r.data);
        setLoading(false);
      });
    } else if (subTab === "shipping") loadShipping().then(() => setLoading(false));
    else if (subTab === "tax") loadTax().then(() => setLoading(false));
    else if (subTab === "integrations") loadIntegrations().then(() => setLoading(false));
    else if (subTab === "legal") loadLegalPages().then(() => setLoading(false));
    else if (subTab === "webhooks") loadWebhooks().then(() => setLoading(false));
    else setLoading(false);
  }, [subTab]);

  const handleAddDomain = async () => {
    if (!domainInput.trim()) return;
    setSaving(true);
    const res = await api.addStoreDomain?.(domainInput.trim());
    setSaving(false);
    if (res?.success) {
      setDomainInput("");
      loadDomains();
      toast({ title: "Domain added. Add DNS record to verify." });
    } else {
      toast({ title: "Failed to add domain", variant: "destructive" });
    }
  };

  const handleSaveTheme = async (updates: Record<string, unknown>) => {
    setSaving(true);
    const res = await api.updateStoreTheme?.(updates);
    setSaving(false);
    if (res?.success) {
      setTheme(res.data);
      toast({ title: "Theme saved" });
    } else {
      toast({ title: "Failed to save", variant: "destructive" });
    }
  };

  const handleSaveSEO = async (updates: Record<string, unknown>) => {
    setSaving(true);
    const res = await api.updateStoreSEOSettings?.(updates);
    setSaving(false);
    if (res?.success) {
      setSEO(res.data);
      toast({ title: "SEO settings saved" });
    } else {
      toast({ title: "Failed to save", variant: "destructive" });
    }
  };

  const handleSavePayment = async (updates: Record<string, unknown>) => {
    setSaving(true);
    const res = await api.updateStorePaymentSettings?.(updates);
    setSaving(false);
    if (res?.success) {
      setPayment(res.data);
      toast({ title: "Payment settings saved" });
    } else {
      toast({ title: "Failed to save", variant: "destructive" });
    }
  };

  const handleSaveShipping = async (updates: Record<string, unknown>) => {
    setSaving(true);
    const res = await api.updateStoreShippingSettings?.(updates);
    setSaving(false);
    if (res?.success) {
      loadShipping();
      toast({ title: "Shipping settings saved" });
    } else {
      toast({ title: "Failed to save", variant: "destructive" });
    }
  };

  const handleSaveTax = async (updates: Record<string, unknown>) => {
    setSaving(true);
    const res = await api.updateStoreTaxSettings?.(updates);
    setSaving(false);
    if (res?.success) {
      loadTax();
      toast({ title: "Tax settings saved" });
    } else {
      toast({ title: "Failed to save", variant: "destructive" });
    }
  };

  const handleCreateShippingZone = async () => {
    if (!newZoneName.trim()) return;
    setSaving(true);
    const res = await api.createStoreShippingZone?.({ name: newZoneName.trim(), countries: [], rates: [] });
    setSaving(false);
    if (res?.success) {
      setNewZoneName("");
      loadShipping();
      toast({ title: "Shipping zone created" });
    } else {
      toast({ title: "Failed to create zone", variant: "destructive" });
    }
  };

  const handleCreateTaxRate = async () => {
    if (!newTaxRate.name || !newTaxRate.country || !newTaxRate.rate) {
      toast({ title: "Name, country, and rate required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const res = await api.createStoreTaxRate?.({
      name: newTaxRate.name,
      country: newTaxRate.country,
      state: newTaxRate.state || undefined,
      rate: parseFloat(newTaxRate.rate) || 0,
    });
    setSaving(false);
    if (res?.success) {
      setNewTaxRate({ name: "", country: "", state: "", rate: "" });
      loadTax();
      toast({ title: "Tax rate added" });
    } else {
      toast({ title: "Failed to add rate", variant: "destructive" });
    }
  };

  const handleSaveLegalPage = async () => {
    if (!editingLegalPage?.page_type || !legalForm.title || !legalForm.content || !legalForm.slug) return;
    setSaving(true);
    const res = await api.updateStoreLegalPage?.(editingLegalPage.page_type, {
      ...legalForm,
      meta_description: legalForm.meta_description || undefined,
    });
    setSaving(false);
    if (res?.success) {
      setEditingLegalPage(null);
      loadLegalPages();
      toast({ title: "Legal page saved" });
    } else {
      toast({ title: "Failed to save", variant: "destructive" });
    }
  };

  const handleCreateWebhook = async () => {
    if (!webhookUrl.trim() || webhookEvents.length === 0) {
      toast({ title: "URL and at least one event required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const res = await api.createStoreWebhook?.({ url: webhookUrl.trim(), events: webhookEvents });
    setSaving(false);
    if (res?.success) {
      setWebhookUrl("");
      setWebhookEvents([]);
      loadWebhooks();
      toast({ title: "Webhook created" });
    } else {
      toast({ title: "Failed to create webhook", variant: "destructive" });
    }
  };

  const subTabs = [
    { id: "general" as SettingsSubTab, label: "General", icon: Settings },
    { id: "domain" as SettingsSubTab, label: "Domain", icon: Globe },
    { id: "theme" as SettingsSubTab, label: "Theme", icon: Palette },
    { id: "seo" as SettingsSubTab, label: "SEO", icon: Search },
    { id: "payment" as SettingsSubTab, label: "Payment", icon: CreditCard },
    { id: "shipping" as SettingsSubTab, label: "Shipping", icon: Truck },
    { id: "tax" as SettingsSubTab, label: "Tax", icon: Receipt },
    { id: "integrations" as SettingsSubTab, label: "Integrations", icon: Plug },
    { id: "legal" as SettingsSubTab, label: "Legal Pages", icon: Scale },
    { id: "webhooks" as SettingsSubTab, label: "Webhooks", icon: Webhook },
    { id: "languages" as SettingsSubTab, label: "Languages", icon: Languages },
    { id: "invoices" as SettingsSubTab, label: "Invoices", icon: FileText },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 w-full min-w-0 overflow-hidden">
      <h2 className="text-xl sm:text-2xl font-bold text-foreground">Store Settings</h2>

      <div className="flex gap-1.5 sm:gap-2 border-b border-border pb-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
        {subTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            className={cn(
              "flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition whitespace-nowrap flex-shrink-0",
              subTab === id ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
            )}
          >
            <Icon size={16} className="flex-shrink-0" />
            <span className="hidden xs:inline">{label}</span>
            <span className="xs:hidden">{label.length > 6 ? label.slice(0, 4) + '.' : label}</span>
          </button>
        ))}
      </div>

      {subTab === "general" && <StoreSettings store={store} onUpdate={onUpdate} />}

      {subTab === "domain" && (
        <div className="rounded-lg border border-border p-3 sm:p-6 space-y-4 bg-card">
          <h3 className="font-semibold">Custom Domains</h3>
          <p className="text-sm text-muted-foreground break-all">Your store is available at: <code className="bg-muted px-2 py-1 rounded text-xs sm:text-sm">{window.location.origin}/store/{store.slug}</code></p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              placeholder="example.com"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              className="flex-1 px-3 py-2 rounded-md border border-input bg-background text-sm"
            />
            <button onClick={handleAddDomain} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium whitespace-nowrap">
              {saving ? <Loader2 size={18} className="animate-spin" /> : "Add Domain"}
            </button>
          </div>
          {loading ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : domains.length > 0 ? (
            <div className="space-y-2">
              {domains.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between p-3 rounded border border-border">
                  <span className="font-medium">{d.domain}</span>
                  <span className={`text-sm ${d.dns_verified ? "text-green-600" : "text-amber-600"}`}>
                    {d.dns_verified ? "Verified" : "Pending verification"}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {subTab === "theme" && (
        <div className="rounded-lg border border-border p-3 sm:p-6 space-y-4 bg-card">
          <h3 className="font-semibold">Theme & Branding</h3>
          {loading ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : (
            <ThemeForm theme={theme} onSave={handleSaveTheme} saving={saving} />
          )}
        </div>
      )}

      {subTab === "seo" && (
        <div className="rounded-lg border border-border p-3 sm:p-6 space-y-4 bg-card">
          <h3 className="font-semibold">SEO Settings</h3>
          {loading ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : (
            <SEOForm seo={seo} onSave={handleSaveSEO} saving={saving} />
          )}
        </div>
      )}

      {subTab === "payment" && (
        <div className="rounded-lg border border-border p-3 sm:p-6 space-y-4 bg-card">
          <h3 className="font-semibold">Payment Settings</h3>
          {loading ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : (
            <PaymentForm payment={payment} onSave={handleSavePayment} saving={saving} />
          )}
        </div>
      )}

      {subTab === "shipping" && (
        <div className="space-y-4 sm:space-y-6">
          <div className="rounded-lg border border-border p-3 sm:p-6 space-y-4 bg-card">
            <h3 className="font-semibold">Shipping Settings</h3>
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <ShippingForm shipping={shipping} onSave={handleSaveShipping} saving={saving} />
            )}
          </div>
          <div className="rounded-lg border border-border p-3 sm:p-6 space-y-4 bg-card">
            <h3 className="font-semibold">Shipping Zones</h3>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                placeholder="Zone name"
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                className="flex-1 px-3 py-2 rounded-md border border-input bg-background text-sm"
              />
              <button onClick={handleCreateShippingZone} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm whitespace-nowrap flex items-center gap-1 justify-center">
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />} Add Zone
              </button>
            </div>
            {(shipping?.zones ?? []).map((z: any) => (
              <div key={z.id} className="p-3 rounded border border-border">
                <p className="font-medium">{z.name}</p>
                <p className="text-sm text-muted-foreground">{z.countries?.length ? z.countries.join(", ") : "All countries"}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === "tax" && (
        <div className="space-y-4 sm:space-y-6">
          <div className="rounded-lg border border-border p-3 sm:p-6 space-y-4 bg-card">
            <h3 className="font-semibold">Tax Settings</h3>
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <TaxForm tax={tax} onSave={handleSaveTax} saving={saving} />
            )}
          </div>
          <div className="rounded-lg border border-border p-3 sm:p-6 space-y-4 bg-card">
            <h3 className="font-semibold">Tax Rates</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input placeholder="Name" value={newTaxRate.name} onChange={(e) => setNewTaxRate((f) => ({ ...f, name: e.target.value }))} className="px-3 py-2 rounded-md border border-input bg-background text-sm" />
              <input placeholder="Country" value={newTaxRate.country} onChange={(e) => setNewTaxRate((f) => ({ ...f, country: e.target.value }))} className="px-3 py-2 rounded-md border border-input bg-background text-sm" />
              <input placeholder="State (opt)" value={newTaxRate.state} onChange={(e) => setNewTaxRate((f) => ({ ...f, state: e.target.value }))} className="px-3 py-2 rounded-md border border-input bg-background text-sm" />
              <input placeholder="Rate (e.g. 0.0825)" type="number" step="0.0001" value={newTaxRate.rate} onChange={(e) => setNewTaxRate((f) => ({ ...f, rate: e.target.value }))} className="px-3 py-2 rounded-md border border-input bg-background text-sm" />
            </div>
            <button onClick={handleCreateTaxRate} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm w-full sm:w-auto">
              {saving ? <Loader2 size={18} className="animate-spin" /> : "Add Rate"}
            </button>
            {(tax?.rates ?? []).map((r: any) => (
              <div key={r.id} className="flex justify-between p-3 rounded border border-border">
                <span>{r.name} - {r.country}{r.state ? `, ${r.state}` : ""}</span>
                <span className="font-medium">{(Number(r.rate) * 100).toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === "integrations" && (
        <div className="rounded-lg border border-border p-3 sm:p-6 space-y-4 bg-card">
          <h3 className="font-semibold">Integrations</h3>
          <p className="text-sm text-muted-foreground">Connect third-party services like Google Analytics, Mailchimp, QuickBooks, and more.</p>
          {loading ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : integrations.length > 0 ? (
            <div className="space-y-2">
              {integrations.map((i: any) => (
                <div key={i.id} className="flex items-center justify-between p-3 rounded border border-border">
                  <span className="font-medium capitalize">{i.integration_type?.replace(/_/g, " ")}</span>
                  <span className={`text-sm px-2 py-1 rounded ${i.status === "active" ? "bg-green-100 text-green-700" : "bg-muted"}`}>{i.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No integrations connected yet. Configure analytics and marketing tools in the SEO and Marketing tabs.</p>
          )}
        </div>
      )}

      {subTab === "legal" && (
        <div className="rounded-lg border border-border p-3 sm:p-6 space-y-4 bg-card">
          <h3 className="font-semibold">Legal Pages</h3>
          {editingLegalPage ? (
            <div className="space-y-4">
              <input placeholder="Title" value={legalForm.title} onChange={(e) => setLegalForm((f) => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 rounded-md border border-input bg-background" />
              <input placeholder="Slug" value={legalForm.slug} onChange={(e) => setLegalForm((f) => ({ ...f, slug: e.target.value }))} className="w-full px-3 py-2 rounded-md border border-input bg-background" />
              <textarea placeholder="Content" value={legalForm.content} onChange={(e) => setLegalForm((f) => ({ ...f, content: e.target.value }))} className="w-full px-3 py-2 rounded-md border border-input bg-background" rows={10} />
              <textarea placeholder="Meta description" value={legalForm.meta_description} onChange={(e) => setLegalForm((f) => ({ ...f, meta_description: e.target.value }))} className="w-full px-3 py-2 rounded-md border border-input bg-background" rows={2} />
              <div className="flex gap-2">
                <button onClick={handleSaveLegalPage} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Save
                </button>
                <button onClick={() => setEditingLegalPage(null)} className="px-4 py-2 bg-muted rounded-lg text-sm">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {LEGAL_PAGE_TYPES.map(({ type, label }) => {
                  const page = legalPages?.find((p: any) => p.page_type === type);
                  return (
                    <div key={type} className="flex items-center justify-between p-3 rounded border border-border">
                      <span>{label}</span>
                      <button
                        onClick={() => {
                          setEditingLegalPage({ page_type: type });
                          setLegalForm({
                            title: page?.title || label,
                            content: page?.content || "",
                            slug: page?.slug || type,
                            meta_description: page?.meta_description || "",
                          });
                        }}
                        className="px-3 py-1 rounded bg-muted hover:bg-muted/80 text-sm"
                      >
                        {page ? "Edit" : "Create"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {subTab === "webhooks" && (
        <div className="rounded-lg border border-border p-3 sm:p-6 space-y-4 bg-card">
          <h3 className="font-semibold">Webhooks</h3>
          <p className="text-sm text-muted-foreground">Receive real-time notifications when events occur in your store.</p>
          <div className="space-y-3">
            <input placeholder="https://your-server.com/webhook" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm" />
            <div className="flex flex-wrap gap-2">
              {WEBHOOK_EVENTS.map((ev) => (
                <label key={ev} className="flex items-center gap-2">
                  <input type="checkbox" checked={webhookEvents.includes(ev)} onChange={(e) => setWebhookEvents((prev) => (e.target.checked ? [...prev, ev] : prev.filter((x) => x !== ev)))} />
                  <span className="text-sm">{ev}</span>
                </label>
              ))}
            </div>
            <button onClick={handleCreateWebhook} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />} Add Webhook
            </button>
          </div>
          {webhooks.length > 0 && (
            <div className="mt-4 space-y-2">
              {webhooks.map((w: any) => (
                <div key={w.id} className="flex items-center justify-between p-3 rounded border border-border">
                  <span className="font-mono text-xs sm:text-sm truncate max-w-[200px] sm:max-w-md">{w.url}</span>
                  <span className="text-sm text-muted-foreground">{w.events?.length || 0} events</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === "languages" && (
        <div className="rounded-lg border border-border p-3 sm:p-6 space-y-4 bg-card">
          <h3 className="font-semibold">Languages</h3>
          <p className="text-sm text-muted-foreground">Configure which languages your store supports. Multi-language support is available on Enterprise plans.</p>
        </div>
      )}

      {subTab === "invoices" && (
        <div className="rounded-lg border border-border p-3 sm:p-6 space-y-4 bg-card">
          <h3 className="font-semibold">Invoice Templates</h3>
          <p className="text-sm text-muted-foreground">Customize the layout, logo, and branding of invoices sent to customers.</p>
        </div>
      )}
    </div>
  );
}

function ThemeForm({ theme, onSave, saving }: { theme: any; onSave: (u: Record<string, unknown>) => void; saving: boolean }) {
  const [form, setForm] = useState({
    primary_color: theme?.primary_color || "#3B82F6",
    secondary_color: theme?.secondary_color || "#6B7280",
    font_family_heading: theme?.font_family_heading || "Inter",
    font_family_body: theme?.font_family_body || "Inter",
    layout_style: theme?.layout_style || "modern",
  });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div>
          <label className="text-sm font-medium">Primary Color</label>
          <input type="color" value={form.primary_color} onChange={(e) => setForm((f) => ({ ...f, primary_color: e.target.value }))} className="w-full h-10 rounded border" />
        </div>
        <div>
          <label className="text-sm font-medium">Secondary Color</label>
          <input type="color" value={form.secondary_color} onChange={(e) => setForm((f) => ({ ...f, secondary_color: e.target.value }))} className="w-full h-10 rounded border" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Heading Font</label>
          <select value={form.font_family_heading} onChange={(e) => setForm((f) => ({ ...f, font_family_heading: e.target.value }))} className="w-full px-3 py-2 rounded-md border border-input bg-background">
            <option value="Inter">Inter</option>
            <option value="Roboto">Roboto</option>
            <option value="Open Sans">Open Sans</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Layout</label>
          <select value={form.layout_style} onChange={(e) => setForm((f) => ({ ...f, layout_style: e.target.value }))} className="w-full px-3 py-2 rounded-md border border-input bg-background">
            <option value="modern">Modern</option>
            <option value="classic">Classic</option>
            <option value="minimal">Minimal</option>
          </select>
        </div>
      </div>
      <button onClick={() => onSave(form)} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">
        {saving ? <Loader2 size={18} className="animate-spin" /> : "Save Theme"}
      </button>
    </div>
  );
}

function SEOForm({ seo, onSave, saving }: { seo: any; onSave: (u: Record<string, unknown>) => void; saving: boolean }) {
  const [form, setForm] = useState({
    meta_title: seo?.meta_title || "",
    meta_description: seo?.meta_description || "",
    google_analytics_id: seo?.google_analytics_id || "",
    noindex: seo?.noindex || false,
  });
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Meta Title</label>
        <input value={form.meta_title} onChange={(e) => setForm((f) => ({ ...f, meta_title: e.target.value }))} className="w-full px-3 py-2 rounded-md border border-input bg-background" placeholder="Store name - Tagline" />
      </div>
      <div>
        <label className="text-sm font-medium">Meta Description</label>
        <textarea value={form.meta_description} onChange={(e) => setForm((f) => ({ ...f, meta_description: e.target.value }))} className="w-full px-3 py-2 rounded-md border border-input bg-background" rows={3} />
      </div>
      <div>
        <label className="text-sm font-medium">Google Analytics ID (G-XXXXXXXXXX)</label>
        <input value={form.google_analytics_id} onChange={(e) => setForm((f) => ({ ...f, google_analytics_id: e.target.value }))} className="w-full px-3 py-2 rounded-md border border-input bg-background" placeholder="G-XXXXXXXXXX" />
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={form.noindex} onChange={(e) => setForm((f) => ({ ...f, noindex: e.target.checked }))} />
        <span className="text-sm">Noindex (hide from search engines)</span>
      </label>
      <button onClick={() => onSave(form)} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">
        {saving ? <Loader2 size={18} className="animate-spin" /> : "Save SEO"}
      </button>
    </div>
  );
}

function PaymentForm({ payment, onSave, saving }: { payment: any; onSave: (u: Record<string, unknown>) => void; saving: boolean }) {
  const [form, setForm] = useState({
    payment_currency: payment?.payment_currency || "USD",
    bank_transfer_enabled: payment?.bank_transfer_enabled || false,
    bank_transfer_instructions: payment?.bank_transfer_instructions || "",
    cash_on_delivery_enabled: payment?.cash_on_delivery_enabled || false,
  });
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Currency</label>
        <select value={form.payment_currency} onChange={(e) => setForm((f) => ({ ...f, payment_currency: e.target.value }))} className="w-full px-3 py-2 rounded-md border border-input bg-background">
          <option value="USD">USD</option>
          <option value="KES">KES</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
        </select>
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={form.bank_transfer_enabled} onChange={(e) => setForm((f) => ({ ...f, bank_transfer_enabled: e.target.checked }))} />
        <span className="text-sm">Bank Transfer</span>
      </label>
      {form.bank_transfer_enabled && (
        <textarea value={form.bank_transfer_instructions} onChange={(e) => setForm((f) => ({ ...f, bank_transfer_instructions: e.target.value }))} className="w-full px-3 py-2 rounded-md border border-input bg-background" rows={3} placeholder="Instructions for bank transfer" />
      )}
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={form.cash_on_delivery_enabled} onChange={(e) => setForm((f) => ({ ...f, cash_on_delivery_enabled: e.target.checked }))} />
        <span className="text-sm">Cash on Delivery</span>
      </label>
      <button onClick={() => onSave(form)} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">
        {saving ? <Loader2 size={18} className="animate-spin" /> : "Save Payment"}
      </button>
    </div>
  );
}

function ShippingForm({ shipping, onSave, saving }: { shipping: any; onSave: (u: Record<string, unknown>) => void; saving: boolean }) {
  const s = shipping?.settings ?? shipping;
  const [form, setForm] = useState({
    origin_address_line1: s?.origin_address_line1 || "",
    origin_city: s?.origin_city || "",
    origin_state: s?.origin_state || "",
    origin_postal_code: s?.origin_postal_code || "",
    origin_country: s?.origin_country || "US",
    free_shipping_enabled: s?.free_shipping_enabled || false,
    free_shipping_threshold: s?.free_shipping_threshold || "",
    flat_rate_enabled: s?.flat_rate_enabled || false,
    flat_rate_amount: s?.flat_rate_amount || "",
    flat_rate_name: s?.flat_rate_name || "Standard Shipping",
    local_pickup_enabled: s?.local_pickup_enabled || false,
  });
  return (
    <div className="space-y-4">
      <h4 className="font-medium">Origin Address</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <input placeholder="Address" value={form.origin_address_line1} onChange={(e) => setForm((f) => ({ ...f, origin_address_line1: e.target.value }))} className="px-3 py-2 rounded-md border border-input bg-background" />
        <input placeholder="City" value={form.origin_city} onChange={(e) => setForm((f) => ({ ...f, origin_city: e.target.value }))} className="px-3 py-2 rounded-md border border-input bg-background" />
        <input placeholder="State" value={form.origin_state} onChange={(e) => setForm((f) => ({ ...f, origin_state: e.target.value }))} className="px-3 py-2 rounded-md border border-input bg-background" />
        <input placeholder="Postal code" value={form.origin_postal_code} onChange={(e) => setForm((f) => ({ ...f, origin_postal_code: e.target.value }))} className="px-3 py-2 rounded-md border border-input bg-background" />
        <input placeholder="Country" value={form.origin_country} onChange={(e) => setForm((f) => ({ ...f, origin_country: e.target.value }))} className="px-3 py-2 rounded-md border border-input bg-background" />
      </div>
      <h4 className="font-medium">Rates</h4>
      <label className="flex flex-wrap items-center gap-2">
        <input type="checkbox" checked={form.free_shipping_enabled} onChange={(e) => setForm((f) => ({ ...f, free_shipping_enabled: e.target.checked }))} />
        <span className="text-sm">Free shipping above</span>
        <input type="number" value={form.free_shipping_threshold} onChange={(e) => setForm((f) => ({ ...f, free_shipping_threshold: e.target.value }))} className="w-20 px-2 py-1 rounded border border-input text-sm" placeholder="0" />
      </label>
      <label className="flex flex-wrap items-center gap-2">
        <input type="checkbox" checked={form.flat_rate_enabled} onChange={(e) => setForm((f) => ({ ...f, flat_rate_enabled: e.target.checked }))} />
        <span className="text-sm">Flat rate</span>
        <input type="number" step="0.01" value={form.flat_rate_amount} onChange={(e) => setForm((f) => ({ ...f, flat_rate_amount: e.target.value }))} className="w-20 px-2 py-1 rounded border border-input text-sm" placeholder="0" />
        <input value={form.flat_rate_name} onChange={(e) => setForm((f) => ({ ...f, flat_rate_name: e.target.value }))} className="w-full sm:flex-1 px-2 py-1 rounded border border-input text-sm" placeholder="Name" />
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={form.local_pickup_enabled} onChange={(e) => setForm((f) => ({ ...f, local_pickup_enabled: e.target.checked }))} />
        <span className="text-sm">Local pickup</span>
      </label>
      <button onClick={() => onSave(form)} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">
        {saving ? <Loader2 size={18} className="animate-spin" /> : "Save Shipping"}
      </button>
    </div>
  );
}

function TaxForm({ tax, onSave, saving }: { tax: any; onSave: (u: Record<string, unknown>) => void; saving: boolean }) {
  const t = tax?.settings ?? tax;
  const [form, setForm] = useState({
    tax_calculation_method: t?.tax_calculation_method || "automatic",
    prices_include_tax: t?.prices_include_tax || false,
    display_prices_with_tax: t?.display_prices_with_tax || false,
    vat_number: t?.vat_number || "",
  });
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Calculation Method</label>
        <select value={form.tax_calculation_method} onChange={(e) => setForm((f) => ({ ...f, tax_calculation_method: e.target.value }))} className="w-full px-3 py-2 rounded-md border border-input bg-background">
          <option value="automatic">Automatic</option>
          <option value="manual">Manual</option>
        </select>
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={form.prices_include_tax} onChange={(e) => setForm((f) => ({ ...f, prices_include_tax: e.target.checked }))} />
        <span>Prices include tax</span>
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={form.display_prices_with_tax} onChange={(e) => setForm((f) => ({ ...f, display_prices_with_tax: e.target.checked }))} />
        <span>Display prices with tax</span>
      </label>
      <div>
        <label className="text-sm font-medium">VAT Number</label>
        <input value={form.vat_number} onChange={(e) => setForm((f) => ({ ...f, vat_number: e.target.value }))} className="w-full px-3 py-2 rounded-md border border-input bg-background" />
      </div>
      <button onClick={() => onSave(form)} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">
        {saving ? <Loader2 size={18} className="animate-spin" /> : "Save Tax"}
      </button>
    </div>
  );
}
