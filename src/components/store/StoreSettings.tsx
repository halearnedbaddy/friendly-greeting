import { useState, useEffect, useCallback } from 'react';
import {
  CameraIcon, SaveIcon, LoaderIcon, AlertTriangleIcon,
  GlobeIcon, LockIcon, CheckCircle2, Circle, XCircle, Rocket, Power,
  RefreshCwIcon,
} from 'lucide-react';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

interface StoreSettingsProps {
  store: {
    id?: string;
    name: string;
    slug: string;
    logo?: string | null;
    bio?: string | null;
    visibility?: string;
    status?: string;
  };
  onUpdate: (data: Partial<StoreSettingsProps['store']>) => void;
}

interface ReadinessCheck {
  id: string;
  label: string;
  done: boolean;
  required: boolean;
  detail?: string;
}

interface Readiness {
  storeStatus: string;
  canActivate: boolean;
  checks: ReadinessCheck[];
  publishedProductCount: number;
}

export function StoreSettings({ store, onUpdate }: StoreSettingsProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: store.name || '',
    slug: store.slug || '',
    bio: store.bio || '',
    visibility: store.visibility || 'PRIVATE',
    logo: store.logo || null as string | null,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [slugError, setSlugError] = useState('');
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(true);

  const loadReadiness = useCallback(async () => {
    setReadinessLoading(true);
    const res = await api.getStoreReadiness();
    if (res.success && res.data) {
      setReadiness(res.data as Readiness);
    }
    setReadinessLoading(false);
  }, []);

  useEffect(() => {
    loadReadiness();
  }, [loadReadiness]);

  useEffect(() => {
    const changed =
      formData.name !== (store.name || '') ||
      formData.slug !== (store.slug || '') ||
      formData.bio !== (store.bio || '') ||
      formData.visibility !== (store.visibility || 'PRIVATE') ||
      formData.logo !== (store.logo || null);
    setHasChanges(changed);
  }, [formData, store]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({ title: 'Image too large', description: 'Please upload an image under 2MB', variant: 'destructive' });
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setFormData((prev) => ({ ...prev, logo: event.target?.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const validateSlug = (slug: string) => {
    if (!slug) { setSlugError('Slug is required'); return false; }
    if (!/^[a-z0-9-]+$/.test(slug)) { setSlugError('Only lowercase letters, numbers, and hyphens'); return false; }
    if (slug.length < 3) { setSlugError('Must be at least 3 characters'); return false; }
    setSlugError('');
    return true;
  };

  const handleSave = async () => {
    if (!validateSlug(formData.slug)) return;
    if (!formData.name.trim()) {
      toast({ title: 'Store name is required', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    const res = await api.updateStore({
      name: formData.name,
      slug: formData.slug,
      bio: formData.bio || undefined,
      visibility: formData.visibility as 'PRIVATE' | 'PUBLIC',
      logo: formData.logo || undefined,
    });
    if (res.success) {
      onUpdate(formData);
      toast({ title: 'Settings saved!' });
      setHasChanges(false);
      loadReadiness();
    } else {
      toast({ title: 'Failed to save', description: res.error, variant: 'destructive' });
    }
    setIsSaving(false);
  };

  const handleActivateStore = async () => {
    setIsActivating(true);
    const res = await api.updateStoreStatus('ACTIVE');
    if (res.success) {
      onUpdate({ status: 'active' });
      setReadiness((prev) => prev ? { ...prev, storeStatus: 'ACTIVE' } : prev);
      toast({ title: 'Store is now live!', description: 'Customers can now find and buy from your store.' });
    } else {
      toast({ title: 'Could not activate store', description: res.error, variant: 'destructive' });
    }
    setIsActivating(false);
  };

  const handleDeactivateStore = async () => {
    setIsActivating(true);
    const res = await api.updateStoreStatus('INACTIVE');
    if (res.success) {
      onUpdate({ status: 'inactive' });
      setReadiness((prev) => prev ? { ...prev, storeStatus: 'INACTIVE' } : prev);
      toast({ title: 'Store deactivated', description: 'Your store is now offline.' });
    } else {
      toast({ title: 'Failed to deactivate', description: res.error, variant: 'destructive' });
    }
    setIsActivating(false);
  };

  const storeStatus = (readiness?.storeStatus || store.status || 'INACTIVE').toString().toUpperCase();
  const isActive = storeStatus === 'ACTIVE';
  const isFrozen = storeStatus === 'FROZEN';

  const requiredChecks = readiness?.checks.filter((c) => c.required) ?? [];
  const optionalChecks = readiness?.checks.filter((c) => !c.required) ?? [];
  const allRequiredDone = requiredChecks.every((c) => c.done);

  return (
    <div className="space-y-5 w-full min-w-0">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">Store Settings</h2>
        {hasChanges && (
          <span className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-3 py-1 rounded-full border border-amber-200 dark:border-amber-800">
            Unsaved changes
          </span>
        )}
      </div>

      {/* ── STORE STATUS CARD ── */}
      <div className={`rounded-2xl border-2 p-5 transition-colors ${
        isFrozen ? 'border-red-400 bg-red-50 dark:bg-red-950/20' :
        isActive ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20' :
        'border-border bg-card'
      }`}>
        {/* Status header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
              isFrozen ? 'bg-red-100 dark:bg-red-900' :
              isActive ? 'bg-emerald-100 dark:bg-emerald-900' :
              'bg-muted'
            }`}>
              {isFrozen ? <AlertTriangleIcon className="text-red-600" size={22} /> :
               isActive ? <Rocket className="text-emerald-600" size={22} /> :
               <Power className="text-muted-foreground" size={22} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-foreground text-base">
                  {isFrozen ? 'Store Frozen' : isActive ? 'Store is Live' : 'Store is Offline'}
                </h3>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  isFrozen ? 'bg-red-200 text-red-700' :
                  isActive ? 'bg-emerald-200 text-emerald-700' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {storeStatus}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {isFrozen ? 'Store frozen by admin. Contact support to resolve.' :
                 isActive ? 'Customers can browse and order from your store.' :
                 'Activate your store to start receiving orders.'}
              </p>
            </div>
          </div>

          {!isFrozen && (
            <button
              onClick={isActive ? handleDeactivateStore : handleActivateStore}
              disabled={isActivating || (!isActive && !allRequiredDone)}
              title={!isActive && !allRequiredDone ? 'Complete all required steps below first' : undefined}
              className={`px-5 py-2.5 rounded-xl font-semibold transition flex items-center gap-2 text-sm w-full sm:w-auto justify-center disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 ${
                isActive
                  ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400'
                  : allRequiredDone
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-200'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {isActivating && <LoaderIcon size={16} className="animate-spin" />}
              {isActive ? 'Take Offline' : 'Go Live'}
            </button>
          )}
        </div>

        {/* Readiness checklist */}
        {!isActive && !isFrozen && (
          <div className="mt-5 pt-5 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-foreground">Launch Checklist</p>
              {readinessLoading ? (
                <LoaderIcon size={14} className="animate-spin text-muted-foreground" />
              ) : (
                <button onClick={loadReadiness} className="text-muted-foreground hover:text-foreground transition" title="Refresh">
                  <RefreshCwIcon size={14} />
                </button>
              )}
            </div>

            {readinessLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-8 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                {requiredChecks.length > 0 && (
                  <>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Required</p>
                    {requiredChecks.map((check) => (
                      <ChecklistItem key={check.id} check={check} />
                    ))}
                  </>
                )}
                {optionalChecks.length > 0 && (
                  <>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-3 mb-2">Recommended</p>
                    {optionalChecks.map((check) => (
                      <ChecklistItem key={check.id} check={check} />
                    ))}
                  </>
                )}
                {allRequiredDone && (
                  <div className="mt-3 flex items-center gap-2 text-emerald-700 text-sm font-medium bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 size={16} />
                    All required steps complete — you can go live now!
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {isActive && (
          <div className="mt-4 pt-4 border-t border-emerald-200 dark:border-emerald-800">
            <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 size={15} />
              <span>Your store link: </span>
              <a
                href={`/store/${store.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline underline-offset-2 hover:no-underline"
              >
                /store/{store.slug}
              </a>
            </div>
          </div>
        )}
      </div>

      {/* ── STORE LOGO ── */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="font-bold text-foreground mb-4">Store Logo</h3>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative group flex-shrink-0">
            {formData.logo ? (
              <img src={formData.logo} alt="Store logo" className="w-20 h-20 object-cover rounded-xl ring-2 ring-border" />
            ) : (
              <div className="w-20 h-20 bg-muted rounded-xl flex items-center justify-center ring-2 ring-border">
                <CameraIcon size={28} className="text-muted-foreground" />
              </div>
            )}
            <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl cursor-pointer">
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              <CameraIcon className="text-white" size={22} />
            </label>
          </div>
          <div>
            <label>
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              <span className="px-4 py-2 rounded-xl bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90 transition font-medium text-sm inline-block">
                Upload Logo
              </span>
            </label>
            <p className="text-xs text-muted-foreground mt-2">Recommended: 200×200px, PNG or JPG (max 2MB)</p>
          </div>
        </div>
      </div>

      {/* ── STORE INFO ── */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <h3 className="font-bold text-foreground">Store Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Store Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="My Awesome Store"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Store URL <span className="text-red-500">*</span></label>
            <div className="flex items-center gap-0">
              <span className="px-3 py-2.5 text-sm bg-muted border border-input rounded-l-xl text-muted-foreground border-r-0 flex-shrink-0">/store/</span>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => {
                  const slug = e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                  setFormData((prev) => ({ ...prev, slug }));
                  validateSlug(slug);
                }}
                className={`flex-1 px-3 py-2.5 rounded-r-xl border bg-background text-sm focus:outline-none focus:ring-2 min-w-0 ${
                  slugError ? 'border-red-500 focus:ring-red-500/20' : 'border-input focus:ring-primary/20 focus:border-primary'
                }`}
                placeholder="my-store"
              />
            </div>
            {slugError ? (
              <p className="text-xs text-red-500 mt-1">{slugError}</p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                Your store: <span className="font-medium">/store/{formData.slug || 'your-slug'}</span>
              </p>
            )}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Store Description</label>
          <textarea
            value={formData.bio}
            onChange={(e) => setFormData((prev) => ({ ...prev, bio: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
            rows={3}
            placeholder="Tell customers what you sell and why they should shop with you..."
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground mt-1 text-right">{formData.bio.length}/500</p>
        </div>
      </div>

      {/* ── VISIBILITY ── */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="font-bold text-foreground mb-4">Store Visibility</h3>
        <div className="space-y-3">
          {[
            {
              value: 'PRIVATE',
              icon: <LockIcon size={16} className="text-muted-foreground" />,
              title: 'Private',
              desc: 'Only accessible via direct link. Not listed in search.',
            },
            {
              value: 'PUBLIC',
              icon: <GlobeIcon size={16} className="text-muted-foreground" />,
              title: 'Public',
              desc: 'Listed publicly and discoverable by anyone.',
            },
          ].map((opt) => (
            <label key={opt.value} className={`flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer transition ${
              formData.visibility === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
            }`}>
              <input
                type="radio"
                name="visibility"
                value={opt.value}
                checked={formData.visibility === opt.value}
                onChange={(e) => setFormData((prev) => ({ ...prev, visibility: e.target.value }))}
                className="mt-0.5 w-4 h-4 text-primary flex-shrink-0"
              />
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  {opt.icon}
                  <p className="font-semibold text-foreground text-sm">{opt.title}</p>
                </div>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* ── SAVE BUTTON ── */}
      <div className="flex justify-end gap-3">
        {hasChanges && (
          <button
            onClick={() => {
              setFormData({ name: store.name || '', slug: store.slug || '', bio: store.bio || '', visibility: store.visibility || 'PRIVATE', logo: store.logo || null });
              setHasChanges(false);
            }}
            className="px-5 py-2.5 border border-input rounded-xl hover:bg-muted transition font-medium text-sm"
          >
            Discard
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition font-semibold flex items-center gap-2 disabled:opacity-50 text-sm"
        >
          {isSaving ? <><LoaderIcon className="animate-spin" size={16} />Saving...</> : <><SaveIcon size={16} />Save Changes</>}
        </button>
      </div>
    </div>
  );
}

function ChecklistItem({ check }: { check: ReadinessCheck }) {
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm ${
      check.done
        ? 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-800 dark:text-emerald-400'
        : check.required
          ? 'bg-red-50 dark:bg-red-900/10 text-red-800 dark:text-red-400'
          : 'bg-muted/50 text-muted-foreground'
    }`}>
      {check.done ? (
        <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
      ) : check.required ? (
        <XCircle size={16} className="text-red-500 flex-shrink-0" />
      ) : (
        <Circle size={16} className="text-muted-foreground/50 flex-shrink-0" />
      )}
      <span className="font-medium flex-1">{check.label}</span>
      {check.detail && (
        <span className="text-xs opacity-70">{check.detail}</span>
      )}
      {check.required && !check.done && (
        <span className="text-xs font-semibold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded-full">
          Required
        </span>
      )}
    </div>
  );
}
