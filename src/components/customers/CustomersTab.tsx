import { useState, useEffect } from "react";
import {
  Users,
  Layers,
  BarChart3,
  Gift,
  Loader2,
  Plus,
  Search,
  Download,
  RefreshCw,
  X,
  Mail,
  Phone,
  Edit2,
  Trash2,
  ShoppingBag,
} from "lucide-react";
import { api } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { downloadCSV } from "@/utils/csvExport";
import type { StoreTab } from "@/components/store/StoreSidebar";

type CustomersSubTab = "all" | "segments" | "analytics" | "loyalty";

const TAB_MAP: Partial<Record<StoreTab, CustomersSubTab>> = {
  customers: "all",
  "customers-all": "all",
  "customers-segments": "segments",
  "customers-analytics": "analytics",
  "customers-loyalty": "loyalty",
};

const SORT_OPTIONS = [
  { value: "created_at", label: "Newest" },
  { value: "total_spent", label: "Total Spent" },
  { value: "total_orders", label: "Orders" },
  { value: "last_order_at", label: "Last Order" },
  { value: "first_name", label: "Name" },
  { value: "email", label: "Email" },
];

export function CustomersTab({ activeTab = "customers" }: { activeTab?: StoreTab }) {
  const { toast } = useToast();
  const [subTab, setSubTab] = useState<CustomersSubTab>(TAB_MAP[activeTab] ?? "all");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [segmentFilter, setSegmentFilter] = useState("");
  const [tagsFilter, _setTagsFilter] = useState("");
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // All customers
  const [customersData, setCustomersData] = useState<any>(null);
  const customers = Array.isArray(customersData?.customers)
    ? customersData.customers
    : Array.isArray(customersData)
    ? customersData
    : [];
  const pagination = customersData?.pagination ?? { page: 1, limit: 20, total: 0, pages: 1 };

  // Segments
  const [segments, setSegments] = useState<any[]>([]);
  const [showNewSegment, setShowNewSegment] = useState(false);
  const [segmentForm, setSegmentForm] = useState({
    name: "",
    description: "",
    conditions: {} as Record<string, { operator: string; value: number | string | string[] }>,
  });

  // Analytics
  const [analytics, setAnalytics] = useState<any>(null);

  // Loyalty
  const [loyaltyProgram, setLoyaltyProgram] = useState<any>(null);
  const [showLoyaltyForm, setShowLoyaltyForm] = useState(false);
  const [loyaltyForm, setLoyaltyForm] = useState({
    name: "Loyalty Rewards",
    description: "",
    points_per_dollar: 1,
    welcome_bonus_points: 0,
    birthday_bonus_points: 0,
    minimum_redemption_points: 100,
    points_value: 0.01,
    is_active: true,
  });

  // Customer detail / create modals
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [customerForm, setCustomerForm] = useState({
    email: "",
    phone: "",
    first_name: "",
    last_name: "",
    tags: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const mapped = TAB_MAP[activeTab];
    if (mapped) setSubTab(mapped);
  }, [activeTab]);

  const loadCustomers = async () => {
    setLoading(true);
    const res = await api.getCustomers?.({
      page,
      limit: 20,
      search: searchQuery || undefined,
      segment_id: segmentFilter || undefined,
      tags: tagsFilter ? tagsFilter.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
      sort: sortField,
      order: sortOrder,
    });
    setLoading(false);
    if (res?.success && res.data) {
      const d = res.data as any;
      setCustomersData(Array.isArray(d) ? { customers: d, pagination: { page: 1, limit: 20, total: d.length, pages: 1 } } : d);
    }
  };

  const loadSegments = async () => {
    setLoading(true);
    const res = await api.getCustomerSegments?.();
    setLoading(false);
    if (res?.success && res.data) setSegments(Array.isArray(res.data) ? res.data : []);
  };

  const loadAnalytics = async () => {
    setLoading(true);
    const res = await api.getCustomerAnalytics?.();
    setLoading(false);
    if (res?.success && res.data) setAnalytics(res.data);
  };

  const loadLoyalty = async () => {
    setLoading(true);
    const res = await api.getLoyaltyProgram?.();
    setLoading(false);
    if (res?.success && res.data) {
      const p = res.data;
      setLoyaltyProgram(p);
      if (p) {
        setLoyaltyForm({
          name: p.name || "Loyalty Rewards",
          description: p.description || "",
          points_per_dollar: p.points_per_dollar ?? 1,
          welcome_bonus_points: p.welcome_bonus_points ?? 0,
          birthday_bonus_points: p.birthday_bonus_points ?? 0,
          minimum_redemption_points: p.minimum_redemption_points ?? 100,
          points_value: p.points_value ?? 0.01,
          is_active: p.is_active !== false,
        });
      }
    }
  };

  useEffect(() => {
    if (subTab === "all") {
      loadSegments();
      loadCustomers();
    } else if (subTab === "segments") loadSegments();
    else if (subTab === "analytics") loadAnalytics();
    else if (subTab === "loyalty") loadLoyalty();
  }, [subTab, page, searchQuery, segmentFilter, tagsFilter, sortField, sortOrder]);

  const handleCreateSegment = async () => {
    if (!segmentForm.name.trim()) return;
    setSaving(true);
    const res = await api.createCustomerSegment?.({
      name: segmentForm.name.trim(),
      description: segmentForm.description || undefined,
      segment_type: "custom",
      conditions: Object.keys(segmentForm.conditions).length ? segmentForm.conditions : undefined,
    });
    setSaving(false);
    if (res?.success) {
      setShowNewSegment(false);
      setSegmentForm({ name: "", description: "", conditions: {} });
      loadSegments();
      toast({ title: "Segment created" });
    } else {
      toast({ title: "Failed to create segment", description: (res as any)?.error, variant: "destructive" });
    }
  };

  const handleCreateCustomer = async () => {
    if (!customerForm.email?.trim() && !customerForm.phone?.trim()) {
      toast({ title: "Email or phone required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const res = await api.createCustomer?.({
      email: customerForm.email?.trim() || undefined,
      phone: customerForm.phone?.trim() || undefined,
      first_name: customerForm.first_name?.trim() || undefined,
      last_name: customerForm.last_name?.trim() || undefined,
      tags: customerForm.tags ? customerForm.tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
      notes: customerForm.notes?.trim() || undefined,
    });
    setSaving(false);
    if (res?.success) {
      setShowCreateCustomer(false);
      setCustomerForm({ email: "", phone: "", first_name: "", last_name: "", tags: "", notes: "" });
      loadCustomers();
      toast({ title: "Customer created" });
    } else {
      toast({ title: "Failed to create customer", description: (res as any)?.error, variant: "destructive" });
    }
  };

  const handleUpdateCustomer = async () => {
    if (!selectedCustomer?.id) return;
    setSaving(true);
    const res = await api.updateCustomer?.(selectedCustomer.id, {
      first_name: customerForm.first_name?.trim() || null,
      last_name: customerForm.last_name?.trim() || null,
      email: customerForm.email?.trim() || null,
      phone: customerForm.phone?.trim() || null,
      tags: customerForm.tags ? customerForm.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      notes: customerForm.notes?.trim() || null,
    });
    setSaving(false);
    if (res?.success) {
      setSelectedCustomer(null);
      loadCustomers();
      toast({ title: "Customer updated" });
    } else {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!confirm("Delete this customer?")) return;
    const res = await api.deleteCustomer?.(id);
    if (res?.success) {
      setSelectedCustomer(null);
      loadCustomers();
      toast({ title: "Customer deleted" });
    } else {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const handleExportCustomers = async () => {
    const res = await api.exportCustomers?.();
    if (res?.success && typeof res.data === "string") {
      downloadCSV(res.data, "customers");
      toast({ title: "Export downloaded" });
    } else {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  const handleSyncFromTransactions = async () => {
    setSaving(true);
    const res = await api.syncCustomersFromTransactions?.();
    setSaving(false);
    if (res?.success && res.data) {
      const d = res.data as any;
      toast({ title: "Sync complete", description: `Synced ${d.synced ?? 0} transactions, ${d.created ?? 0} new customers` });
      loadCustomers();
    } else {
      toast({ title: "Sync failed", variant: "destructive" });
    }
  };

  const handleSaveLoyalty = async () => {
    setSaving(true);
    const res = await api.upsertLoyaltyProgram?.({
      ...loyaltyForm,
      points_value: Number(loyaltyForm.points_value),
    });
    setSaving(false);
    if (res?.success) {
      loadLoyalty();
      setShowLoyaltyForm(false);
      toast({ title: "Loyalty program saved" });
    } else {
      toast({ title: "Failed to save", variant: "destructive" });
    }
  };

  const openCustomerDetail = async (c: any) => {
    setSelectedCustomer(c);
    setCustomerForm({
      email: c.email || "",
      phone: c.phone || "",
      first_name: c.first_name || "",
      last_name: c.last_name || "",
      tags: Array.isArray(c.tags) ? c.tags.join(", ") : "",
      notes: c.notes || "",
    });
  };

  const subTabs = [
    { id: "all" as CustomersSubTab, label: "All Customers", icon: Users },
    { id: "segments" as CustomersSubTab, label: "Segments", icon: Layers },
    { id: "analytics" as CustomersSubTab, label: "Analytics", icon: BarChart3 },
    { id: "loyalty" as CustomersSubTab, label: "Loyalty Program", icon: Gift },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Customers</h2>

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {subTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition",
              subTab === id ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
            )}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>

      {/* All Customers */}
      {subTab === "all" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                placeholder="Search by email, name, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadCustomers()}
                className="w-full pl-9 pr-3 py-2 rounded-md border border-input bg-background text-sm"
              />
            </div>
            <select
              value={segmentFilter}
              onChange={(e) => setSegmentFilter(e.target.value)}
              className="px-3 py-2 rounded-md border border-input bg-background text-sm"
            >
              <option value="">All segments</option>
              {segments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={`${sortField}:${sortOrder}`}
              onChange={(e) => {
                const [s, o] = e.target.value.split(":");
                setSortField(s);
                setSortOrder((o as "asc" | "desc") || "desc");
              }}
              className="px-3 py-2 rounded-md border border-input bg-background text-sm"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={`${opt.value}:desc`}>
                  {opt.label} (desc)
                </option>
              ))}
            </select>
            <button
              onClick={() => loadSegments()}
              className="p-2 rounded-md border border-input hover:bg-muted"
              title="Refresh segments"
            >
              <RefreshCw size={18} />
            </button>
            <button
              onClick={loadCustomers}
              className="px-4 py-2 rounded-lg border border-input hover:bg-muted text-sm font-medium"
            >
              Search
            </button>
            <button
              onClick={() => setShowCreateCustomer(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
            >
              <Plus size={18} />
              Add Customer
            </button>
            <button
              onClick={handleExportCustomers}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-input hover:bg-muted text-sm"
            >
              <Download size={18} />
              Export CSV
            </button>
            <button
              onClick={handleSyncFromTransactions}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-input hover:bg-muted text-sm"
              title="Sync customers from completed transactions"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
              Sync from Transactions
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="divide-y divide-border">
                {customers.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No customers yet. Add manually or sync from completed transactions.
                  </div>
                ) : (
                  customers.map((c: any) => {
                    const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || c.phone || "Customer";
                    const loyalty = c.customer_loyalty_accounts?.[0];
                    return (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-4 hover:bg-muted/20 cursor-pointer"
                        onClick={() => openCustomerDetail(c)}
                      >
                        <div>
                          <p className="font-medium">{name}</p>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                            {c.email && (
                              <span className="flex items-center gap-1">
                                <Mail size={12} /> {c.email}
                              </span>
                            )}
                            {c.phone && (
                              <span className="flex items-center gap-1">
                                <Phone size={12} /> {c.phone}
                              </span>
                            )}
                          </div>
                          {c.tags?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {c.tags.map((t: string) => (
                                <span key={t} className="px-1.5 py-0.5 rounded bg-muted text-xs">
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span title="Orders">{c.total_orders ?? 0} orders</span>
                          <span title="Total spent" className="font-medium">
                            {typeof c.total_spent === "number" ? c.total_spent.toFixed(2) : c.total_spent ?? "0"}
                          </span>
                          {loyalty?.points_balance != null && (
                            <span className="text-amber-600 flex items-center gap-1">
                              <Gift size={14} /> {loyalty.points_balance} pts
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              {pagination.pages > 1 && (
                <div className="flex justify-between items-center p-3 border-t border-border">
                  <span className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.pages} ({pagination.total} total)
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={pagination.page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1 rounded border disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      disabled={pagination.page >= pagination.pages}
                      onClick={() => setPage((p) => p + 1)}
                      className="px-3 py-1 rounded border disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Segments */}
      {subTab === "segments" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowNewSegment(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
            >
              <Plus size={18} />
              New Segment
            </button>
          </div>
          {showNewSegment && (
            <div className="rounded-lg border border-border p-4 space-y-3 bg-card">
              <h4 className="font-medium">New Segment</h4>
              <input
                placeholder="Segment name"
                value={segmentForm.name}
                onChange={(e) => setSegmentForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 rounded-md border border-input bg-background"
              />
              <textarea
                placeholder="Description (optional)"
                value={segmentForm.description}
                onChange={(e) => setSegmentForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2 rounded-md border border-input bg-background"
                rows={2}
              />
              <div className="text-sm text-muted-foreground">
                Conditions (optional): Add JSON conditions like total_spent, total_orders, tags. Example: {"{ \"total_spent\": { \"operator\": \"gte\", \"value\": 100 } }"}
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreateSegment} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                </button>
                <button onClick={() => setShowNewSegment(false)} className="px-4 py-2 bg-muted rounded-lg text-sm">
                  Cancel
                </button>
              </div>
            </div>
          )}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="divide-y divide-border">
                {segments.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No segments yet. Create segments to group customers for targeting.
                  </div>
                ) : (
                  segments.map((seg: any) => (
                    <div key={seg.id} className="flex items-center justify-between p-4 hover:bg-muted/20">
                      <div>
                        <p className="font-medium">{seg.name}</p>
                        <p className="text-sm text-muted-foreground">{seg.description || "-"}</p>
                      </div>
                      <span className="text-sm font-medium">{seg.customer_count ?? seg.member_count ?? 0} customers</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Analytics */}
      {subTab === "analytics" && (
        <div className="space-y-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-lg border border-border p-4 bg-card">
                <p className="text-sm text-muted-foreground">Total Customers</p>
                <p className="text-2xl font-bold">{analytics?.total_customers ?? 0}</p>
              </div>
              <div className="rounded-lg border border-border p-4 bg-card">
                <p className="text-sm text-muted-foreground">New (Last 30 Days)</p>
                <p className="text-2xl font-bold text-green-600">{analytics?.new_customers_30d ?? 0}</p>
              </div>
              <div className="rounded-lg border border-border p-4 bg-card">
                <p className="text-sm text-muted-foreground">Avg Customer Value</p>
                <p className="text-2xl font-bold">
                  {analytics?.avg_customer_value != null ? Number(analytics.avg_customer_value).toFixed(2) : "-"}
                </p>
              </div>
              <div className="rounded-lg border border-border p-4 bg-card">
                <p className="text-sm text-muted-foreground">Repeat Customers</p>
                <p className="text-2xl font-bold text-primary">
                  {analytics?.repeat_customers ?? 0}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loyalty Program */}
      {subTab === "loyalty" && (
        <div className="space-y-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {loyaltyProgram ? (
                <div className="rounded-lg border border-border p-6 bg-card">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold">{loyaltyProgram.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{loyaltyProgram.description || "No description"}</p>
                      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Points per $1</p>
                          <p className="font-medium">{loyaltyProgram.points_per_dollar ?? 1}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Welcome bonus</p>
                          <p className="font-medium">{loyaltyProgram.welcome_bonus_points ?? 0} pts</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Min redemption</p>
                          <p className="font-medium">{loyaltyProgram.minimum_redemption_points ?? 100} pts</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Status</p>
                          <p className="font-medium">{loyaltyProgram.is_active !== false ? "Active" : "Inactive"}</p>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowLoyaltyForm(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-input hover:bg-muted text-sm"
                    >
                      <Edit2 size={16} />
                      Edit
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-8 text-center">
                  <Gift className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No loyalty program yet. Set one up to reward your customers.</p>
                  <button
                    onClick={() => setShowLoyaltyForm(true)}
                    className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
                  >
                    Create Loyalty Program
                  </button>
                </div>
              )}

              {showLoyaltyForm && (
                <div className="rounded-lg border border-border p-6 bg-card space-y-4">
                  <h4 className="font-medium">Loyalty Program Settings</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Name</label>
                      <input
                        value={loyaltyForm.name}
                        onChange={(e) => setLoyaltyForm((f) => ({ ...f, name: e.target.value }))}
                        className="w-full px-3 py-2 mt-1 rounded-md border border-input bg-background"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Points per $1 spent</label>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={loyaltyForm.points_per_dollar}
                        onChange={(e) => setLoyaltyForm((f) => ({ ...f, points_per_dollar: parseFloat(e.target.value) || 1 }))}
                        className="w-full px-3 py-2 mt-1 rounded-md border border-input bg-background"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Welcome bonus (points)</label>
                      <input
                        type="number"
                        min={0}
                        value={loyaltyForm.welcome_bonus_points}
                        onChange={(e) => setLoyaltyForm((f) => ({ ...f, welcome_bonus_points: parseInt(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 mt-1 rounded-md border border-input bg-background"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Minimum redemption (points)</label>
                      <input
                        type="number"
                        min={0}
                        value={loyaltyForm.minimum_redemption_points}
                        onChange={(e) => setLoyaltyForm((f) => ({ ...f, minimum_redemption_points: parseInt(e.target.value) || 100 }))}
                        className="w-full px-3 py-2 mt-1 rounded-md border border-input bg-background"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Points value ($ per point, e.g. 0.01)</label>
                      <input
                        type="number"
                        step={0.001}
                        min={0}
                        value={loyaltyForm.points_value}
                        onChange={(e) => setLoyaltyForm((f) => ({ ...f, points_value: parseFloat(e.target.value) || 0.01 }))}
                        className="w-full px-3 py-2 mt-1 rounded-md border border-input bg-background"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-6">
                      <input
                        type="checkbox"
                        id="loyalty-active"
                        checked={loyaltyForm.is_active}
                        onChange={(e) => setLoyaltyForm((f) => ({ ...f, is_active: e.target.checked }))}
                      />
                      <label htmlFor="loyalty-active" className="text-sm">Active</label>
                    </div>
                  </div>
                  <textarea
                    placeholder="Description"
                    value={loyaltyForm.description}
                    onChange={(e) => setLoyaltyForm((f) => ({ ...f, description: e.target.value }))}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <button onClick={handleSaveLoyalty} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                    </button>
                    <button onClick={() => setShowLoyaltyForm(false)} className="px-4 py-2 bg-muted rounded-lg text-sm">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Create Customer Modal */}
      {showCreateCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg shadow-xl max-w-md w-full mx-4 p-6 space-y-4">
            <h3 className="text-lg font-semibold">Add Customer</h3>
            <input
              placeholder="Email"
              type="email"
              value={customerForm.email}
              onChange={(e) => setCustomerForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2 rounded-md border border-input bg-background"
            />
            <input
              placeholder="Phone"
              value={customerForm.phone}
              onChange={(e) => setCustomerForm((f) => ({ ...f, phone: e.target.value }))}
              className="w-full px-3 py-2 rounded-md border border-input bg-background"
            />
            <div className="flex gap-2">
              <input
                placeholder="First name"
                value={customerForm.first_name}
                onChange={(e) => setCustomerForm((f) => ({ ...f, first_name: e.target.value }))}
                className="flex-1 px-3 py-2 rounded-md border border-input bg-background"
              />
              <input
                placeholder="Last name"
                value={customerForm.last_name}
                onChange={(e) => setCustomerForm((f) => ({ ...f, last_name: e.target.value }))}
                className="flex-1 px-3 py-2 rounded-md border border-input bg-background"
              />
            </div>
            <input
              placeholder="Tags (comma-separated)"
              value={customerForm.tags}
              onChange={(e) => setCustomerForm((f) => ({ ...f, tags: e.target.value }))}
              className="w-full px-3 py-2 rounded-md border border-input bg-background"
            />
            <textarea
              placeholder="Notes"
              value={customerForm.notes}
              onChange={(e) => setCustomerForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 rounded-md border border-input bg-background"
              rows={2}
            />
            <div className="flex gap-2">
              <button onClick={handleCreateCustomer} disabled={saving} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Create"}
              </button>
              <button onClick={() => setShowCreateCustomer(false)} className="px-4 py-2 bg-muted rounded-lg text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border flex justify-between items-start">
              <h3 className="text-lg font-semibold">
                {[selectedCustomer.first_name, selectedCustomer.last_name].filter(Boolean).join(" ") || selectedCustomer.email || selectedCustomer.phone || "Customer"}
              </h3>
              <button onClick={() => setSelectedCustomer(null)} className="p-2 hover:bg-muted rounded">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Email</label>
                  <input
                    value={customerForm.email}
                    onChange={(e) => setCustomerForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 mt-1 rounded-md border border-input bg-background"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Phone</label>
                  <input
                    value={customerForm.phone}
                    onChange={(e) => setCustomerForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2 mt-1 rounded-md border border-input bg-background"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">First name</label>
                  <input
                    value={customerForm.first_name}
                    onChange={(e) => setCustomerForm((f) => ({ ...f, first_name: e.target.value }))}
                    className="w-full px-3 py-2 mt-1 rounded-md border border-input bg-background"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Last name</label>
                  <input
                    value={customerForm.last_name}
                    onChange={(e) => setCustomerForm((f) => ({ ...f, last_name: e.target.value }))}
                    className="w-full px-3 py-2 mt-1 rounded-md border border-input bg-background"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Tags (comma-separated)</label>
                <input
                  value={customerForm.tags}
                  onChange={(e) => setCustomerForm((f) => ({ ...f, tags: e.target.value }))}
                  className="w-full px-3 py-2 mt-1 rounded-md border border-input bg-background"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Notes</label>
                <textarea
                  value={customerForm.notes}
                  onChange={(e) => setCustomerForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 mt-1 rounded-md border border-input bg-background"
                  rows={3}
                />
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{selectedCustomer.total_orders ?? 0} orders</span>
                <span>Total: {typeof selectedCustomer.total_spent === "number" ? selectedCustomer.total_spent.toFixed(2) : selectedCustomer.total_spent ?? "0"}</span>
              </div>
              {selectedCustomer.orders?.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <ShoppingBag size={16} /> Order History
                  </h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {selectedCustomer.orders.slice(0, 10).map((o: any) => (
                      <div key={o.id} className="flex justify-between text-sm">
                        <span>{o.item_name ?? o.order_number ?? o.id?.slice(0, 8)}</span>
                        <span>{o.amount ?? o.total} - {o.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button onClick={handleUpdateCustomer} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </button>
                <button
                  onClick={() => selectedCustomer.id && handleDeleteCustomer(selectedCustomer.id)}
                  className="px-4 py-2 border border-red-500 text-red-500 rounded-lg text-sm hover:bg-red-500/10"
                >
                  <Trash2 size={14} className="inline mr-1" />
                  Delete
                </button>
                <button onClick={() => setSelectedCustomer(null)} className="px-4 py-2 bg-muted rounded-lg text-sm">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
