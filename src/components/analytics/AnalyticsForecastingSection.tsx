import { useState, useEffect } from "react";
import { TrendingUp, Loader2, RefreshCw } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/useCurrency";

export function AnalyticsForecastingSection() {
  const { formatPrice } = useCurrency();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [forecasts, setForecasts] = useState<any[]>([]);
  const [horizon, setHorizon] = useState(30);

  const loadForecasts = async () => {
    setLoading(true);
    const res = await api.getAnalyticsForecast?.({ horizon: String(horizon) });
    setLoading(false);
    if (res?.success && res.data) setForecasts(Array.isArray(res.data) ? res.data : []);
  };

  useEffect(() => {
    loadForecasts();
  }, [horizon]);

  const handleGenerate = async () => {
    setGenerating(true);
    const res = await api.generateAnalyticsForecast?.({ horizon_days: horizon });
    setGenerating(false);
    if (res?.success) {
      loadForecasts();
      toast({ title: "Forecast generated" });
    } else {
      toast({ title: "Failed to generate", variant: "destructive" });
    }
  };

  const chartData = forecasts
    .slice(0, Math.min(horizon, 30))
    .map((f) => ({
      date: f.forecast_date ? new Date(f.forecast_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "",
      value: Number(f.predicted_value) || 0,
    }));

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border p-6 bg-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold">Sales Forecast</h3>
            <p className="text-sm text-muted-foreground">Revenue predictions based on historical data. Plan inventory and staffing.</p>
          </div>
          <div className="flex gap-2">
            <select
              value={horizon}
              onChange={(e) => setHorizon(parseInt(e.target.value))}
              className="px-3 py-2 rounded-md border border-input bg-background text-sm"
            >
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
            <button onClick={handleGenerate} disabled={generating} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
              {generating ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
              Generate
            </button>
          </div>
        </div>

        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
          </div>
        ) : chartData.length > 0 ? (
          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="fgRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: any) => [formatPrice(Number(v), "KES"), "Predicted"]} />
                <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="url(#fgRevenue)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="mt-6 h-64 flex items-center justify-center bg-muted rounded-lg">
            <div className="text-center text-muted-foreground">
              <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No forecast data. Click Generate to create predictions.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
