import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Content-Type": "application/json",
};

function generateLinkId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "PL-";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getUserId(req: Request): string | null {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

// Helper to check status (case-insensitive)
function isStatusActive(status: string | null): boolean {
  if (!status) return false;
  const normalized = status.toLowerCase();
  return normalized === 'active';
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const fnIndex = pathParts.indexOf("links-api");
  const pathAfter = fnIndex >= 0 ? pathParts.slice(fnIndex + 1) : pathParts;

  try {
    // POST /links-api (create payment link) - auth required
    if (req.method === "POST" && pathAfter.length === 0) {
      const userId = getUserId(req);
      if (!userId) {
        return new Response(
          JSON.stringify({ success: false, error: "Authentication required", code: "NO_AUTH" }),
          { status: 401, headers: corsHeaders }
        );
      }
      const body = await req.json();
      const {
        productName,
        productDescription,
        price,
        originalPrice,
        images,
        customerPhone,
        currency = "KES",
        quantity = 1,
        expiryHours,
      } = body;
      if (!productName || price == null) {
        return new Response(
          JSON.stringify({ success: false, error: "Product name and price are required", code: "VALIDATION_ERROR" }),
          { status: 400, headers: corsHeaders }
        );
      }
      const linkId = generateLinkId();
      const expiryDate = expiryHours
        ? new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString()
        : null;
      const rawFrontendUrl = Deno.env.get("FRONTEND_URL") || "https://payloominstantsafrica.vercel.app";
      const frontendUrl = rawFrontendUrl.replace(/\/+$/, ""); // strip trailing slashes

      // Store status as ACTIVE (uppercase for consistency with existing data)
      const { data: link, error } = await supabase
        .from("payment_links")
        .insert({
          id: linkId,
          seller_id: userId,
          product_name: productName,
          product_description: productDescription || null,
          price: Number(price),
          original_price: originalPrice ? Number(originalPrice) : null,
          currency,
          images: images || [],
          customer_phone: customerPhone || null,
          quantity: Number(quantity) || 1,
          expiry_date: expiryDate,
          status: "ACTIVE",
        })
        .select()
        .single();

      if (error) {
        console.error("Create link error:", error);
        return new Response(
          JSON.stringify({ success: false, error: error.message, code: "SERVER_ERROR" }),
          { status: 500, headers: corsHeaders }
        );
      }
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            ...link,
            productName: link.product_name,
            productDescription: link.product_description,
            originalPrice: link.original_price,
            customerPhone: link.customer_phone,
            expiryDate: link.expiry_date,
            linkUrl: `${frontendUrl}/buy/${linkId}`,
          },
        }),
        { status: 201, headers: corsHeaders }
      );
    }

    // GET /links-api/:linkId - get payment link (public)
    if (req.method === "GET" && pathAfter.length === 1) {
      const linkId = pathAfter[0];
      const { data: link, error } = await supabase
        .from("payment_links")
        .select("*")
        .eq("id", linkId)
        .maybeSingle();

      if (error || !link) {
        console.error("Link fetch error:", error || "Link not found");
        return new Response(
          JSON.stringify({ success: false, error: "Payment link not found", code: "NOT_FOUND" }),
          { status: 404, headers: corsHeaders }
        );
      }

      // Check expiry
      if (link.expiry_date && new Date() > new Date(link.expiry_date)) {
        await supabase.from("payment_links").update({ status: "EXPIRED" }).eq("id", linkId);
        return new Response(
          JSON.stringify({ success: false, error: "Payment link has expired", code: "EXPIRED" }),
          { status: 400, headers: corsHeaders }
        );
      }

      // Check status (case-insensitive check for ACTIVE or active)
      const linkStatus = link.status?.toUpperCase();
      if (linkStatus !== "ACTIVE") {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `This link is ${link.status?.toLowerCase() || 'unavailable'}`, 
            code: "INVALID_STATUS" 
          }),
          { status: 400, headers: corsHeaders }
        );
      }

      // Get seller info
      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("user_id", link.seller_id)
        .maybeSingle();

      const { data: sellerProfile } = await supabase
        .from("seller_profiles")
        .select("rating, total_reviews, is_verified")
        .eq("user_id", link.seller_id)
        .maybeSingle();

      // Increment click count
      await supabase
        .from("payment_links")
        .update({ clicks: (link.clicks || 0) + 1 })
        .eq("id", linkId);

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            id: link.id,
            productName: link.product_name,
            productDescription: link.product_description,
            price: link.price,
            originalPrice: link.original_price,
            currency: link.currency,
            images: link.images || [],
            status: link.status,
            quantity: link.quantity,
            seller: {
              id: link.seller_id,
              name: profile?.name || "Seller",
              sellerProfile: sellerProfile 
                ? { 
                    rating: sellerProfile.rating, 
                    totalReviews: sellerProfile.total_reviews, 
                    isVerified: sellerProfile.is_verified 
                  } 
                : undefined,
            },
          },
        }),
        { headers: corsHeaders }
      );
    }

    // GET /links-api/seller/my-links - my links (auth)
    if (req.method === "GET" && pathAfter[0] === "seller" && pathAfter[1] === "my-links") {
      const userId = getUserId(req);
      if (!userId) {
        return new Response(
          JSON.stringify({ success: false, error: "Authentication required", code: "NO_AUTH" }),
          { status: 401, headers: corsHeaders }
        );
      }
      const status = url.searchParams.get("status");
      let query = supabase
        .from("payment_links")
        .select("*")
        .eq("seller_id", userId)
        .order("created_at", { ascending: false });
      if (status && status !== "ALL") query = query.eq("status", status);
      const { data: links, error } = await query;
      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: corsHeaders }
        );
      }
      const formatted = (links || []).map((l: any) => ({
        id: l.id,
        productName: l.product_name,
        productDescription: l.product_description,
        price: l.price,
        originalPrice: l.original_price,
        currency: l.currency,
        images: l.images || [],
        status: l.status,
        quantity: l.quantity,
        clicks: l.clicks,
        purchases: l.purchases,
        revenue: l.revenue,
        createdAt: l.created_at,
        expiryDate: l.expiry_date,
      }));
      return new Response(JSON.stringify({ success: true, data: formatted }), { headers: corsHeaders });
    }

    // PATCH /links-api/:linkId/status - update status (auth, seller)
    if (req.method === "PATCH" && pathAfter.length === 2 && pathAfter[1] === "status") {
      const userId = getUserId(req);
      if (!userId) {
        return new Response(
          JSON.stringify({ success: false, error: "Authentication required", code: "NO_AUTH" }),
          { status: 401, headers: corsHeaders }
        );
      }
      const linkId = pathAfter[0];
      const body = await req.json();
      const { status } = body;
      const { error } = await supabase
        .from("payment_links")
        .update({ status: status || "DELETED", updated_at: new Date().toISOString() })
        .eq("id", linkId)
        .eq("seller_id", userId);
      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: corsHeaders }
        );
      }
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // PATCH /links-api/:linkId/restock - restock quantity (auth, seller)
    if (req.method === "PATCH" && pathAfter.length === 2 && pathAfter[1] === "restock") {
      const userId = getUserId(req);
      if (!userId) {
        return new Response(
          JSON.stringify({ success: false, error: "Authentication required", code: "NO_AUTH" }),
          { status: 401, headers: corsHeaders }
        );
      }
      const linkId = pathAfter[0];
      const body = await req.json();
      const { quantity } = body;
      
      if (quantity == null || typeof quantity !== 'number' || quantity < 0) {
        return new Response(
          JSON.stringify({ success: false, error: "Quantity must be a non-negative number", code: "VALIDATION_ERROR" }),
          { status: 400, headers: corsHeaders }
        );
      }

      // Fetch current link to get current quantity
      const { data: currentLink } = await supabase
        .from("payment_links")
        .select("quantity, status")
        .eq("id", linkId)
        .eq("seller_id", userId)
        .single();

      if (!currentLink) {
        return new Response(
          JSON.stringify({ success: false, error: "Link not found", code: "NOT_FOUND" }),
          { status: 404, headers: corsHeaders }
        );
      }

      // Determine new status - if restocking a sold out item, reactivate it
      let newStatus = currentLink.status;
      if (quantity > 0 && (currentLink.status === "SOLD_OUT" || currentLink.status === "sold_out")) {
        newStatus = "ACTIVE";
      }

      const { error } = await supabase
        .from("payment_links")
        .update({ 
          quantity, 
          status: newStatus,
          updated_at: new Date().toISOString() 
        })
        .eq("id", linkId)
        .eq("seller_id", userId);

      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: corsHeaders }
        );
      }
      return new Response(
        JSON.stringify({ success: true, data: { quantity, status: newStatus } }), 
        { headers: corsHeaders }
      );
    }

    // POST /links-api/:linkId/purchase - create order (transaction) for Paystack
    if (req.method === "POST" && pathAfter.length === 2 && pathAfter[1] === "purchase") {
      const linkId = pathAfter[0];
      const body = await req.json();
      const {
        buyerPhone,
        buyerEmail,
        deliveryAddress,
        paymentMethod = "PAYSTACK",
        buyerCurrency = "KES",
        quantity = 1,
        buyerName,
      } = body;

      const { data: link, error: linkErr } = await supabase
        .from("payment_links")
        .select("*")
        .eq("id", linkId)
        .maybeSingle();

      if (linkErr || !link) {
        return new Response(
          JSON.stringify({ success: false, error: "Payment link not found", code: "NOT_FOUND" }),
          { status: 404, headers: corsHeaders }
        );
      }

      // Check status (case-insensitive)
      const linkStatus = link.status?.toUpperCase();
      if (linkStatus !== "ACTIVE") {
        return new Response(
          JSON.stringify({ success: false, error: `Link is ${link.status?.toLowerCase() || 'unavailable'}`, code: "INVALID_STATUS" }),
          { status: 400, headers: corsHeaders }
        );
      }

      if (link.expiry_date && new Date() > new Date(link.expiry_date)) {
        return new Response(
          JSON.stringify({ success: false, error: "Link has expired", code: "EXPIRED" }),
          { status: 400, headers: corsHeaders }
        );
      }

      // Stock handling
      // IMPORTANT: We allow multiple payment attempts. Creating an order should NOT immediately “consume” stock
      // because M-Pesa/IntaSend payments can fail or time out after the order is created.
      //
      // We only hard-block purchases when the seller explicitly marked the link as SOLD_OUT.
      const linkStatusUpper = (link.status || '').toUpperCase();
      if (linkStatusUpper === 'SOLD_OUT') {
        return new Response(
          JSON.stringify({ success: false, error: 'This item is sold out', code: 'OUT_OF_STOCK' }),
          { status: 400, headers: corsHeaders }
        );
      }

      // Keep `quantity` for display/restock UX, but do not block on it here (retries must work).
      // If you want strict stock enforcement, we should decrement stock only after payment is confirmed.

      const amount = Number(link.price) * (quantity || 1);
      const platformFeePercent = parseFloat(Deno.env.get("PLATFORM_FEE_PERCENT") || "5");
      const platformFee = (amount * platformFeePercent) / 100;
      const sellerPayout = amount - platformFee;

      // Generate a unique transaction ID
      const transactionId = `TXN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      
      const { data: tx, error: txErr } = await supabase
        .from("transactions")
        .insert({
          id: transactionId,
          seller_id: link.seller_id,
          item_name: link.product_name,
          item_description: link.product_description,
          item_images: link.images || [],
          amount,
          quantity: quantity || 1,
          currency: link.currency,
          buyer_phone: buyerPhone,
          buyer_name: buyerName || "Buyer",
          buyer_email: buyerEmail || null,
          buyer_address: deliveryAddress || null,
          payment_method: paymentMethod,
          platform_fee: platformFee,
          seller_payout: sellerPayout,
          status: "pending",
        })
        .select()
        .single();

      if (txErr) {
        console.error("Create transaction error:", txErr);
        return new Response(
          JSON.stringify({ success: false, error: txErr.message }),
          { status: 500, headers: corsHeaders }
        );
      }

      // Update purchase count on the link
      await supabase
        .from("payment_links")
        .update({ 
          purchases: (link.purchases || 0) + 1,
          quantity: link.quantity !== null ? link.quantity - quantity : null,
        })
        .eq("id", linkId);

      return new Response(
        JSON.stringify({ success: true, data: { id: tx.id, transactionId: tx.id } }),
        { status: 201, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Not found" }),
      { status: 404, headers: corsHeaders }
    );
  } catch (err) {
    console.error("links-api error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
