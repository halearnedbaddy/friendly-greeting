import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const PLATFORM_FEE_PERCENT = parseFloat(Deno.env.get('PLATFORM_FEE_PERCENT') || '5');
const PLATFORM_FEE_MINIMUM = parseFloat(Deno.env.get('PLATFORM_FEE_MINIMUM') || '50');
const DEFAULT_AUTO_RELEASE_DAYS = parseInt(Deno.env.get('DEFAULT_AUTO_RELEASE_DAYS') || '7');

// SMS helper - sends SMS via otp-sms style providers
async function sendBuyerSMS(phone: string, message: string) {
  if (!phone) return;
  const apiKey = Deno.env.get('BULK_SMS_API_KEY');
  const senderId = Deno.env.get('BULK_SMS_SENDER_ID') || 'PayLoom';
  
  // Format phone: strip non-digits
  const formattedPhone = phone.replace(/\D/g, '');
  
  if (!apiKey) {
    console.log(`📱 [DEV MODE] Would send SMS to ${formattedPhone}: ${message}`);
    return;
  }

  try {
    console.log(`📱 Sending buyer SMS to ${formattedPhone}...`);
    const response = await fetch('https://sms.blessedtexts.com/api/sms/v1/sendsms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        sender_id: senderId,
        message,
        phone: formattedPhone,
      }),
    });
    const data = await response.json();
    console.log('📱 SMS Response:', JSON.stringify(data));
  } catch (err) {
    console.error('❌ SMS send error:', err);
  }
}

// Fee calculation: 5% or KES 50, whichever is higher
function calculatePlatformFee(amount: number): number {
  const percentageFee = amount * (PLATFORM_FEE_PERCENT / 100);
  return Math.max(percentageFee, PLATFORM_FEE_MINIMUM);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace('/escrow-api', '');
    
    // Service role client for admin operations
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // User client for auth
    const authHeader = req.headers.get('Authorization') || '';
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user
    let userId: string | null = null;
    let isAdmin = false;
    
    if (authHeader.startsWith('Bearer ')) {
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        userId = user.id;
        
        // Check if admin (user may have multiple roles, so check for any admin role)
        const { data: roleData } = await serviceClient
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('role', 'admin')
          .maybeSingle();
        isAdmin = !!roleData;
      }
    }

    // ============ LOCK: Lock funds in escrow when payment received ============
    if (req.method === 'POST' && path === '/lock') {
      const body = await req.json();
      const { orderId, amount } = body;

      if (!orderId || !amount) {
        return new Response(JSON.stringify({ success: false, error: 'Missing orderId or amount' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get order details
      const { data: order, error: orderError } = await serviceClient
        .from('transactions')
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderError || !order) {
        return new Response(JSON.stringify({ success: false, error: 'Order not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Calculate fees (5% or KES 50 minimum)
      const grossAmount = Number(amount);
      const platformFee = calculatePlatformFee(grossAmount);
      const netAmount = grossAmount - platformFee;

      // Calculate auto-release date
      const autoReleaseDate = new Date();
      autoReleaseDate.setDate(autoReleaseDate.getDate() + DEFAULT_AUTO_RELEASE_DAYS);

      // Create escrow wallet
      const walletRef = `ESC-${Date.now()}`;

      const { data: escrowWallet, error: escrowError } = await serviceClient
        .from('escrow_wallets')
        .insert({
          wallet_ref: walletRef,
          order_id: orderId,
          gross_amount: grossAmount,
          platform_fee: platformFee,
          net_amount: netAmount,
          currency: order.currency || 'KES',
          status: 'locked',
          auto_release_date: autoReleaseDate.toISOString(),
        })
        .select()
        .single();

      if (escrowError) {
        console.error('Escrow wallet creation error:', escrowError);
        return new Response(JSON.stringify({ success: false, error: 'Failed to create escrow wallet' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Update order with escrow info
      await serviceClient
        .from('transactions')
        .update({
          escrow_wallet_id: escrowWallet.id,
          escrow_status: 'held',
          auto_release_at: autoReleaseDate.toISOString(),
          platform_fee: platformFee,
          seller_payout: netAmount,
        })
        .eq('id', orderId);

      // Record in ledger
      await serviceClient.from('ledger_entries').insert({
        entry_ref: `LOCK-${Date.now()}`,
        order_id: orderId,
        transaction_type: 'escrow_lock',
        debit_account: 'buyer',
        credit_account: 'escrow_pool',
        amount: grossAmount,
        description: `Escrow lock for order ${orderId}`,
      });

      // Update platform escrow pool balance
      const { data: poolAccount } = await serviceClient
        .from('platform_accounts')
        .select('balance')
        .eq('account_type', 'escrow_pool')
        .single();

      if (poolAccount) {
        await serviceClient
          .from('platform_accounts')
          .update({ balance: (poolAccount.balance || 0) + grossAmount })
          .eq('account_type', 'escrow_pool');
      }

      // Notify seller
      await serviceClient.from('notifications').insert({
        user_id: order.seller_id,
        type: 'payment_received',
        title: 'Payment Received! ✅',
        message: `${order.currency} ${grossAmount.toLocaleString()} received for "${order.item_name}". Funds held in escrow.`,
        data: { transactionId: orderId, escrowId: escrowWallet.id }
      });

      return new Response(JSON.stringify({
        success: true,
        escrowWallet,
        autoReleaseDate: autoReleaseDate.toISOString(),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============ RELEASE: Release funds to seller ============
    if (req.method === 'POST' && path.match(/^\/release(\/[\w-]+)?$/)) {
      const pathParts = path.split('/').filter(Boolean);
      const walletId = pathParts.length > 1 ? pathParts[1] : null;
      const body = await req.json();
      const orderId = body.orderId;
      const releasedBy = body.releasedBy || (isAdmin ? 'admin' : 'buyer_confirmation');

      // Find escrow wallet
      let escrowWallet;
      if (walletId) {
        const { data } = await serviceClient
          .from('escrow_wallets')
          .select('*')
          .eq('id', walletId)
          .eq('status', 'locked')
          .single();
        escrowWallet = data;
      } else if (orderId) {
        const { data } = await serviceClient
          .from('escrow_wallets')
          .select('*')
          .eq('order_id', orderId)
          .eq('status', 'locked')
          .single();
        escrowWallet = data;
      }

      if (!escrowWallet) {
        return new Response(JSON.stringify({ success: false, error: 'Escrow wallet not found or already released' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Update escrow status
      await serviceClient
        .from('escrow_wallets')
        .update({
          status: 'released',
          released_at: new Date().toISOString(),
          released_by: releasedBy,
        })
        .eq('id', escrowWallet.id);

      // Update order status - mark all timeline steps as complete
      const now = new Date().toISOString();
      await serviceClient
        .from('transactions')
        .update({
          escrow_status: 'released',
          status: 'completed',
          shipped_at: now,
          delivered_at: now,
          completed_at: now,
        })
        .eq('id', escrowWallet.order_id);

      // Record escrow release in ledger
      await serviceClient.from('ledger_entries').insert({
        entry_ref: `REL-${Date.now()}`,
        order_id: escrowWallet.order_id,
        transaction_type: 'escrow_release',
        debit_account: 'escrow_pool',
        credit_account: 'payout_pending',
        amount: escrowWallet.net_amount,
        description: `Escrow release for order ${escrowWallet.order_id}`,
      });

      // Record fee collection
      await serviceClient.from('ledger_entries').insert({
        entry_ref: `FEE-${Date.now()}`,
        order_id: escrowWallet.order_id,
        transaction_type: 'fee_collection',
        debit_account: 'escrow_pool',
        credit_account: 'platform_fees',
        amount: escrowWallet.platform_fee,
        description: `Platform fee for order ${escrowWallet.order_id}`,
      });

      // Update platform accounts
      const { data: poolAccount } = await serviceClient
        .from('platform_accounts')
        .select('balance')
        .eq('account_type', 'escrow_pool')
        .single();

      if (poolAccount) {
        await serviceClient
          .from('platform_accounts')
          .update({ balance: Math.max(0, (poolAccount.balance || 0) - escrowWallet.gross_amount) })
          .eq('account_type', 'escrow_pool');
      }

      const { data: feesAccount } = await serviceClient
        .from('platform_accounts')
        .select('balance')
        .eq('account_type', 'platform_fees')
        .single();

      if (feesAccount) {
        await serviceClient
          .from('platform_accounts')
          .update({ balance: (feesAccount.balance || 0) + escrowWallet.platform_fee })
          .eq('account_type', 'platform_fees');
      }

      const { data: payoutAccount } = await serviceClient
        .from('platform_accounts')
        .select('balance')
        .eq('account_type', 'payout_pending')
        .single();

      if (payoutAccount) {
        await serviceClient
          .from('platform_accounts')
          .update({ balance: (payoutAccount.balance || 0) + escrowWallet.net_amount })
          .eq('account_type', 'payout_pending');
      }

      // Update seller wallet
      const { data: order } = await serviceClient
        .from('transactions')
        .select('seller_id, item_name, currency, buyer_phone')
        .eq('id', escrowWallet.order_id)
        .single();

      if (order?.seller_id) {
        const { data: wallet } = await serviceClient
          .from('wallets')
          .select('available_balance, pending_balance, total_earned')
          .eq('user_id', order.seller_id)
          .single();

        if (wallet) {
          await serviceClient
            .from('wallets')
            .update({
              available_balance: (wallet.available_balance || 0) + escrowWallet.net_amount,
              pending_balance: Math.max(0, (wallet.pending_balance || 0) - escrowWallet.net_amount),
              total_earned: (wallet.total_earned || 0) + escrowWallet.net_amount
            })
            .eq('user_id', order.seller_id);
        }

        // Notify seller via in-app notification
        await serviceClient.from('notifications').insert({
          user_id: order.seller_id,
          type: 'withdrawal_processed',
          title: 'Funds Released! 💰',
          message: `${order.currency || 'KES'} ${escrowWallet.net_amount.toLocaleString()} has been added to your wallet for "${order.item_name}". You can now withdraw.`,
          data: { transactionId: escrowWallet.order_id, amount: escrowWallet.net_amount }
        });

        // Send SMS to seller to withdraw
        const { data: sellerProfile } = await serviceClient
          .from('profiles')
          .select('phone')
          .eq('user_id', order.seller_id)
          .single();

        if (sellerProfile?.phone) {
          await sendBuyerSMS(
            sellerProfile.phone,
            `💰 PayLoom: ${order.currency || 'KES'} ${escrowWallet.net_amount.toLocaleString()} has been released for "${order.item_name}". Login to your dashboard to withdraw your funds now!`
          );
        }
      }

      return new Response(JSON.stringify({
        success: true,
        releasedAmount: escrowWallet.net_amount,
        platformFee: escrowWallet.platform_fee,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============ REFUND: Refund to buyer ============
    if (req.method === 'POST' && path.match(/^\/refund(\/[\w-]+)?$/)) {
      const pathParts = path.split('/').filter(Boolean);
      const walletId = pathParts.length > 1 ? pathParts[1] : null;
      const body = await req.json();
      const orderId = body.orderId;
      const reason = body.reason || 'Dispute refund';

      // Find escrow wallet
      let escrowWallet;
      if (walletId) {
        const { data } = await serviceClient
          .from('escrow_wallets')
          .select('*')
          .eq('id', walletId)
          .eq('status', 'locked')
          .single();
        escrowWallet = data;
      } else if (orderId) {
        const { data } = await serviceClient
          .from('escrow_wallets')
          .select('*')
          .eq('order_id', orderId)
          .eq('status', 'locked')
          .single();
        escrowWallet = data;
      }

      if (!escrowWallet) {
        return new Response(JSON.stringify({ success: false, error: 'Escrow wallet not found or already processed' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Update escrow status
      await serviceClient
        .from('escrow_wallets')
        .update({
          status: 'refunded',
          released_at: new Date().toISOString(),
          released_by: 'dispute_refund',
        })
        .eq('id', escrowWallet.id);

      // Update order status
      await serviceClient
        .from('transactions')
        .update({
          escrow_status: 'refunded',
          status: 'refunded',
          refunded_at: new Date().toISOString(),
        })
        .eq('id', escrowWallet.order_id);

      // Record refund in ledger
      await serviceClient.from('ledger_entries').insert({
        entry_ref: `REFUND-${Date.now()}`,
        order_id: escrowWallet.order_id,
        transaction_type: 'escrow_refund',
        debit_account: 'escrow_pool',
        credit_account: 'buyer',
        amount: escrowWallet.gross_amount,
        description: `Refund for order ${escrowWallet.order_id}. Reason: ${reason}`,
      });

      // Update platform escrow pool
      const { data: poolAccount } = await serviceClient
        .from('platform_accounts')
        .select('balance')
        .eq('account_type', 'escrow_pool')
        .single();

      if (poolAccount) {
        await serviceClient
          .from('platform_accounts')
          .update({ balance: Math.max(0, (poolAccount.balance || 0) - escrowWallet.gross_amount) })
          .eq('account_type', 'escrow_pool');
      }

      // Notify parties
      const { data: order } = await serviceClient
        .from('transactions')
        .select('seller_id, buyer_id, item_name, currency')
        .eq('id', escrowWallet.order_id)
        .single();

      if (order?.buyer_id) {
        await serviceClient.from('notifications').insert({
          user_id: order.buyer_id,
          type: 'withdrawal_processed',
          title: 'Refund Initiated',
          message: `Your payment of ${order.currency || 'KES'} ${escrowWallet.gross_amount.toLocaleString()} for "${order.item_name}" will be refunded. Reason: ${reason}`,
          data: { transactionId: escrowWallet.order_id }
        });
      }

      if (order?.seller_id) {
        await serviceClient.from('notifications').insert({
          user_id: order.seller_id,
          type: 'dispute_resolved',
          title: 'Order Refunded',
          message: `Order "${order.item_name}" has been refunded to buyer. Reason: ${reason}`,
          data: { transactionId: escrowWallet.order_id }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        refundedAmount: escrowWallet.gross_amount,
        message: 'Refund processed successfully.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============ SUBMIT-PAYMENT: Buyer submits payment proof ============
    if (req.method === 'POST' && path.match(/^\/submit-payment\/[\w-]+$/)) {
      const pathParts = path.split('/').filter(Boolean);
      const orderId = pathParts[1];
      const body = await req.json();
      const { paymentMethod, paymentReference, payerPhone, payerName } = body;

      if (!orderId || !paymentReference) {
        return new Response(JSON.stringify({ success: false, error: 'Missing orderId or paymentReference' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get order
      const { data: order, error: orderError } = await serviceClient
        .from('transactions')
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderError || !order) {
        return new Response(JSON.stringify({ success: false, error: 'Order not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (order.status !== 'pending') {
        return new Response(JSON.stringify({ success: false, error: 'Order already processed' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Create escrow deposit record
      const { data: deposit, error: depositError } = await serviceClient
        .from('escrow_deposits')
        .insert({
          transaction_id: orderId,
          amount: order.amount,
          currency: order.currency || 'KES',
          payment_method: paymentMethod || 'MPESA',
          payment_reference: paymentReference,
          payer_phone: payerPhone || order.buyer_phone,
          payer_name: payerName || order.buyer_name,
          status: 'pending',
        })
        .select()
        .single();

      if (depositError) {
        console.error('Escrow deposit error:', depositError);
        return new Response(JSON.stringify({ success: false, error: 'Failed to record payment' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Update order with payment info
      await serviceClient
        .from('transactions')
        .update({
          payment_reference: paymentReference,
          payment_method: paymentMethod,
          status: 'processing',
          escrow_status: 'pending_confirmation',
        })
        .eq('id', orderId);

      // Notify seller about pending payment
      await serviceClient.from('notifications').insert({
        user_id: order.seller_id,
        type: 'payment_received',
        title: 'Payment Submitted 💳',
        message: `A buyer has submitted payment for "${order.item_name}". Reference: ${paymentReference}. Please verify and confirm.`,
        data: { transactionId: orderId, reference: paymentReference }
      });

      return new Response(JSON.stringify({
        success: true,
        depositId: deposit.id,
        message: 'Payment submitted. Awaiting verification.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============ CONFIRM-PAYMENT: Admin/Seller confirms payment received ============
    if (req.method === 'POST' && path.match(/^\/confirm-payment\/[\w-]+$/)) {
      const pathParts = path.split('/').filter(Boolean);
      const orderId = pathParts[1];
      const body = await req.json();
      const adminNotes = body.adminNotes || '';

      // Get order
      const { data: order, error: orderError } = await serviceClient
        .from('transactions')
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderError || !order) {
        return new Response(JSON.stringify({ success: false, error: 'Order not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Verify user has permission (admin or seller)
      if (!isAdmin && userId !== order.seller_id) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Calculate fees (5% or KES 50 minimum)
      const grossAmount = Number(order.amount);
      const platformFee = calculatePlatformFee(grossAmount);
      const netAmount = grossAmount - platformFee;

      // Calculate auto-release date
      const autoReleaseDate = new Date();
      autoReleaseDate.setDate(autoReleaseDate.getDate() + DEFAULT_AUTO_RELEASE_DAYS);

      // Create escrow wallet
      const walletRef = `ESC-${Date.now()}`;

      const { data: escrowWallet, error: escrowError } = await serviceClient
        .from('escrow_wallets')
        .insert({
          wallet_ref: walletRef,
          order_id: orderId,
          gross_amount: grossAmount,
          platform_fee: platformFee,
          net_amount: netAmount,
          currency: order.currency || 'KES',
          status: 'locked',
          auto_release_date: autoReleaseDate.toISOString(),
        })
        .select()
        .single();

      if (escrowError) {
        console.error('Escrow wallet creation error:', escrowError);
        return new Response(JSON.stringify({ success: false, error: 'Failed to create escrow wallet' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Update escrow deposit
      await serviceClient
        .from('escrow_deposits')
        .update({
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
          confirmed_by_id: userId,
          admin_notes: adminNotes,
          auto_release_at: autoReleaseDate.toISOString(),
        })
        .eq('transaction_id', orderId);

      // Update order
      await serviceClient
        .from('transactions')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          escrow_status: 'held',
          escrow_wallet_id: escrowWallet.id,
          auto_release_at: autoReleaseDate.toISOString(),
          platform_fee: platformFee,
          seller_payout: netAmount,
        })
        .eq('id', orderId);

      // Update seller pending balance
      await serviceClient
        .from('wallets')
        .update({
          pending_balance: serviceClient.rpc('increment_balance', { amount: netAmount }),
        })
        .eq('user_id', order.seller_id);

      // Actually increment pending balance
      const { data: wallet } = await serviceClient
        .from('wallets')
        .select('pending_balance')
        .eq('user_id', order.seller_id)
        .single();

      if (wallet) {
        await serviceClient
          .from('wallets')
          .update({ pending_balance: (wallet.pending_balance || 0) + netAmount })
          .eq('user_id', order.seller_id);
      }

      // Record in ledger
      await serviceClient.from('ledger_entries').insert({
        entry_ref: `LOCK-${Date.now()}`,
        order_id: orderId,
        transaction_type: 'escrow_lock',
        debit_account: 'buyer',
        credit_account: 'escrow_pool',
        amount: grossAmount,
        description: `Payment confirmed for order ${orderId}`,
      });

      // Update escrow pool
      const { data: poolAccount } = await serviceClient
        .from('platform_accounts')
        .select('balance')
        .eq('account_type', 'escrow_pool')
        .single();

      if (poolAccount) {
        await serviceClient
          .from('platform_accounts')
          .update({ balance: (poolAccount.balance || 0) + grossAmount })
          .eq('account_type', 'escrow_pool');
    }

    // ============ REJECT-PAYMENT: Admin rejects payment ============
    if (req.method === 'POST' && path.match(/^\/reject-payment\/[\w-]+$/)) {
      if (!isAdmin) {
        return new Response(JSON.stringify({ success: false, error: 'Admin access required' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const pathParts = path.split('/').filter(Boolean);
      const orderId = pathParts[1];
      const body = await req.json();
      const reason = body.reason || 'Payment rejected by admin';

      const { data: order } = await serviceClient
        .from('transactions')
        .select('*')
        .eq('id', orderId)
        .single();

      if (!order) {
        return new Response(JSON.stringify({ success: false, error: 'Order not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Update transaction
      await serviceClient
        .from('transactions')
        .update({
          status: 'cancelled',
          escrow_status: 'rejected',
          cancellation_reason: reason,
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      // Update escrow deposit
      await serviceClient
        .from('escrow_deposits')
        .update({ status: 'rejected', admin_notes: reason })
        .eq('transaction_id', orderId);

      // Notify buyer in-app
      if (order.buyer_id) {
        await serviceClient.from('notifications').insert({
          user_id: order.buyer_id,
          type: 'dispute_resolved',
          title: 'Payment Rejected ❌',
          message: `Your payment for "${order.item_name}" was rejected. Reason: ${reason}. A refund will be processed.`,
          data: { transactionId: orderId }
        });
      }

      // Send SMS to buyer
      if (order.buyer_phone) {
        const smsMsg = `PayLoom: Your payment of ${order.currency || 'KES'} ${order.amount.toLocaleString()} for "${order.item_name}" was REJECTED ❌. Reason: ${reason}. A refund will be processed to your account.`;
        await sendBuyerSMS(order.buyer_phone, smsMsg);
      }

      // Notify seller
      await serviceClient.from('notifications').insert({
        user_id: order.seller_id,
        type: 'dispute_resolved',
        title: 'Payment Rejected',
        message: `Payment for "${order.item_name}" was rejected. Reason: ${reason}`,
        data: { transactionId: orderId }
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'Payment rejected. Buyer notified via SMS.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

      // Notify seller
      await serviceClient.from('notifications').insert({
        user_id: order.seller_id,
        type: 'payment_received',
        title: 'Payment Confirmed! ✅',
        message: `${order.currency || 'KES'} ${grossAmount.toLocaleString()} payment confirmed for "${order.item_name}". Funds held in escrow.`,
        data: { transactionId: orderId, escrowId: escrowWallet.id }
      });

      // Notify buyer (in-app + SMS)
      if (order.buyer_id) {
        await serviceClient.from('notifications').insert({
          user_id: order.buyer_id,
          type: 'payment_received',
          title: 'Payment Verified! ✅',
          message: `Your payment for "${order.item_name}" has been verified. The seller will now ship your order.`,
          data: { transactionId: orderId }
        });
      }

      // Send SMS to buyer
      if (order.buyer_phone) {
        const smsMsg = `PayLoom: Your payment of ${order.currency || 'KES'} ${grossAmount.toLocaleString()} for "${order.item_name}" has been ACCEPTED ✅. Your order is now being processed. Track: ${Deno.env.get('FRONTEND_URL') || 'https://payloom.app'}/track/${orderId}`;
        await sendBuyerSMS(order.buyer_phone, smsMsg);
      }

      return new Response(JSON.stringify({
        success: true,
        escrowWallet,
        message: 'Payment confirmed and funds locked in escrow.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============ CONFIRM: Buyer confirm delivery ============
    if (req.method === 'POST' && path === '/confirm') {
      const body = await req.json();
      const { orderId, buyerPhone } = body;

      if (!orderId) {
        return new Response(JSON.stringify({ success: false, error: 'Missing orderId' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get order
      const { data: order, error: orderError } = await serviceClient
        .from('transactions')
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderError || !order) {
        return new Response(JSON.stringify({ success: false, error: 'Order not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Verify buyer (optional)
      if (buyerPhone && order.buyer_phone !== buyerPhone) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (!['delivered', 'shipped'].includes(order.status || '')) {
        return new Response(JSON.stringify({ success: false, error: 'Order must be shipped or delivered before confirmation' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Update order
      await serviceClient
        .from('transactions')
        .update({ buyer_confirmed_at: new Date().toISOString() })
        .eq('id', orderId);

      // Release escrow
      const releaseResponse = await fetch(`${SUPABASE_URL}/functions/v1/escrow-api/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, releasedBy: 'buyer_confirmation' }),
      });

      const releaseResult = await releaseResponse.json();

      return new Response(JSON.stringify({
        success: true,
        message: 'Receipt confirmed. Seller will receive payment shortly.',
        releaseResult,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============ AUTO-RELEASE: Process auto-releases (cron job) ============
    if (req.method === 'POST' && path === '/auto-release') {
      const now = new Date();

      // Find all orders eligible for auto-release
      const { data: eligibleWallets } = await serviceClient
        .from('escrow_wallets')
        .select('*')
        .eq('status', 'locked')
        .lte('auto_release_date', now.toISOString());

      if (!eligibleWallets || eligibleWallets.length === 0) {
        return new Response(JSON.stringify({ success: true, processed: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let processed = 0;
      for (const wallet of eligibleWallets) {
        try {
          // Check if order is delivered
          const { data: order } = await serviceClient
            .from('transactions')
            .select('status')
            .eq('id', wallet.order_id)
            .single();

          if (order?.status === 'delivered' || order?.status === 'shipped') {
            await fetch(`${SUPABASE_URL}/functions/v1/escrow-api/release`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderId: wallet.order_id, releasedBy: 'auto_release' }),
            });
            processed++;
            console.log(`Auto-released order ${wallet.order_id}`);
          }
        } catch (error) {
          console.error(`Failed to auto-release ${wallet.order_id}:`, error);
        }
      }

      return new Response(JSON.stringify({ success: true, processed }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============ GET: List escrow wallets (admin) ============
    if (req.method === 'GET' && path === '/list') {
      if (!isAdmin) {
        return new Response(JSON.stringify({ success: false, error: 'Admin access required' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const status = url.searchParams.get('status');
      let query = serviceClient
        .from('escrow_wallets')
        .select('*')
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data: wallets } = await query;

      return new Response(JSON.stringify({ success: true, data: wallets }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============ GET: Platform accounts summary (admin) ============
    if (req.method === 'GET' && path === '/platform-summary') {
      if (!isAdmin) {
        return new Response(JSON.stringify({ success: false, error: 'Admin access required' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: accounts } = await serviceClient
        .from('platform_accounts')
        .select('*');

      return new Response(JSON.stringify({ success: true, data: accounts }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============ GET: Escrow status by order ============
    if (req.method === 'GET') {
      const orderId = url.searchParams.get('orderId') || path.replace('/', '');

      if (!orderId) {
        return new Response(JSON.stringify({ success: false, error: 'Missing orderId' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: escrowWallet } = await serviceClient
        .from('escrow_wallets')
        .select('*')
        .eq('order_id', orderId)
        .single();

      return new Response(JSON.stringify({ success: true, escrowWallet }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Escrow API error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
