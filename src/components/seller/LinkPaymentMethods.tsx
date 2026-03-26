import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, Plus, ArrowLeft, Info, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  getCountryConfig,
  type PaymentMethodDefinition,
} from '@/config/countryPaymentConfig';

interface PaymentMethodRow {
  id: string;
  provider: string;
  payment_type: string | null;
  account_name: string;
  account_number: string;
  method_name: string | null;
  details: Record<string, any> | null;
  is_default: boolean | null;
  country: string | null;
  is_active: boolean | null;
}

// Map currency codes to country codes
const CURRENCY_TO_COUNTRY: Record<string, string> = {
  KES: 'KE',
  TZS: 'TZ',
  UGX: 'UG',
  RWF: 'RW',
};

interface LinkPaymentMethodsProps {
  currency: string;
}

export function LinkPaymentMethods({ currency }: LinkPaymentMethodsProps) {
  const { toast } = useToast();
  const [methods, setMethods] = useState<PaymentMethodRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedMethodDef, setSelectedMethodDef] = useState<PaymentMethodDefinition | null>(null);
  const [formFields, setFormFields] = useState<Record<string, string>>({});

  const countryCode = CURRENCY_TO_COUNTRY[currency] || 'KE';
  const countryConfig = getCountryConfig(countryCode);

  useEffect(() => {
    loadMethods();
    setShowAddForm(false);
    setSelectedMethodDef(null);
    setFormFields({});
  }, [currency]);

  const loadMethods = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    const { data, error } = await (supabase
      .from('payment_methods' as any)
      .select('*')
      .eq('user_id', session.user.id)
      .eq('country', countryCode)
      .eq('is_active', true)
      .order('is_default', { ascending: false }) as any);

    if (!error && data) setMethods(data as PaymentMethodRow[]);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!selectedMethodDef) return;

    const missing = selectedMethodDef.fields.filter(f => f.validation.required && !formFields[f.name]?.trim());
    if (missing.length > 0) {
      toast({ title: 'Missing Fields', description: `Please fill: ${missing.map(f => f.label).join(', ')}`, variant: 'destructive' });
      return;
    }

    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSaving(false); return; }

    const accountNumber = formFields.paybill_number || formFields.till_number || formFields.phone_number || formFields.account_number || '';
    const accountName = formFields.account_name || formFields.business_name || '';

    const { error } = await (supabase.from('payment_methods' as any) as any).insert({
      user_id: session.user.id,
      type: selectedMethodDef.type === 'BANK' ? 'bank_account' : 'mobile_money',
      provider: selectedMethodDef.provider,
      payment_type: selectedMethodDef.type,
      method_name: selectedMethodDef.displayName,
      account_number: accountNumber,
      account_name: accountName,
      country: countryCode,
      details: formFields,
      is_default: methods.length === 0,
      is_active: true,
    } as any);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Added!', description: 'Payment method added. Customers will see this on checkout.' });
      setShowAddForm(false);
      setSelectedMethodDef(null);
      setFormFields({});
      await loadMethods();
    }
    setSaving(false);
  };

  const getProviderIcon = (provider: string) => {
    if (provider.toLowerCase().includes('safaricom') || provider.toLowerCase().includes('mpesa')) return '📱';
    if (provider.toLowerCase().includes('airtel')) return '🔴';
    if (provider.toLowerCase().includes('mtn')) return '🟡';
    if (provider.toLowerCase().includes('vodacom') || provider.toLowerCase().includes('tigo')) return '📱';
    if (provider.toLowerCase().includes('bank')) return '🏦';
    return '💳';
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-muted-foreground">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">Loading payment methods...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-sm font-bold text-foreground">
            Payment Methods {countryConfig && <span className="font-normal text-muted-foreground">({countryConfig.flag} {countryConfig.countryName})</span>}
          </label>
          <p className="text-xs text-muted-foreground mt-0.5">
            These methods will be shown to customers at checkout
          </p>
        </div>
        {!showAddForm && (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition"
          >
            <Plus size={14} />
            Add
          </button>
        )}
      </div>

      {/* Existing methods */}
      {methods.length > 0 ? (
        <div className="space-y-2">
          {methods.map(method => {
            const details = method.details as Record<string, string> | null;
            return (
              <div key={method.id} className="flex items-center gap-3 p-3 bg-accent/20 border border-accent/30 rounded-lg">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-lg flex-shrink-0">
                  {getProviderIcon(method.provider)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{method.method_name || method.provider}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {details?.paybill_number && `Paybill: ${details.paybill_number}`}
                    {details?.till_number && `Till: ${details.till_number}`}
                    {details?.phone_number && `Phone: ${details.phone_number}`}
                    {details?.bank_name && `Bank: ${details.bank_name}`}
                    {' • '}{method.account_name}
                  </p>
                </div>
                <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">No payment methods for {countryConfig?.countryName || 'this country'}</p>
              <p className="text-xs text-amber-600 dark:text-amber-300 mt-0.5">Add at least one so customers can pay you.</p>
            </div>
          </div>
        </div>
      )}

      {/* Add Form */}
      {showAddForm && countryConfig && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          {!selectedMethodDef ? (
            <>
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-foreground">Select Payment Type</h4>
                <button type="button" onClick={() => setShowAddForm(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {countryConfig.paymentMethods.map(method => (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setSelectedMethodDef(method)}
                    className="text-left p-3 border border-border rounded-lg hover:border-primary transition bg-background"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{method.icon}</span>
                      <div>
                        <p className="font-semibold text-foreground text-xs">{method.displayName}</p>
                        <p className="text-[10px] text-muted-foreground">{method.provider}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => { setSelectedMethodDef(null); setFormFields({}); }}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ArrowLeft size={12} /> Back
              </button>

              <div className="bg-accent/20 border border-accent/30 rounded-lg p-2 flex items-start gap-2">
                <Info className="text-primary mt-0.5 flex-shrink-0" size={14} />
                <p className="text-xs text-muted-foreground">{selectedMethodDef.instructions}</p>
              </div>

              {selectedMethodDef.fields.map(field => (
                <div key={field.name}>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    {field.label} {field.validation.required && <span className="text-destructive">*</span>}
                  </label>
                  <input
                    type={field.type}
                    placeholder={field.placeholder}
                    value={formFields[field.name] || ''}
                    onChange={(e) => setFormFields({ ...formFields, [field.name]: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  {field.helperText && <p className="text-[10px] text-muted-foreground mt-0.5">{field.helperText}</p>}
                </div>
              ))}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); setSelectedMethodDef(null); setFormFields({}); }}
                  className="px-3 py-1.5 text-xs border border-input rounded-lg text-foreground hover:bg-muted transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={saving}
                  className="px-4 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition disabled:opacity-50 flex items-center gap-1"
                >
                  {saving && <Loader2 size={12} className="animate-spin" />}
                  Save Method
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
