import { useState, useEffect } from "react";
import { Box, MapPin, Package, Loader2, Plus, Truck, Users, AlertTriangle } from "lucide-react";
import { api } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { StoreTab } from "@/components/store/StoreSidebar";

type InventorySubTab = "stock" | "locations" | "transfers" | "suppliers" | "reorder";

const TAB_MAP: Partial<Record<StoreTab, InventorySubTab>> = {
  inventory: "stock",
  "inventory-stock": "stock",
  "inventory-locations": "locations",
  "inventory-transfers": "transfers",
  "inventory-suppliers": "suppliers",
  "inventory-reorder": "reorder",
};

export function InventoryTab({ activeTab = "inventory" }: { activeTab?: StoreTab }) {
  const { toast } = useToast();
  const [subTab, setSubTab] = useState<InventorySubTab>(TAB_MAP[activeTab] ?? "stock");
  const [loading, setLoading] = useState(true);

  // Stock
  const [dashboard, setDashboard] = useState<any>(null);
  const [levels, setLevels] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<any>(null);
  const [adjustForm, setAdjustForm] = useState({ quantity_change: "", adjustment_type: "restock", reason: "", location_id: "" });
  const [adjusting, setAdjusting] = useState(false);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [locationFilter, setLocationFilter] = useState<string>("");

  // Locations
  const [locations, setLocations] = useState<any[]>([]);
  const [showNewLocation, setShowNewLocation] = useState(false);
  const [locationForm, setLocationForm] = useState({
    name: "",
    code: "",
    address_line1: "",
    city: "",
    country: "",
    contact_email: "",
    contact_phone: "",
    is_default: false,
    location_type: "warehouse",
  });
  const [saving, setSaving] = useState(false);

  // Transfers
  const [transfers, setTransfers] = useState<any[]>([]);
  const [showNewTransfer, setShowNewTransfer] = useState(false);
  const [transferForm, setTransferForm] = useState({
    from_location_id: "",
    to_location_id: "",
    product_id: "",
    quantity: "",
    notes: "",
  });
  const [products, setProducts] = useState<any[]>([]);

  // Suppliers
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [supplierForm, setSupplierForm] = useState({
    name: "",
    code: "",
    contact_name: "",
    email: "",
    phone: "",
    address_line1: "",
    city: "",
    country: "",
    payment_terms: "",
    lead_time_days: "",
    notes: "",
  });

  // Reorder
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [showCreatePO, setShowCreatePO] = useState(false);
  const [poProduct, setPoProduct] = useState<any>(null);
  const [poForm, setPoForm] = useState({ supplier_id: "", location_id: "", quantity: "", notes: "" });

  useEffect(() => {
    const mapped = TAB_MAP[activeTab];
    if (mapped) setSubTab(mapped);
  }, [activeTab]);

  const loadStock = async () => {
    setLoading(true);
    const [dashRes, levelsRes, adjRes] = await Promise.all([
      api.getInventoryDashboard?.(),
      api.getInventoryLevels?.({ location_id: locationFilter ? parseInt(locationFilter) : undefined, low_stock_only: lowStockOnly }),
      api.getInventoryAdjustments?.(),
    ]);
    setLoading(false);
    if (dashRes?.success && dashRes.data) setDashboard(dashRes.data);
    const levData = levelsRes?.success ? (Array.isArray(levelsRes.data) ? levelsRes.data : (levelsRes.data as any)?.data ?? []) : [];
    setLevels(levData);
    const adjData = adjRes?.success && adjRes.data ? (Array.isArray(adjRes.data) ? adjRes.data : []) : [];
    setAdjustments(adjData);
  };

  const loadLocations = async () => {
    setLoading(true);
    const res = await api.getInventoryLocations?.();
    setLoading(false);
    if (res?.success && res.data) setLocations(Array.isArray(res.data) ? res.data : []);
  };

  const loadTransfers = async () => {
    setLoading(true);
    const res = await api.getInventoryTransfers?.();
    setLoading(false);
    if (res?.success && res.data) setTransfers(Array.isArray(res.data) ? res.data : []);
  };

  const loadSuppliers = async () => {
    setLoading(true);
    const res = await api.getInventorySuppliers?.();
    setLoading(false);
    if (res?.success && res.data) setSuppliers(Array.isArray(res.data) ? res.data : []);
  };

  const loadProducts = async () => {
    const res = await api.getProducts?.({ limit: 200 });
    if (res?.success && res.data) {
      const prods = (res.data as any)?.products ?? (Array.isArray(res.data) ? res.data : []);
      setProducts(prods);
    }
  };

  const loadReorder = async () => {
    setLoading(true);
    const res = await api.getReorderRecommendations?.();
    setLoading(false);
    if (res?.success && res.data) setRecommendations(Array.isArray(res.data) ? res.data : []);
  };

  useEffect(() => {
    if (subTab === "stock") { loadLocations(); loadStock(); }
    else if (subTab === "locations") loadLocations();
    else if (subTab === "transfers") { loadTransfers(); loadLocations(); loadProducts(); }
    else if (subTab === "suppliers") loadSuppliers();
    else if (subTab === "reorder") { loadReorder(); loadSuppliers(); loadLocations(); }
  }, [subTab, lowStockOnly, locationFilter]);

  const handleAdjust = async () => {
    if (!adjustProduct || !adjustForm.quantity_change) return;
    const qty = parseInt(adjustForm.quantity_change);
    if (isNaN(qty)) return;
    setAdjusting(true);
    const res = await api.adjustInventory?.({
      product_id: adjustProduct.product_id ?? adjustProduct.id,
      location_id: adjustForm.location_id ? parseInt(adjustForm.location_id) : undefined,
      quantity_change: qty,
      adjustment_type: adjustForm.adjustment_type,
      reason: adjustForm.reason || undefined,
    });
    setAdjusting(false);
    if (res?.success) {
      setShowAdjustModal(false);
      setAdjustProduct(null);
      setAdjustForm({ quantity_change: "", adjustment_type: "restock", reason: "", location_id: "" });
      loadStock();
      toast({ title: "Inventory adjusted" });
    } else {
      toast({ title: "Adjustment failed", description: (res as any)?.error, variant: "destructive" });
    }
  };

  const handleCreateLocation = async () => {
    if (!locationForm.name.trim()) return;
    setSaving(true);
    const res = await api.createInventoryLocation?.({
      ...locationForm,
      lead_time_days: undefined,
      minimum_order_value: undefined,
    });
    setSaving(false);
    if (res?.success) {
      setShowNewLocation(false);
      setLocationForm({ name: "", code: "", address_line1: "", city: "", country: "", contact_email: "", contact_phone: "", is_default: false, location_type: "warehouse" });
      loadLocations();
      toast({ title: "Location created" });
    } else {
      toast({ title: "Failed to create location", variant: "destructive" });
    }
  };

  const handleCreateTransfer = async () => {
    const fromId = parseInt(transferForm.from_location_id);
    const toId = parseInt(transferForm.to_location_id);
    const qty = parseInt(transferForm.quantity);
    if (!fromId || !toId || !transferForm.product_id || !qty || fromId === toId) {
      toast({ title: "Fill all fields and use different locations", variant: "destructive" });
      return;
    }
    setSaving(true);
    const res = await api.createInventoryTransfer?.({
      from_location_id: fromId,
      to_location_id: toId,
      items: [{ product_id: transferForm.product_id, quantity: qty }],
      notes: transferForm.notes || undefined,
    });
    setSaving(false);
    if (res?.success) {
      setShowNewTransfer(false);
      setTransferForm({ from_location_id: "", to_location_id: "", product_id: "", quantity: "", notes: "" });
      loadTransfers();
      toast({ title: "Transfer created" });
    } else {
      toast({ title: "Transfer failed", variant: "destructive" });
    }
  };

  const handleCreateSupplier = async () => {
    if (!supplierForm.name.trim()) return;
    setSaving(true);
    const res = await api.createInventorySupplier?.({
      ...supplierForm,
      lead_time_days: supplierForm.lead_time_days ? parseInt(supplierForm.lead_time_days) : undefined,
    });
    setSaving(false);
    if (res?.success) {
      setShowNewSupplier(false);
      setSupplierForm({ name: "", code: "", contact_name: "", email: "", phone: "", address_line1: "", city: "", country: "", payment_terms: "", lead_time_days: "", notes: "" });
      loadSuppliers();
      toast({ title: "Supplier created" });
    } else {
      toast({ title: "Failed to create supplier", variant: "destructive" });
    }
  };

  const handleCreatePO = async () => {
    if (!poProduct) return;
    const qty = parseInt(poForm.quantity) || poProduct.recommended_order_quantity || 10;
    setSaving(true);
    const res = await api.createPurchaseOrder?.({
      supplier_id: poForm.supplier_id ? parseInt(poForm.supplier_id) : undefined,
      location_id: poForm.location_id ? parseInt(poForm.location_id) : undefined,
      items: [{ product_id: poProduct.id ?? poProduct.product_id, quantity: qty }],
      notes: poForm.notes || undefined,
    });
    setSaving(false);
    if (res?.success) {
      setShowCreatePO(false);
      setPoProduct(null);
      setPoForm({ supplier_id: "", location_id: "", quantity: "", notes: "" });
      loadReorder();
      toast({ title: "Purchase order created" });
    } else {
      toast({ title: "Failed to create PO", variant: "destructive" });
    }
  };

  const summary = dashboard?.summary ?? {};
  const lowStockProducts = dashboard?.low_stock_products ?? [];
  const recentAdj = dashboard?.recent_adjustments ?? adjustments;

  const subTabs = [
    { id: "stock" as InventorySubTab, label: "Stock Management", icon: Package },
    { id: "locations" as InventorySubTab, label: "Locations", icon: MapPin },
    { id: "transfers" as InventorySubTab, label: "Transfers", icon: Truck },
    { id: "suppliers" as InventorySubTab, label: "Suppliers", icon: Users },
    { id: "reorder" as InventorySubTab, label: "Reorder", icon: Box },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Inventory</h2>

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

      {/* Stock Management */}
      {subTab === "stock" && (
        <div className="space-y-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="rounded-lg border border-border p-4 bg-card">
                  <p className="text-sm text-muted-foreground">Total Products</p>
                  <p className="text-2xl font-bold">{summary.total_products ?? summary.total_skus ?? "-"}</p>
                </div>
                <div className="rounded-lg border border-border p-4 bg-card">
                  <p className="text-sm text-muted-foreground">Total Quantity</p>
                  <p className="text-2xl font-bold">{summary.total_quantity ?? "-"}</p>
                </div>
                <div className="rounded-lg border border-border p-4 bg-card">
                  <p className="text-sm text-muted-foreground">In Stock</p>
                  <p className="text-2xl font-bold text-green-600">{summary.in_stock_count ?? summary.in_stock ?? "-"}</p>
                </div>
                <div className="rounded-lg border border-border p-4 bg-card">
                  <p className="text-sm text-muted-foreground">Low Stock</p>
                  <p className="text-2xl font-bold text-amber-600">{summary.low_stock_count ?? summary.low_stock ?? "-"}</p>
                </div>
                <div className="rounded-lg border border-border p-4 bg-card">
                  <p className="text-sm text-muted-foreground">Out of Stock</p>
                  <p className="text-2xl font-bold text-red-600">{summary.out_of_stock_count ?? summary.out_of_stock ?? "-"}</p>
                </div>
              </div>

              {lowStockProducts.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4">
                  <h4 className="font-semibold flex items-center gap-2 text-amber-800 dark:text-amber-200">
                    <AlertTriangle size={18} />
                    Low Stock Alerts
                  </h4>
                  <div className="mt-2 space-y-1">
                    {lowStockProducts.slice(0, 10).map((p: any) => (
                      <div key={p.id} className="flex justify-between text-sm">
                        <span>{p.name ?? p.product_name}</span>
                        <span className="font-medium">{p.total_quantity ?? p.quantity ?? 0} / {p.low_stock_threshold ?? 10}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 items-center">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} className="rounded" />
                  <span className="text-sm">Low stock only</span>
                </label>
                {locations.length > 0 && (
                  <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-input bg-background text-sm">
                    <option value="">All locations</option>
                    {locations.map((loc: any) => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                  </select>
                )}
              </div>

              <div className="rounded-lg border border-border overflow-hidden">
                <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center">
                  <h3 className="font-semibold">Stock Levels</h3>
                </div>
                <div className="divide-y divide-border max-h-96 overflow-y-auto">
                  {levels.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">No inventory levels. Add products and adjust stock.</div>
                  ) : (
                    levels.map((item: any, i: number) => (
                      <div key={item.product_id ?? i} className="flex items-center justify-between p-4 hover:bg-muted/20">
                        <div>
                          <p className="font-medium">{item.product_name ?? item.name ?? "Product"}</p>
                          <p className="text-sm text-muted-foreground">{item.sku ? `SKU: ${item.sku}` : (item.locations?.length ? item.locations.map((l: any) => `${l.location_name || "?"}: ${l.quantity ?? 0}`).join(" | ") : "-")}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={item.total_quantity <= (item.low_stock_threshold ?? 10) ? "text-amber-600 font-semibold" : ""}>
                            {item.total_quantity ?? item.quantity ?? 0}
                          </span>
                          <button onClick={() => { setAdjustProduct(item); setShowAdjustModal(true); loadLocations(); }} className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90">Adjust</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-border overflow-hidden">
                <div className="p-4 border-b border-border bg-muted/30">
                  <h3 className="font-semibold">Recent Adjustments</h3>
                </div>
                <div className="divide-y divide-border max-h-64 overflow-y-auto">
                  {(recentAdj.length === 0 ? adjustments : recentAdj).length === 0 ? (
                    <div className="p-6 text-center text-muted-foreground text-sm">No adjustments yet</div>
                  ) : (
                    (recentAdj.length ? recentAdj : adjustments).slice(0, 20).map((adj: any) => (
                      <div key={adj.id} className="flex items-center justify-between p-3 text-sm">
                        <div>
                          <span className="font-medium">{adj.products?.name ?? adj.product_name ?? "Product"}</span>
                          <span className="text-muted-foreground ml-2">({adj.adjustment_type})</span>
                        </div>
                        <span className={adj.quantity_change > 0 ? "text-green-600" : "text-red-600"}>
                          {adj.quantity_change > 0 ? "+" : ""}{adj.quantity_change}
                        </span>
                        <span className="text-muted-foreground text-xs">{adj.created_at ? new Date(adj.created_at).toLocaleDateString() : ""}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Adjust Modal */}
      {showAdjustModal && adjustProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl p-6 w-full max-w-md">
            <h3 className="font-bold mb-4">Adjust Inventory: {adjustProduct.product_name ?? adjustProduct.name}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Quantity change (+ or -)</label>
                <input type="number" value={adjustForm.quantity_change} onChange={(e) => setAdjustForm((f) => ({ ...f, quantity_change: e.target.value }))} placeholder="e.g. 10 or -5" className="w-full px-3 py-2 rounded-lg border border-input bg-background" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select value={adjustForm.adjustment_type} onChange={(e) => setAdjustForm((f) => ({ ...f, adjustment_type: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-input bg-background">
                  <option value="restock">Restock</option>
                  <option value="sale">Sale</option>
                  <option value="return">Return</option>
                  <option value="damaged">Damaged</option>
                  <option value="correction">Correction</option>
                </select>
              </div>
              {locations.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-1">Location (optional)</label>
                  <select value={adjustForm.location_id} onChange={(e) => setAdjustForm((f) => ({ ...f, location_id: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-input bg-background">
                    <option value="">Default (product level)</option>
                    {locations.map((loc: any) => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Reason (optional)</label>
                <input type="text" value={adjustForm.reason} onChange={(e) => setAdjustForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Reason" className="w-full px-3 py-2 rounded-lg border border-input bg-background" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setShowAdjustModal(false); setAdjustProduct(null); }} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
              <button onClick={handleAdjust} disabled={adjusting || !adjustForm.quantity_change} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50">
                {adjusting ? <Loader2 size={16} className="animate-spin inline" /> : "Apply"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Locations */}
      {subTab === "locations" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowNewLocation(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
              <Plus size={18} /> Add Location
            </button>
          </div>
          {showNewLocation && (
            <div className="rounded-lg border border-border p-6 space-y-3 bg-card">
              <h4 className="font-medium">New Location</h4>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Name" value={locationForm.name} onChange={(e) => setLocationForm((f) => ({ ...f, name: e.target.value }))} className="col-span-2 px-3 py-2 rounded-md border border-input bg-background" />
                <input placeholder="Code (e.g. WH1)" value={locationForm.code} onChange={(e) => setLocationForm((f) => ({ ...f, code: e.target.value }))} className="px-3 py-2 rounded-md border border-input bg-background" />
                <select value={locationForm.location_type} onChange={(e) => setLocationForm((f) => ({ ...f, location_type: e.target.value }))} className="px-3 py-2 rounded-md border border-input bg-background">
                  <option value="warehouse">Warehouse</option>
                  <option value="store">Store</option>
                  <option value="3pl">3PL</option>
                </select>
              </div>
              <input placeholder="Address" value={locationForm.address_line1} onChange={(e) => setLocationForm((f) => ({ ...f, address_line1: e.target.value }))} className="w-full px-3 py-2 rounded-md border border-input bg-background" />
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="City" value={locationForm.city} onChange={(e) => setLocationForm((f) => ({ ...f, city: e.target.value }))} className="px-3 py-2 rounded-md border border-input bg-background" />
                <input placeholder="Country" value={locationForm.country} onChange={(e) => setLocationForm((f) => ({ ...f, country: e.target.value }))} className="px-3 py-2 rounded-md border border-input bg-background" />
              </div>
              <input placeholder="Contact email" value={locationForm.contact_email} onChange={(e) => setLocationForm((f) => ({ ...f, contact_email: e.target.value }))} className="w-full px-3 py-2 rounded-md border border-input bg-background" />
              <label className="flex items-center gap-2"><input type="checkbox" checked={locationForm.is_default} onChange={(e) => setLocationForm((f) => ({ ...f, is_default: e.target.checked }))} /> Default</label>
              <div className="flex gap-2">
                <button onClick={handleCreateLocation} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg">{saving ? <Loader2 size={16} className="animate-spin" /> : "Save"}</button>
                <button onClick={() => setShowNewLocation(false)} className="px-4 py-2 bg-muted rounded-lg">Cancel</button>
              </div>
            </div>
          )}
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-10 w-10 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              {locations.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No locations. Add one to track multi-location inventory.</div>
              ) : (
                locations.map((loc: any) => (
                  <div key={loc.id} className="flex items-center justify-between p-4 border-b border-border last:border-0 hover:bg-muted/20">
                    <div>
                      <p className="font-medium">{loc.name} {loc.code && <span className="text-muted-foreground">({loc.code})</span>}</p>
                      <p className="text-sm text-muted-foreground">{loc.address_line1 ? `${loc.address_line1}, ${loc.city || ""} ${loc.country || ""}` : loc.location_type || "warehouse"}</p>
                    </div>
                    {loc.is_default && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">Default</span>}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Transfers */}
      {subTab === "transfers" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => { setShowNewTransfer(true); loadLocations(); loadProducts(); }} disabled={locations.length < 2 || products.length === 0} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50">
              <Plus size={18} /> New Transfer
            </button>
          </div>
          {showNewTransfer && (
            <div className="rounded-lg border border-border p-6 space-y-3 bg-card">
              <h4 className="font-medium">Create Transfer</h4>
              <select value={transferForm.from_location_id} onChange={(e) => setTransferForm((f) => ({ ...f, from_location_id: e.target.value }))} className="w-full px-3 py-2 rounded-md border border-input bg-background" required>
                <option value="">From location</option>
                {locations.map((loc: any) => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
              </select>
              <select value={transferForm.to_location_id} onChange={(e) => setTransferForm((f) => ({ ...f, to_location_id: e.target.value }))} className="w-full px-3 py-2 rounded-md border border-input bg-background" required>
                <option value="">To location</option>
                {locations.map((loc: any) => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
              </select>
              <select value={transferForm.product_id} onChange={(e) => setTransferForm((f) => ({ ...f, product_id: e.target.value }))} className="w-full px-3 py-2 rounded-md border border-input bg-background" required>
                <option value="">Select product</option>
                {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input type="number" placeholder="Quantity" value={transferForm.quantity} onChange={(e) => setTransferForm((f) => ({ ...f, quantity: e.target.value }))} className="w-full px-3 py-2 rounded-md border border-input bg-background" min="1" />
              <textarea placeholder="Notes" value={transferForm.notes} onChange={(e) => setTransferForm((f) => ({ ...f, notes: e.target.value }))} className="w-full px-3 py-2 rounded-md border border-input bg-background" rows={2} />
              <div className="flex gap-2">
                <button onClick={handleCreateTransfer} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg">{saving ? <Loader2 size={16} className="animate-spin" /> : "Create"}</button>
                <button onClick={() => setShowNewTransfer(false)} className="px-4 py-2 bg-muted rounded-lg">Cancel</button>
              </div>
            </div>
          )}
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-10 w-10 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              {transfers.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No transfers yet. Create a transfer to move stock between locations.</div>
              ) : (
                transfers.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between p-4 border-b border-border last:border-0 hover:bg-muted/20">
                    <div>
                      <p className="font-medium">{t.items?.length ?? 1} item(s)</p>
                      <p className="text-sm text-muted-foreground">{locations.find((l: any) => l.id === t.from_location_id)?.name ?? "?"} → {locations.find((l: any) => l.id === t.to_location_id)?.name ?? "?"}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded capitalize ${t.status === "completed" ? "bg-green-100 text-green-800" : t.status === "pending" ? "bg-amber-100 text-amber-800" : "bg-muted"}`}>{t.status}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Suppliers */}
      {subTab === "suppliers" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowNewSupplier(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
              <Plus size={18} /> Add Supplier
            </button>
          </div>
          {showNewSupplier && (
            <div className="rounded-lg border border-border p-6 space-y-3 bg-card">
              <h4 className="font-medium">New Supplier</h4>
              <input placeholder="Name *" value={supplierForm.name} onChange={(e) => setSupplierForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 rounded-md border border-input bg-background" />
              <input placeholder="Code" value={supplierForm.code} onChange={(e) => setSupplierForm((f) => ({ ...f, code: e.target.value }))} className="w-full px-3 py-2 rounded-md border border-input bg-background" />
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Contact name" value={supplierForm.contact_name} onChange={(e) => setSupplierForm((f) => ({ ...f, contact_name: e.target.value }))} className="px-3 py-2 rounded-md border border-input bg-background" />
                <input placeholder="Email" value={supplierForm.email} onChange={(e) => setSupplierForm((f) => ({ ...f, email: e.target.value }))} className="px-3 py-2 rounded-md border border-input bg-background" />
              </div>
              <input placeholder="Phone" value={supplierForm.phone} onChange={(e) => setSupplierForm((f) => ({ ...f, phone: e.target.value }))} className="w-full px-3 py-2 rounded-md border border-input bg-background" />
              <input placeholder="Address" value={supplierForm.address_line1} onChange={(e) => setSupplierForm((f) => ({ ...f, address_line1: e.target.value }))} className="w-full px-3 py-2 rounded-md border border-input bg-background" />
              <input placeholder="Payment terms" value={supplierForm.payment_terms} onChange={(e) => setSupplierForm((f) => ({ ...f, payment_terms: e.target.value }))} className="w-full px-3 py-2 rounded-md border border-input bg-background" />
              <input placeholder="Lead time (days)" type="number" value={supplierForm.lead_time_days} onChange={(e) => setSupplierForm((f) => ({ ...f, lead_time_days: e.target.value }))} className="w-full px-3 py-2 rounded-md border border-input bg-background" />
              <textarea placeholder="Notes" value={supplierForm.notes} onChange={(e) => setSupplierForm((f) => ({ ...f, notes: e.target.value }))} className="w-full px-3 py-2 rounded-md border border-input bg-background" rows={2} />
              <div className="flex gap-2">
                <button onClick={handleCreateSupplier} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg">{saving ? <Loader2 size={16} className="animate-spin" /> : "Create"}</button>
                <button onClick={() => setShowNewSupplier(false)} className="px-4 py-2 bg-muted rounded-lg">Cancel</button>
              </div>
            </div>
          )}
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-10 w-10 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              {suppliers.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No suppliers. Add suppliers to create purchase orders for restocking.</div>
              ) : (
                suppliers.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between p-4 border-b border-border last:border-0 hover:bg-muted/20">
                    <div>
                      <p className="font-medium">{s.name}</p>
                      <p className="text-sm text-muted-foreground">{s.contact_name || s.email || s.phone || "-"}</p>
                    </div>
                    {s.lead_time_days && <span className="text-xs text-muted-foreground">{s.lead_time_days} day lead</span>}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Reorder */}
      {subTab === "reorder" && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-10 w-10 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="p-4 border-b border-border bg-muted/30">
                <h3 className="font-semibold">Reorder Recommendations</h3>
                <p className="text-sm text-muted-foreground mt-1">Products below reorder point. Create a purchase order to restock.</p>
              </div>
              <div className="divide-y divide-border">
                {recommendations.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">All products are adequately stocked. No reorder recommendations.</div>
                ) : (
                  recommendations.map((rec: any, i: number) => (
                    <div key={rec.id ?? rec.product_id ?? i} className="flex items-center justify-between p-4 hover:bg-muted/20">
                      <div>
                        <p className="font-medium">{rec.name ?? rec.product_name ?? "Product"}</p>
                        <p className="text-sm text-muted-foreground">
                          Current: {rec.current_stock ?? 0} | Reorder point: {rec.reorder_point ?? 10} | Recommended qty: +{rec.recommended_order_quantity ?? 0}
                        </p>
                      </div>
                      <button onClick={() => { setPoProduct(rec); setPoForm({ ...poForm, quantity: String(rec.recommended_order_quantity ?? 10) }); setShowCreatePO(true); }} className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
                        Create PO
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create PO Modal */}
      {showCreatePO && poProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl p-6 w-full max-w-md">
            <h3 className="font-bold mb-4">Create Purchase Order: {poProduct.name ?? poProduct.product_name}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Quantity</label>
                <input type="number" value={poForm.quantity} onChange={(e) => setPoForm((f) => ({ ...f, quantity: e.target.value }))} min="1" className="w-full px-3 py-2 rounded-lg border border-input bg-background" />
              </div>
              {suppliers.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-1">Supplier</label>
                  <select value={poForm.supplier_id} onChange={(e) => setPoForm((f) => ({ ...f, supplier_id: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-input bg-background">
                    <option value="">None</option>
                    {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              {locations.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-1">Destination</label>
                  <select value={poForm.location_id} onChange={(e) => setPoForm((f) => ({ ...f, location_id: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-input bg-background">
                    <option value="">None</option>
                    {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea value={poForm.notes} onChange={(e) => setPoForm((f) => ({ ...f, notes: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-input bg-background" rows={2} />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setShowCreatePO(false); setPoProduct(null); }} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
              <button onClick={handleCreatePO} disabled={saving} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50">
                {saving ? <Loader2 size={16} className="animate-spin inline" /> : "Create PO"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
