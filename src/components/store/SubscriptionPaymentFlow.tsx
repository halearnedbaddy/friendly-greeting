import { useState } from 'react';
import { XIcon, CheckCircleIcon, LoaderIcon } from '@/components/icons';
import { getPlanById } from '@/config/subscriptionPlans';
import { validateTransactionCode } from '@/lib/transactionValidation';
import { initiateSubscription, verifyMpesaCode } from '@/services/mpesaService';

type FlowStep = 'choose-method' | 'stk-push' | 'paybill' | 'processing' | 'success' | 'trial' | 'stk-waiting';

interface SubscriptionPaymentFlowProps {
  open: boolean;
  onClose: () => void;
  planId: string;
  billingCycle: 'monthly' | 'annual';
  mode: 'payment' | 'trial';
  onComplete: () => void;
}

export function SubscriptionPaymentFlow({ open, onClose, planId, billingCycle, mode, onComplete }: SubscriptionPaymentFlowProps) {
  const [step, setStep] = useState<FlowStep>(mode === 'trial' ? 'trial' : 'choose-method');
  const [processing, setProcessing] = useState(false);
  const [mpesaCode, setMpesaCode] = useState('');
  const [mpesaMessage, setMpesaMessage] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [_stkReference, setStkReference] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const plan = getPlanById(planId);
  if (!open || !plan) return null;

  const price = billingCycle === 'monthly' ? plan.monthlyPrice : plan.annualPrice;

  // STK Push flow - prompt appears on user's phone
  const handleSTKPush = async () => {
    if (!phoneNumber.trim()) {
      setVerifyError('Please enter your M-Pesa phone number');
      return;
    }
    setVerifyError('');
    setProcessing(true);
    setStatusMessage('Sending payment prompt to your phone...');
    setStep('stk-waiting');

    try {
      const planKey = planId === 'basic' ? 'basic' : 'premium';
      const result = await initiateSubscription(phoneNumber.trim(), planKey);

      if (result.success) {
        setStkReference(result.reference || '');
        setStatusMessage('Check your phone for the M-Pesa prompt. Enter your PIN to complete payment.');
        setProcessing(false);

        // Poll for completion (simplified - in production use websockets)
        let attempts = 0;
        const pollInterval = setInterval(async () => {
          attempts++;
          if (attempts > 30) { // 90 seconds
            clearInterval(pollInterval);
            setStatusMessage('Payment timed out. If you completed the payment, use "Pay via Paybill" option and enter your M-Pesa code.');
            return;
          }

          // Check subscription status
          try {
          const { data: sub } = await import('@/integrations/supabase/client').then(m => 
              (m.supabase.from('subscriptions' as any) as any)
                .select('status')
                .eq('reference', result.reference)
                .single()
            );
            if ((sub as any)?.status === 'active') {
              clearInterval(pollInterval);
              setStep('success');
            }
          } catch {
            // continue polling
          }
        }, 3000);
      } else {
        setVerifyError(result.error || 'Failed to initiate payment');
        setStep('stk-push');
        setProcessing(false);
      }
    } catch (err) {
      setVerifyError('Payment request failed. Please try again.');
      setStep('stk-push');
      setProcessing(false);
    }
  };

  // Paybill verification flow
  const handlePaybillVerify = async () => {
    const code = mpesaCode.trim().toUpperCase();
    const validation = validateTransactionCode(code, 'MPESA');
    if (!validation.valid) {
      setVerifyError(validation.error || 'Invalid transaction code');
      return;
    }

    setVerifyError('');
    setProcessing(true);
    setStep('processing');

    try {
      const result = await verifyMpesaCode(
        code,
        phoneNumber || '254700000000',
        `SUB-${planId}-${Date.now()}`,
        price
      );

      if (result.success) {
        setStep('success');
      } else {
        setVerifyError(result.error || 'Verification failed');
        setStep('paybill');
      }
    } catch {
      setVerifyError('Verification failed. Please try again.');
      setStep('paybill');
    }
    setProcessing(false);
  };

  const handleStartTrial = async () => {
    setProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setProcessing(false);
    setStep('success');
  };

  const resetFlow = () => {
    setStep('choose-method');
    setMpesaCode('');
    setMpesaMessage('');
    setVerifyError('');
    setProcessing(false);
    setStatusMessage('');
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* Choose Payment Method */}
        {step === 'choose-method' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-foreground">Upgrade to {plan.name} Plan</h3>
              <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition">
                <XIcon size={20} />
              </button>
            </div>

            <div className="bg-muted/50 rounded-xl p-4 mb-5">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium text-foreground">{plan.name}</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-bold text-foreground">KES {price.toLocaleString()}/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
              </div>
            </div>

            <p className="text-sm font-medium text-foreground mb-3">Choose payment method:</p>

            <div className="space-y-3">
              {/* STK Push Option */}
              <button
                onClick={() => setStep('stk-push')}
                className="w-full flex items-center gap-4 p-4 border-2 border-primary/30 bg-primary/5 rounded-xl hover:border-primary/60 transition text-left"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-lg" style={{ background: '#d4f4dd', color: '#00a86b' }}>
                  📱
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">Pay via STK Push <span className="text-xs text-primary">(Recommended)</span></p>
                  <p className="text-xs text-muted-foreground">Payment prompt sent directly to your phone</p>
                </div>
              </button>

              {/* Paybill Option */}
              <button
                onClick={() => setStep('paybill')}
                className="w-full flex items-center gap-4 p-4 border-2 border-border rounded-xl hover:border-primary/60 hover:bg-primary/5 transition text-left"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-lg" style={{ background: '#d4f4dd', color: '#00a86b' }}>
                  M-P
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">Pay via M-Pesa Paybill</p>
                  <p className="text-xs text-muted-foreground">Paybill 522522 • Enter code after payment</p>
                </div>
              </button>
            </div>

            <button onClick={onClose} className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground transition py-2">
              Maybe Later
            </button>
          </div>
        )}

        {/* STK Push - Enter Phone */}
        {step === 'stk-push' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-foreground">M-Pesa Payment</h3>
              <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition">
                <XIcon size={20} />
              </button>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-5">
              <p className="text-sm text-foreground">
                A payment prompt of <strong>KES {price.toLocaleString()}</strong> will be sent to your phone. Enter your M-Pesa PIN to complete.
              </p>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-medium text-foreground mb-1.5">M-Pesa Phone Number</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={e => { setPhoneNumber(e.target.value); setVerifyError(''); }}
                placeholder="e.g. 0712345678 or 254712345678"
                className="w-full px-3 py-3 rounded-lg border border-input bg-background text-foreground text-base focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              {verifyError && <p className="text-xs text-destructive mt-1">{verifyError}</p>}
            </div>

            <div className="flex gap-3">
              <button onClick={resetFlow} className="flex-1 px-4 py-3 border border-input rounded-lg hover:bg-muted transition font-medium text-foreground text-sm">
                ← Back
              </button>
              <button
                onClick={handleSTKPush}
                disabled={!phoneNumber.trim() || processing}
                className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {processing && <LoaderIcon size={16} className="animate-spin" />}
                Send Payment Prompt
              </button>
            </div>
          </div>
        )}

        {/* STK Push Waiting */}
        {step === 'stk-waiting' && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              {processing ? (
                <LoaderIcon size={28} className="text-primary animate-spin" />
              ) : (
                <span className="text-3xl">📱</span>
              )}
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">
              {processing ? 'Sending Payment Prompt...' : 'Check Your Phone'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">{statusMessage}</p>

            {!processing && (
              <div className="space-y-3">
                <button onClick={() => setStep('paybill')} className="w-full px-4 py-2 text-sm text-primary hover:underline">
                  Already paid? Enter M-Pesa code instead
                </button>
                <button onClick={resetFlow} className="w-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
                  ← Try again
                </button>
              </div>
            )}
          </div>
        )}

        {/* Paybill Instructions + Verify */}
        {step === 'paybill' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-foreground">Pay via M-Pesa Paybill</h3>
              <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition">
                <XIcon size={20} />
              </button>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-5">
              <p className="text-sm font-bold text-foreground mb-3">📱 M-Pesa Steps:</p>
              <ol className="space-y-2 text-sm text-foreground">
                <li className="flex gap-2"><span className="font-bold shrink-0">1.</span><span>Go to M-Pesa → <strong>Lipa Na M-Pesa</strong> → <strong>Pay Bill</strong></span></li>
                <li className="flex gap-2"><span className="font-bold shrink-0">2.</span><span>Business Number: <strong className="text-primary text-base">522522</strong></span></li>
                <li className="flex gap-2"><span className="font-bold shrink-0">3.</span><span>Account Number: <strong className="text-primary text-base">1348763280</strong></span></li>
                <li className="flex gap-2"><span className="font-bold shrink-0">4.</span><span>Amount: <strong className="text-primary text-base">KES {price.toLocaleString()}</strong></span></li>
                <li className="flex gap-2"><span className="font-bold shrink-0">5.</span><span>Enter your M-Pesa PIN and confirm</span></li>
              </ol>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  M-Pesa Confirmation Message <span className="text-muted-foreground">(optional)</span>
                </label>
                <textarea value={mpesaMessage} onChange={e => setMpesaMessage(e.target.value)}
                  placeholder="Paste the full M-Pesa SMS confirmation message here..." rows={3}
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  M-Pesa Transaction Code <span className="text-destructive">*</span>
                </label>
                <input type="text" value={mpesaCode}
                  onChange={e => { setMpesaCode(e.target.value.toUpperCase()); setVerifyError(''); }}
                  placeholder="e.g. SJK7Y6H4TQ" maxLength={12}
                  className="w-full px-3 py-3 rounded-lg border border-input bg-background text-foreground font-mono text-base tracking-wider focus:outline-none focus:ring-2 focus:ring-primary/20 uppercase" />
                {verifyError && <p className="text-xs text-destructive mt-1">{verifyError}</p>}
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={resetFlow} className="flex-1 px-4 py-3 border border-input rounded-lg hover:bg-muted transition font-medium text-foreground text-sm">
                ← Back
              </button>
              <button onClick={handlePaybillVerify} disabled={!mpesaCode.trim() || processing}
                className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {processing && <LoaderIcon size={16} className="animate-spin" />}
                Submit for Verification
              </button>
            </div>
          </div>
        )}

        {/* Processing */}
        {step === 'processing' && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <LoaderIcon size={28} className="text-primary animate-spin" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">Verifying Payment...</h3>
            <p className="text-sm text-muted-foreground">
              Verifying transaction code <strong className="font-mono">{mpesaCode}</strong> with M-Pesa
            </p>
          </div>
        )}

        {/* Success */}
        {step === 'success' && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircleIcon size={32} className="text-primary" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">
              {mode === 'trial' ? `🎉 Welcome to ${plan.name} Plan!` : '✅ Payment Submitted!'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {mode === 'trial'
                ? `Your 14-day free trial has started! Enjoy all ${plan.name} features.`
                : 'Your payment is being verified. You\'ll be notified once confirmed.'}
            </p>

            <div className="bg-muted/50 rounded-xl p-4 mb-5 text-left">
              <p className="text-sm font-medium text-foreground mb-2">You can now:</p>
              <ul className="space-y-1.5">
                <li className="flex items-center gap-2 text-sm text-foreground">
                  <CheckCircleIcon size={14} className="text-primary" />
                  {plan.productLimit ? `Add up to ${plan.productLimit} products` : 'Add unlimited products'}
                </li>
                <li className="flex items-center gap-2 text-sm text-foreground">
                  <CheckCircleIcon size={14} className="text-primary" />
                  No transaction fees — flat fee only
                </li>
              </ul>
            </div>

            <button onClick={() => { onComplete(); onClose(); }}
              className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium">
              {mode === 'trial' ? 'Start Adding Products' : 'Got It'}
            </button>
          </div>
        )}

        {/* Trial Step */}
        {step === 'trial' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-foreground">Start Your 14-Day Free Trial</h3>
              <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition"><XIcon size={20} /></button>
            </div>

            <p className="text-sm text-muted-foreground mb-4">Try {plan.name} Plan free for 14 days — no payment required now!</p>

            <div className="bg-muted/50 rounded-xl p-4 mb-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">What you get</p>
              <ul className="space-y-1.5">
                {plan.features.filter(f => f.included).slice(0, 4).map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-foreground">
                    <CheckCircleIcon size={14} className="text-primary" /> {f.text}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-accent/10 rounded-xl p-4 mb-5 text-sm text-foreground">
              <p className="font-medium mb-1">After 14 days:</p>
              <ul className="list-disc ml-4 space-y-1 text-xs text-muted-foreground">
                <li>We'll send a reminder 2 days before trial ends</li>
                <li>You'll be charged KES {plan.monthlyPrice}/month if you continue</li>
                <li>Cancel anytime during trial — no charges</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button onClick={handleStartTrial} disabled={processing}
                className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium flex items-center justify-center gap-2 disabled:opacity-50">
                {processing && <LoaderIcon size={16} className="animate-spin" />} Start Free Trial
              </button>
              <button onClick={() => setStep('choose-method')}
                className="flex-1 px-4 py-3 border border-input text-foreground rounded-lg hover:bg-muted transition font-medium">
                Skip Trial & Pay Now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
