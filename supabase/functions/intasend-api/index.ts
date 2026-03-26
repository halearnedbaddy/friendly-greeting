/**
 * IntaSend Payment API Edge Function
 * Handles: STK Push, Send Money (withdrawals/refunds), and Webhooks
 * 
 * Endpoints:
 *   POST /stk-push          - Initiate M-Pesa STK Push payment
 *   POST /send-money         - Send money (withdrawals, refunds)
 *   POST /payment-status     - Check payment status by invoice_id
 *   POST /webhook/payment    - IntaSend payment webhook
 *   POST /webhook/withdrawal - IntaSend withdrawal webhook
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const INTASEND_SECRET_KEY = Deno.env.get('INTASEND_SECRET_KEY') || '';
const INTASEND_PUBLISHABLE_KEY = Deno.env.get('INTASEND_PUBLISHABLE_KEY') || '';

// Determine IntaSend environment from key prefix
const IS_LIVE = INTASEND_SECRET_KEY.includes('_live_');
const INTASEND_BASE_URL = IS_LIVE
  ? 'https://payment.intasend.com/api/v1'
  : 'https://sandbox.intasend.com/api/v1';

// Fee configuration from the document
const FEES = {
  platform: { percentage: 0.05, minimum: 50 },  // 5%, min KES 50
  withdrawal: { mpesa: 20, airtel: 20, mtn: 1000, bank: 50 },
  refund: 20,
};

function calculatePlatformFee(amount: number): number {
  const percentageFee = amount * FEES.platform.percentage;
  return Math.max(percentageFee, FEES.platform.minimum);
}

function formatPhone(phone: string): string {
  let formatted = phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
  formatted = formatted.replace(/^\+/, '');
  if (formatted.startsWith('0')) formatted = '254' + formatted.slice(1);
  if (!formatted.startsWith('254')) formatted = '254' + formatted;
  return formatted;
}

// IntaSend API helper
async function intasendRequest(endpoint: string, body: Record<string, unknown>) {
  const response = await fetch(`${INTASEND_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${INTASEND_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error(`IntaSend API error (${endpoint}):`, data);
    throw new Error(data.error || data.message || `IntaSend API error: ${response.status}`);
  }
  return data;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests - must return 200 OK
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace('/intasend-api', '');
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // ==================== STK PUSH ====================
    if (req.method === 'POST' && path === '/stk-push') {
      const { phoneNumber, email, amount, orderId, narrative } = await req.json();

      if (!phoneNumber || !amount || !orderId) {
        return new Response(JSON.stringify({ success: false, error: 'Missing required fields: phoneNumber, amount, orderId' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const formattedPhone = formatPhone(phoneNumber);

      // Call IntaSend STK Push
      const result = await intasendRequest('/payment/mpesa-stk-push/', {
        phone_number: formattedPhone,
        email: email || `buyer-${orderId}@payloom.africa`,
        amount: Math.round(amount),
        narrative: narrative || `Payment for Order ${orderId}`,
        api_ref: orderId,
      });

      console.log('✅ IntaSend STK Push initiated:', result);

      // Save transaction record
      await supabase.from('mpesa_transactions').insert({
        order_id: orderId,
        transaction_type: 'stk_push',
        checkout_request_id: result.id || result.invoice?.invoice_id,
        phone_number: formattedPhone,
        amount,
        status: 'pending',
        raw_request: { phoneNumber: formattedPhone, amount, orderId },
        raw_response: result,
      });

      // Update order to processing
      await supabase
        .from('transactions')
        .update({ status: 'processing', payment_method: 'mpesa' })
        .eq('id', orderId);

      return new Response(JSON.stringify({
        success: true,
        invoiceId: result.invoice?.invoice_id || result.id,
        state: result.invoice?.state || 'PENDING',
        message: 'M-Pesa payment prompt sent to your phone. Enter your PIN to complete.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ==================== PAYMENT STATUS CHECK ====================
    if (req.method === 'POST' && path === '/payment-status') {
      const { invoiceId, orderId } = await req.json();

      if (!invoiceId && !orderId) {
        return new Response(JSON.stringify({ success: false, error: 'Missing invoiceId or orderId' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check our local record first
      let query = supabase.from('mpesa_transactions').select('*');
      if (invoiceId) {
        query = query.eq('checkout_request_id', invoiceId);
      } else {
        query = query.eq('order_id', orderId).eq('transaction_type', 'stk_push');
      }
      const { data: txRecord } = await query.order('created_at', { ascending: false }).limit(1).single();

      // Also check order status
      const orderQuery = orderId || txRecord?.order_id;
      let orderStatus = null;
      if (orderQuery) {
        const { data: order } = await supabase
          .from('transactions')
          .select('status, escrow_status, payment_reference')
          .eq('id', orderQuery)
          .single();
        orderStatus = order;
      }

      return new Response(JSON.stringify({
        success: true,
        payment: txRecord ? {
          status: txRecord.status,
          mpesaReceipt: txRecord.mpesa_receipt_number,
          completedAt: txRecord.completed_at,
        } : null,
        order: orderStatus,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ==================== SEND MONEY (Withdrawals/Refunds) ====================
    if (req.method === 'POST' && path === '/send-money') {
      const { provider, account, amount, narrative, callbackUrl, orderId, type, bankCode, name, country } = await req.json();

      if (!provider || !account || !amount) {
        return new Response(JSON.stringify({ success: false, error: 'Missing required fields: provider, account, amount' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const webhookUrl = callbackUrl || `${SUPABASE_URL}/functions/v1/intasend-api/webhook/withdrawal`;

      const transaction: Record<string, unknown> = {
        account: formatPhone(account),
        amount: Math.round(amount),
        narrative: narrative || 'Payment from PayLoom',
      };

      // Add bank details for PesaLink
      if (provider === 'PESALINK' && bankCode) {
        transaction.bank_code = bankCode;
        transaction.name = name || '';
      }

      const requestBody: Record<string, unknown> = {
        currency: country === 'UG' ? 'UGX' : 'KES',
        provider,
        transactions: [transaction],
        callback_url: webhookUrl,
      };

      // Add country for cross-border
      if (provider === 'INTASEND-XB' && country) {
        requestBody.country = country;
      }

      const result = await intasendRequest('/send-money/initiate/', requestBody);
      console.log('✅ IntaSend Send Money initiated:', result);

      // Track the send-money transaction
      if (orderId) {
        await supabase.from('mpesa_transactions').insert({
          order_id: orderId,
          transaction_type: type || 'withdrawal',
          conversation_id: result.tracking_id,
          phone_number: account,
          amount,
          status: 'pending',
          raw_request: requestBody,
          raw_response: result,
        });
      }

      // Approve the send-money (IntaSend requires approval for some accounts)
      if (result.tracking_id) {
        try {
          const approvalResult = await intasendRequest('/send-money/approve/', {
            tracking_id: result.tracking_id,
          });
          console.log('✅ Send Money approved:', approvalResult);
        } catch (approvalError) {
          console.log('Send Money auto-approval skipped (may not be required):', approvalError);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        trackingId: result.tracking_id,
        status: result.status,
        transactions: result.transactions,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ==================== WEBHOOK: Payment Confirmation ====================
    if (req.method === 'POST' && path === '/webhook/payment') {
      console.log('📥 IntaSend Payment Webhook received');
      const payload = await req.json();
      console.log('Payload:', JSON.stringify(payload));

      const { invoice_id, state, api_ref, value, mpesa_reference, failed_reason, account } = payload;

      // Idempotency check - find existing transaction
      const { data: existingTx } = await supabase
        .from('mpesa_transactions')
        .select('*')
        .eq('order_id', api_ref)
        .eq('transaction_type', 'stk_push')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (existingTx?.status === 'completed') {
        console.log('Webhook already processed for:', api_ref);
        return new Response(JSON.stringify({ success: true, message: 'Already processed' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (state === 'COMPLETE') {
        const amount = parseFloat(value);

        // Update mpesa_transaction
        if (existingTx) {
          await supabase.from('mpesa_transactions').update({
            status: 'completed',
            mpesa_receipt_number: mpesa_reference,
            callback_data: payload,
            completed_at: new Date().toISOString(),
          }).eq('id', existingTx.id);
        }

        // Update order: payment received, awaiting admin approval
        await supabase.from('transactions').update({
          status: 'processing',  // AWAITING_ADMIN_APPROVAL
          payment_method: 'mpesa',
          payment_reference: mpesa_reference,
          paid_at: new Date().toISOString(),
          escrow_status: 'pending_confirmation',
        }).eq('id', api_ref);

        // Get order details for notifications
        const { data: order } = await supabase
          .from('transactions')
          .select('seller_id, item_name, currency, amount, buyer_name')
          .eq('id', api_ref)
          .single();

        // Notify admin about pending approval
        if (order) {
          // Get all admin user IDs
          const { data: admins } = await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', 'admin');

          for (const admin of (admins || [])) {
            await supabase.from('notifications').insert({
              user_id: admin.user_id,
              type: 'payment_received',
              title: 'New Payment Pending Approval 💳',
              message: `${order.currency || 'KES'} ${amount.toLocaleString()} payment received from ${order.buyer_name || 'Buyer'} for "${order.item_name}". M-Pesa Ref: ${mpesa_reference}`,
              data: { transactionId: api_ref, mpesaRef: mpesa_reference, amount },
            });
          }

          // Notify seller
          await supabase.from('notifications').insert({
            user_id: order.seller_id,
            type: 'payment_received',
            title: 'Payment Received! 💰',
            message: `${order.currency || 'KES'} ${amount.toLocaleString()} payment received for "${order.item_name}". Awaiting admin verification.`,
            data: { transactionId: api_ref },
          });
        }

        console.log(`✅ Payment complete: Order ${api_ref}, M-Pesa ${mpesa_reference}`);
      } else if (state === 'FAILED') {
        // Update mpesa_transaction
        if (existingTx) {
          await supabase.from('mpesa_transactions').update({
            status: 'failed',
            result_desc: failed_reason,
            callback_data: payload,
            completed_at: new Date().toISOString(),
          }).eq('id', existingTx.id);
        }

        // Update order
        await supabase.from('transactions').update({
          status: 'pending',
          escrow_status: 'payment_failed',
        }).eq('id', api_ref);

        console.log(`❌ Payment failed: ${failed_reason}`);
      }

      // Always return 200 to prevent retries
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ==================== WEBHOOK: Withdrawal/Send Money ====================
    if (req.method === 'POST' && path === '/webhook/withdrawal') {
      console.log('📥 IntaSend Withdrawal Webhook received');
      const payload = await req.json();
      console.log('Payload:', JSON.stringify(payload));

      const { tracking_id, status, transactions: txList } = payload;

      // Find our record
      const { data: txRecord } = await supabase
        .from('mpesa_transactions')
        .select('*')
        .eq('conversation_id', tracking_id)
        .single();

      if (!txRecord) {
        console.log('No matching transaction for tracking_id:', tracking_id);
        return new Response(JSON.stringify({ success: true }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (status === 'Complete' || status === 'COMPLETE') {
        // Update transaction record
        await supabase.from('mpesa_transactions').update({
          status: 'completed',
          callback_data: payload,
          completed_at: new Date().toISOString(),
        }).eq('id', txRecord.id);

        // If it's a withdrawal, update the wallet_transaction
        if (txRecord.transaction_type === 'withdrawal') {
          // Record in ledger
          await supabase.from('ledger_entries').insert({
            entry_ref: `WDRAW-${Date.now()}`,
            order_id: txRecord.order_id,
            transaction_type: 'withdrawal',
            debit_account: 'seller_wallet',
            credit_account: 'external',
            amount: txRecord.amount,
            description: `Withdrawal completed via ${tracking_id}`,
            metadata: { tracking_id, status },
          });
        }

        // If it's a refund
        if (txRecord.transaction_type === 'refund') {
          await supabase.from('ledger_entries').insert({
            entry_ref: `RFND-${Date.now()}`,
            order_id: txRecord.order_id,
            transaction_type: 'refund_completed',
            debit_account: 'escrow_pool',
            credit_account: 'buyer',
            amount: txRecord.amount,
            description: `Refund completed via ${tracking_id}`,
            metadata: { tracking_id },
          });
        }

        console.log(`✅ Send Money complete: ${tracking_id}`);
      } else if (status === 'Failed' || status === 'FAILED') {
        await supabase.from('mpesa_transactions').update({
          status: 'failed',
          result_desc: 'Withdrawal failed',
          callback_data: payload,
          completed_at: new Date().toISOString(),
        }).eq('id', txRecord.id);

        // If withdrawal failed, refund to seller wallet
        if (txRecord.transaction_type === 'withdrawal' && txRecord.order_id) {
          // Get the user who made the withdrawal
          const { data: walletTx } = await supabase
            .from('wallet_transactions')
            .select('user_id, amount')
            .eq('reference', txRecord.order_id)
            .single();

          if (walletTx) {
            const { data: wallet } = await supabase
              .from('wallets')
              .select('available_balance')
              .eq('user_id', walletTx.user_id)
              .single();

            if (wallet) {
              await supabase.from('wallets').update({
                available_balance: (wallet.available_balance || 0) + walletTx.amount,
              }).eq('user_id', walletTx.user_id);

              await supabase.from('notifications').insert({
                user_id: walletTx.user_id,
                type: 'withdrawal_processed',
                title: 'Withdrawal Failed ❌',
                message: `Your withdrawal failed. KES ${walletTx.amount.toLocaleString()} has been returned to your wallet.`,
                data: { tracking_id },
              });
            }
          }
        }

        console.log(`❌ Send Money failed: ${tracking_id}`);
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ==================== FEE CALCULATION ====================
    if (req.method === 'GET' && path === '/fees') {
      return new Response(JSON.stringify({
        success: true,
        fees: FEES,
        calculatePlatformFee: 'Use: Math.max(amount * 0.05, 50)',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: false, error: 'Not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('IntaSend API error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
