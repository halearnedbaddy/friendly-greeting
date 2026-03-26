import { useState, useEffect, useRef } from "react";
import { Package, Layers, Zap, Loader2, Plus, Upload, FileText } from "lucide-react";
import { api } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { StoreProducts } from "@/components/store/StoreProducts";
import type { StoreTab } from "@/components/store/StoreSidebar";

type ProductsSubTab = "all" | "categories" | "bulk" | "recommendations";

const TAB_MAP: Partial<Record<StoreTab, ProductsSubTab>> = {
  products: "all",
  "products-all": "all",
  "products-categories": "categories",
  "products-bulk": "bulk",
  "products-recommendations": "recommendations",
};

interface ProductsTabProps {
  activeTab?: StoreTab;
  storeSlug?: string;
}

export function ProductsTab({ activeTab = "products", storeSlug }: ProductsTabProps) {
  const { toast } = useToast();
  const [subTab, setSubTab] = useState<ProductsSubTab>(TAB_MAP[activeTab] ?? "all");
  const [loading, setLoading] = useState(true);

  // Categories
  const [categories, setCategories] = useState<any[]>([]);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);

  // Import
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ total: 0, done: 0, errors: 0 });
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const mapped = TAB_MAP[activeTab];
    if (mapped) setSubTab(mapped);
  }, [activeTab]);

  const loadCategories = async () => {
    setLoading(true);
    const res = await api.getProductCategories?.();
    setLoading(false);
    if (res?.success && res.data) setCategories(Array.isArray(res.data) ? res.data : []);
  };

  useEffect(() => {
    if (subTab === "categories") loadCategories();
  }, [subTab]);

  const handleCreateCategory = async () => {
    if (!categoryForm.name.trim()) return;
    setSaving(true);
    const res = await api.createProductCategory?.({ name: categoryForm.name.trim(), description: categoryForm.description || undefined });
    setSaving(false);
    if (res?.success) {
      setShowNewCategory(false);
      setCategoryForm({ name: "", description: "" });
      loadCategories();
    } else {
      alert(res?.error || "Failed to create category");
    }
  };

  const subTabs = [
    { id: "all" as ProductsSubTab, label: "All Products", icon: Package },
    { id: "categories" as ProductsSubTab, label: "Categories", icon: Layers },
    { id: "bulk" as ProductsSubTab, label: "Bulk Operations", icon: Zap },
    { id: "recommendations" as ProductsSubTab, label: "Recommendations", icon: Zap },
  ];

  return (
    <div className="space-y-6">
      {(subTab === "categories" || subTab === "bulk" || subTab === "recommendations") && (
        <h2 className="text-2xl font-bold text-foreground">Products</h2>
      )}
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

      {subTab === "all" && <StoreProducts storeSlug={storeSlug} />}
      {subTab === "bulk" && <StoreProducts storeSlug={storeSlug} bulkMode />}

      {subTab === "categories" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowNewCategory(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
            >
              <Plus size={18} />
              New Category
            </button>
          </div>
          {showNewCategory && (
            <div className="rounded-lg border border-border p-4 space-y-3 bg-card">
              <h4 className="font-medium">New Category</h4>
              <input
                placeholder="Category name"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 rounded-md border border-input bg-background"
              />
              <textarea
                placeholder="Description (optional)"
                value={categoryForm.description}
                onChange={(e) => setCategoryForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2 rounded-md border border-input bg-background"
                rows={2}
              />
              <div className="flex gap-2">
                <button onClick={handleCreateCategory} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                </button>
                <button onClick={() => setShowNewCategory(false)} className="px-4 py-2 bg-muted rounded-lg text-sm">Cancel</button>
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
                {categories.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">No categories yet. Create categories to organize your products.</div>
                ) : (
                  categories.map((cat: any) => (
                    <div key={cat.id} className="flex items-center justify-between p-4 hover:bg-muted/20">
                      <div>
                        <p className="font-medium">{cat.name}</p>
                        <p className="text-sm text-muted-foreground">{cat.description || "-"}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {subTab === "bulk" && (
        <div className="space-y-6">
          <div className="rounded-lg border border-border p-4 bg-card space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Upload size={18} />
              Import from CSV
            </h4>
            <p className="text-sm text-muted-foreground">Upload a CSV file with columns: name, price, description, sku, quantity, category_id. First row should be headers.</p>
            <input ref={importInputRef} type="file" accept=".csv" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setImporting(true);
              setImportProgress({ total: 0, done: 0, errors: 0 });
              try {
                const text = await file.text();
                const lines = text.split(/\r?\n/).filter(Boolean);
                if (lines.length < 2) { toast({ title: "No data rows", variant: "destructive" }); setImporting(false); return; }
                const headers = lines[0].toLowerCase().split(",").map((h: string) => h.trim());
                const nameIdx = headers.findIndex((h: string) => h === "name");
                const priceIdx = headers.findIndex((h: string) => h === "price");
                if (nameIdx < 0 || priceIdx < 0) { toast({ title: "CSV must have 'name' and 'price' columns", variant: "destructive" }); setImporting(false); return; }
                const descIdx = headers.findIndex((h: string) => h === "description");
                const skuIdx = headers.findIndex((h: string) => h === "sku");
                const qtyIdx = headers.findIndex((h: string) => h === "quantity");
                const catIdx = headers.findIndex((h: string) => h === "category_id");
                const rows = lines.slice(1);
                setImportProgress({ total: rows.length, done: 0, errors: 0 });
                let done = 0, errs = 0;
                for (let i = 0; i < rows.length; i++) {
                  const row = rows[i];
                  const cells = row.match(/("([^"]*)"|([^,]*))/g)?.map((c: string) => c.replace(/^"|"$/g, "").trim()) ?? row.split(",");
                  const name = cells[nameIdx]?.trim();
                  const price = parseFloat(cells[priceIdx] || "0");
                  if (!name || isNaN(price)) { errs++; setImportProgress((p) => ({ ...p, done: i + 1, errors: errs })); continue; }
                  const res = await api.createProductFull?.({
                    name,
                    price,
                    description: descIdx >= 0 ? cells[descIdx] : undefined,
                    sku: skuIdx >= 0 ? cells[skuIdx] : undefined,
                    quantity: qtyIdx >= 0 ? parseInt(cells[qtyIdx]) || 0 : 0,
                    category_id: catIdx >= 0 ? parseInt(cells[catIdx]) : undefined,
                  });
                  if (res?.success) done++; else errs++;
                  setImportProgress((p) => ({ ...p, done: i + 1, errors: errs }));
                }
                toast({ title: "Import complete", description: `${done} created, ${errs} failed.` });
              } catch (err) {
                alert("Import failed: " + (err as Error).message);
              } finally {
                setImporting(false);
                e.target.value = "";
              }
            }} />
            <div className="flex gap-2">
              <button onClick={() => importInputRef.current?.click()} disabled={importing} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50">
                {importing ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
                {importing ? `Importing ${importProgress.done}/${importProgress.total}...` : "Choose CSV File"}
              </button>
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">Select products below and use the bulk actions bar to publish, archive, or delete them.</p>
            <StoreProducts storeSlug={storeSlug} bulkMode />
          </div>
        </div>
      )}

      {subTab === "recommendations" && (
        <div className="rounded-lg border border-border p-6 space-y-4 bg-card">
          <h3 className="font-semibold">Recommendations Engine</h3>
          <p className="text-sm text-muted-foreground">Product recommendations help shoppers discover related items. Configure cross-sell and upsell rules to increase average order value.</p>
          <p className="text-sm text-muted-foreground">This feature is available on Business+ plans. Configure rules in your store settings when upgraded.</p>
        </div>
      )}
    </div>
  );
}
