import { supabase } from '@/integrations/supabase/client';

type OrderEvent =
  | 'order_placed'
  | 'order_accepted'
  | 'order_rejected'
  | 'order_shipped'
  | 'delivery_confirmed'
  | 'payment_received'
  | 'dispute_opened';

interface NotifyOptions {
  phone: string;
  event: OrderEvent;
  order_number?: string;
  seller_name?: string;
  buyer_name?: string;
  amount?: number;
}

export async function sendOrderNotification(options: NotifyOptions) {
  try {
    const { data, error } = await supabase.functions.invoke('push-notifications', {
      body: {
        action: 'order_lifecycle',
        ...options,
      },
    });
    if (error) throw error;
    return { success: true, data };
  } catch (err: any) {
    console.error('Failed to send notification:', err);
    return { success: false, error: err.message };
  }
}

export async function sendDeliveryOTP(phone: string, orderId: string, buyerName?: string) {
  try {
    const { data, error } = await supabase.functions.invoke('push-notifications', {
      body: {
        action: 'delivery_otp',
        phone,
        order_id: orderId,
        buyer_name: buyerName,
      },
    });
    if (error) throw error;
    return { success: true, otp: data?.otp, data };
  } catch (err: any) {
    console.error('Failed to send delivery OTP:', err);
    return { success: false, error: err.message };
  }
}

export async function sendPushNotification(
  title: string,
  message: string,
  playerIds?: string[],
  extraData?: Record<string, unknown>
) {
  try {
    const { data, error } = await supabase.functions.invoke('push-notifications', {
      body: {
        action: 'send_notification',
        title,
        message,
        player_ids: playerIds,
        data: extraData,
      },
    });
    if (error) throw error;
    return { success: true, data };
  } catch (err: any) {
    console.error('Failed to send push notification:', err);
    return { success: false, error: err.message };
  }
}
