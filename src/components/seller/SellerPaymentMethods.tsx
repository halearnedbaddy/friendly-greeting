import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2, Star, ToggleLeft, ToggleRight, Loader2, AlertCircle, Info, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  getAllCountries,
  getCountryConfig,
  
  type PaymentMethodDefinition,
} from '@/config/countryPaymentConfig';

interface PaymentMethodRow {
  id: string;
  user_id: string;
  type: string;
  provider: string;
  account_name: string;
  account_number: string;
  country?: string | null;
  payment_type?: string | null;
  method_name?: string | null;
  details?: Record<string, any> | null;
  is_default: boolean | null;
  is_active: boolean | null;
  created_at: string | null;
}

export function SellerPaymentMethods() {
  const { toast } = useToast();
  const [methods, setMethods] = useState<PaymentMethodRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState('KE');
  const [selectedMethodDef, setSelectedMethodDef] = useState<PaymentMethodDefinition | null>(null);
  const [formFields, setFormFields] = useState<Record<string, string>>({});

  const countries = getAllCountries();
  const countryConfig = getCountryConfig(selectedCountry);

  useEffect(() => { loadMethods(); }, []);

  const loadMethods = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    const { data, error } = await (supabase
      .from('payment_methods' as any)
      .select('*')
      .eq('user_id', session.user.id)
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
      country: selectedCountry,
      details: formFields,
      is_default: methods.length === 0,
      is_active: true,
    } as any);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Added!', description: 'Payment method added successfully' });
      resetForm();
      await loadMethods();
    }
    setSaving(false);
  };

  const resetForm = () => {
    setShowForm(false);
    setSelectedMethodDef(null);
    setFormFields({});
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    await (supabase.from('payment_methods' as any) as any).update({ is_active: !currentActive }).eq('id', id);
    await loadMethods();
  };

  const setDefault = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await (supabase.from('payment_methods' as any) as any).update({ is_default: false }).eq('user_id', session.user.id);
    await (supabase.from('payment_methods' as any) as any).update({ is_default: true }).eq('id', id);
    await loadMethods();
    toast({ title: 'Default Updated', description: 'Default payment method changed' });
  };

  const deleteMethod = async (id: string) => {
    if (!confirm('Delete this payment method?')) return;
    await (supabase.from('payment_methods' as any) as any).delete().eq('id', id);
    await loadMethods();
    toast({ title: 'Deleted', description: 'Payment method removed' });
  };

  const getProviderIcon = (provider: string) => {
    if (provider.toLowerCase().includes('safaricom')) return '📱';
    if (provider.toLowerCase().includes('airtel')) return '🔴';
    if (provider.toLowerCase().includes('mtn')) return '🟡';
    if (provider.toLowerCase().includes('vodacom')) return '📱';
    if (provider.toLowerCase().includes('tigo')) return '📱';
    if (provider.toLowerCase().includes('bank')) return '🏦';
    return '💳';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Payment Methods</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure how buyers can pay you. These will appear on your payment links.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition"
        >
          <Plus size={16} />
          {showForm ? 'Cancel' : 'Add Method'}
        </button>
      </div>

      {methods.length === 0 && !showForm && (
        <div className="bg-accent/10 border border-accent/30 rounded-lg p-6 text-center">
          <AlertCircle className="mx-auto mb-3 text-accent" size={32} />
          <p className="font-semibold text-foreground">No Payment Methods</p>
          <p className="text-sm text-muted-foreground mt-1">Add at least one payment method so buyers can pay you.</p>
        </div>
      )}

      {/* Add Form */}
      {showForm && (
        <div className="bg-card border border-border rounded-lg p-6 space-y-5">
          <h3 className="font-bold text-foreground">Add Payment Method</h3>

          {/* Country Selector */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Select Country</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {countries.map(c => (
                <button
                  key={c.countryCode}
                  onClick={() => { setSelectedCountry(c.countryCode); setSelectedMethodDef(null); setFormFields({}); }}
                  className={`p-3 border-2 rounded-lg text-left transition ${
                    selectedCountry === c.countryCode
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <span className="text-lg">{c.flag}</span>
                  <p className="font-medium text-foreground text-sm mt-1">{c.countryName}</p>
                  <p className="text-xs text-muted-foreground">{c.currency}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Payment Method Type Selection */}
          {countryConfig && !selectedMethodDef && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Select Payment Type for {countryConfig.countryName}
              </label>
              <div className="grid md:grid-cols-2 gap-3">
                {countryConfig.paymentMethods.map((method) => (
                  <button
                    key={method.id}
                    onClick={() => setSelectedMethodDef(method)}
                    className="text-left p-4 border border-border rounded-lg hover:border-primary transition bg-background"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{method.icon}</span>
                        <p className="font-semibold text-foreground text-sm">{method.displayName}</p>
                      </div>
                      {method.isPopular && (
                        <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded-full">Popular</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground ml-8">{method.provider}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Dynamic Form Fields */}
          {selectedMethodDef && (
            <div className="space-y-4">
              <button
                onClick={() => { setSelectedMethodDef(null); setFormFields({}); }}
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <ArrowLeft size={14} /> Back to method selection
              </button>

              <div className="bg-accent/20 border border-accent/30 rounded-lg p-3 flex items-start gap-2">
                <Info className="text-primary mt-0.5 flex-shrink-0" size={16} />
                <p className="text-sm text-muted-foreground">{selectedMethodDef.instructions}</p>
              </div>

              {selectedMethodDef.fields.map((field) => (
                <div key={field.name}>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {field.label} {field.validation.required && <span className="text-destructive">*</span>}
                  </label>
                  <input
                    type={field.type}
                    placeholder={field.placeholder}
                    value={formFields[field.name] || ''}
                    onChange={(e) => setFormFields({ ...formFields, [field.name]: e.target.value })}
                    className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  {field.helperText && (
                    <p className="text-xs text-muted-foreground mt-1">{field.helperText}</p>
                  )}
                </div>
              ))}

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={resetForm} className="px-4 py-2 border border-input rounded-lg text-foreground hover:bg-muted transition text-sm">
                  Cancel
                </button>
                <button onClick={handleAdd} disabled={saving} className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition disabled:opacity-50 flex items-center gap-2">
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  Save Method
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Existing Methods */}
      <div className="space-y-3">
        {methods.map(method => {
          const details = method.details as Record<string, string> | null;
          const country = countries.find(c => c.countryCode === method.country);
          return (
            <div key={method.id} className={`bg-card border rounded-lg p-4 ${method.is_active ? 'border-border' : 'border-border opacity-60'}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-xl flex-shrink-0">
                    {getProviderIcon(method.provider)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">{method.method_name || method.provider}</span>
                      {method.is_default && (
                        <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded-full flex items-center gap-1">
                          <Star size={10} /> Default
                        </span>
                      )}
                      {!method.is_active && (
                        <span className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded-full">Inactive</span>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground space-y-0.5">
                      {details?.paybill_number && <p>Paybill: <span className="font-mono font-medium text-foreground">{details.paybill_number}</span></p>}
                      {details?.account_number && <p>Account: <span className="font-mono font-medium text-foreground">{details.account_number}</span></p>}
                      {details?.till_number && <p>Till: <span className="font-mono font-medium text-foreground">{details.till_number}</span></p>}
                      {details?.phone_number && <p>Phone: <span className="font-mono font-medium text-foreground">{details.phone_number}</span></p>}
                      {details?.bank_name && <p>Bank: <span className="font-medium text-foreground">{details.bank_name}</span></p>}
                      <p>Name: {method.account_name}</p>
                      {country && <p className="text-xs">{country.flag} {country.countryName} ({country.currency})</p>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!method.is_default && (
                    <button onClick={() => setDefault(method.id)} className="text-xs text-primary hover:underline">Set Default</button>
                  )}
                  <button onClick={() => toggleActive(method.id, !!method.is_active)} className="p-1.5 hover:bg-muted rounded-lg transition" title={method.is_active ? 'Deactivate' : 'Activate'}>
                    {method.is_active ? <ToggleRight size={20} className="text-primary" /> : <ToggleLeft size={20} className="text-muted-foreground" />}
                  </button>
                  <button onClick={() => deleteMethod(method.id)} className="p-1.5 hover:bg-destructive/10 rounded-lg transition text-destructive">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
