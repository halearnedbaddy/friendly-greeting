import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
    const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OneSignal not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, ...data } = await req.json();

    switch (action) {
      case "send_notification": {
        const { title, message, player_ids, data: notifData } = data;

        const payload: Record<string, unknown> = {
          app_id: ONESIGNAL_APP_ID,
          headings: { en: title },
          contents: { en: message },
          data: notifData || {},
        };

        // Send to specific users or all
        if (player_ids && player_ids.length > 0) {
          payload.include_player_ids = player_ids;
        } else {
          payload.included_segments = ["All"];
        }

        const response = await fetch("https://onesignal.com/api/v1/notifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
          },
          body: JSON.stringify(payload),
        });

        const result = await response.json();
        return new Response(
          JSON.stringify({ success: true, result }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "send_sms_notification": {
        // Send SMS-style notification via OneSignal
        const { phone, message: smsMessage, template } = data;

        const smsPayload = {
          app_id: ONESIGNAL_APP_ID,
          name: template || "sms_notification",
          sms_from: Deno.env.get("ONESIGNAL_SMS_FROM") || "",
          contents: { en: smsMessage },
          include_phone_numbers: [phone],
          channel_for_external_user_ids: "sms",
        };

        const smsResponse = await fetch("https://onesignal.com/api/v1/notifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
          },
          body: JSON.stringify(smsPayload),
        });

        const smsResult = await smsResponse.json();
        return new Response(
          JSON.stringify({ success: true, result: smsResult }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "delivery_otp": {
        // Generate and send delivery OTP
        const { phone: deliveryPhone, order_id, buyer_name } = data;
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        const otpMessage = `PayLoom: Your delivery confirmation code is ${otp}. Share this code with the delivery agent to confirm receipt of order ${order_id?.slice(0, 8) || "N/A"}.`;

        const otpPayload = {
          app_id: ONESIGNAL_APP_ID,
          contents: { en: otpMessage },
          include_phone_numbers: [deliveryPhone],
          sms_from: Deno.env.get("ONESIGNAL_SMS_FROM") || "",
          channel_for_external_user_ids: "sms",
        };

        const otpResponse = await fetch("https://onesignal.com/api/v1/notifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
          },
          body: JSON.stringify(otpPayload),
        });

        const otpResult = await otpResponse.json();
        return new Response(
          JSON.stringify({ success: true, otp, result: otpResult }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "order_lifecycle": {
        // Send notifications for order lifecycle events
        const { event, phone: eventPhone, order_number, seller_name, buyer_name: eventBuyer, amount } = data;

        const messages: Record<string, string> = {
          order_placed: `PayLoom: New order #${order_number} received from ${eventBuyer || "a buyer"} for KES ${amount}. Log in to accept or reject.`,
          order_accepted: `PayLoom: Your order #${order_number} has been accepted by ${seller_name || "the seller"}. It will be shipped soon!`,
          order_rejected: `PayLoom: Your order #${order_number} was declined by ${seller_name || "the seller"}. Your payment will be refunded.`,
          order_shipped: `PayLoom: Your order #${order_number} has been shipped! Track delivery in the app.`,
          delivery_confirmed: `PayLoom: Delivery of order #${order_number} has been confirmed. Thank you for using PayLoom!`,
          payment_received: `PayLoom: Payment of KES ${amount} received for order #${order_number}.`,
          dispute_opened: `PayLoom: A dispute has been opened on order #${order_number}. Please check your dashboard.`,
        };

        const eventMessage = messages[event] || `PayLoom: Update on order #${order_number}: ${event}`;

        const eventPayload = {
          app_id: ONESIGNAL_APP_ID,
          contents: { en: eventMessage },
          include_phone_numbers: [eventPhone],
          sms_from: Deno.env.get("ONESIGNAL_SMS_FROM") || "",
          channel_for_external_user_ids: "sms",
        };

        const eventResponse = await fetch("https://onesignal.com/api/v1/notifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
          },
          body: JSON.stringify(eventPayload),
        });

        const eventResult = await eventResponse.json();
        return new Response(
          JSON.stringify({ success: true, result: eventResult }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Unknown action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
