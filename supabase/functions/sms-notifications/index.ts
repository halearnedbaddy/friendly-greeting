import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BULK_SMS_API_KEY = Deno.env.get('BULK_SMS_API_KEY') || '';
const BULK_SMS_SENDER_ID = Deno.env.get('BULK_SMS_SENDER_ID') || 'PayLoom';
const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://payloom.app';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function sendSMS(to: string, message: string, eventType: string, metadata?: Record<string, any>) {
  // Log the SMS
  await supabase.from('sms_logs').insert({
    recipient: to,
    message,
    event_type: eventType,
    status: 'PENDING',
    metadata,
  });

  if (!BULK_SMS_API_KEY) {
    console.log(`[SMS-DRY-RUN] To: ${to}, Message: ${message}`);
    return { success: true, dry_run: true };
  }

  try {
    const response = await fetch('https://api.bulksms.co.ke/sms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BULK_SMS_API_KEY}`,
      },
      body: JSON.stringify({
        to,
        message,
        from: BULK_SMS_SENDER_ID,
      }),
    });

    const result = await response.json();
    
    await supabase.from('sms_logs')
      .update({ status: response.ok ? 'SENT' : 'FAILED', error_message: response.ok ? null : JSON.stringify(result) })
      .eq('recipient', to)
      .eq('event_type', eventType)
      .order('created_at', { ascending: false })
      .limit(1);

    return { success: response.ok };
  } catch (error) {
    console.error('SMS send error:', error);
    return { success: false, error: String(error) };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'dispute_created': {
        const { transactionId, disputeType, description } = body;
        
        // Get transaction details
        const { data: tx } = await supabase
          .from('transactions')
          .select('*, profiles:seller_id(phone, name)')
          .eq('id', transactionId)
          .single();

        if (tx) {
          // Notify seller
          const sellerProfile = tx.profiles as any;
          if (sellerProfile?.phone) {
            await sendSMS(
              sellerProfile.phone,
              `⚠️ PayLoom: New dispute on order #${transactionId.slice(0, 8).toUpperCase()}. Type: ${disputeType}. Check your dashboard.`,
              'dispute_created',
              { transactionId, disputeType }
            );
          }

          // Notify buyer
          if (tx.buyer_phone) {
            await sendSMS(
              tx.buyer_phone,
              `✓ PayLoom: Your dispute has been submitted. We'll investigate and contact you within 24 hours.`,
              'dispute_created',
              { transactionId }
            );
          }
        }
        break;
      }

      case 'dispute_message': {
        const { disputeId, senderType, message } = body;
        
        // Get dispute with transaction details
        const { data: dispute } = await supabase
          .from('disputes')
          .select('*, transactions:transaction_id(buyer_phone, seller_id)')
          .eq('id', disputeId)
          .single();

        if (dispute) {
          const tx = dispute.transactions as any;
          // Notify the OTHER party
          if (senderType === 'CUSTOMER' && tx?.seller_id) {
            const { data: sellerProfile } = await supabase
              .from('profiles')
              .select('phone')
              .eq('user_id', tx.seller_id)
              .single();

            if (sellerProfile?.phone) {
              await sendSMS(
                sellerProfile.phone,
                `💬 PayLoom: New message on dispute #${disputeId.slice(0, 8)}: "${message.substring(0, 50)}..." Reply in dashboard.`,
                'dispute_message',
                { disputeId }
              );
            }
          } else if (senderType === 'SELLER' && tx?.buyer_phone) {
            await sendSMS(
              tx.buyer_phone,
              `💬 PayLoom: Seller replied to your dispute #${disputeId.slice(0, 8)}: "${message.substring(0, 50)}..."`,
              'dispute_message',
              { disputeId }
            );
          } else if (senderType === 'ADMIN') {
            // Admin message: notify BOTH buyer and seller
            if (tx?.buyer_phone) {
              await sendSMS(
                tx.buyer_phone,
                `💬 PayLoom Admin on dispute #${disputeId.slice(0, 8)}: "${message.substring(0, 50)}..." Check your dashboard.`,
                'dispute_message',
                { disputeId }
              );
            }
            if (tx?.seller_id) {
              const { data: sellerProfile } = await supabase
                .from('profiles')
                .select('phone')
                .eq('user_id', tx.seller_id)
                .single();
              if (sellerProfile?.phone) {
                await sendSMS(
                  sellerProfile.phone,
                  `💬 PayLoom Admin on dispute #${disputeId.slice(0, 8)}: "${message.substring(0, 50)}..." Check your dashboard.`,
                  'dispute_message',
                  { disputeId }
                );
              }
            }
          }
        }
        break;
      }

      case 'dispute_resolved': {
        const { disputeId, resolution } = body;
        
        const { data: dispute } = await supabase
          .from('disputes')
          .select('*, transactions:transaction_id(buyer_phone, seller_id)')
          .eq('id', disputeId)
          .single();

        if (dispute) {
          const tx = dispute.transactions as any;
          
          if (tx?.buyer_phone) {
            await sendSMS(
              tx.buyer_phone,
              `✅ PayLoom: Your dispute #${disputeId.slice(0, 8)} has been resolved. ${resolution || ''}`,
              'dispute_resolved',
              { disputeId }
            );
          }

          if (tx?.seller_id) {
            const { data: sellerProfile } = await supabase
              .from('profiles')
              .select('phone')
              .eq('user_id', tx.seller_id)
              .single();

            if (sellerProfile?.phone) {
              await sendSMS(
                sellerProfile.phone,
                `✅ PayLoom: Dispute #${disputeId.slice(0, 8)} resolved. Outcome: ${resolution || 'Check dashboard.'}`,
                'dispute_resolved',
                { disputeId }
              );
            }
          }
        }
        break;
      }

      case 'payment_submitted': {
        const { transactionId, amount, currency, payerPhone } = body;
        
        const { data: tx } = await supabase
          .from('transactions')
          .select('seller_id, item_name')
          .eq('id', transactionId)
          .single();

        if (tx) {
          const { data: sellerProfile } = await supabase
            .from('profiles')
            .select('phone')
            .eq('user_id', tx.seller_id)
            .single();

          if (sellerProfile?.phone) {
            await sendSMS(
              sellerProfile.phone,
              `💰 PayLoom: New payment of ${currency} ${amount} submitted for "${tx.item_name}". Verify and approve in dashboard.`,
              'payment_submitted',
              { transactionId }
            );
          }

          if (payerPhone) {
            await sendSMS(
              payerPhone,
              `✓ PayLoom: Your payment of ${currency} ${amount} for "${tx.item_name}" has been submitted. We'll verify and confirm shortly.`,
              'payment_submitted',
              { transactionId }
            );
          }
        }
        break;
      }

      case 'order_shipped': {
        const { transactionId, trackingNumber } = body;
        
        const { data: tx } = await supabase
          .from('transactions')
          .select('buyer_phone, item_name, currency, amount')
          .eq('id', transactionId)
          .single();

        if (tx?.buyer_phone) {
          await sendSMS(
            tx.buyer_phone,
            `📦 PayLoom: Your order "${tx.item_name}" has been shipped!${trackingNumber ? ` Tracking: ${trackingNumber}` : ''} Track: ${FRONTEND_URL}/track/${transactionId}`,
            'order_shipped',
            { transactionId }
          );
        }
        break;
      }

      case 'payment_approved': {
        const { transactionId, phone, message: smsMsg } = body;
        if (phone && smsMsg) {
          await sendSMS(phone, smsMsg, 'payment_approved', { transactionId });
        }
        break;
      }

      case 'order_accepted': {
        const { transactionId: txId } = body;

        const { data: tx } = await supabase
          .from('transactions')
          .select('buyer_phone, buyer_name, item_name, amount, currency, seller_id')
          .eq('id', txId)
          .single();

        if (tx?.buyer_phone) {
          const currency = tx.currency || 'KES';
          const amount = tx.amount || 0;
          const item = tx.item_name || 'your item';
          const shortId = txId.slice(0, 8).toUpperCase();
          await sendSMS(
            tx.buyer_phone,
            `✅ PayLoom: Your order #${shortId} for "${item}" (${currency} ${amount}) has been accepted by the seller! You'll be notified once it ships. Track: ${FRONTEND_URL}/track/${txId}`,
            'order_accepted',
            { transactionId: txId }
          );
        }
        break;
      }

      case 'order_placed': {
        const { transactionId: txId2, buyerPhone, buyerName, itemName, amount: orderAmount, currency: orderCurrency } = body;
        
        // Notify buyer
        if (buyerPhone) {
          const shortId = txId2?.slice(0, 8).toUpperCase() || '';
          await sendSMS(
            buyerPhone,
            `✅ PayLoom: Hi ${buyerName || 'Customer'}, your order #${shortId} for "${itemName}" (${orderCurrency || 'KES'} ${orderAmount}) has been placed! The seller will review and accept it shortly. Track: ${FRONTEND_URL}/track/${txId2}`,
            'order_placed',
            { transactionId: txId2 }
          );
        }

        // Notify seller
        if (body.sellerId) {
          const { data: sellerProfile } = await supabase
            .from('profiles')
            .select('phone, full_name')
            .eq('user_id', body.sellerId)
            .single();

          if (sellerProfile?.phone) {
            await sendSMS(
              sellerProfile.phone,
              `🛒 PayLoom: New order received! "${itemName}" (${orderCurrency || 'KES'} ${orderAmount}) from ${buyerName || 'a customer'}. Accept or reject in your dashboard.`,
              'order_placed',
              { transactionId: txId2 }
            );
          }
        }
        break;
      }

      case 'delivery_confirmed': {
        const { transactionId: txId3, sellerPayout } = body;

        const { data: tx3 } = await supabase
          .from('transactions')
          .select('buyer_phone, buyer_name, item_name, amount, currency, seller_id')
          .eq('id', txId3)
          .single();

        if (tx3) {
          // Notify buyer
          if (tx3.buyer_phone) {
            await sendSMS(
              tx3.buyer_phone,
              `✅ PayLoom: Delivery confirmed for "${tx3.item_name}". Thank you for shopping with PayLoom!`,
              'delivery_confirmed',
              { transactionId: txId3 }
            );
          }

          // Notify seller - funds released
          if (tx3.seller_id) {
            const { data: sellerProfile } = await supabase
              .from('profiles')
              .select('phone')
              .eq('user_id', tx3.seller_id)
              .single();

            if (sellerProfile?.phone) {
              const payout = sellerPayout || (tx3.amount * 0.95);
              await sendSMS(
                sellerProfile.phone,
                `💰 PayLoom: Delivery confirmed! ${tx3.currency || 'KES'} ${payout.toLocaleString()} has been released to your wallet for "${tx3.item_name}". Withdraw anytime!`,
                'delivery_confirmed',
                { transactionId: txId3 }
              );
            }
          }
        }
        break;
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Unknown action' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('SMS notification error:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
