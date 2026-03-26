/**
 * Storefront API Edge Function
 * Public-facing API for viewing stores and products
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getUserFromRequest(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user } } = await supabase.auth.getUser(token);
  return user?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const idx = pathParts.indexOf("storefront-api");
    const path = idx >= 0 ? "/" + (pathParts.slice(idx + 1).join("/") || "") : url.pathname;
    const method = req.method;

    // GET /store/:slug - Get public store by slug
    if (method === "GET" && path.match(/^\/store\/[a-zA-Z0-9-_]+$/)) {
      const slug = path.replace("/store/", "");

      // First try to get the store (allow active or null status for flexibility)
      const { data: storeOnly, error: storeError } = await supabase
        .from("stores")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();

      if (storeError) {
        console.error("Store fetch error:", storeError);
        throw storeError;
      }

      if (!storeOnly) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Store not found. Please check the URL and try again." 
        }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if store is active (allow both 'active' and 'ACTIVE' for compatibility)
      const storeStatus = storeOnly.status?.toLowerCase();
      if (storeStatus !== 'active') {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "This store is not yet active. The seller needs to activate it first.",
          code: "STORE_INACTIVE"
        }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get seller profile info
      const { data: sellerProfile } = await supabase
        .from("profiles")
        .select("name, email, phone")
        .eq("user_id", storeOnly.seller_id)
        .maybeSingle();

      // Get seller rating info
      const { data: sellerInfo } = await supabase
        .from("seller_profiles")
        .select("rating, total_reviews, is_verified, total_sales")
        .eq("user_id", storeOnly.seller_id)
        .maybeSingle();

      // Get products for the store
      const { data: products } = await supabase
        .from("products")
        .select("*")
        .eq("store_id", storeOnly.id)
        .eq("status", "published")
        .order("updated_at", { ascending: false });

      return new Response(JSON.stringify({
        success: true,
        data: { 
          ...storeOnly, 
          products: products || [],
          seller: sellerProfile || { name: "Seller" },
          sellerProfile: sellerInfo || null,
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /product/:slug/:id - Get public product
    if (method === "GET" && path.match(/^\/product\/[a-zA-Z0-9-_]+\/[a-zA-Z0-9-]+$/)) {
      const parts = path.replace("/product/", "").split("/");
      const storeSlug = parts[0];
      const productId = parts[1];

      // Get store first
      const { data: store } = await supabase
        .from("stores")
        .select("id, seller_id, name, slug")
        .eq("slug", storeSlug)
        .maybeSingle();

      if (!store) {
        return new Response(JSON.stringify({ success: false, error: "Store not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: product, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .eq("store_id", store.id)
        .eq("status", "published")
        .maybeSingle();

      if (error) throw error;

      if (!product) {
        return new Response(JSON.stringify({ success: false, error: "Product not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get seller info
      const { data: sellerProfile } = await supabase
        .from("profiles")
        .select("name")
        .eq("user_id", store.seller_id)
        .maybeSingle();

      const { data: sellerInfo } = await supabase
        .from("seller_profiles")
        .select("rating, total_reviews, is_verified")
        .eq("user_id", store.seller_id)
        .maybeSingle();

      return new Response(JSON.stringify({ 
        success: true, 
        data: {
          ...product,
          store: { id: store.id, name: store.name, slug: store.slug },
          seller: sellerProfile || { name: "Seller" },
          sellerProfile: sellerInfo || null,
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /product/:slug/:id/reviews - Get approved reviews for product (public)
    if (method === "GET" && path.match(/^\/product\/[a-zA-Z0-9-_]+\/[a-zA-Z0-9-]+\/reviews$/)) {
      const parts = path.replace("/product/", "").replace("/reviews", "").split("/");
      const storeSlug = parts[0];
      const productId = parts[1];
      const rating = url.searchParams.get("rating") || "";
      const sort = url.searchParams.get("sort") || "recent";
      const page = parseInt(url.searchParams.get("page") || "1");
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);

      const { data: store } = await supabase
        .from("stores")
        .select("id")
        .eq("slug", storeSlug)
        .maybeSingle();
      if (!store) {
        return new Response(JSON.stringify({ success: false, error: "Store not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let q = supabase
        .from("product_reviews")
        .select("id, rating, title, content, images, customer_name, is_verified_purchase, seller_response, seller_responded_at, helpful_count, not_helpful_count, created_at", { count: "exact" })
        .eq("product_id", productId)
        .eq("status", "approved")
        .eq("is_published", true);

      if (rating) q = q.eq("rating", parseInt(rating));
      if (sort === "helpful") q = q.order("helpful_count", { ascending: false });
      else if (sort === "rating_high") q = q.order("rating", { ascending: false });
      else if (sort === "rating_low") q = q.order("rating", { ascending: true });
      else q = q.order("created_at", { ascending: false });

      const { data: reviews, error, count } = await q.range((page - 1) * limit, page * limit - 1);
      if (error) throw error;

      return new Response(JSON.stringify({
        success: true,
        data: {
          reviews: reviews || [],
          pagination: {
            page,
            limit,
            total: count || 0,
            pages: Math.ceil((count || 0) / limit),
          },
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET /product/:slug/:id/reviews/summary - Get review summary for product (public)
    if (method === "GET" && path.match(/^\/product\/[a-zA-Z0-9-_]+\/[a-zA-Z0-9-]+\/reviews\/summary$/)) {
      const parts = path.replace("/product/", "").replace("/reviews/summary", "").split("/");
      const productId = parts[1];

      const { data: rows, error } = await supabase
        .from("product_reviews")
        .select("rating")
        .eq("product_id", productId)
        .eq("status", "approved")
        .eq("is_published", true);

      if (error) throw error;

      const r = rows || [];
      const total = r.length;
      const dist: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      r.forEach((x) => { dist[Math.min(5, Math.max(1, x.rating || 0))] = (dist[Math.min(5, Math.max(1, x.rating || 0))] || 0) + 1; });
      const avg = total > 0 ? r.reduce((s, x) => s + (x.rating || 0), 0) / total : 0;

      return new Response(JSON.stringify({
        success: true,
        data: {
          total_reviews: total,
          average_rating: avg.toFixed(1),
          rating_distribution: Object.fromEntries(
            [5, 4, 3, 2, 1].map((star) => [
              star,
              { count: dist[star] || 0, percentage: total > 0 ? ((dist[star] || 0) / total * 100).toFixed(0) : "0" },
            ])
          ),
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET /product/:slug/:id/reviewable-orders - Orders user can review (requires auth)
    if (method === "GET" && path.match(/^\/product\/[a-zA-Z0-9-_]+\/[a-zA-Z0-9-]+\/reviewable-orders$/)) {
      const userId = await getUserFromRequest(req);
      if (!userId) {
        return new Response(JSON.stringify({ success: false, error: "Sign in to view reviewable orders" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const parts = path.replace("/product/", "").replace("/reviewable-orders", "").split("/");
      const storeSlug = parts[0];
      const productId = parts[1];
      const { data: store } = await supabase.from("stores").select("id, seller_id").eq("slug", storeSlug).maybeSingle();
      if (!store) {
        return new Response(JSON.stringify({ success: false, error: "Store not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: orders } = await supabase
        .from("transactions")
        .select("id, created_at, item_name")
        .eq("buyer_id", userId)
        .eq("seller_id", store.seller_id)
        .eq("product_id", productId)
        .in("status", ["completed", "delivered"])
        .order("created_at", { ascending: false });
      const reviewed = await supabase
        .from("product_reviews")
        .select("order_id")
        .eq("product_id", productId)
        .eq("customer_id", userId);
      const reviewedIds = new Set((reviewed.data || []).map((r) => r.order_id));
      const reviewable = (orders || []).filter((o) => !reviewedIds.has(o.id));
      return new Response(JSON.stringify({ success: true, data: reviewable }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /product/:slug/:id/review - Submit review (requires auth, verified purchase)
    if (method === "POST" && path.match(/^\/product\/[a-zA-Z0-9-_]+\/[a-zA-Z0-9-]+\/review$/)) {
      const userId = await getUserFromRequest(req);
      if (!userId) {
        return new Response(JSON.stringify({ success: false, error: "Sign in to submit a review" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const parts = path.replace("/product/", "").replace("/review", "").split("/");
      const storeSlug = parts[0];
      const productId = parts[1];
      const body = await req.json();
      const { order_id, rating, title, content, images } = body;
      if (!order_id || !rating || !content) {
        return new Response(JSON.stringify({ success: false, error: "order_id, rating, content required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const r = Number(rating);
      if (r < 1 || r > 5 || content.length < 10) {
        return new Response(JSON.stringify({ success: false, error: "Rating 1-5, content min 10 chars" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: store } = await supabase.from("stores").select("id, seller_id").eq("slug", storeSlug).maybeSingle();
      if (!store) {
        return new Response(JSON.stringify({ success: false, error: "Store not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: tx } = await supabase
        .from("transactions")
        .select("id, buyer_id, product_id, status")
        .eq("id", order_id)
        .eq("seller_id", store.seller_id)
        .maybeSingle();
      if (!tx || (tx.buyer_id && tx.buyer_id !== userId)) {
        return new Response(JSON.stringify({ success: false, error: "Order not found or not yours" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const statusLower = (tx.status || "").toLowerCase();
      if (statusLower !== "completed" && statusLower !== "delivered") {
        return new Response(JSON.stringify({ success: false, error: "Can only review completed orders" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (String(tx.product_id) !== String(productId)) {
        return new Response(JSON.stringify({ success: false, error: "Product does not match order" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: existing } = await supabase
        .from("product_reviews")
        .select("id")
        .eq("product_id", productId)
        .eq("order_id", order_id)
        .eq("customer_id", userId)
        .maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ success: false, error: "You already reviewed this order" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: profile } = await supabase.from("profiles").select("name").eq("user_id", userId).maybeSingle();
      const { data: review, error } = await supabase
        .from("product_reviews")
        .insert({
          product_id: productId,
          order_id,
          customer_id: userId,
          seller_id: store.seller_id,
          rating: r,
          title: title || null,
          content,
          images: images ? JSON.stringify(Array.isArray(images) ? images : []) : "[]",
          is_verified_purchase: true,
          verified_at: new Date().toISOString(),
          customer_name: profile?.name || null,
          status: "pending",
          moderation_status: "pending",
        })
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: review }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /reviews/:id/helpful - Mark helpful/not helpful (public)
    if (method === "POST" && path.match(/^\/reviews\/[a-zA-Z0-9-]+\/helpful$/)) {
      const reviewId = path.split("/")[2];
      const body = await req.json().catch(() => ({}));
      const isHelpful = body.is_helpful === true || body.is_helpful === "true";
      const userId = await getUserFromRequest(req);
      const userKey = userId || `anon-${(req.headers.get("x-forwarded-for") || "0").slice(0, 32)}`;
      await supabase.from("review_helpfulness").delete().eq("review_id", reviewId).eq("user_id", userKey);
      await supabase.from("review_helpfulness").insert({ review_id: reviewId, user_id: userKey, is_helpful: isHelpful });
      const { data: counts } = await supabase.from("review_helpfulness").select("is_helpful").eq("review_id", reviewId);
      const helpful = (counts || []).filter((c) => c.is_helpful).length;
      const notHelpful = (counts || []).filter((c) => !c.is_helpful).length;
      await supabase.from("product_reviews").update({
        helpful_count: helpful,
        not_helpful_count: notHelpful,
        updated_at: new Date().toISOString(),
      }).eq("id", reviewId);
      return new Response(JSON.stringify({ success: true, helpful_count: helpful, not_helpful_count: notHelpful }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /reviews/:id/report - Report review
    if (method === "POST" && path.match(/^\/reviews\/[a-zA-Z0-9-]+\/report$/)) {
      const reviewId = path.split("/")[2];
      const body = await req.json().catch(() => ({}));
      const { reason, description } = body;
      if (!reason) {
        return new Response(JSON.stringify({ success: false, error: "reason required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userId = await getUserFromRequest(req);
      const { error } = await supabase.from("review_reports").insert({
        review_id: reviewId,
        reporter_id: userId,
        reason: String(reason).slice(0, 100),
        description: description || null,
      });
      if (error) throw error;
      const { count } = await supabase.from("review_reports").select("id", { count: "exact", head: true }).eq("review_id", reviewId);
      if ((count || 0) >= 3) {
        await supabase.from("product_reviews").update({ status: "flagged" }).eq("id", reviewId);
      }
      return new Response(JSON.stringify({ success: true, message: "Review reported" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /product/:slug/:id/questions - Get Q&A for product (public)
    if (method === "GET" && path.match(/^\/product\/[a-zA-Z0-9-_]+\/[a-zA-Z0-9-]+\/questions$/)) {
      const parts = path.replace("/product/", "").replace("/questions", "").split("/");
      const productId = parts[1];
      const { data: questions, error } = await supabase
        .from("review_questions")
        .select("id, question, is_answered, helpful_count, created_at")
        .eq("product_id", productId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      const qIds = (questions || []).map((q) => q.id);
      const { data: answers } = qIds.length > 0 ? await supabase
        .from("review_answers")
        .select("id, question_id, answer, answerer_type, is_official, created_at")
        .in("question_id", qIds)
        .order("created_at", { ascending: true }) : { data: [] };
      const ansByQ: Record<string, any[]> = {};
      (answers || []).forEach((a) => {
        const q = a.question_id;
        if (!ansByQ[q]) ansByQ[q] = [];
        ansByQ[q].push(a);
      });
      const withAnswers = (questions || []).map((q) => ({ ...q, answers: ansByQ[q.id] || [] }));
      return new Response(JSON.stringify({ success: true, data: withAnswers }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /store/:slug/chat - Customer send message (creates conversation if needed)
    if (method === "POST" && path.match(/^\/store\/[a-zA-Z0-9-_]+\/chat$/)) {
      const storeSlug = path.replace("/store/", "").replace("/chat", "");
      const body = await req.json();
      const { message, customer_name, customer_email } = body;
      if (!message) {
        return new Response(JSON.stringify({ success: false, error: "message required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userId = await getUserFromRequest(req);
      const { data: store } = await supabase.from("stores").select("id, seller_id").eq("slug", storeSlug).maybeSingle();
      if (!store) {
        return new Response(JSON.stringify({ success: false, error: "Store not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      let convo = null;
      if (userId) {
        const { data: existing } = await supabase
          .from("chat_conversations")
          .select("*")
          .eq("seller_id", store.seller_id)
          .eq("customer_id", userId)
          .maybeSingle();
        convo = existing;
      }
      if (!convo) {
        const { data: profile } = userId ? await supabase.from("profiles").select("name, email").eq("user_id", userId).maybeSingle() : { data: null };
        const { data: newConvo, error: ec } = await supabase
          .from("chat_conversations")
          .insert({
            seller_id: store.seller_id,
            customer_id: userId,
            customer_name: customer_name || profile?.name,
            customer_email: customer_email || profile?.email,
            store_id: store.id,
            status: "waiting",
            last_message_at: new Date().toISOString(),
          })
          .select()
          .single();
        if (ec) throw ec;
        convo = newConvo;
      }
      const { data: profile } = userId ? await supabase.from("profiles").select("name").eq("user_id", userId).maybeSingle() : { data: null };
      const { data: msg, error } = await supabase
        .from("chat_messages")
        .insert({
          conversation_id: convo.id,
          sender_id: userId,
          sender_type: "customer",
          sender_name: customer_name || profile?.name || "Customer",
          message: message.slice(0, 2000),
        })
        .select()
        .single();
      if (error) throw error;
      await supabase
        .from("chat_conversations")
        .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", convo.id);
      return new Response(JSON.stringify({ success: true, data: { conversation_id: convo.id, message: msg } }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /product/:slug/:id/question - Ask question (auth)
    if (method === "POST" && path.match(/^\/product\/[a-zA-Z0-9-_]+\/[a-zA-Z0-9-]+\/question$/)) {
      const userId = await getUserFromRequest(req);
      if (!userId) {
        return new Response(JSON.stringify({ success: false, error: "Sign in to ask" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const parts = path.replace("/product/", "").replace("/question", "").split("/");
      const storeSlug = parts[0];
      const productId = parts[1];
      const body = await req.json();
      const { question } = body;
      if (!question || question.length < 10) {
        return new Response(JSON.stringify({ success: false, error: "Question min 10 chars" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: store } = await supabase.from("stores").select("id").eq("slug", storeSlug).maybeSingle();
      if (!store) {
        return new Response(JSON.stringify({ success: false, error: "Store not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: product } = await supabase.from("products").select("id").eq("id", productId).eq("store_id", store.id).maybeSingle();
      if (!product) {
        return new Response(JSON.stringify({ success: false, error: "Product not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: q, error } = await supabase
        .from("review_questions")
        .insert({ product_id: productId, customer_id: userId, question: question.slice(0, 500) })
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: q }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /checkout/:slug/:productId - Create transaction from product
    if (method === "POST" && path.match(/^\/checkout\/[a-zA-Z0-9-_]+\/[a-zA-Z0-9-]+$/)) {
      const parts = path.replace("/checkout/", "").split("/");
      const storeSlug = parts[0];
      const productId = parts[1];
      const { buyerName, buyerPhone, buyerEmail, paymentMethod, deliveryAddress } = await req.json();

      if (!buyerName || !buyerPhone) {
        return new Response(JSON.stringify({ success: false, error: "Buyer name and phone required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get store
      const { data: store } = await supabase
        .from("stores")
        .select("id, seller_id")
        .eq("slug", storeSlug)
        .maybeSingle();

      if (!store) {
        return new Response(JSON.stringify({ success: false, error: "Store not available" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get seller's account_id (required NOT NULL field on transactions)
      const { data: sellerAccount } = await supabase
        .from("accounts")
        .select("id")
        .eq("user_id", store.seller_id)
        .maybeSingle();

      if (!sellerAccount) {
        return new Response(JSON.stringify({ success: false, error: "Seller account not configured" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get buyer user id if authenticated
      const buyerUserId = await getUserFromRequest(req);

      // Get product
      const { data: product } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .eq("store_id", store.id)
        .eq("status", "published")
        .maybeSingle();

      if (!product) {
        return new Response(JSON.stringify({ success: false, error: "Product not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!product.price) {
        return new Response(JSON.stringify({ success: false, error: "Product price not set" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create transaction with unique ID
      const transactionId = `ORD-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const platformFeePercent = parseFloat(Deno.env.get("PLATFORM_FEE_PERCENT") || "5");
      const platformFee = (product.price * platformFeePercent) / 100;
      const sellerPayout = product.price - platformFee;

      const { data: transaction, error } = await supabase
        .from("transactions")
        .insert({
          id: transactionId,
          account_id: sellerAccount.id,
          seller_id: store.seller_id,
          buyer_id: buyerUserId || null,
          product_id: productId,
          item_name: product.name,
          item_description: product.description,
          item_images: product.images || [],
          amount: product.price,
          currency: product.currency || "KES",
          buyer_name: buyerName,
          buyer_phone: buyerPhone,
          buyer_email: buyerEmail,
          buyer_address: deliveryAddress,
          payment_method: paymentMethod || "PENDING_CONFIRMATION",
          platform_fee: platformFee,
          seller_payout: sellerPayout,
          status: "pending",
        })
        .select()
        .single();

      if (error) {
        console.error("Checkout insert error:", error);
        throw error;
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          ...transaction,
          paymentLink: `/pay/${transaction.id}`,
        },
      }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /stores - List all public stores
    if (method === "GET" && (path === "/stores" || path === "/stores/")) {
      const page = parseInt(url.searchParams.get("page") || "1");
      const limit = parseInt(url.searchParams.get("limit") || "20");

      const { data: stores, error, count } = await supabase
        .from("stores")
        .select("id, name, slug, bio, logo", { count: "exact" })
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (error) throw error;

      return new Response(JSON.stringify({
        success: true,
        data: stores,
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
    console.error("Storefront API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
