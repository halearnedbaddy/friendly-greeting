import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MPESA_ENV = Deno.env.get("MPESA_ENV") || "sandbox";
const MPESA_BASE_URL = MPESA_ENV === "production"
  ? "https://api.safaricom.co.ke"
  : "https://sandbox.safaricom.co.ke";

const PAYMENT_TIMEOUT = 90000;

// ============= HELPERS =============

async function getAccessToken(attempt = 1): Promise<string> {
  const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");

  if (!consumerKey || !consumerSecret) {
    throw new Error("M-Pesa consumer key and secret must be configured");
  }

  try {
    const auth = btoa(`${consumerKey}:${consumerSecret}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(
      `${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
      { headers: { Authorization: `Basic ${auth}` }, signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`OAuth failed: ${response.status}`);
    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error(`M-Pesa auth error (attempt ${attempt}/3):`, error);
    if (attempt >= 3) throw new Error("Failed to get M-Pesa access token after 3 attempts");
    await new Promise((r) => setTimeout(r, 2000 * Math.pow(2, attempt - 1)));
    return getAccessToken(attempt + 1);
  }
}

function getTimestamp(): string {
  return new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
}

function generatePassword(shortcode: string, passkey: string): string {
  const timestamp = getTimestamp();
  return btoa(`${shortcode}${passkey}${timestamp}`);
}

function formatPhone(phone: string): string {
  return phone.replace(/\+/g, "").replace(/^0/, "254");
}

function normalizeShortcode(value?: string | null): string {
  return (value ?? "").replace(/\D/g, "");
}

function getShortcode(secretName: string, fallbackName = "MPESA_SHORTCODE"): string {
  const normalized = normalizeShortcode(Deno.env.get(secretName) ?? Deno.env.get(fallbackName));
  if (!normalized) throw new Error(`M-Pesa shortcode missing (${secretName} or ${fallbackName})`);
  return normalized;
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function logCallback(supabase: any, type: string, body: any, resultCode?: number, resultDesc?: string) {
  try {
    await supabase.from("mpesa_callbacks").insert({
      callback_type: type,
      request_body: body,
      result_code: resultCode,
      result_desc: resultDesc,
      processed: false,
    });
  } catch (e) {
    console.error("Failed to log callback:", e);
  }
}

// ============= API #1: STK PUSH =============

async function stkPush(phoneNumber: string, amount: number, orderRef: string, callbackUrl: string) {
  const shortcode = getShortcode("MPESA_STK_SHORTCODE");
  const passkey = Deno.env.get("MPESA_PASSKEY")!;

  if (!shortcode || !passkey) throw new Error("M-Pesa shortcode and passkey must be configured");

  const token = await getAccessToken();
  const timestamp = getTimestamp();
  const password = btoa(`${shortcode}${passkey}${timestamp}`);
  const formattedPhone = formatPhone(phoneNumber);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PAYMENT_TIMEOUT);

  const response = await fetch(`${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.round(amount),
      PartyA: formattedPhone,
      PartyB: shortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: callbackUrl,
      AccountReference: orderRef,
      TransactionDesc: `Payment for ${orderRef}`,
    }),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  const data = await response.json();

  if (data.ResponseCode === "0") {
    return {
      success: true,
      checkoutRequestId: data.CheckoutRequestID,
      merchantRequestId: data.MerchantRequestID,
      customerMessage: data.CustomerMessage,
    };
  }
  return { success: false, error: data.ResponseDescription || data.errorMessage || "STK Push failed" };
}

// ============= API #2: C2B REGISTRATION =============

async function registerC2BUrls(supabaseUrl: string, shortCodeOverride?: string) {
  const shortcode = normalizeShortcode(shortCodeOverride) || getShortcode("MPESA_C2B_SHORTCODE");
  const token = await getAccessToken();

  const response = await fetch(`${MPESA_BASE_URL}/mpesa/c2b/v2/registerurl`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      ShortCode: shortcode,
      ResponseType: "Completed",
      ConfirmationURL: `${supabaseUrl}/functions/v1/payment-api/webhook/c2b-confirmation`,
      ValidationURL: `${supabaseUrl}/functions/v1/payment-api/webhook/c2b-validation`,
    }),
  });

  const data = await response.json();
  return { usedShortCode: shortcode, ...data };
}

// ============= API #3: TRANSACTION STATUS =============

async function queryTransactionStatus(transactionCode: string, supabaseUrl: string) {
  const shortcode = getShortcode("MPESA_STATUS_SHORTCODE");
  const initiatorName = Deno.env.get("MPESA_INITIATOR_NAME")!;
  const securityCredential = Deno.env.get("MPESA_SECURITY_CREDENTIAL")!;

  if (!shortcode || !initiatorName || !securityCredential) {
    throw new Error("M-Pesa verification credentials not configured");
  }

  const token = await getAccessToken();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  const response = await fetch(`${MPESA_BASE_URL}/mpesa/transactionstatus/v1/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      Initiator: initiatorName,
      SecurityCredential: securityCredential,
      CommandID: "TransactionStatusQuery",
      TransactionID: transactionCode,
      PartyA: shortcode,
      IdentifierType: "4",
      ResultURL: `${supabaseUrl}/functions/v1/payment-api/webhook/verification-result`,
      QueueTimeOutURL: `${supabaseUrl}/functions/v1/payment-api/webhook/timeout`,
      Remarks: "PayLoom verification",
      Occasion: "Verification",
    }),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  return await response.json();
}

// ============= API #4: ACCOUNT BALANCE =============

async function queryAccountBalance(supabaseUrl: string) {
  const shortcode = getShortcode("MPESA_BALANCE_SHORTCODE");
  const initiatorName = Deno.env.get("MPESA_INITIATOR_NAME")!;
  const securityCredential = Deno.env.get("MPESA_SECURITY_CREDENTIAL")!;

  if (!shortcode || !initiatorName || !securityCredential) {
    throw new Error("M-Pesa balance credentials not configured");
  }

  const token = await getAccessToken();

  const response = await fetch(`${MPESA_BASE_URL}/mpesa/accountbalance/v1/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      Initiator: initiatorName,
      SecurityCredential: securityCredential,
      CommandID: "AccountBalance",
      PartyA: shortcode,
      IdentifierType: "4",
      Remarks: "PayLoom balance check",
      QueueTimeOutURL: `${supabaseUrl}/functions/v1/payment-api/webhook/timeout`,
      ResultURL: `${supabaseUrl}/functions/v1/payment-api/webhook/balance-result`,
    }),
  });

  return await response.json();
}

// ============= API #5: B2C PAYOUT =============

async function payoutB2C(phoneNumber: string, amount: number, orderRef: string, supabaseUrl: string) {
  const shortcode = getShortcode("MPESA_B2C_SHORTCODE");
  const initiatorName = Deno.env.get("MPESA_INITIATOR_NAME")!;
  const securityCredential = Deno.env.get("MPESA_SECURITY_CREDENTIAL")!;

  if (!shortcode || !initiatorName || !securityCredential) {
    throw new Error("M-Pesa B2C credentials must be configured");
  }

  const token = await getAccessToken();
  const formattedPhone = formatPhone(phoneNumber);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PAYMENT_TIMEOUT);

  const response = await fetch(`${MPESA_BASE_URL}/mpesa/b2c/v1/paymentrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      InitiatorName: initiatorName,
      SecurityCredential: securityCredential,
      CommandID: "BusinessPayment",
      Amount: Math.round(amount),
      PartyA: shortcode,
      PartyB: formattedPhone,
      Remarks: `Payout for ${orderRef}`,
      QueueTimeOutURL: `${supabaseUrl}/functions/v1/payment-api/webhook/timeout`,
      ResultURL: `${supabaseUrl}/functions/v1/payment-api/webhook/b2c-result`,
      Occasion: "PayLoom Payout",
    }),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  const data = await response.json();

  if (data.ResponseCode === "0") {
    return {
      success: true,
      conversationId: data.ConversationID,
      originatorConversationId: data.OriginatorConversationID,
    };
  }
  return { success: false, error: data.ResponseDescription || "B2C payout failed" };
}

// ============= SMS HELPER =============

async function sendNotificationSMS(supabaseUrl: string, serviceKey: string, data: any) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/sms-notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify(data),
    });
  } catch (err) {
    console.error("SMS notification failed (non-blocking):", err);
  }
}

// ============= MAIN HANDLER =============

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const action = pathParts[pathParts.length - 1];

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // ==========================================
    // ACTION ENDPOINTS (called from frontend)
    // ==========================================

    // --- STK Push (subscription payments / order payments) ---
    if (action === "stk-push" && req.method === "POST") {
      const { phoneNumber, amount, orderId, orderRef, subscriptionRef } = await req.json();

      if (!phoneNumber || !amount) {
        return jsonResponse({ success: false, error: "Missing required fields" }, 400);
      }

      const callbackUrl = `${supabaseUrl}/functions/v1/payment-api/webhook/stk-callback`;
      const ref = subscriptionRef || orderRef || orderId || `PAY-${Date.now()}`;
      const result = await stkPush(phoneNumber, amount, ref, callbackUrl);

      if (result.success) {
        await supabase.from("mpesa_transactions").insert({
          order_id: orderId || subscriptionRef,
          transaction_type: "stk_push",
          merchant_request_id: result.merchantRequestId,
          checkout_request_id: result.checkoutRequestId,
          phone_number: phoneNumber,
          amount,
          status: "pending",
          raw_request: { phoneNumber, amount, orderId, orderRef, subscriptionRef },
        });
      }

      return jsonResponse(result);
    }

    // --- Subscribe via STK Push ---
    if (action === "subscribe" && req.method === "POST") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return jsonResponse({ success: false, error: "Unauthorized" }, 401);

      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) return jsonResponse({ success: false, error: "Unauthorized" }, 401);

      const { phoneNumber, plan } = await req.json();
      if (!phoneNumber || !plan) return jsonResponse({ success: false, error: "Phone and plan required" }, 400);

      const planPrices: Record<string, number> = { basic: 500, premium: 2000 };
      const amount = planPrices[plan];
      if (!amount) return jsonResponse({ success: false, error: "Invalid plan" }, 400);

      const reference = `SUB-${user.id.slice(0, 8)}-${Date.now()}`;

      // Create pending subscription
      await supabase.from("subscriptions").insert({
        user_id: user.id,
        plan,
        status: "pending",
        amount,
        reference,
      });

      // Initiate STK Push
      const callbackUrl = `${supabaseUrl}/functions/v1/payment-api/webhook/stk-callback`;
      const result = await stkPush(phoneNumber, amount, reference, callbackUrl);

      if (result.success) {
        await supabase.from("mpesa_transactions").insert({
          order_id: reference,
          transaction_type: "stk_push",
          merchant_request_id: result.merchantRequestId,
          checkout_request_id: result.checkoutRequestId,
          phone_number: phoneNumber,
          amount,
          status: "pending",
          raw_request: { userId: user.id, plan, phoneNumber, reference },
        });

        // Update subscription with checkout ID
        await supabase.from("subscriptions")
          .update({ checkout_request_id: result.checkoutRequestId })
          .eq("reference", reference);
      }

      return jsonResponse({ ...result, reference });
    }

    // --- Get subscription status ---
    if (action === "subscription-status" && req.method === "GET") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return jsonResponse({ success: false, error: "Unauthorized" }, 401);

      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) return jsonResponse({ success: false, error: "Unauthorized" }, 401);

      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["active", "trial", "pending"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return jsonResponse({ success: true, data: subscription });
    }

    // --- B2C Payout ---
    if (action === "payout" && req.method === "POST") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return jsonResponse({ success: false, error: "Unauthorized" }, 401);

      const { phoneNumber, amount, orderId, orderRef } = await req.json();
      if (!phoneNumber || !amount) return jsonResponse({ success: false, error: "Missing required fields" }, 400);

      const result = await payoutB2C(phoneNumber, amount, orderRef || orderId || `PAY-${Date.now()}`, supabaseUrl);

      if (result.success) {
        await supabase.from("mpesa_transactions").insert({
          order_id: orderId,
          transaction_type: "b2c_payout",
          conversation_id: result.conversationId,
          phone_number: phoneNumber,
          amount,
          status: "pending",
          raw_request: { phoneNumber, amount, orderId, orderRef },
        });
      }

      return jsonResponse(result);
    }

    // --- Register C2B URLs (one-time setup) ---
    if (action === "register-c2b" && req.method === "POST") {
      const payload: any = await req.json().catch(() => ({}));
      const shortCodeOverride = payload?.shortCode ?? payload?.shortcode ?? payload?.tillNumber;
      const result = await registerC2BUrls(supabaseUrl, shortCodeOverride);
      return jsonResponse({ success: true, data: result });
    }

    // --- Account Balance Query ---
    if (action === "balance" && req.method === "POST") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return jsonResponse({ success: false, error: "Unauthorized" }, 401);

      const result = await queryAccountBalance(supabaseUrl);

      await supabase.from("mpesa_transactions").insert({
        transaction_type: "balance_query",
        amount: 0,
        status: "pending",
        raw_request: { action: "balance_query", timestamp: new Date().toISOString() },
      });

      return jsonResponse({ success: true, data: result });
    }

    // --- Get latest account balance ---
    if (action === "balance-latest" && req.method === "GET") {
      const { data } = await supabase
        .from("mpesa_account_balances")
        .select("*")
        .order("checked_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return jsonResponse({ success: true, data });
    }

    // --- Verify M-Pesa transaction code ---
    if (action === "verify" && req.method === "POST") {
      const { transaction_code, customer_phone, order_id, expected_amount } = await req.json();

      if (!transaction_code || !customer_phone || !order_id) {
        return jsonResponse({ success: false, error: "Transaction code, phone, and order ID required" }, 400);
      }

      const codeRegex = /^[A-Z0-9]{10}$/i;
      if (!codeRegex.test(transaction_code)) {
        return jsonResponse({ success: false, error: "Invalid M-Pesa code format (10 alphanumeric chars)" }, 400);
      }

      const cleanPhone = formatPhone(customer_phone);
      const upperCode = transaction_code.toUpperCase();

      // Check duplicate
      const { data: existing } = await supabase
        .from("mpesa_verification_attempts")
        .select("id, order_id")
        .eq("transaction_code", upperCode)
        .eq("verification_status", "success")
        .limit(1);

      if (existing?.length && existing[0].order_id !== order_id) {
        await supabase.from("mpesa_verification_attempts").insert({
          order_id, transaction_code: upperCode, customer_phone: cleanPhone,
          verification_status: "duplicate",
          error_message: `Code already used for order ${existing[0].order_id}`,
        });
        return jsonResponse({ success: false, error: "This transaction code has already been used" }, 400);
      }

      // Query Daraja Transaction Status API
      try {
        const mpesaData = await queryTransactionStatus(upperCode, supabaseUrl);
        const conversationId = mpesaData?.ConversationID;
        const responseCode = mpesaData?.ResponseCode;

        if (responseCode === "0") {
          await supabase.from("mpesa_verification_attempts").insert({
            order_id, transaction_code: upperCode, customer_phone: cleanPhone,
            verification_status: "pending_callback", daraja_response: mpesaData,
          });

          await supabase.from("mpesa_transactions").insert({
            order_id, transaction_type: "verification",
            conversation_id: conversationId, phone_number: cleanPhone,
            amount: expected_amount || 0, status: "pending",
            raw_request: { transaction_code: upperCode, customer_phone: cleanPhone },
          });

          return jsonResponse({
            success: true,
            message: "Verification submitted. Awaiting M-Pesa confirmation.",
            data: { order_id, transaction_code: upperCode, status: "pending_verification", conversation_id: conversationId },
          });
        } else {
          await supabase.from("mpesa_verification_attempts").insert({
            order_id, transaction_code: upperCode, customer_phone: cleanPhone,
            verification_status: "rejected",
            error_message: mpesaData?.ResponseDescription || "Verification rejected",
            daraja_response: mpesaData,
          });
          return jsonResponse({ success: false, error: mpesaData?.ResponseDescription || "Verification failed" }, 400);
        }
      } catch (err) {
        await supabase.from("mpesa_verification_attempts").insert({
          order_id, transaction_code: upperCode, customer_phone: cleanPhone,
          verification_status: "failed",
          error_message: err instanceof Error ? err.message : "M-Pesa API error",
        });
        return jsonResponse({ success: false, error: "Failed to verify. Please try again." }, 500);
      }
    }

    // --- Verification status ---
    if (action === "verification-status" && req.method === "GET") {
      const orderId = url.searchParams.get("order_id");
      if (!orderId) return jsonResponse({ success: false, error: "order_id required" }, 400);

      const { data } = await supabase
        .from("mpesa_verification_attempts")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });

      return jsonResponse({ success: true, data: data || [] });
    }

    // --- Earnings balance ---
    if (action === "earnings" && req.method === "GET") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return jsonResponse({ success: false, error: "Unauthorized" }, 401);

      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) return jsonResponse({ success: false, error: "Unauthorized" }, 401);

      const { data: earnings } = await supabase
        .from("earnings")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      const available = (earnings || [])
        .filter(e => e.status === "available")
        .reduce((sum, e) => sum + Number(e.amount), 0);

      return jsonResponse({ success: true, data: { earnings: earnings || [], availableBalance: available } });
    }

    // --- Withdraw earnings via B2C ---
    if (action === "withdraw-earnings" && req.method === "POST") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return jsonResponse({ success: false, error: "Unauthorized" }, 401);

      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) return jsonResponse({ success: false, error: "Unauthorized" }, 401);

      const { phoneNumber, amount } = await req.json();
      if (!phoneNumber || !amount || amount < 100) {
        return jsonResponse({ success: false, error: "Min withdrawal is KES 100" }, 400);
      }

      // Check available balance
      const { data: earnings } = await supabase
        .from("earnings")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "available");

      const available = (earnings || []).reduce((sum, e) => sum + Number(e.amount), 0);
      if (available < amount) {
        return jsonResponse({ success: false, error: "Insufficient earnings balance" }, 400);
      }

      const result = await payoutB2C(phoneNumber, amount, `EARN-${user.id.slice(0, 8)}`, supabaseUrl);

      if (result.success) {
        // Mark earnings as withdrawn
        let remaining = amount;
        for (const earning of (earnings || [])) {
          if (remaining <= 0) break;
          const earningAmount = Number(earning.amount);
          if (earningAmount <= remaining) {
            await supabase.from("earnings").update({ status: "withdrawn", withdrawn_at: new Date().toISOString() }).eq("id", earning.id);
            remaining -= earningAmount;
          }
        }
      }

      return jsonResponse(result);
    }

    // ==========================================
    // WEBHOOK HANDLERS (called by Safaricom)
    // ==========================================

    // --- STK Push Callback ---
    if (url.pathname.includes("/webhook/stk-callback") && req.method === "POST") {
      console.log("📥 STK Callback received");
      const body = await req.json();
      await logCallback(supabase, "stk_push", body);

      const { Body: { stkCallback } } = body;
      const { CheckoutRequestID, ResultCode, ResultDesc } = stkCallback;

      const { data: transaction } = await supabase
        .from("mpesa_transactions")
        .select("*")
        .eq("checkout_request_id", CheckoutRequestID)
        .single();

      if (!transaction) {
        console.error("Transaction not found:", CheckoutRequestID);
        return jsonResponse({ ResultCode: 0, ResultDesc: "Accepted" });
      }

      const status = ResultCode === 0 ? "completed" : "failed";
      let mpesaReceiptNumber = null;

      if (ResultCode === 0) {
        const items = stkCallback.CallbackMetadata?.Item || [];
        mpesaReceiptNumber = items.find((i: any) => i.Name === "MpesaReceiptNumber")?.Value;
      }

      await supabase.from("mpesa_transactions").update({
        status, result_code: String(ResultCode), result_desc: ResultDesc,
        mpesa_receipt_number: mpesaReceiptNumber, callback_data: stkCallback,
        completed_at: new Date().toISOString(),
      }).eq("id", transaction.id);

      // If payment successful, update order or subscription
      if (ResultCode === 0 && transaction.order_id) {
        // Check if this is a subscription payment
        if (transaction.order_id.startsWith("SUB-")) {
          const now = new Date();
          const expiresAt = new Date(now);
          expiresAt.setMonth(expiresAt.getMonth() + 1);

          await supabase.from("subscriptions").update({
            status: "active",
            mpesa_transaction_id: mpesaReceiptNumber,
            paid_at: now.toISOString(),
            started_at: now.toISOString(),
            expires_at: expiresAt.toISOString(),
          }).eq("reference", transaction.order_id);
        } else {
          // Regular order payment
          await supabase.from("transactions").update({
            status: "paid", payment_method: "mpesa",
            provider_ref: mpesaReceiptNumber,
          }).eq("id", transaction.order_id);

          // Lock in escrow
          try {
            await fetch(`${supabaseUrl}/functions/v1/escrow-api/lock`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId: transaction.order_id, amount: transaction.amount }),
            });
          } catch (e) {
            console.error("Escrow lock failed:", e);
          }
        }

        // Send SMS
        await sendNotificationSMS(supabaseUrl, supabaseServiceKey, {
          action: "payment_submitted",
          transactionId: transaction.order_id,
          amount: transaction.amount,
          currency: "KES",
          payerPhone: transaction.phone_number,
        });
      }

      return jsonResponse({ ResultCode: 0, ResultDesc: "Success" });
    }

    // --- C2B Validation ---
    if (url.pathname.includes("/webhook/c2b-validation") && req.method === "POST") {
      console.log("📥 C2B Validation received");
      const body = await req.json();
      await logCallback(supabase, "c2b_validation", body);

      // Accept all payments (can add validation logic here)
      return jsonResponse({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    // --- C2B Confirmation ---
    if (url.pathname.includes("/webhook/c2b-confirmation") && req.method === "POST") {
      console.log("📥 C2B Confirmation received");
      const body = await req.json();
      await logCallback(supabase, "c2b_confirmation", body);

      const { TransID, TransAmount, MSISDN, BillRefNumber, TransTime } = body;

      // Record the C2B payment
      await supabase.from("mpesa_transactions").insert({
        order_id: BillRefNumber,
        transaction_type: "c2b",
        phone_number: MSISDN,
        amount: parseFloat(TransAmount) || 0,
        mpesa_receipt_number: TransID,
        status: "completed",
        completed_at: new Date().toISOString(),
        callback_data: body,
      });

      // If BillRefNumber matches a subscription reference, activate it
      if (BillRefNumber?.startsWith("SUB-")) {
        const now = new Date();
        const expiresAt = new Date(now);
        expiresAt.setMonth(expiresAt.getMonth() + 1);

        await supabase.from("subscriptions").update({
          status: "active",
          mpesa_transaction_id: TransID,
          paid_at: now.toISOString(),
          started_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        }).eq("reference", BillRefNumber);
      }

      return jsonResponse({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    // --- B2C Result ---
    if (url.pathname.includes("/webhook/b2c-result") && req.method === "POST") {
      console.log("📥 B2C Result received");
      const body = await req.json();
      await logCallback(supabase, "b2c_result", body, body.Result?.ResultCode, body.Result?.ResultDesc);

      const { Result } = body;
      const { ConversationID, ResultCode, ResultDesc, ResultParameters } = Result;

      const { data: transaction } = await supabase
        .from("mpesa_transactions")
        .select("*")
        .eq("conversation_id", ConversationID)
        .single();

      if (transaction) {
        let receipt = null;
        if (ResultCode === 0 && ResultParameters?.ResultParameter) {
          receipt = ResultParameters.ResultParameter.find((p: any) => p.Key === "TransactionReceipt")?.Value;
        }

        await supabase.from("mpesa_transactions").update({
          status: ResultCode === 0 ? "completed" : "failed",
          result_code: String(ResultCode), result_desc: ResultDesc,
          mpesa_receipt_number: receipt, callback_data: Result,
          completed_at: new Date().toISOString(),
        }).eq("id", transaction.id);

        if (ResultCode === 0 && transaction.order_id) {
          await supabase.from("ledger_entries").insert({
            entry_ref: `PAY-${Date.now()}`,
            order_id: transaction.order_id,
            transaction_type: "payout",
            debit_account: "payout_pending",
            credit_account: "seller",
            amount: transaction.amount,
            description: `Payout, Receipt: ${receipt}`,
            metadata: { mpesa_receipt: receipt, conversation_id: ConversationID },
          });
        }
      }

      return jsonResponse({ ResultCode: 0, ResultDesc: "Success" });
    }

    // --- Account Balance Result ---
    if (url.pathname.includes("/webhook/balance-result") && req.method === "POST") {
      console.log("📥 Balance Result received");
      const body = await req.json();
      await logCallback(supabase, "balance_result", body, body.Result?.ResultCode, body.Result?.ResultDesc);

      const { Result } = body;
      if (Result.ResultCode === 0 && Result.ResultParameters?.ResultParameter) {
        const params = Result.ResultParameters.ResultParameter;
        const balanceStr = params.find((p: any) => p.Key === "AccountBalance")?.Value;

        if (balanceStr) {
          // Parse: "Working Account|KES|50000.00|50000.00|0.00|0.00"
          const parts = balanceStr.split("|");
          const currency = parts[1] || "KES";
          const available = parseFloat(parts[2]) || 0;
          const current = parseFloat(parts[3]) || 0;

          await supabase.from("mpesa_account_balances").insert({
            shortcode: getShortcode("MPESA_BALANCE_SHORTCODE"),
            available_balance: available,
            current_balance: current,
            currency,
            raw_balance_string: balanceStr,
            checked_at: new Date().toISOString(),
          });
        }
      }

      return jsonResponse({ ResultCode: 0, ResultDesc: "Success" });
    }

    // --- Verification Result ---
    if (url.pathname.includes("/webhook/verification-result") && req.method === "POST") {
      console.log("📥 Verification Result received");
      const body = await req.json();
      await logCallback(supabase, "status_result", body, body.Result?.ResultCode, body.Result?.ResultDesc);

      const { Result } = body;
      const { ConversationID, ResultCode, ResultDesc, ResultParameters } = Result;

      const { data: transaction } = await supabase
        .from("mpesa_transactions")
        .select("*")
        .eq("conversation_id", ConversationID)
        .eq("transaction_type", "verification")
        .single();

      if (transaction) {
        const isSuccess = ResultCode === 0;
        let receiptNumber = null;
        let transactionAmount = null;

        if (isSuccess && ResultParameters?.ResultParameter) {
          const params = ResultParameters.ResultParameter;
          receiptNumber = params.find((p: any) => p.Key === "ReceiptNo")?.Value;
          transactionAmount = params.find((p: any) => p.Key === "Amount")?.Value;
        }

        await supabase.from("mpesa_transactions").update({
          status: isSuccess ? "completed" : "failed",
          result_code: String(ResultCode), result_desc: ResultDesc,
          mpesa_receipt_number: receiptNumber, callback_data: Result,
          completed_at: new Date().toISOString(),
          verification_status: isSuccess ? "verified" : "failed",
          verified_at: isSuccess ? new Date().toISOString() : null,
        }).eq("id", transaction.id);

        // Update verification attempts
        const txCode = (transaction.raw_request as any)?.transaction_code;
        if (txCode) {
          await supabase.from("mpesa_verification_attempts").update({
            verification_status: isSuccess ? "success" : "failed",
            error_message: isSuccess ? null : ResultDesc,
            daraja_response: Result,
          })
          .eq("transaction_code", txCode)
          .eq("order_id", transaction.order_id)
          .eq("verification_status", "pending_callback");
        }

        // If verified, update the order
        if (isSuccess && transaction.order_id) {
          const expectedAmount = transaction.amount;
          if (expectedAmount > 0 && transactionAmount) {
            const diff = Math.abs(parseFloat(transactionAmount) - expectedAmount);
            if (diff > 5) {
              // Amount mismatch
              if (txCode) {
                await supabase.from("mpesa_verification_attempts").update({
                  verification_status: "amount_mismatch",
                  error_message: `Expected KES ${expectedAmount}, got KES ${transactionAmount}`,
                }).eq("transaction_code", txCode).eq("order_id", transaction.order_id);
              }
            } else {
              await supabase.from("transactions").update({
                status: "paid", payment_method: "mpesa", provider_ref: receiptNumber,
              }).eq("id", transaction.order_id);

              await sendNotificationSMS(supabaseUrl, supabaseServiceKey, {
                action: "payment_submitted",
                transactionId: transaction.order_id,
                amount: transactionAmount,
                currency: "KES",
                payerPhone: transaction.phone_number,
              });
            }
          } else {
            await supabase.from("transactions").update({
              status: "paid", payment_method: "mpesa", provider_ref: receiptNumber,
            }).eq("id", transaction.order_id);

            await sendNotificationSMS(supabaseUrl, supabaseServiceKey, {
              action: "payment_submitted",
              transactionId: transaction.order_id,
              amount: transactionAmount,
              currency: "KES",
              payerPhone: transaction.phone_number,
            });
          }
        }
      }

      return jsonResponse({ ResultCode: 0, ResultDesc: "Success" });
    }

    // --- Timeout handler ---
    if (url.pathname.includes("/webhook/timeout") && req.method === "POST") {
      console.log("📥 Timeout received");
      const body = await req.json();
      await logCallback(supabase, "timeout", body);
      return jsonResponse({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    return jsonResponse({ success: false, error: "Unknown endpoint" }, 404);
  } catch (error) {
    console.error("M-Pesa API error:", error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    }, 500);
  }
});
