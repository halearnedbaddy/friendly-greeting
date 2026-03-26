import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

function getUserId(req: Request): string | null {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload?.sub ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Use service role for public transaction fetching
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const idx = pathParts.indexOf("transaction-api");
    const apiPath = idx >= 0 ? pathParts.slice(idx + 1) : pathParts;
    const method = req.method;

    // POST /transaction-api/:id/accept - Seller accepts order
    if (method === "POST" && apiPath.length === 2 && apiPath[1] === "accept") {
      const userId = getUserId(req);
      if (!userId) {
        return new Response(
          JSON.stringify({ success: false, error: "Authentication required", code: "NO_AUTH" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const transactionId = apiPath[0];

      const { data: tx, error: txError } = await supabase
        .from("transactions")
        .select("id, seller_id, account_id, status")
        .eq("id", transactionId)
        .maybeSingle();

      if (txError || !tx) {
        return new Response(
          JSON.stringify({ success: false, error: "Transaction not found", code: "NOT_FOUND" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: ownedAccount } = await supabase
        .from("accounts")
        .select("id")
        .eq("id", tx.account_id)
        .eq("user_id", userId)
        .maybeSingle();

      const isAuthorized = tx.seller_id === userId || !!ownedAccount;
      if (!isAuthorized) {
        return new Response(
          JSON.stringify({ success: false, error: "Forbidden", code: "FORBIDDEN" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const statusLower = String(tx.status || "").toLowerCase();
      if (["cancelled", "completed", "delivered", "shipped"].includes(statusLower)) {
        return new Response(
          JSON.stringify({ success: false, error: "Order cannot be accepted in its current status", code: "INVALID_STATUS" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: updated, error: updateError } = await supabase
        .from("transactions")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", transactionId)
        .select()
        .single();

      if (updateError) {
        return new Response(
          JSON.stringify({ success: false, error: updateError.message, code: "UPDATE_FAILED" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: updated }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /transaction-api/:id/reject - Seller rejects order
    if (method === "POST" && apiPath.length === 2 && apiPath[1] === "reject") {
      const userId = getUserId(req);
      if (!userId) {
        return new Response(
          JSON.stringify({ success: false, error: "Authentication required", code: "NO_AUTH" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const transactionId = apiPath[0];
      const body = await req.json().catch(() => ({}));
      const reason = body?.reason || "Seller rejected order";

      const { data: tx, error: txError } = await supabase
        .from("transactions")
        .select("id, seller_id, account_id, status")
        .eq("id", transactionId)
        .maybeSingle();

      if (txError || !tx) {
        return new Response(
          JSON.stringify({ success: false, error: "Transaction not found", code: "NOT_FOUND" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: ownedAccount } = await supabase
        .from("accounts")
        .select("id")
        .eq("id", tx.account_id)
        .eq("user_id", userId)
        .maybeSingle();

      const isAuthorized = tx.seller_id === userId || !!ownedAccount;
      if (!isAuthorized) {
        return new Response(
          JSON.stringify({ success: false, error: "Forbidden", code: "FORBIDDEN" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const statusLower2 = String(tx.status || "").toLowerCase();
      if (["accepted", "shipped", "delivered", "completed"].includes(statusLower2)) {
        return new Response(
          JSON.stringify({ success: false, error: "Order has already advanced and cannot be rejected", code: "INVALID_STATUS" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: updated, error: updateError } = await supabase
        .from("transactions")
        .update({
          status: "cancelled",
          rejection_reason: reason,
          rejected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", transactionId)
        .select()
        .single();

      if (updateError) {
        return new Response(
          JSON.stringify({ success: false, error: updateError.message, code: "UPDATE_FAILED" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: updated }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /transaction-api/:id - Get transaction details (PUBLIC)
    if (method === "GET" && apiPath.length === 1) {
      const transactionId = apiPath[0];

      const { data: transaction, error } = await supabase
        .from("transactions")
        .select(`
          id,
          status,
          amount,
          currency,
          item_name,
          item_description,
          item_images,
          seller_id,
          buyer_id,
          buyer_name,
          buyer_phone,
          created_at,
          expires_at,
          paid_at,
          shipped_at,
          delivered_at,
          tracking_number,
          courier_name
        `)
        .eq("id", transactionId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching transaction:", error);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to fetch transaction" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!transaction) {
        return new Response(
          JSON.stringify({ success: false, error: "Transaction not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch seller info
      const { data: sellerProfile } = await supabase
        .from("profiles")
        .select("name, phone, profile_picture")
        .eq("user_id", transaction.seller_id)
        .maybeSingle();

      const { data: sellerDetails } = await supabase
        .from("seller_profiles")
        .select("business_name, is_verified, rating, total_reviews")
        .eq("user_id", transaction.seller_id)
        .maybeSingle();

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            ...transaction,
            seller: {
              name: sellerDetails?.business_name || sellerProfile?.name || "Seller",
              phone: sellerProfile?.phone,
              profilePicture: sellerProfile?.profile_picture,
              isVerified: sellerDetails?.is_verified || false,
              rating: sellerDetails?.rating || 0,
              totalReviews: sellerDetails?.total_reviews || 0,
            },
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /transaction-api/:id/pay - Initiate payment
    if (method === "POST" && apiPath.length === 2 && apiPath[1] === "pay") {
      const transactionId = apiPath[0];
      const body = await req.json();
      const { buyerName, buyerPhone, buyerEmail, buyerAddress, paymentMethod } = body;

      if (!buyerName || !buyerPhone) {
        return new Response(
          JSON.stringify({ success: false, error: "Buyer name and phone are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // First check if transaction exists and is pending
      const { data: existing } = await supabase
        .from("transactions")
        .select("id, status")
        .eq("id", transactionId)
        .maybeSingle();

      if (!existing) {
        return new Response(
          JSON.stringify({ success: false, error: "Transaction not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (existing.status !== "pending") {
        return new Response(
          JSON.stringify({ success: false, error: "Transaction is no longer available" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update transaction with buyer info
      const { data: transaction, error } = await supabase
        .from("transactions")
        .update({
          buyer_name: buyerName,
          buyer_phone: buyerPhone,
          buyer_email: buyerEmail || null,
          buyer_address: buyerAddress || null,
          payment_method: paymentMethod || "MPESA",
          status: "processing",
          updated_at: new Date().toISOString(),
        })
        .eq("id", transactionId)
        .select()
        .single();

      if (error) {
        console.error("Error updating transaction:", error);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to initiate payment" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Payment initiated",
          data: transaction,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /transaction-api/:id/deliver - Buyer confirms delivery received
    if (method === "POST" && apiPath.length === 2 && apiPath[1] === "deliver") {
      const transactionId = apiPath[0];
      const { data: transaction, error } = await supabase
        .from("transactions")
        .update({
          status: "delivered",
          delivered_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", transactionId)
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: "Failed to confirm delivery" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ success: true, data: transaction }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /transaction-api/:id/confirm - Confirm payment (simulate for now)
    if (method === "POST" && apiPath.length === 2 && apiPath[1] === "confirm") {
      const transactionId = apiPath[0];
      const body = await req.json().catch(() => ({}));
      const paymentReference = body.paymentReference || `PAY-${Date.now()}`;

      const { data: transaction, error } = await supabase
        .from("transactions")
        .update({
          status: "paid",
          payment_reference: paymentReference,
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", transactionId)
        .select()
        .single();

      if (error) {
        console.error("Error confirming payment:", error);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to confirm payment" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Payment confirmed",
          data: transaction,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Transaction API error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
