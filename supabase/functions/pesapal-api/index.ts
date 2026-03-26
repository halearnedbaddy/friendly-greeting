import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PESAPAL_BASE_URL = "https://pay.pesapal.com/v3";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getPesapalToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const consumerKey = Deno.env.get("PESAPAL_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("PESAPAL_CONSUMER_SECRET");
  if (!consumerKey || !consumerSecret) {
    throw new Error("Pesapal credentials not configured");
  }

  const res = await fetch(`${PESAPAL_BASE_URL}/api/Auth/RequestToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ consumer_key: consumerKey, consumer_secret: consumerSecret }),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(`Pesapal auth failed: ${JSON.stringify(data)}`);
  }

  cachedToken = {
    token: data.token,
    expiresAt: Date.now() + 4 * 60 * 1000, // 4 min (token valid 5 min)
  };
  return data.token;
}

async function registerIPN(token: string, callbackUrl: string): Promise<string> {
  const res = await fetch(`${PESAPAL_BASE_URL}/api/URLSetup/RegisterIPN`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      url: callbackUrl,
      ipn_notification_type: "GET",
    }),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(`IPN registration failed: ${JSON.stringify(data)}`);
  }
  return data.ipn_id;
}

async function handleInitialize(req: Request): Promise<Response> {
  const body = await req.json();
  const {
    transactionId,
    amount,
    currency = "KES",
    description,
    buyerName,
    buyerPhone,
    buyerEmail,
    callbackUrl,
  } = body;

  if (!transactionId || !amount || !callbackUrl) {
    return new Response(
      JSON.stringify({ success: false, error: "Missing required fields: transactionId, amount, callbackUrl" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const token = await getPesapalToken();

    // Register IPN callback — use our edge function as the IPN endpoint
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const ipnUrl = `${supabaseUrl}/functions/v1/pesapal-api/ipn`;
    const ipnId = await registerIPN(token, ipnUrl);

    // Submit order to Pesapal
    const orderPayload = {
      id: transactionId,
      currency,
      amount: Number(amount),
      description: description || `Order ${transactionId}`,
      callback_url: callbackUrl,
      notification_id: ipnId,
      billing_address: {
        email_address: buyerEmail || "",
        phone_number: buyerPhone || "",
        first_name: buyerName?.split(" ")[0] || "",
        last_name: buyerName?.split(" ").slice(1).join(" ") || "",
        country_code: "KE",
      },
    };

    const orderRes = await fetch(`${PESAPAL_BASE_URL}/api/Transactions/SubmitOrderRequest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(orderPayload),
    });

    const orderData = await orderRes.json();
    console.log("Pesapal SubmitOrderRequest response:", JSON.stringify(orderData));

    if (!orderRes.ok || orderData.error) {
      throw new Error(`Pesapal order failed: ${JSON.stringify(orderData)}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          redirect_url: orderData.redirect_url,
          order_tracking_id: orderData.order_tracking_id,
          merchant_reference: orderData.merchant_reference,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Pesapal initialize error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

async function handleVerify(req: Request): Promise<Response> {
  const body = await req.json();
  const { reference, transactionId } = body;

  if (!reference) {
    return new Response(
      JSON.stringify({ success: false, error: "Missing reference" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const token = await getPesapalToken();

    // Get transaction status from Pesapal
    const statusRes = await fetch(
      `${PESAPAL_BASE_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${reference}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const statusData = await statusRes.json();
    console.log("Pesapal status response:", JSON.stringify(statusData));

    // status_code: 0 = Invalid, 1 = Completed, 2 = Failed, 3 = Reversed
    const isPaid = statusData.payment_status_description === "Completed" || statusData.status_code === 1;

    if (isPaid && transactionId) {
      // Update transaction in Supabase
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, serviceRoleKey);

      await sb
        .from("transactions")
        .update({
          status: "PAID",
          payment_method: "PESAPAL",
          payment_reference: statusData.confirmation_code || reference,
          paid_at: new Date().toISOString(),
        })
        .eq("id", transactionId);
    }

    return new Response(
      JSON.stringify({
        success: isPaid,
        data: {
          status: statusData.payment_status_description,
          status_code: statusData.status_code,
          confirmation_code: statusData.confirmation_code,
          amount: statusData.amount,
          currency: statusData.currency,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Pesapal verify error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

async function handleIPN(req: Request): Promise<Response> {
  // Pesapal sends IPN as GET with query params
  const url = new URL(req.url);
  const orderTrackingId = url.searchParams.get("OrderTrackingId");
  const orderMerchantReference = url.searchParams.get("OrderMerchantReference");

  console.log("Pesapal IPN received:", { orderTrackingId, orderMerchantReference });

  if (!orderTrackingId) {
    return new Response(
      JSON.stringify({ success: false, error: "Missing OrderTrackingId" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const token = await getPesapalToken();

    // Check status
    const statusRes = await fetch(
      `${PESAPAL_BASE_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
      {
        method: "GET",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      }
    );

    const statusData = await statusRes.json();
    console.log("IPN status check:", JSON.stringify(statusData));

    const isPaid = statusData.payment_status_description === "Completed" || statusData.status_code === 1;

    if (isPaid && orderMerchantReference) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, serviceRoleKey);

      await sb
        .from("transactions")
        .update({
          status: "PAID",
          payment_method: "PESAPAL",
          payment_reference: statusData.confirmation_code || orderTrackingId,
          paid_at: new Date().toISOString(),
        })
        .eq("id", orderMerchantReference);
    }

    // Pesapal expects a 200 response
    return new Response(
      JSON.stringify({ orderNotificationType: "IPNCHANGE", orderTrackingId, orderMerchantReference, status: statusData.payment_status_description }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("IPN handling error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "IPN processing failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();

  switch (path) {
    case "initialize":
      return handleInitialize(req);
    case "verify":
      return handleVerify(req);
    case "ipn":
      return handleIPN(req);
    default:
      return new Response(
        JSON.stringify({ success: false, error: `Unknown endpoint: ${path}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
  }
});
