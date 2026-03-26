/**
 * Wallet API Edge Function
 * Handles wallet operations and withdrawals
 * Uses service role for wallet mutations (RLS prevents user-level updates)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // User client for auth verification
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization")! } },
    });

    // Service role client for mutations (bypasses RLS)
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await userClient.auth.getUser(token);

    if (authError || !authData.user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;
    const url = new URL(req.url);
    const path = url.pathname.replace("/wallet-api", "");
    const method = req.method;

    // GET /wallet - Get user's wallet
    if (method === "GET" && (path === "" || path === "/")) {
      // Read via user client (RLS allows SELECT on own wallet)
      let { data: wallet, error } = await userClient
        .from("wallets")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;

      // Create wallet if it doesn't exist (use service client for INSERT)
      if (!wallet) {
        const { data: newWallet, error: createError } = await serviceClient
          .from("wallets")
          .insert({
            user_id: userId,
            available_balance: 0,
            pending_balance: 0,
            total_earned: 0,
            total_spent: 0,
          })
          .select()
          .single();

        if (createError) throw createError;
        wallet = newWallet;
      }

      return new Response(JSON.stringify({ success: true, data: wallet }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /wallet/topup - Top up wallet (for buyers)
    if (method === "POST" && path === "/topup") {
      const { amount, paymentMethod } = await req.json();

      if (!amount || amount <= 0) {
        return new Response(JSON.stringify({ success: false, error: "Invalid amount" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get or create wallet (service client)
      let { data: wallet } = await serviceClient
        .from("wallets")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (!wallet) {
        const { data: newWallet } = await serviceClient
          .from("wallets")
          .insert({
            user_id: userId,
            available_balance: 0,
            pending_balance: 0,
            total_earned: 0,
            total_spent: 0,
          })
          .select()
          .single();
        wallet = newWallet;
      }

      // Update wallet balance (service client for UPDATE)
      const { data: updated, error } = await serviceClient
        .from("wallets")
        .update({
          available_balance: (wallet?.available_balance || 0) + amount,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({
        success: true,
        message: "Top-up successful",
        data: updated,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /wallet/withdraw - Request withdrawal via IntaSend Send Money
    if (method === "POST" && path === "/withdraw") {
      const { amount, paymentMethodId, paymentMethod, accountNumber, accountName, provider, bankCode, country } = await req.json();

      if (!amount || amount <= 0) {
        return new Response(JSON.stringify({ success: false, error: "Invalid amount" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get wallet
      const { data: wallet } = await serviceClient
        .from("wallets")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (!wallet || (wallet.available_balance || 0) < amount) {
        return new Response(JSON.stringify({ success: false, error: "Insufficient balance" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Resolve payment method details
      let resolvedProvider = provider || "MPESA-B2C";
      let resolvedAccount = accountNumber || "";
      let resolvedName = accountName || "";
      let resolvedBankCode = bankCode || "";

      if (paymentMethodId) {
        const { data: pm } = await serviceClient
          .from("payment_methods")
          .select("*")
          .eq("id", paymentMethodId)
          .eq("user_id", userId)
          .single();

        if (!pm) {
          return new Response(JSON.stringify({ success: false, error: "Payment method not found" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        resolvedAccount = pm.account_number;
        resolvedName = pm.account_name;
        // Map provider from payment method
        const prov = (pm.provider || "").toUpperCase();
        if (prov.includes("AIRTEL")) resolvedProvider = "AIRTEL";
        else if (prov.includes("MTN")) resolvedProvider = "INTASEND-XB";
        else if (prov.includes("BANK") || prov.includes("PESALINK")) resolvedProvider = "PESALINK";
        else resolvedProvider = "MPESA-B2C";
      }

      // Fee structure from document: KES 20 flat withdrawal fee
      const WITHDRAWAL_FEES: Record<string, number> = {
        "MPESA-B2C": 20,
        "AIRTEL": 20,
        "INTASEND-XB": 1000, // UGX 1000
        "PESALINK": 50,
      };

      const withdrawalFee = WITHDRAWAL_FEES[resolvedProvider] || 20;
      const netAmount = amount - withdrawalFee;

      if (netAmount <= 0) {
        return new Response(JSON.stringify({
          success: false,
          error: `Amount too low. Withdrawal fee is KES ${withdrawalFee}`,
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Deduct from wallet
      const { error: updateError } = await serviceClient
        .from("wallets")
        .update({
          available_balance: (wallet.available_balance || 0) - amount,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (updateError) throw updateError;

      const reference = `WD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Initiate IntaSend Send Money
      const intasendUrl = Deno.env.get("SUPABASE_URL") || "";
      try {
        const sendMoneyResponse = await fetch(`${intasendUrl}/functions/v1/intasend-api/send-money`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: resolvedProvider,
            account: resolvedAccount,
            amount: netAmount,
            narrative: `PayLoom withdrawal - ${reference}`,
            orderId: reference,
            type: "withdrawal",
            bankCode: resolvedBankCode,
            name: resolvedName,
            country: country || (resolvedProvider === "INTASEND-XB" ? "UG" : undefined),
            callbackUrl: `${intasendUrl}/functions/v1/intasend-api/webhook/withdrawal`,
          }),
        });

        const sendResult = await sendMoneyResponse.json();
        console.log("IntaSend withdrawal result:", sendResult);
      } catch (sendError) {
        console.error("IntaSend withdrawal call failed:", sendError);
        // Don't fail the whole operation - the withdrawal is recorded
      }

      // Create notification
      await serviceClient.from("notifications").insert({
        user_id: userId,
        type: "withdrawal_processed",
        title: "Withdrawal Processing 💸",
        message: `Your withdrawal of KES ${netAmount.toLocaleString()} is being processed via ${resolvedProvider}.`,
        data: { amount, netAmount, withdrawalFee, reference, provider: resolvedProvider },
      });

      return new Response(JSON.stringify({
        success: true,
        message: "Withdrawal initiated via IntaSend",
        data: {
          requestedAmount: amount,
          withdrawalFee,
          netAmount,
          reference,
          provider: resolvedProvider,
          status: "PROCESSING",
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /wallet/history - Get transaction history
    if (method === "GET" && path === "/history") {
      const page = parseInt(url.searchParams.get("page") || "1");
      const limit = parseInt(url.searchParams.get("limit") || "20");

      const { data: transactions, error, count } = await userClient
        .from("transactions")
        .select("*", { count: "exact" })
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .order("created_at", { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (error) throw error;

      return new Response(JSON.stringify({
        success: true,
        data: transactions,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: false, error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Wallet API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
