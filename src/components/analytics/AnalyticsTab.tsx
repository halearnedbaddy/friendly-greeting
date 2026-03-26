import { useState, useEffect, lazy, Suspense } from "react";
import {
  BarChart3,
  TrendingUp,
  Users,
  Globe,
  FileText,
  Loader2,
  Zap,
  Lightbulb,
  Download,
  Plus,
  ChevronRight,
} from "lucide-react";
import { api } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/useCurrency";
import { cn } from "@/lib/utils";
import { downloadCSV } from "@/utils/csvExport";
import type { StoreTab } from "@/components/store/StoreSidebar";

// Lazy-load recharts-heavy components only when their sub-tab is selected
const StoreAnalytics = lazy(() => import("@/components/store/StoreAnalytics").then(m => ({ default: m.StoreAnalytics })));
const AnalyticsForecastingSection = lazy(() => import("./AnalyticsForecastingSection").then(m => ({ default: m.AnalyticsForecastingSection })));

type AnalyticsSubTab =
  | "overview"
  | "forecasting"
  | "customer-insights"
  | "traffic"
  | "insights"
  | "market-intelligence"
  | "custom-reports";

const TAB_MAP: Partial<Record<StoreTab, AnalyticsSubTab>> = {
  analytics: "overview",
  "analytics-overview": "overview",
  "analytics-forecasting": "forecasting",
  "analytics-customer-insights": "customer-insights",
  "analytics-traffic": "traffic",
  "analytics-insights": "insights",
  "analytics-market-intelligence": "market-intelligence",
  "analytics-custom-reports": "custom-reports",
};

export function AnalyticsTab({ activeTab = "analytics" }: { activeTab?: StoreTab }) {
  useToast(); // keep hook call order
  const [subTab, setSubTab] = useState<AnalyticsSubTab>(TAB_MAP[activeTab] ?? "overview");

  useEffect(() => {
    const mapped = TAB_MAP[activeTab];
    if (mapped) setSubTab(mapped);
  }, [activeTab]);

  const subTabs = [
    { id: "overview" as AnalyticsSubTab, label: "Overview", icon: BarChart3 },
    { id: "forecasting" as AnalyticsSubTab, label: "Forecasting", icon: TrendingUp },
    { id: "customer-insights" as AnalyticsSubTab, label: "Customer Insights", icon: Users },
    { id: "traffic" as AnalyticsSubTab, label: "Traffic", icon: Globe },
    { id: "insights" as AnalyticsSubTab, label: "Insights", icon: Lightbulb },
    { id: "market-intelligence" as AnalyticsSubTab, label: "Market Intel", icon: Zap },
    { id: "custom-reports" as AnalyticsSubTab, label: "Custom Reports", icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Analytics</h2>

      <div className="flex flex-wrap gap-2 border-b border-border pb-2 overflow-x-auto">
        {subTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap",
              subTab === id ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
            )}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>

      {subTab === "overview" && (
        <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted" />}>
          <StoreAnalytics />
        </Suspense>
      )}

      {subTab === "forecasting" && (
        <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted" />}>
          <AnalyticsForecastingSection />
        </Suspense>
      )}

      {subTab === "customer-insights" && <CustomerInsightsSection />}

      {subTab === "traffic" && <TrafficSection />}

      {subTab === "insights" && <InsightsSection />}

      {subTab === "market-intelligence" && (
        <div className="rounded-lg border border-border p-6 space-y-4 bg-card">
          <h3 className="font-semibold">Market Intelligence</h3>
          <p className="text-sm text-muted-foreground">Competitive benchmarking and market trends. See how your store compares to industry standards.</p>
          <p className="text-sm text-amber-600">Available on Enterprise plans.</p>
        </div>
      )}

      {subTab === "custom-reports" && <CustomReportsSection />}
    </div>
  );
}

function CustomerInsightsSection() {
  const { formatPrice } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [customerData, setCustomerData] = useState<any>(null);
  const [cohorts, setCohorts] = useState<any[]>([]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getAnalyticsCustomers?.(),
      api.getAnalyticsCustomerCohorts?.(),
    ]).then(([custRes, cohortRes]) => {
      setLoading(false);
      if (custRes?.success && custRes.data) setCustomerData(custRes.data);
      if (cohortRes?.success && cohortRes.data) setCohorts(Array.isArray(cohortRes.data) ? cohortRes.data : []);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const c = customerData || {};

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border p-4 bg-card">
          <p className="text-sm text-muted-foreground">Total Customers</p>
          <p className="text-2xl font-bold">{c.total_customers ?? "-"}</p>
        </div>
        <div className="rounded-lg border border-border p-4 bg-card">
          <p className="text-sm text-muted-foreground">New (30 days)</p>
          <p className="text-2xl font-bold text-green-600">{c.new_customers_30d ?? "-"}</p>
        </div>
        <div className="rounded-lg border border-border p-4 bg-card">
          <p className="text-sm text-muted-foreground">Returning</p>
          <p className="text-2xl font-bold">{c.returning_customers ?? "-"}</p>
        </div>
        <div className="rounded-lg border border-border p-4 bg-card">
          <p className="text-sm text-muted-foreground">Avg Customer Value</p>
          <p className="text-2xl font-bold">{c.avg_customer_value != null ? formatPrice(c.avg_customer_value, "KES") : "-"}</p>
        </div>
      </div>

      {cohorts.length > 0 && (
        <div className="rounded-lg border border-border p-6 bg-card">
          <h3 className="font-semibold mb-4">Cohort Retention</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2">Cohort</th>
                  <th className="text-right py-2">Size</th>
                  <th className="text-right py-2">Retention</th>
                </tr>
              </thead>
              <tbody>
                {cohorts.slice(0, 12).map((ch: any) => (
                  <tr key={ch.id} className="border-b border-border/50">
                    <td className="py-2">{ch.cohort_date}</td>
                    <td className="text-right">{ch.cohort_size ?? 0}</td>
                    <td className="text-right">{Array.isArray(ch.retention_data) ? `${ch.retention_data.length} periods` : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function TrafficSection() {
  const [loading, setLoading] = useState(true);
  const [traffic, setTraffic] = useState<any[]>([]);
  const [period, setPeriod] = useState("30d");

  useEffect(() => {
    setLoading(true);
    api.getAnalyticsTraffic?.({ period }).then((res: any) => {
      setLoading(false);
      if (res?.success && res.data) setTraffic(Array.isArray(res.data) ? res.data : []);
    });
  }, [period]);

  const bySource: Record<string, { sessions: number; conversions: number; value: number }> = {};
  for (const t of traffic) {
    const s = t.source || "direct";
    if (!bySource[s]) bySource[s] = { sessions: 0, conversions: 0, value: 0 };
    bySource[s].sessions += t.sessions || 0;
    bySource[s].conversions += t.conversions || 0;
    bySource[s].value += Number(t.conversion_value) || 0;
  }
  const sourceList = Object.entries(bySource).map(([source, data]) => ({ source, ...data }));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Traffic Sources</h3>
        <select value={period} onChange={(e) => setPeriod(e.target.value)} className="px-3 py-2 rounded-md border border-input bg-background text-sm">
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>
      </div>
      {loading ? (
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
      ) : sourceList.length > 0 ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3">Source</th>
                <th className="text-right p-3">Sessions</th>
                <th className="text-right p-3">Conversions</th>
                <th className="text-right p-3">Value</th>
              </tr>
            </thead>
            <tbody>
              {sourceList.map((row) => (
                <tr key={row.source} className="border-t border-border">
                  <td className="p-3 font-medium capitalize">{row.source}</td>
                  <td className="p-3 text-right">{row.sessions}</td>
                  <td className="p-3 text-right">{row.conversions}</td>
                  <td className="p-3 text-right">{row.value.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-border p-8 text-center text-muted-foreground">
          <Globe className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No traffic data yet. Connect your storefront to start tracking traffic sources.</p>
        </div>
      )}
    </div>
  );
}

function InsightsSection() {
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<any[]>([]);

  useEffect(() => {
    setLoading(true);
    api.getAnalyticsInsights?.().then((res: any) => {
      setLoading(false);
      if (res?.success && res.data) setInsights(Array.isArray(res.data) ? res.data : []);
    });
  }, []);

  const handleMarkRead = async (id: string) => {
    await api.markAnalyticsInsightRead?.(id);
    setInsights((prev) => prev.map((i) => (i.id === id ? { ...i, is_read: true } : i)));
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Automated Insights</h3>
      <p className="text-sm text-muted-foreground">AI-generated recommendations, anomaly detection, and opportunity alerts.</p>
      {loading ? (
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
      ) : insights.length > 0 ? (
        <div className="space-y-2">
          {insights.map((ins: any) => (
            <div
              key={ins.id}
              className={cn(
                "rounded-lg border p-4 transition",
                ins.is_read ? "border-border bg-card" : "border-primary/30 bg-primary/5"
              )}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{ins.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{ins.description}</p>
                  {ins.recommendation && <p className="text-sm text-primary mt-2">{ins.recommendation}</p>}
                </div>
                {!ins.is_read && (
                  <button onClick={() => handleMarkRead(ins.id)} className="text-xs text-muted-foreground hover:text-foreground">
                    Mark read
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border p-8 text-center text-muted-foreground">
          <Lightbulb className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No insights yet. Keep selling to get personalized recommendations.</p>
        </div>
      )}
    </div>
  );
}

function CustomReportsSection() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.getAnalyticsReports?.().then((res: any) => {
      setLoading(false);
      if (res?.success && res.data) setReports(Array.isArray(res.data) ? res.data : []);
    });
  }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const res = await api.createAnalyticsReport?.({ name: form.name.trim(), description: form.description || undefined });
    setSaving(false);
    if (res?.success) {
      setShowCreate(false);
      setForm({ name: "", description: "" });
      setReports((prev) => [...prev, res.data].filter(Boolean));
      toast({ title: "Report created" });
    } else {
      toast({ title: "Failed to create", variant: "destructive" });
    }
  };

  const handleExport = async () => {
    const res = await api.exportAnalyticsReport?.({ report_type: "transactions", format: "csv" });
    if (res?.success && typeof res.data === "string") {
      downloadCSV(res.data, "analytics-export");
      toast({ title: "Export downloaded" });
    } else {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Custom Reports</h3>
        <div className="flex gap-2">
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-input hover:bg-muted text-sm">
            <Download size={18} />
            Export CSV
          </button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">
            <Plus size={18} />
            New Report
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="rounded-lg border border-border p-4 bg-card space-y-3">
          <input
            placeholder="Report name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full px-3 py-2 rounded-md border border-input bg-background"
          />
          <textarea
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="w-full px-3 py-2 rounded-md border border-input bg-background"
            rows={2}
          />
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">
              {saving ? <Loader2 size={18} className="animate-spin" /> : "Create"}
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-muted rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
      ) : reports.length > 0 ? (
        <div className="space-y-2">
          {reports.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/30">
              <div>
                <p className="font-medium">{r.name}</p>
                <p className="text-sm text-muted-foreground">{r.description || "-"}</p>
              </div>
              <ChevronRight size={20} className="text-muted-foreground" />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border p-8 text-center text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No custom reports. Create one to get started.</p>
        </div>
      )}
    </div>
  );
}
