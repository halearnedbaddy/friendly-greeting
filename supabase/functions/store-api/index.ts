/**
 * Store API Edge Function
 * Handles store CRUD operations, products, and social accounts
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization")! } },
    });

    const supabaseAdmin = supabaseServiceKey
      ? createClient(supabaseUrl, supabaseServiceKey)
      : supabase;

    // Verify user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const fnIdx = pathParts.indexOf("store-api");
    const path = fnIdx >= 0 ? "/" + (pathParts.slice(fnIdx + 1).join("/") || "") : url.pathname;
    const method = req.method;

    // Route handlers
    // GET /store - Get user's store
    if (method === "GET" && (path === "" || path === "/")) {
      const { data: store, error } = await supabase
        .from("stores")
        .select("*, social_accounts(*)")
        .eq("seller_id", userId)
        .maybeSingle();

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: store }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /store - Create store
    if (method === "POST" && (path === "" || path === "/")) {
      const { name, slug, bio, logo } = await req.json();
      
      if (!name || !slug) {
        return new Response(JSON.stringify({ success: false, error: "Name and slug are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if user already has a store
      const { data: existing } = await supabase
        .from("stores")
        .select("id")
        .eq("seller_id", userId)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ success: false, error: "User already has a store" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if slug is taken
      const { data: slugExists } = await supabase
        .from("stores")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      if (slugExists) {
        return new Response(JSON.stringify({ success: false, error: "Slug already taken" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: store, error } = await supabase
        .from("stores")
        .insert({ seller_id: userId, name, slug, bio, logo, status: "inactive", visibility: "PRIVATE" })
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: store }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PUT /store - Update store
    if (method === "PUT" && (path === "" || path === "/")) {
      const body = await req.json();
      const { name, slug, bio, logo, visibility, status } = body;

      const { data: store, error } = await supabase
        .from("stores")
        .update({ 
          ...(name && { name }),
          ...(slug && { slug }),
          ...(bio !== undefined && { bio }),
          ...(logo !== undefined && { logo }),
          ...(visibility && { visibility }),
          ...(status && { status }),
          updated_at: new Date().toISOString()
        })
        .eq("seller_id", userId)
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: store }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==================== PRODUCTS (Full CRUD, Variants, Bulk, Categories) ====================
    const { data: store } = await supabaseAdmin.from("stores").select("id").eq("seller_id", userId).maybeSingle();
    const storeId = store?.id;

    function slugify(s: string) {
      return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    }

    // GET /products - List with filters, pagination
    if (method === "GET" && path === "/products") {
      if (!storeId) {
        return new Response(JSON.stringify({ success: true, data: { products: [], pagination: { page: 1, limit: 50, total: 0, pages: 0 } } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50")));
      const status = url.searchParams.get("status") || "";
      const categoryId = url.searchParams.get("category_id") || "";
      const search = url.searchParams.get("search") || "";
      const sort = url.searchParams.get("sort") || "created_at";
      const order = url.searchParams.get("order") === "asc" ? true : false;

      let q = supabase.from("products").select("*", { count: "exact" }).eq("store_id", storeId);

      if (status && ["draft", "published", "archived"].includes(status)) q = q.eq("status", status);
      if (categoryId) q = q.eq("category_id", parseInt(categoryId));
      if (search) q = q.or(`name.ilike.%${search}%,sku.ilike.%${search}%,description.ilike.%${search}%`);

      const validSort = ["name", "price", "created_at", "updated_at", "sales_count", "quantity"];
      const sortCol = validSort.includes(sort) ? sort : "created_at";
      q = q.order(sortCol, { ascending: order });

      const { data: products, error, count } = await q.range((page - 1) * limit, page * limit - 1);
      if (error) throw error;

      const total = count || 0;
      return new Response(JSON.stringify({
        success: true,
        data: {
          products: products || [],
          pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET /products/export - Export to CSV
    if (method === "GET" && path === "/products/export") {
      if (!storeId) {
        return new Response(JSON.stringify({ success: false, error: "Store not found" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: products, error } = await supabase.from("products").select("name,sku,price,compare_at_price,cost,quantity,description,category_id,brand,status,weight").eq("store_id", storeId).order("created_at", { ascending: false });
      if (error) throw error;
      const cols = ["name", "sku", "price", "compare_at_price", "cost", "quantity", "description", "category_id", "brand", "status", "weight"];
      const csv = [cols.join(","), ...(products || []).map((p: Record<string, unknown>) => cols.map((c) => `"${String(p[c] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
      return new Response(csv, {
        headers: { ...corsHeaders, "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="products.csv"' },
      });
    }

    // POST /products/bulk-update
    if (method === "POST" && path === "/products/bulk-update") {
      const { product_ids, updates } = await req.json();
      if (!Array.isArray(product_ids) || product_ids.length === 0 || !updates || typeof updates !== "object") {
        return new Response(JSON.stringify({ success: false, error: "product_ids array and updates object required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const allowed = ["price", "status", "category_id", "tags"];
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const k of allowed) {
        if (updates[k] !== undefined) updateData[k] = updates[k];
      }
      if (Object.keys(updateData).length <= 1) {
        return new Response(JSON.stringify({ success: false, error: "No valid fields to update" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data, error } = await supabase.from("products").update(updateData).in("id", product_ids).eq("store_id", storeId).select("id");
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, updated: (data || []).length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /products/bulk-delete
    if (method === "POST" && path === "/products/bulk-delete") {
      const { product_ids } = await req.json();
      if (!Array.isArray(product_ids) || product_ids.length === 0) {
        return new Response(JSON.stringify({ success: false, error: "product_ids array required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { error } = await supabase.from("products").delete().in("id", product_ids).eq("store_id", storeId);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, deleted: product_ids.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /products/import - Start import job (placeholder - actual processing would need worker)
    if (method === "POST" && path === "/products/import") {
      if (!storeId) {
        return new Response(JSON.stringify({ success: false, error: "Store not found" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const body = await req.json().catch(() => ({}));
      const { file_url, file_name, file_size } = body;
      if (!file_url || !file_name) {
        return new Response(JSON.stringify({ success: false, error: "file_url and file_name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: job, error } = await supabase.from("product_import_jobs").insert({ store_id: storeId, file_url, file_name, file_size: file_size || 0, status: "pending" }).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, message: "Import job started", job_id: job.id }), { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET /products/import/:jobId
    if (method === "GET" && path.match(/^\/products\/import\/[a-zA-Z0-9-]+$/)) {
      const jobId = path.split("/")[3];
      const { data: job, error } = await supabase.from("product_import_jobs").select("*").eq("id", jobId).eq("store_id", storeId).single();
      if (error || !job) {
        return new Response(JSON.stringify({ success: false, error: "Import job not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ success: true, data: job }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET /products/categories
    if (method === "GET" && path === "/products/categories") {
      if (!storeId) {
        return new Response(JSON.stringify({ success: true, data: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: categories, error } = await supabase.from("categories").select("*").eq("store_id", storeId).order("display_order").order("name");
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: categories || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /products/categories
    if (method === "POST" && path === "/products/categories") {
      const body = await req.json();
      const { name, parent_id, description, image_url, seo_title, seo_description } = body;
      if (!name || !storeId) {
        return new Response(JSON.stringify({ success: false, error: "Name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const slug = slugify(name);
      const { data: cat, error } = await supabase.from("categories").insert({
        store_id: storeId,
        name,
        slug,
        description: description || null,
        parent_id: parent_id || null,
        image_url: image_url || null,
        seo_title: seo_title || name,
        seo_description: seo_description || description,
      }).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: cat }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET /products/:id - Single product with variants
    if (method === "GET" && path.match(/^\/products\/[a-zA-Z0-9-]+$/) && !path.includes("/variants") && !path.includes("/duplicate") && !path.includes("/analytics")) {
      const productId = path.split("/")[2];
      const { data: product, error: pe } = await supabase.from("products").select("*").eq("id", productId).eq("store_id", storeId).single();
      if (pe || !product) {
        return new Response(JSON.stringify({ success: false, error: "Product not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: variants } = await supabase.from("product_variants").select("*").eq("product_id", productId).order("position");
      return new Response(JSON.stringify({ success: true, data: { ...product, variants: variants || [] } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /products - Create (matches FreshCart implementation guide schema: store_id, slug, etc.)
    if (method === "POST" && path === "/products") {
      try {
        let body: Record<string, unknown>;
        try {
          body = (await req.json()) as Record<string, unknown>;
        } catch {
          return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const {
          name,
          description,
          short_description,
          price,
          compare_at_price,
          cost,
          sku,
          barcode,
          quantity,
          low_stock_threshold,
          category_id,
          brand,
          tags,
          product_type,
          status,
          images,
          videos,
          seo_title,
          seo_description,
          requires_shipping,
          weight,
          is_featured,
        } = body;

        if (!name || typeof price !== "number") {
          return new Response(JSON.stringify({ success: false, error: "Product name and price are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (!storeId) {
          return new Response(JSON.stringify({ success: false, error: "Create a store first" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const nameStr = String(name).trim();
        const slugBase = slugify(nameStr) || "product";
        let uniqueSlug = slugBase;
        let counter = 1;
        for (let i = 0; i < 100; i++) {
          const { data: existing, error: selErr } = await supabaseAdmin.from("products").select("id").eq("store_id", storeId).eq("slug", uniqueSlug).maybeSingle();
          if (selErr) {
            console.error("Slug check error:", selErr);
            return new Response(JSON.stringify({ success: false, error: selErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          if (!existing) break;
          uniqueSlug = `${slugBase}-${counter}`;
          counter++;
        }

        const imgArray = Array.isArray(images) ? images : images ? [images] : [];
        const statusVal = (typeof status === "string" ? status : "draft").toLowerCase();
        const insertPayload: Record<string, unknown> = {
          store_id: storeId,
          name: nameStr,
          slug: uniqueSlug,
          description: description || null,
          short_description: short_description || null,
          price,
          compare_at_price: compare_at_price ?? null,
          cost: cost ?? null,
          sku: sku || null,
          barcode: barcode || null,
          quantity: quantity ?? 0,
          low_stock_threshold: low_stock_threshold ?? 10,
          category_id: category_id || null,
          brand: brand || null,
          tags: Array.isArray(tags) ? tags : tags ? [tags] : [],
          product_type: product_type || "physical",
          status: statusVal,
          images: imgArray,
          videos: Array.isArray(videos) ? videos : [],
          seo_title: seo_title || nameStr,
          seo_description: seo_description ?? description,
          requires_shipping: requires_shipping !== false,
          weight: weight ?? null,
          is_featured: !!is_featured,
        };

        let result = await supabaseAdmin.from("products").insert(insertPayload).select().single();

        if (result.error && result.error.message?.includes("column") && result.error.message?.includes("does not exist")) {
          const minimalPayload: Record<string, unknown> = {
            store_id: storeId,
            name: nameStr,
            description: description || null,
            price,
            images: imgArray,
            status: statusVal,
          };
          if (uniqueSlug) minimalPayload.slug = uniqueSlug;
          result = await supabaseAdmin.from("products").insert(minimalPayload).select().single();
          if (result.error && result.error.message?.toLowerCase().includes("enum") && statusVal === "draft") {
            delete minimalPayload.status;
            result = await supabaseAdmin.from("products").insert(minimalPayload).select().single();
          }
        }

        if (result.error) {
          console.error("Products insert error:", result.error);
          return new Response(JSON.stringify({ success: false, error: result.error.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const product = result.data;
        return new Response(JSON.stringify({ success: true, data: product }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (err) {
        console.error("POST /products error:", err);
        const msg = err instanceof Error ? err.message : "Failed to create product";
        return new Response(JSON.stringify({ success: false, error: msg }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // PATCH /products/:id - Update
    if (method === "PATCH" && path.match(/^\/products\/[a-zA-Z0-9-]+$/) && !path.includes("/variants") && !path.includes("/duplicate") && !path.includes("/analytics")) {
      const productId = path.split("/")[2];
      const body = await req.json();
      const allowed = [
        "name", "description", "short_description", "price", "compare_at_price", "cost", "sku", "barcode",
        "quantity", "low_stock_threshold", "category_id", "brand", "tags", "status", "images", "videos",
        "seo_title", "seo_description", "weight", "is_featured", "product_type", "requires_shipping",
      ];
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const k of allowed) {
        if (body[k] !== undefined) updateData[k] = body[k];
      }
      if (Array.isArray(body.images)) updateData.images = body.images;
      const { data: product, error } = await supabase.from("products").update(updateData).eq("id", productId).eq("store_id", storeId).select().single();
      if (error) throw error;
      if (!product) {
        return new Response(JSON.stringify({ success: false, error: "Product not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ success: true, data: product }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // PUT /products/:id - Update (legacy, same as PATCH)
    if (method === "PUT" && path.match(/^\/products\/[a-zA-Z0-9-]+$/) && !path.includes("/variants")) {
      const productId = path.split("/")[2];
      const body = await req.json();
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        ...(body.name && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.price !== undefined && { price: body.price }),
        ...(body.images !== undefined && { images: Array.isArray(body.images) ? body.images : body.images ? [body.images] : [] }),
        ...(body.status && { status: body.status.toLowerCase() }),
      };
      const { data: product, error } = await supabase.from("products").update(updateData).eq("id", productId).eq("store_id", storeId).select().single();
      if (error) throw error;
      if (!product) {
        return new Response(JSON.stringify({ success: false, error: "Product not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ success: true, data: product }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // DELETE /products/:id
    if (method === "DELETE" && path.match(/^\/products\/[a-zA-Z0-9-]+$/) && !path.includes("/variants")) {
      const productId = path.split("/")[2];
      const { error } = await supabase.from("products").delete().eq("id", productId).eq("store_id", storeId);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, message: "Product deleted" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /products/:id/duplicate
    if (method === "POST" && path.match(/^\/products\/[a-zA-Z0-9-]+\/duplicate$/)) {
      const productId = path.split("/")[2];
      const { data: orig, error: oe } = await supabase.from("products").select("*").eq("id", productId).eq("store_id", storeId).single();
      if (oe || !orig) {
        return new Response(JSON.stringify({ success: false, error: "Product not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const slug = slugify(orig.name + " Copy");
      let uniqueSlug = slug;
      let c = 1;
      while (true) {
        const { data: ex } = await supabase.from("products").select("id").eq("store_id", storeId).eq("slug", uniqueSlug).maybeSingle();
        if (!ex) break;
        uniqueSlug = `${slug}-${c}`;
        c++;
      }
      const { data: dup, error: de } = await supabase.from("products").insert({
        store_id: storeId,
        name: orig.name + " (Copy)",
        slug: uniqueSlug,
        description: orig.description,
        short_description: orig.short_description,
        price: orig.price,
        compare_at_price: orig.compare_at_price,
        cost: orig.cost,
        sku: null,
        barcode: null,
        quantity: orig.quantity ?? 0,
        category_id: orig.category_id,
        brand: orig.brand,
        tags: orig.tags || [],
        product_type: orig.product_type || "physical",
        status: "draft",
        images: orig.images || [],
        videos: orig.videos || [],
        seo_title: orig.seo_title,
        seo_description: orig.seo_description,
        weight: orig.weight,
        is_featured: false,
      }).select().single();
      if (de) throw de;
      const { data: vars } = await supabase.from("product_variants").select("*").eq("product_id", productId);
      for (const v of vars || []) {
        await supabase.from("product_variants").insert({
          product_id: dup.id,
          name: v.name,
          sku: null,
          options: v.options,
          price: v.price,
          compare_at_price: v.compare_at_price,
          cost: v.cost,
          quantity: v.quantity,
          image_url: v.image_url,
          position: v.position,
        });
      }
      return new Response(JSON.stringify({ success: true, data: dup }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET /products/:id/variants
    if (method === "GET" && path.match(/^\/products\/[a-zA-Z0-9-]+\/variants$/)) {
      const productId = path.split("/")[2];
      const { data: prod } = await supabase.from("products").select("id").eq("id", productId).eq("store_id", storeId).single();
      if (!prod) {
        return new Response(JSON.stringify({ success: false, error: "Product not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: variants, error } = await supabase.from("product_variants").select("*").eq("product_id", productId).order("position");
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: variants || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /products/:id/variants
    if (method === "POST" && path.match(/^\/products\/[a-zA-Z0-9-]+\/variants$/)) {
      const productId = path.split("/")[2];
      const body = await req.json();
      const { options, price, compare_at_price, cost, quantity, sku, image_url } = body;
      if (!options || typeof options !== "object") {
        return new Response(JSON.stringify({ success: false, error: "options object required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: prod } = await supabase.from("products").select("id").eq("id", productId).eq("store_id", storeId).single();
      if (!prod) {
        return new Response(JSON.stringify({ success: false, error: "Product not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const variantName = Object.values(options).join(" / ");
      const { data: variant, error } = await supabase.from("product_variants").insert({
        product_id: productId,
        name: variantName,
        options,
        price: price ?? null,
        compare_at_price: compare_at_price ?? null,
        cost: cost ?? null,
        quantity: quantity ?? 0,
        sku: sku || null,
        image_url: image_url || null,
      }).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: variant }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // PATCH /products/:id/variants/:variantId
    if (method === "PATCH" && path.match(/^\/products\/[a-zA-Z0-9-]+\/variants\/[a-zA-Z0-9-]+$/)) {
      const parts = path.split("/");
      const productId = parts[2];
      const variantId = parts[4];
      const body = await req.json();
      const { data: prod } = await supabase.from("products").select("id").eq("id", productId).eq("store_id", storeId).single();
      if (!prod) {
        return new Response(JSON.stringify({ success: false, error: "Product not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const k of ["price", "quantity", "sku", "image_url", "is_available"]) {
        if (body[k] !== undefined) updateData[k] = body[k];
      }
      const { data: variant, error } = await supabase.from("product_variants").update(updateData).eq("id", variantId).eq("product_id", productId).select().single();
      if (error) throw error;
      if (!variant) {
        return new Response(JSON.stringify({ success: false, error: "Variant not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ success: true, data: variant }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // DELETE /products/:id/variants/:variantId
    if (method === "DELETE" && path.match(/^\/products\/[a-zA-Z0-9-]+\/variants\/[a-zA-Z0-9-]+$/)) {
      const parts = path.split("/");
      const productId = parts[2];
      const variantId = parts[4];
      const { data: prod } = await supabase.from("products").select("id").eq("id", productId).eq("store_id", storeId).single();
      if (!prod) {
        return new Response(JSON.stringify({ success: false, error: "Product not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { error } = await supabase.from("product_variants").delete().eq("id", variantId).eq("product_id", productId);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, message: "Variant deleted" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET /products/:id/analytics
    if (method === "GET" && path.match(/^\/products\/[a-zA-Z0-9-]+\/analytics$/)) {
      const productId = path.split("/")[2];
      const { data: prod } = await supabase.from("products").select("id").eq("id", productId).eq("store_id", storeId).single();
      if (!prod) {
        return new Response(JSON.stringify({ success: false, error: "Product not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const startDate = url.searchParams.get("start_date") || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const endDate = url.searchParams.get("end_date") || new Date().toISOString().slice(0, 10);
      const { data: rows } = await supabase
        .from("product_analytics")
        .select("date, views, unique_views, add_to_cart_count, purchase_count, revenue")
        .eq("product_id", productId)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date");
      const summary = (rows || []).reduce(
        (acc: Record<string, number>, r: Record<string, unknown>) => {
          acc.total_views += Number(r.views || 0);
          acc.total_unique_views += Number(r.unique_views || 0);
          acc.total_add_to_cart += Number(r.add_to_cart_count || 0);
          acc.total_purchases += Number(r.purchase_count || 0);
          acc.total_revenue += Number(r.revenue || 0);
          return acc;
        },
        { total_views: 0, total_unique_views: 0, total_add_to_cart: 0, total_purchases: 0, total_revenue: 0 }
      );
      return new Response(JSON.stringify({ success: true, data: { summary, trend: rows || [] } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET /store/social - Get social accounts
    if (method === "GET" && path === "/social") {
      const { data: store } = await supabase
        .from("stores")
        .select("id")
        .eq("seller_id", userId)
        .maybeSingle();

      if (!store) {
        return new Response(JSON.stringify({ success: true, data: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: accounts, error } = await supabase
        .from("social_accounts")
        .select("*")
        .eq("store_id", store.id);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: accounts }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /store/social - Connect social account
    if (method === "POST" && path === "/social") {
      const { platform, pageUrl, pageId } = await req.json();

      if (!platform || !pageUrl) {
        return new Response(JSON.stringify({ success: false, error: "Platform and pageUrl are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: store } = await supabase
        .from("stores")
        .select("id")
        .eq("seller_id", userId)
        .maybeSingle();

      if (!store) {
        return new Response(JSON.stringify({ success: false, error: "Create a store first" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: account, error } = await supabase
        .from("social_accounts")
        .insert({ store_id: store.id, platform, page_url: pageUrl, page_id: pageId })
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: account }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE /store/social/:id - Disconnect social account
    if (method === "DELETE" && path.startsWith("/social/")) {
      const accountId = path.replace("/social/", "");

      const { error } = await supabase.from("social_accounts").delete().eq("id", accountId);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true, message: "Account disconnected" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==================== REVIEWS (Seller) ====================
    if (method === "GET" && path === "/reviews") {
      const status = url.searchParams.get("status") || "all";
      const rating = url.searchParams.get("rating") || "";
      const productId = url.searchParams.get("product_id") || "";
      const sort = url.searchParams.get("sort") || "recent";
      const page = parseInt(url.searchParams.get("page") || "1");
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);

      let q = supabase
        .from("product_reviews")
        .select("*, products(id, name, images)", { count: "exact" })
        .eq("seller_id", userId);

      if (status !== "all") q = q.eq("status", status);
      if (rating) q = q.eq("rating", parseInt(rating));
      if (productId) q = q.eq("product_id", productId);

      if (sort === "rating_high") q = q.order("rating", { ascending: false });
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

    if (method === "GET" && path === "/reviews/analytics") {
      const startDate = url.searchParams.get("start_date") || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const endDate = url.searchParams.get("end_date") || new Date().toISOString().slice(0, 10);
      const productId = url.searchParams.get("product_id") || "";

      let analyticsQuery = supabase
        .from("product_reviews")
        .select("id, rating, created_at, product_id, images, video_url, seller_response, is_verified_purchase")
        .eq("seller_id", userId)
        .eq("status", "approved")
        .gte("created_at", startDate)
        .lte("created_at", endDate + "T23:59:59");
      if (productId) analyticsQuery = analyticsQuery.eq("product_id", productId);
      const { data: reviews, error } = await analyticsQuery;

      if (error) throw error;

      const r = reviews || [];
      const total = r.length;
      const avg = total > 0 ? r.reduce((s, x) => s + (x.rating || 0), 0) / total : 0;
      const dist: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      r.forEach((x) => { dist[Math.min(5, Math.max(1, x.rating || 0))]++; });
      const withPhotos = r.filter((x) => Array.isArray(x.images) && x.images.length > 0).length;
      const withVideos = r.filter((x) => !!x.video_url).length;
      const responded = r.filter((x) => !!x.seller_response).length;

      return new Response(JSON.stringify({
        success: true,
        data: {
          summary: {
            total_reviews: total,
            average_rating: avg.toFixed(2),
            rating_distribution: dist,
            with_photos: withPhotos,
            with_videos: withVideos,
            response_rate: total > 0 ? ((responded / total) * 100).toFixed(1) : "0",
          },
          trend: [],
          top_products: [],
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "POST" && path.match(/^\/reviews\/[a-zA-Z0-9-]+\/respond$/)) {
      const reviewId = path.split("/")[2];
      const { response } = await req.json();
      if (!response) {
        return new Response(JSON.stringify({ success: false, error: "Response text required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await supabase
        .from("product_reviews")
        .update({
          seller_response: response,
          seller_responded_at: new Date().toISOString(),
          seller_responder_id: userId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", reviewId)
        .eq("seller_id", userId)
        .select()
        .single();
      if (error) throw error;
      if (!data) {
        return new Response(JSON.stringify({ success: false, error: "Review not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "PATCH" && path.match(/^\/reviews\/[a-zA-Z0-9-]+\/status$/)) {
      const reviewId = path.split("/")[2];
      const { status: newStatus } = await req.json();
      if (!["approved", "rejected"].includes(newStatus)) {
        return new Response(JSON.stringify({ success: false, error: "Status must be approved or rejected" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await supabase
        .from("product_reviews")
        .update({
          status: newStatus,
          is_published: newStatus === "approved",
          published_at: newStatus === "approved" ? new Date().toISOString() : null,
          moderation_status: "reviewed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", reviewId)
        .eq("seller_id", userId)
        .select()
        .single();
      if (error) throw error;
      if (!data) {
        return new Response(JSON.stringify({ success: false, error: "Review not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "GET" && path === "/reviews/requestable-orders") {
      const { data: txList } = await supabase
        .from("transactions")
        .select("id, item_name, created_at, product_id")
        .eq("seller_id", userId)
        .in("status", ["completed", "delivered"])
        .order("created_at", { ascending: false })
        .limit(100);
      const orderIds = (txList || []).map((t) => t.id);
      const { data: existing } = await supabase
        .from("review_requests")
        .select("order_id")
        .eq("seller_id", userId)
        .in("order_id", orderIds.length ? orderIds : ["__none__"]);
      const requestedSet = new Set((existing || []).map((r) => r.order_id));
      const requestable = (txList || []).filter((t) => !requestedSet.has(t.id));
      return new Response(JSON.stringify({ success: true, data: requestable }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "POST" && path === "/reviews/request") {
      const { order_ids, send_via = "email", delay_days = 0 } = await req.json();
      if (!Array.isArray(order_ids) || order_ids.length === 0) {
        return new Response(JSON.stringify({ success: false, error: "order_ids array required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: store } = await supabase.from("stores").select("id, name, slug").eq("seller_id", userId).maybeSingle();
      if (!store) {
        return new Response(JSON.stringify({ success: false, error: "Store not found" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const inserted: string[] = [];
      for (const orderId of order_ids.slice(0, 50)) {
        const { data: tx } = await supabase.from("transactions").select("id, buyer_id").eq("id", orderId).eq("seller_id", userId).maybeSingle();
        if (!tx) continue;
        const { data: oi } = await supabase.from("transactions").select("product_id").eq("id", orderId).maybeSingle();
        const productIds = oi?.product_id ? [oi.product_id] : [];
        const { error } = await supabase.from("review_requests").insert({
          seller_id: userId,
          order_id: orderId,
          customer_id: tx.buyer_id,
          product_ids: productIds,
          request_type: send_via,
          status: delay_days > 0 ? "pending" : "sent",
          sent_at: delay_days > 0 ? null : new Date().toISOString(),
        });
        if (!error) inserted.push(orderId);
      }
      return new Response(JSON.stringify({ success: true, requests_sent: inserted.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "POST" && path === "/reviews/auto-request/config") {
      const body = await req.json();
      const { enabled, delay_days, send_via, incentive_type, incentive_value } = body;
      const { data, error } = await supabase
        .from("seller_review_settings")
        .upsert({
          seller_id: userId,
          review_auto_request_enabled: !!enabled,
          review_auto_request_delay_days: delay_days ?? 7,
          review_auto_request_method: send_via || "email",
          updated_at: new Date().toISOString(),
        }, { onConflict: "seller_id" })
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "GET" && path === "/reviews/auto-request/config") {
      const { data, error } = await supabase
        .from("seller_review_settings")
        .select("*")
        .eq("seller_id", userId)
        .maybeSingle();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: data || { review_auto_request_enabled: false } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "GET" && path === "/reviews/questions") {
      const { data: store } = await supabase.from("stores").select("id").eq("seller_id", userId).maybeSingle();
      if (!store) {
        return new Response(JSON.stringify({ success: true, data: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: products } = await supabase.from("products").select("id").eq("store_id", store.id);
      const productIds = (products || []).map((p) => p.id);
      if (!productIds.length) {
        return new Response(JSON.stringify({ success: true, data: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: questions, error } = await supabase
        .from("review_questions")
        .select("*, products(id, name)")
        .in("product_id", productIds)
        .eq("is_answered", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const qIds = (questions || []).map((q) => q.id);
      const { data: answers } = await supabase.from("review_answers").select("*").in("question_id", qIds.length ? qIds : ["00000000-0000-0000-0000-000000000000"]);
      const ansByQ: Record<string, any[]> = {};
      (answers || []).forEach((a) => {
        if (!ansByQ[a.question_id]) ansByQ[a.question_id] = [];
        ansByQ[a.question_id].push(a);
      });
      const withAnswers = (questions || []).map((q) => ({ ...q, answers: ansByQ[q.id] || [] }));
      return new Response(JSON.stringify({ success: true, data: withAnswers }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "POST" && path.match(/^\/questions\/[a-zA-Z0-9-]+\/answer$/)) {
      const questionId = path.split("/")[2];
      const { answer } = await req.json();
      if (!answer || answer.length < 5) {
        return new Response(JSON.stringify({ success: false, error: "Answer min 5 chars" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: q } = await supabase
        .from("review_questions")
        .select("id, product_id")
        .eq("id", questionId)
        .single();
      if (!q) {
        return new Response(JSON.stringify({ success: false, error: "Question not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: product } = await supabase.from("products").select("store_id").eq("id", q.product_id).single();
      const { data: store } = await supabase.from("stores").select("seller_id").eq("id", product?.store_id).single();
      if (!store || store.seller_id !== userId) {
        return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: a, error } = await supabase
        .from("review_answers")
        .insert({ question_id: questionId, answerer_id: userId, answerer_type: "seller", answer: answer.slice(0, 2000), is_official: true })
        .select()
        .single();
      if (error) throw error;
      await supabase.from("review_questions").update({ is_answered: true }).eq("id", questionId);
      return new Response(JSON.stringify({ success: true, data: a }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "POST" && path === "/reviews/bulk-update") {
      const { review_ids, status: newStatus } = await req.json();
      if (!Array.isArray(review_ids) || !["approved", "rejected"].includes(newStatus)) {
        return new Response(JSON.stringify({ success: false, error: "review_ids array and status required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await supabase
        .from("product_reviews")
        .update({
          status: newStatus,
          is_published: newStatus === "approved",
          published_at: newStatus === "approved" ? new Date().toISOString() : null,
          moderation_status: "reviewed",
          updated_at: new Date().toISOString(),
        })
        .eq("seller_id", userId)
        .in("id", review_ids);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, updated: review_ids.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==================== FINANCIAL ====================
    if (method === "GET" && path === "/financial/dashboard") {
      const period = url.searchParams.get("period") || "30d";
      const days = period === "7d" ? 7 : period === "90d" ? 90 : period === "1y" ? 365 : 30;
      const startDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
      const endDate = new Date().toISOString().slice(0, 10);

      const { data: txRows } = await supabase
        .from("transactions")
        .select("amount, seller_payout, platform_fee, status")
        .eq("seller_id", userId)
        .gte("created_at", startDate)
        .lte("created_at", endDate + "T23:59:59");

      const completed = (txRows || []).filter((t) => (t.status || "").toLowerCase() === "completed");
      const refunded = (txRows || []).filter((t) => (t.status || "").toLowerCase() === "refunded");
      const revenue = completed.reduce((s, t) => s + (Number(t.seller_payout ?? t.amount ?? 0)), 0);
      const refunds = refunded.reduce((s, t) => s + (Number(t.amount ?? 0)), 0);
      const commission = completed.reduce((s, t) => s + (Number(t.platform_fee ?? 0)), 0);

      const { data: expenseRows } = await supabase
        .from("seller_expenses")
        .select("amount")
        .eq("seller_id", userId)
        .eq("status", "active")
        .gte("expense_date", startDate)
        .lte("expense_date", endDate);

      const expenses = (expenseRows || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const grossProfit = revenue - refunds;
      const netProfit = grossProfit - expenses;
      const profitMargin = revenue > 0 ? ((netProfit / revenue) * 100).toFixed(2) : "0";

      return new Response(JSON.stringify({
        success: true,
        data: {
          summary: {
            revenue,
            refunds,
            gross_profit: grossProfit,
            commission,
            payment_fees: 0,
            expenses,
            net_revenue: grossProfit,
            net_profit: netProfit,
            profit_margin: profitMargin,
          },
          trend: [],
          breakdown: [],
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "GET" && path === "/financial/expenses") {
      const category = url.searchParams.get("category") || "";
      const startDate = url.searchParams.get("start_date") || "";
      const endDate = url.searchParams.get("end_date") || "";
      const page = parseInt(url.searchParams.get("page") || "1");
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);

      let q = supabase
        .from("seller_expenses")
        .select("*", { count: "exact" })
        .eq("seller_id", userId)
        .eq("status", "active");

      if (category) q = q.eq("category", category);
      if (startDate) q = q.gte("expense_date", startDate);
      if (endDate) q = q.lte("expense_date", endDate);

      const { data: expenses, error, count } = await q
        .order("expense_date", { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (error) throw error;
      return new Response(JSON.stringify({
        success: true,
        data: {
          expenses: expenses || [],
          pagination: {
            page,
            limit,
            total: count || 0,
            pages: Math.ceil((count || 0) / limit),
          },
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "POST" && path === "/financial/expenses") {
      const body = await req.json();
      const { amount, category, description, vendor_name, expense_date, is_tax_deductible } = body;
      if (!amount || !category || !description || !expense_date) {
        return new Response(JSON.stringify({ success: false, error: "amount, category, description, expense_date required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await supabase
        .from("seller_expenses")
        .insert({
          seller_id: userId,
          amount: parseFloat(amount),
          category,
          description,
          vendor_name: vendor_name || null,
          expense_date,
          is_tax_deductible: is_tax_deductible !== false,
        })
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "PATCH" && path.match(/^\/financial\/expenses\/[a-zA-Z0-9-]+$/)) {
      const expenseId = path.split("/")[3];
      const body = await req.json();
      const { data, error } = await supabase
        .from("seller_expenses")
        .update({
          ...(body.amount !== undefined && { amount: parseFloat(body.amount) }),
          ...(body.category && { category: body.category }),
          ...(body.description && { description: body.description }),
          ...(body.vendor_name !== undefined && { vendor_name: body.vendor_name }),
          ...(body.expense_date && { expense_date: body.expense_date }),
          updated_at: new Date().toISOString(),
        })
        .eq("id", expenseId)
        .eq("seller_id", userId)
        .select()
        .single();
      if (error) throw error;
      if (!data) {
        return new Response(JSON.stringify({ success: false, error: "Expense not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "DELETE" && path.match(/^\/financial\/expenses\/[a-zA-Z0-9-]+$/)) {
      const expenseId = path.split("/")[3];
      const { error } = await supabase
        .from("seller_expenses")
        .update({ status: "deleted", updated_at: new Date().toISOString() })
        .eq("id", expenseId)
        .eq("seller_id", userId);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "GET" && path === "/financial/reports/profit-loss") {
      const startDate = url.searchParams.get("start_date") || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const endDate = url.searchParams.get("end_date") || new Date().toISOString().slice(0, 10);

      const { data: txRows } = await supabase
        .from("transactions")
        .select("amount, seller_payout, platform_fee, status")
        .eq("seller_id", userId)
        .gte("created_at", startDate)
        .lte("created_at", endDate + "T23:59:59");

      const completed = (txRows || []).filter((t) => (t.status || "").toLowerCase() === "completed");
      const refunded = (txRows || []).filter((t) => (t.status || "").toLowerCase() === "refunded");
      const revenue = completed.reduce((s, t) => s + (Number(t.seller_payout ?? t.amount ?? 0)), 0);
      const refunds = refunded.reduce((s, t) => s + (Number(t.amount ?? 0)), 0);
      const commission = completed.reduce((s, t) => s + (Number(t.platform_fee ?? 0)), 0);

      const { data: expenseRows } = await supabase
        .from("seller_expenses")
        .select("category, amount")
        .eq("seller_id", userId)
        .eq("status", "active")
        .gte("expense_date", startDate)
        .lte("expense_date", endDate);

      const expenses = (expenseRows || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const byCategory: Record<string, number> = {};
      (expenseRows || []).forEach((e) => {
        const cat = e.category || "other";
        byCategory[cat] = (byCategory[cat] || 0) + (Number(e.amount) || 0);
      });

      const grossProfit = revenue - refunds;
      const netProfit = grossProfit - expenses;
      const profitMargin = revenue > 0 ? ((netProfit / revenue) * 100).toFixed(2) : "0";

      return new Response(JSON.stringify({
        success: true,
        data: {
          period: { start: startDate, end: endDate },
          revenue: {
            gross_sales: revenue,
            refunds,
            net_sales: grossProfit,
          },
          gross_profit: grossProfit,
          expenses: {
            platform_commission: commission,
            payment_processing: 0,
            operating_expenses: expenses,
            total_expenses: commission + expenses,
            by_category: byCategory,
          },
          net_profit: netProfit,
          profit_margin: profitMargin,
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==================== INVENTORY ====================
    if (method === "GET" && path === "/inventory/dashboard") {
      if (!storeId) {
        return new Response(JSON.stringify({ success: true, data: { summary: {}, low_stock_products: [], recent_adjustments: [] } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: products } = await supabase.from("products").select("id, quantity, low_stock_threshold, cost, status").eq("store_id", storeId).in("status", ["published", "draft", "active"]);
      const prodIds = (products || []).map((p) => p.id);
      let totalQty = 0;
      let totalVal = 0;
      let inStock = 0;
      let lowStock = 0;
      let outOfStock = 0;
      const lowStockList: any[] = [];
      for (const p of products || []) {
        const qty = p.quantity ?? 0;
        const threshold = p.low_stock_threshold ?? 10;
        totalQty += qty;
        totalVal += qty * (Number(p.cost) || 0);
        if (qty > 0) inStock++;
        if (qty <= threshold && qty > 0) { lowStock++; lowStockList.push({ ...p, total_quantity: qty, low_stock_threshold: threshold }); }
        if (qty === 0) outOfStock++;
      }
      const summary = {
        total_products: (products || []).length,
        total_quantity: totalQty,
        total_value: totalVal,
        in_stock_count: inStock,
        low_stock_count: lowStock,
        out_of_stock_count: outOfStock,
      };
      let recentAdj: any[] = [];
      if (prodIds.length) {
        const { data: adj } = await supabase.from("inventory_adjustments").select("*, products(id, name, sku)").in("product_id", prodIds).order("created_at", { ascending: false }).limit(10);
        recentAdj = adj || [];
      }
      return new Response(JSON.stringify({
        success: true,
        data: {
          summary,
          low_stock_products: lowStockList.slice(0, 20),
          recent_adjustments: recentAdj,
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "GET" && path === "/inventory/levels") {
      if (!storeId) {
        return new Response(JSON.stringify({ success: true, data: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const locationId = url.searchParams.get("location_id");
      const lowStockOnly = url.searchParams.get("low_stock_only") === "true";
      const { data: products } = await supabase.from("products").select("id, name, sku, images, quantity, low_stock_threshold, cost").eq("store_id", storeId);
      const prodIds = (products || []).map((p) => p.id);
      let levels: any[] = [];
      if (prodIds.length) {
        let q = supabase.from("inventory_levels").select("*, inventory_locations(name, code)").in("product_id", prodIds);
        if (locationId) q = q.eq("location_id", parseInt(locationId));
        const { data: il } = await q;
        const byProduct: Record<string, any[]> = {};
        for (const row of il || []) {
          if (!byProduct[row.product_id]) byProduct[row.product_id] = [];
          byProduct[row.product_id].push(row);
        }
        for (const p of products || []) {
          const locRows = byProduct[p.id] || [];
          const totalQty = locRows.length ? locRows.reduce((s, r) => s + (r.quantity ?? 0) - (r.reserved_quantity ?? 0), 0) : (p.quantity ?? 0);
          const threshold = p.low_stock_threshold ?? 10;
          if (lowStockOnly && totalQty > threshold) continue;
          levels.push({
            product_id: p.id,
            product_name: p.name,
            sku: p.sku,
            images: p.images,
            total_quantity: totalQty,
            low_stock_threshold: threshold,
            locations: locRows.map((r) => ({ location_id: r.location_id, location_name: r.inventory_locations?.name, quantity: r.quantity, reserved_quantity: r.reserved_quantity })),
          });
        }
      }
      return new Response(JSON.stringify({ success: true, data: levels }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "POST" && path === "/inventory/adjust") {
      const body = await req.json();
      const { product_id, variant_id, location_id, quantity_change, adjustment_type, reason, notes } = body;
      if ((!product_id && !variant_id) || quantity_change === undefined) {
        return new Response(JSON.stringify({ success: false, error: "product_id or variant_id and quantity_change required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const qtyChange = parseInt(quantity_change);
      if (isNaN(qtyChange)) {
        return new Response(JSON.stringify({ success: false, error: "Invalid quantity_change" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!storeId) {
        return new Response(JSON.stringify({ success: false, error: "Store not found" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const pid = product_id || (variant_id ? null : undefined);
      let currentQty = 0;
      let newQty = 0;
      if (location_id && pid) {
        const { data: existing } = await supabase.from("inventory_levels").select("id, quantity").eq("product_id", pid).eq("location_id", parseInt(location_id)).is("variant_id", null).maybeSingle();
        currentQty = existing?.quantity ?? 0;
        newQty = Math.max(0, currentQty + qtyChange);
        if (existing) {
          await supabase.from("inventory_levels").update({ quantity: newQty, updated_at: new Date().toISOString() }).eq("id", existing.id);
        } else {
          await supabase.from("inventory_levels").insert({
            product_id: pid,
            variant_id: null,
            location_id: parseInt(location_id),
            quantity: newQty,
          });
        }
      } else if (pid) {
        const { data: prod } = await supabase.from("products").select("quantity").eq("id", pid).eq("store_id", storeId).single();
        if (!prod) {
          return new Response(JSON.stringify({ success: false, error: "Product not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        currentQty = prod.quantity ?? 0;
        newQty = Math.max(0, currentQty + qtyChange);
        await supabase.from("products").update({ quantity: newQty, updated_at: new Date().toISOString() }).eq("id", pid);
      } else {
        return new Response(JSON.stringify({ success: false, error: "product_id or variant_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: adj, error } = await supabase.from("inventory_adjustments").insert({
        product_id: pid || null,
        variant_id: variant_id || null,
        location_id: location_id ? parseInt(location_id) : null,
        adjustment_type: adjustment_type || "correction",
        quantity_change: qtyChange,
        quantity_before: currentQty,
        quantity_after: Math.max(0, newQty),
        reason: reason || null,
        notes: notes || null,
        adjusted_by: userId,
      }).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: adj }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "GET" && path === "/inventory/locations") {
      if (!storeId) {
        return new Response(JSON.stringify({ success: true, data: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: locs, error } = await supabase.from("inventory_locations").select("*").eq("store_id", storeId).eq("is_active", true).order("priority").order("name");
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: locs || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "POST" && path === "/inventory/locations") {
      const body = await req.json();
      const { name, code, address_line1, address_line2, city, state, postal_code, country, contact_name, contact_email, contact_phone, is_default, location_type } = body;
      if (!name || !storeId) {
        return new Response(JSON.stringify({ success: false, error: "Name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: loc, error } = await supabase.from("inventory_locations").insert({
        store_id: storeId,
        name,
        code: code || null,
        address_line1: address_line1 || null,
        address_line2: address_line2 || null,
        city: city || null,
        state: state || null,
        postal_code: postal_code || null,
        country: country || "US",
        contact_name: contact_name || null,
        contact_email: contact_email || null,
        contact_phone: contact_phone || null,
        is_default: !!is_default,
        location_type: location_type || "warehouse",
      }).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: loc }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "GET" && path === "/inventory/transfers") {
      if (!storeId) {
        return new Response(JSON.stringify({ success: true, data: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: transfers, error } = await supabase.from("inventory_transfers").select("*").eq("store_id", storeId).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: transfers || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "POST" && path === "/inventory/transfers") {
      const body = await req.json();
      const { from_location_id, to_location_id, items, notes } = body;
      if (!from_location_id || !to_location_id || !Array.isArray(items) || items.length === 0 || !storeId) {
        return new Response(JSON.stringify({ success: false, error: "from_location_id, to_location_id, and items required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: transfer, error } = await supabase.from("inventory_transfers").insert({
        store_id: storeId,
        from_location_id: parseInt(from_location_id),
        to_location_id: parseInt(to_location_id),
        items,
        notes: notes || null,
        status: "pending",
        requested_by: userId,
      }).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: transfer }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "GET" && path === "/inventory/suppliers") {
      if (!storeId) {
        return new Response(JSON.stringify({ success: true, data: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: supp, error } = await supabase.from("suppliers").select("*").eq("store_id", storeId).eq("is_active", true).order("name");
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: supp || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "POST" && path === "/inventory/suppliers") {
      const body = await req.json();
      const { name, code, contact_name, email, phone, website, address_line1, address_line2, city, state, postal_code, country, payment_terms, lead_time_days, minimum_order_value, notes } = body;
      if (!name || !storeId) {
        return new Response(JSON.stringify({ success: false, error: "Name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: supp, error } = await supabase.from("suppliers").insert({
        store_id: storeId,
        name,
        code: code || null,
        contact_name: contact_name || null,
        email: email || null,
        phone: phone || null,
        website: website || null,
        address_line1: address_line1 || null,
        address_line2: address_line2 || null,
        city: city || null,
        state: state || null,
        postal_code: postal_code || null,
        country: country || null,
        payment_terms: payment_terms || null,
        lead_time_days: lead_time_days || null,
        minimum_order_value: minimum_order_value || null,
        notes: notes || null,
      }).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: supp }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "POST" && path === "/inventory/purchase-orders") {
      const body = await req.json();
      const { supplier_id, location_id, items, po_number, order_date, expected_date, payment_terms, notes } = body;
      if (!Array.isArray(items) || items.length === 0 || !storeId) {
        return new Response(JSON.stringify({ success: false, error: "items array required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const subtotal = items.reduce((s: number, i: { quantity?: number; unit_cost?: number }) => s + (i.quantity || 0) * (Number(i.unit_cost) || 0), 0);
      const { data: po, error } = await supabase.from("purchase_orders").insert({
        store_id: storeId,
        supplier_id: supplier_id || null,
        location_id: location_id || null,
        items,
        po_number: po_number || null,
        subtotal,
        tax: 0,
        shipping: 0,
        total: subtotal,
        status: "draft",
        order_date: order_date || new Date().toISOString().slice(0, 10),
        expected_date: expected_date || null,
        payment_terms: payment_terms || null,
        notes: notes || null,
        created_by: userId,
      }).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: po }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "GET" && path === "/inventory/adjustments") {
      if (!storeId) {
        return new Response(JSON.stringify({ success: true, data: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const productId = url.searchParams.get("product_id");
      const startDate = url.searchParams.get("start_date");
      const endDate = url.searchParams.get("end_date");
      const { data: products } = await supabase.from("products").select("id").eq("store_id", storeId);
      const prodIds = (products || []).map((p) => p.id);
      if (prodIds.length === 0) {
        return new Response(JSON.stringify({ success: true, data: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      let q = supabase.from("inventory_adjustments").select("*, products(id, name, sku)").in("product_id", prodIds);
      if (productId) q = q.eq("product_id", productId);
      if (startDate) q = q.gte("created_at", startDate);
      if (endDate) q = q.lte("created_at", endDate + "T23:59:59");
      const { data: adj, error } = await q.order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: adj || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "GET" && path === "/inventory/reorder-recommendations") {
      if (!storeId) {
        return new Response(JSON.stringify({ success: true, data: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: products } = await supabase.from("products").select("id, name, sku, quantity, low_stock_threshold, sales_count, cost").eq("store_id", storeId);
      const recommendations: any[] = [];
      for (const p of products || []) {
        const current = p.quantity ?? 0;
        const threshold = p.low_stock_threshold ?? 10;
        if (current > threshold) continue;
        const avgDaily = (p.sales_count ?? 0) / 30;
        const recommended = Math.max(threshold * 2, Math.ceil(avgDaily * 14));
        recommendations.push({
          id: p.id,
          name: p.name,
          sku: p.sku,
          current_stock: current,
          reorder_point: threshold,
          avg_daily_sales: avgDaily,
          recommended_order_quantity: recommended,
        });
      }
      recommendations.sort((a, b) => a.current_stock - b.current_stock);
      return new Response(JSON.stringify({ success: true, data: recommendations }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==================== CUSTOMERS ====================
    if (method === "GET" && path === "/customers") {
      if (!storeId) {
        return new Response(JSON.stringify({ success: true, data: { customers: [], pagination: { page: 1, limit: 50, total: 0, pages: 0 } } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50")));
      const search = url.searchParams.get("search") || "";
      const segmentId = url.searchParams.get("segment_id") || "";
      const tagsParam = url.searchParams.get("tags") || "";
      const sort = url.searchParams.get("sort") || "created_at";
      const order = url.searchParams.get("order") === "asc";

      let q = supabase.from("customers").select("*, customer_loyalty_accounts(points_balance, current_tier)", { count: "exact" }).eq("store_id", storeId);

      if (search) {
        q = q.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%`);
      }
      if (segmentId) {
        const { data: members } = await supabase.from("customer_segment_members").select("customer_id").eq("segment_id", segmentId);
        const custIds = (members || []).map((m) => m.customer_id);
        if (custIds.length) q = q.in("id", custIds);
        else q = q.eq("id", "00000000-0000-0000-0000-000000000000");
      }
      if (tagsParam) {
        const tags = tagsParam.split(",").map((t) => t.trim()).filter(Boolean);
        if (tags.length) q = q.overlaps("tags", tags);
      }

      const validSort = ["email", "first_name", "total_spent", "created_at", "last_order_at"];
      const sortCol = validSort.includes(sort) ? sort : "created_at";
      q = q.order(sortCol, { ascending: order });

      const { data: customers, error, count } = await q.range((page - 1) * limit, page * limit - 1);
      if (error) throw error;
      const total = count || 0;
      return new Response(JSON.stringify({
        success: true,
        data: {
          customers: customers || [],
          pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "GET" && path === "/customers/export") {
      if (!storeId) {
        return new Response(JSON.stringify({ success: false, error: "Store not found" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: customers } = await supabase.from("customers").select("email, first_name, last_name, phone, total_spent, total_orders, created_at").eq("store_id", storeId).order("created_at", { ascending: false });
      const cols = ["email", "first_name", "last_name", "phone", "total_spent", "total_orders", "created_at"];
      const csv = [cols.join(","), ...(customers || []).map((c: Record<string, unknown>) => cols.map((col) => `"${String(c[col] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
      return new Response(csv, {
        headers: { ...corsHeaders, "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="customers.csv"' },
      });
    }

    if (method === "GET" && path === "/customers/analytics/dashboard") {
      if (!storeId) {
        return new Response(JSON.stringify({ success: true, data: {} }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: customers } = await supabase.from("customers").select("id, total_spent, total_orders, created_at").eq("store_id", storeId);
      const c = customers || [];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const new30d = c.filter((x) => (x.created_at || "") >= thirtyDaysAgo).length;
      const totalSpent = c.reduce((s, x) => s + (Number(x.total_spent) || 0), 0);
      const totalOrders = c.reduce((s, x) => s + (x.total_orders || 0), 0);
      const repeat = c.filter((x) => (x.total_orders || 0) > 1).length;
      return new Response(JSON.stringify({
        success: true,
        data: {
          total_customers: c.length,
          new_customers_30d: new30d,
          avg_customer_value: c.length ? totalSpent / c.length : 0,
          avg_orders_per_customer: c.length ? totalOrders / c.length : 0,
          repeat_customers: repeat,
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "GET" && path === "/customers/segments") {
      if (!storeId) {
        return new Response(JSON.stringify({ success: true, data: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: segments, error } = await supabase.from("customer_segments").select("*").eq("store_id", storeId).order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: segments || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "POST" && path === "/customers/segments") {
      const body = await req.json();
      const { name, description, segment_type, conditions, is_dynamic } = body;
      if (!name || !storeId) {
        return new Response(JSON.stringify({ success: false, error: "Name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: seg, error } = await supabase.from("customer_segments").insert({
        store_id: storeId,
        name,
        description: description || null,
        segment_type: segment_type || "custom",
        conditions: conditions || {},
        is_dynamic: is_dynamic !== false,
      }).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: seg }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "GET" && path === "/customers/loyalty/program") {
      if (!storeId) {
        return new Response(JSON.stringify({ success: true, data: null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: program, error } = await supabase.from("loyalty_programs").select("*").eq("store_id", storeId).eq("is_active", true).maybeSingle();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: program }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "POST" && path === "/customers/loyalty/program") {
      const body = await req.json();
      const { name, description, points_per_dollar, welcome_bonus_points, birthday_bonus_points, referral_points, review_points, points_value, minimum_redemption_points, tiers, is_active } = body;
      if (!name || !storeId) {
        return new Response(JSON.stringify({ success: false, error: "Name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: existing } = await supabase.from("loyalty_programs").select("id").eq("store_id", storeId).maybeSingle();
      const payload = {
        store_id: storeId,
        name,
        description: description || null,
        points_per_dollar: points_per_dollar ?? 1,
        welcome_bonus_points: welcome_bonus_points ?? 0,
        birthday_bonus_points: birthday_bonus_points ?? 0,
        referral_points: referral_points ?? 0,
        review_points: review_points ?? 0,
        points_value: points_value ?? null,
        minimum_redemption_points: minimum_redemption_points ?? 100,
        tiers: tiers || null,
        is_active: is_active !== false,
        updated_at: new Date().toISOString(),
      };
      const { data: program, error } = existing
        ? await supabase.from("loyalty_programs").update(payload).eq("id", existing.id).select().single()
        : await supabase.from("loyalty_programs").insert(payload).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: program }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "POST" && path === "/customers/sync-from-transactions") {
      if (!storeId) {
        return new Response(JSON.stringify({ success: false, error: "Store not found" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: store } = await supabase.from("stores").select("seller_id").eq("id", storeId).single();
      if (!store) {
        return new Response(JSON.stringify({ success: false, error: "Store not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: txList } = await supabase.from("transactions").select("buyer_id, buyer_email, buyer_phone, buyer_name, amount, created_at").eq("seller_id", store.seller_id).in("status", ["completed", "delivered", "paid", "accepted", "shipped"]);
      const created: string[] = [];
      for (const tx of txList || []) {
        const email = (tx.buyer_email || "").trim() || null;
        const phone = (tx.buyer_phone || "").trim() || null;
        const name = (tx.buyer_name || "").trim() || "";
        const [first, ...rest] = name.split(/\s+/);
        const firstName = first || null;
        const lastName = rest.length ? rest.join(" ") : null;
        if (!email && !phone) continue;
        let existing = null;
        if (email) {
          const r = await supabase.from("customers").select("id, total_orders, total_spent").eq("store_id", storeId).eq("email", email).maybeSingle();
          existing = r.data;
        } else if (phone) {
          const r = await supabase.from("customers").select("id, total_orders, total_spent").eq("store_id", storeId).eq("phone", phone).maybeSingle();
          existing = r.data;
        }
        if (existing) {
          const newTotalOrders = (existing.total_orders || 0) + 1;
          const newTotalSpent = (Number(existing.total_spent) || 0) + (Number(tx.amount) || 0);
          await supabase.from("customers").update({
            total_orders: newTotalOrders,
            total_spent: newTotalSpent,
            average_order_value: newTotalSpent / newTotalOrders,
            last_order_at: tx.created_at,
            updated_at: new Date().toISOString(),
          }).eq("id", existing.id);
        } else {
          const { data: ins } = await supabase.from("customers").insert({
            store_id: storeId,
            user_id: tx.buyer_id || null,
            email,
            phone,
            first_name: firstName,
            last_name: lastName,
            total_orders: 1,
            total_spent: tx.amount || 0,
            average_order_value: tx.amount || 0,
            last_order_at: tx.created_at,
          }).select("id").single();
          if (ins) created.push(ins.id);
        }
      }
      return new Response(JSON.stringify({ success: true, synced: (txList || []).length, created: created.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "GET" && path.match(/^\/customers\/[a-zA-Z0-9-]+$/) && !path.includes("/orders") && !path.includes("/segments")) {
      const customerId = path.split("/")[2];
      const { data: customer, error } = await supabase.from("customers").select("*, customer_loyalty_accounts(points_balance, current_tier, lifetime_points_earned)").eq("id", customerId).eq("store_id", storeId).single();
      if (error || !customer) {
        return new Response(JSON.stringify({ success: false, error: "Customer not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: storeRow } = await supabase.from("stores").select("seller_id").eq("id", storeId).single();
      const sellerId = storeRow?.seller_id;
      let ords: any[] = [];
      if (sellerId) {
        let q = supabase.from("transactions").select("id, item_name, amount, status, created_at").eq("seller_id", sellerId);
        if (customer.user_id) {
          q = q.eq("buyer_id", customer.user_id);
        } else if (customer.email) {
          q = q.ilike("buyer_email", customer.email);
        } else if (customer.phone) {
          q = q.eq("buyer_phone", customer.phone);
        }
        const { data: orders } = await q.order("created_at", { ascending: false });
        ords = orders || [];
      }
      return new Response(JSON.stringify({ success: true, data: { ...customer, orders: ords } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "POST" && path === "/customers") {
      const body = await req.json();
      const { email, phone, first_name, last_name, tags, notes } = body;
      if ((!email && !phone) || !storeId) {
        return new Response(JSON.stringify({ success: false, error: "Email or phone required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: cust, error } = await supabase.from("customers").insert({
        store_id: storeId,
        email: (email || "").trim() || null,
        phone: (phone || "").trim() || null,
        first_name: (first_name || "").trim() || null,
        last_name: (last_name || "").trim() || null,
        tags: Array.isArray(tags) ? tags : [],
        notes: notes || null,
      }).select().single();
      if (error) {
        if (error.code === "23505") {
          return new Response(JSON.stringify({ success: false, error: "Email or phone already exists for this store" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        throw error;
      }
      return new Response(JSON.stringify({ success: true, data: cust }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "PATCH" && path.match(/^\/customers\/[a-zA-Z0-9-]+$/)) {
      const customerId = path.split("/")[2];
      const body = await req.json();
      const allowed = ["email", "phone", "first_name", "last_name", "addresses", "marketing_consent", "sms_consent", "tags", "notes", "status"];
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const k of allowed) {
        if (body[k] !== undefined) updateData[k] = body[k];
      }
      const { data: cust, error } = await supabase.from("customers").update(updateData).eq("id", customerId).eq("store_id", storeId).select().single();
      if (error) throw error;
      if (!cust) {
        return new Response(JSON.stringify({ success: false, error: "Customer not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ success: true, data: cust }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "DELETE" && path.match(/^\/customers\/[a-zA-Z0-9-]+$/)) {
      const customerId = path.split("/")[2];
      const { error } = await supabase.from("customers").delete().eq("id", customerId).eq("store_id", storeId);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, message: "Customer deleted" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "GET" && path.match(/^\/customers\/[a-zA-Z0-9-]+\/orders$/)) {
      const customerId = path.split("/")[2];
      const { data: customer } = await supabase.from("customers").select("user_id, email").eq("id", customerId).eq("store_id", storeId).single();
      if (!customer) {
        return new Response(JSON.stringify({ success: false, error: "Customer not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: store } = await supabase.from("stores").select("seller_id").eq("id", storeId).single();
      let q = supabase.from("transactions").select("*").eq("seller_id", store?.seller_id);
      if (customer.user_id) q = q.eq("buyer_id", customer.user_id);
      else if (customer.email) q = q.ilike("buyer_email", customer.email);
      else {
        return new Response(JSON.stringify({ success: true, data: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: orders } = await q.order("created_at", { ascending: false });
      return new Response(JSON.stringify({ success: true, data: orders || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==================== ANALYTICS ====================
    if (method === "GET" && path === "/analytics/dashboard") {
      if (!storeId) {
        return new Response(JSON.stringify({ success: true, data: {} }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: store } = await supabase.from("stores").select("seller_id").eq("id", storeId).single();
      const sellerId = store?.seller_id;
      const today = new Date().toISOString().slice(0, 10);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

      const { data: txToday } = await supabase.from("transactions").select("amount, seller_payout").eq("seller_id", sellerId).in("status", ["completed", "delivered", "paid", "accepted"]).gte("created_at", today);
      const { data: tx30d } = await supabase.from("transactions").select("amount, seller_payout, status").eq("seller_id", sellerId).gte("created_at", thirtyDaysAgo);

      const completed30 = (tx30d || []).filter((t) => ["completed", "delivered"].includes(t.status || ""));
      const revenueToday = (txToday || []).reduce((s, t) => s + (Number(t.seller_payout ?? t.amount) || 0), 0);
      const revenue30d = completed30.reduce((s, t) => s + (Number(t.seller_payout ?? t.amount) || 0), 0);
      const orderCount30 = completed30.length;

      const { data: dailyRows } = await supabase.from("daily_analytics").select("date, gross_revenue, order_count").eq("store_id", storeId).gte("date", thirtyDaysAgo).order("date");
      const trend = dailyRows || [];

      return new Response(JSON.stringify({
        success: true,
        data: {
          summary: {
            revenue_today: revenueToday,
            revenue_30d: revenue30d,
            orders_today: (txToday || []).length,
            orders_30d: orderCount30,
          },
          trend,
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "GET" && path === "/analytics/realtime") {
      if (!storeId) {
        return new Response(JSON.stringify({ success: true, data: { active_sessions: 0, revenue_hour: 0, orders_hour: 0 } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: store } = await supabase.from("stores").select("seller_id").eq("id", storeId).single();
      const hourAgo = new Date(Date.now() - 3600000).toISOString();
      const today = new Date().toISOString().slice(0, 10);
      const curHour = new Date().getHours();
      const { data: txHour } = await supabase.from("transactions").select("amount").eq("seller_id", store?.seller_id).in("status", ["completed", "delivered", "paid"]).gte("created_at", hourAgo);
      const revenueHour = (txHour || []).reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const { data: hourRow } = await supabase.from("hourly_analytics").select("visitors, sessions").eq("store_id", storeId).eq("date", today).eq("hour", curHour).maybeSingle();
      return new Response(JSON.stringify({
        success: true,
        data: {
          active_sessions: hourRow?.sessions ?? 0,
          visitors_last_hour: hourRow?.visitors ?? 0,
          revenue_hour: revenueHour,
          orders_hour: (txHour || []).length,
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "GET" && path === "/analytics/revenue") {
      if (!storeId) {
        return new Response(JSON.stringify({ success: true, data: { summary: {}, trend: [], by_category: [] } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const period = url.searchParams.get("period") || "30d";
      const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
      const start = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
      const { data: store } = await supabase.from("stores").select("seller_id").eq("id", storeId).single();
      const { data: tx } = await supabase.from("transactions").select("amount, seller_payout, platform_fee, status").eq("seller_id", store?.seller_id).gte("created_at", start);
      const completed = (tx || []).filter((t) => ["completed", "delivered"].includes(t.status || ""));
      const gross = completed.reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const net = completed.reduce((s, t) => s + (Number(t.seller_payout ?? t.amount) || 0), 0);
      const fees = completed.reduce((s, t) => s + (Number(t.platform_fee) || 0), 0);
      const { data: daily } = await supabase.from("daily_analytics").select("*").eq("store_id", storeId).gte("date", start).order("date");
      return new Response(JSON.stringify({
        success: true,
        data: {
          summary: { gross_revenue: gross, net_revenue: net, platform_fees: fees, order_count: completed.length },
          trend: daily || [],
          by_category: [],
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "GET" && path === "/analytics/products") {
      if (!storeId) {
        return new Response(JSON.stringify({ success: true, data: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: products } = await supabase.from("products").select("id, name, sku, images, sales_count, view_count").eq("store_id", storeId);
      const topProducts = (products || []).map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        images: p.images,
        sales_count: p.sales_count ?? 0,
        views: p.view_count ?? 0,
      })).sort((a, b) => (b.sales_count || 0) - (a.sales_count || 0)).slice(0, 20);
      return new Response(JSON.stringify({ success: true, data: topProducts }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "GET" && path === "/analytics/customers") {
      if (!storeId) {
        return new Response(JSON.stringify({ success: true, data: {} }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: customers } = await supabase.from("customers").select("id, total_orders, total_spent, created_at").eq("store_id", storeId);
      const c = customers || [];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const new30d = c.filter((x) => (x.created_at || "") >= thirtyDaysAgo).length;
      const returning = c.filter((x) => (x.total_orders || 0) > 1).length;
      const totalRev = c.reduce((s, x) => s + (Number(x.total_spent) || 0), 0);
      return new Response(JSON.stringify({
        success: true,
        data: {
          total_customers: c.length,
          new_customers_30d: new30d,
          returning_customers: returning,
          total_revenue: totalRev,
          avg_customer_value: c.length ? totalRev / c.length : 0,
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "GET" && path === "/analytics/customers/cohorts") {
      if (!storeId) {
        return new Response(JSON.stringify({ success: true, data: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: cohorts } = await supabase.from("customer_cohorts").select("*").eq("store_id", storeId).order("cohort_date", { ascending: false }).limit(12);
      return new Response(JSON.stringify({ success: true, data: cohorts || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "GET" && path === "/analytics/traffic") {
      if (!storeId) {
        return new Response(JSON.stringify({ success: true, data: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const period = url.searchParams.get("period") || "30d";
      const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
      const start = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
      const { data: traffic } = await supabase.from("traffic_sources_daily").select("*").eq("store_id", storeId).gte("date", start).order("date", { ascending: false });
      return new Response(JSON.stringify({ success: true, data: traffic || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "GET" && path === "/analytics/forecast") {
      if (!storeId) {
        return new Response(JSON.stringify({ success: true, data: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const horizon = url.searchParams.get("horizon") || "30";
      const { data: forecasts } = await supabase.from("sales_forecasts").select("*").eq("store_id", storeId).eq("horizon_days", parseInt(horizon)).order("forecast_date");
      return new Response(JSON.stringify({ success: true, data: forecasts || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "POST" && path === "/analytics/forecast/generate") {
      if (!storeId) {
        return new Response(JSON.stringify({ success: false, error: "Store not found" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const body = await req.json().catch(() => ({}));
      const horizon = body.horizon_days || 30;
      const { data: store } = await supabase.from("stores").select("seller_id").eq("id", storeId).single();
      const start = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
      const { data: tx } = await supabase.from("transactions").select("amount, created_at").eq("seller_id", store?.seller_id).in("status", ["completed", "delivered"]).gte("created_at", start);
      const dailyRev: Record<string, number> = {};
      for (const t of tx || []) {
        const d = (t.created_at || "").slice(0, 10);
        dailyRev[d] = (dailyRev[d] || 0) + (Number(t.amount) || 0);
      }
      const sorted = Object.keys(dailyRev).sort();
      const avg = sorted.length ? sorted.reduce((s, d) => s + dailyRev[d], 0) / sorted.length : 0;
      const forecasts: any[] = [];
      for (let i = 1; i <= horizon; i++) {
        const d = new Date(Date.now() + i * 86400000);
        const dateStr = d.toISOString().slice(0, 10);
        forecasts.push({ store_id: storeId, forecast_type: "revenue", horizon_days: horizon, forecast_date: dateStr, predicted_value: avg, model_version: "simple_avg" });
      }
      if (forecasts.length) {
        await supabase.from("sales_forecasts").delete().eq("store_id", storeId).eq("horizon_days", horizon);
        await supabase.from("sales_forecasts").insert(forecasts);
      }
      return new Response(JSON.stringify({ success: true, message: "Forecast generated", data: forecasts }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "GET" && path === "/analytics/insights") {
      if (!storeId) {
        return new Response(JSON.stringify({ success: true, data: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const unreadOnly = url.searchParams.get("unread_only") === "true";
      let q = supabase.from("automated_insights").select("*").eq("store_id", storeId).order("created_at", { ascending: false }).limit(50);
      if (unreadOnly) q = q.eq("is_read", false);
      const { data: insights } = await q;
      return new Response(JSON.stringify({ success: true, data: insights || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "PATCH" && path.match(/^\/analytics\/insights\/[a-zA-Z0-9-]+\/read$/)) {
      const insightId = path.split("/")[3];
      await supabase.from("automated_insights").update({ is_read: true, read_at: new Date().toISOString() }).eq("id", insightId).eq("store_id", storeId);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "GET" && path === "/analytics/reports") {
      if (!storeId) {
        return new Response(JSON.stringify({ success: true, data: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: reports } = await supabase.from("custom_reports").select("*").eq("store_id", storeId).order("created_at", { ascending: false });
      return new Response(JSON.stringify({ success: true, data: reports || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "POST" && path === "/analytics/reports") {
      const body = await req.json();
      const { name, description, report_config, metrics, dimensions, filters } = body;
      if (!name || !storeId) {
        return new Response(JSON.stringify({ success: false, error: "Name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: report, error } = await supabase.from("custom_reports").insert({
        store_id: storeId,
        name,
        description: description || null,
        report_config: report_config || {},
        metrics: metrics || [],
        dimensions: dimensions || [],
        filters: filters || {},
        created_by: userId,
      }).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: report }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "POST" && path === "/analytics/export") {
      const body = await req.json().catch(() => ({}));
      const { report_type, format, date_from, date_to } = body;
      if (!report_type || !storeId) {
        return new Response(JSON.stringify({ success: false, error: "report_type required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: store } = await supabase.from("stores").select("seller_id").eq("id", storeId).single();
      const start = date_from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const end = date_to || new Date().toISOString().slice(0, 10);
      const { data: tx } = await supabase.from("transactions").select("id, amount, status, created_at, buyer_name, buyer_email").eq("seller_id", store?.seller_id).gte("created_at", start).lte("created_at", end + "T23:59:59");
      const cols = ["id", "amount", "status", "created_at", "buyer_name", "buyer_email"];
      const csv = [cols.join(","), ...(tx || []).map((r: Record<string, unknown>) => cols.map((c) => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
      return new Response(JSON.stringify({ success: true, data: csv, format: "csv" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==================== LIVE CHAT ====================
    if (method === "GET" && path === "/chat/conversations") {
      const status = url.searchParams.get("status");
      const assignedTo = url.searchParams.get("assigned_to");
      const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
      const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "50")));
      const offset = (page - 1) * limit;
      let q = supabase
        .from("chat_conversations")
        .select("*", { count: "exact" })
        .eq("seller_id", userId)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .range(offset, offset + limit - 1);
      if (status) q = q.eq("status", status);
      if (assignedTo) q = q.eq("assigned_to", assignedTo);
      const { data: convos, error, count } = await q;
      if (error) throw error;
      return new Response(
        JSON.stringify({
          success: true,
          data: convos || [],
          pagination: { page, limit, total: count ?? convos?.length ?? 0, pages: Math.ceil((count ?? convos?.length ?? 0) / limit) },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (method === "GET" && path.match(/^\/chat\/conversations\/[a-zA-Z0-9-]+$/)) {
      const convId = path.split("/")[3];
      const { data: convo, error: ce } = await supabase
        .from("chat_conversations")
        .select("*")
        .eq("id", convId)
        .eq("seller_id", userId)
        .single();
      if (ce || !convo) {
        return new Response(JSON.stringify({ success: false, error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: messages, error: me } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });
      if (me) throw me;
      return new Response(JSON.stringify({ success: true, data: { ...convo, messages: messages || [] } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "POST" && path.match(/^\/chat\/conversations\/[a-zA-Z0-9-]+\/messages$/)) {
      const convId = path.split("/")[3];
      const body = await req.json().catch(() => ({}));
      const message = body.message ?? body.content;
      if (!message) {
        return new Response(JSON.stringify({ success: false, error: "message required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: convo } = await supabase
        .from("chat_conversations")
        .select("id, first_response_at")
        .eq("id", convId)
        .eq("seller_id", userId)
        .single();
      if (!convo) {
        return new Response(JSON.stringify({ success: false, error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: profile } = await supabase.from("profiles").select("name").eq("user_id", userId).maybeSingle();
      const text = String(message).slice(0, 2000);
      const { data: msg, error } = await supabase
        .from("chat_messages")
        .insert({
          conversation_id: convId,
          sender_id: userId,
          sender_type: "seller",
          sender_name: profile?.name || "Seller",
          message: text,
          content: text,
        })
        .select()
        .single();
      if (error) throw error;
      const updates: Record<string, unknown> = { last_message_at: new Date().toISOString(), updated_at: new Date().toISOString(), status: "active" };
      if (!(convo as any).first_response_at) updates.first_response_at = new Date().toISOString();
      await supabase.from("chat_conversations").update(updates).eq("id", convId);
      return new Response(JSON.stringify({ success: true, data: msg }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "PATCH" && path.match(/^\/chat\/conversations\/[a-zA-Z0-9-]+\/assign$/)) {
      const convId = path.split("/")[3];
      const { agent_id } = await req.json().catch(() => ({}));
      const { data: convo } = await supabase
        .from("chat_conversations")
        .select("id")
        .eq("id", convId)
        .eq("seller_id", userId)
        .single();
      if (!convo) {
        return new Response(JSON.stringify({ success: false, error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await supabase
        .from("chat_conversations")
        .update({ assigned_to: agent_id || null, assigned_at: agent_id ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
        .eq("id", convId);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "PATCH" && path.match(/^\/chat\/conversations\/[a-zA-Z0-9-]+\/status$/)) {
      const convId = path.split("/")[3];
      const { status } = await req.json().catch(() => ({}));
      if (!status) {
        return new Response(JSON.stringify({ success: false, error: "status required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: convo } = await supabase
        .from("chat_conversations")
        .select("id")
        .eq("id", convId)
        .eq("seller_id", userId)
        .single();
      if (!convo) {
        return new Response(JSON.stringify({ success: false, error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
      if (status === "resolved" || status === "closed") updates.ended_at = new Date().toISOString();
      await supabase.from("chat_conversations").update(updates).eq("id", convId);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "POST" && path.match(/^\/chat\/conversations\/[a-zA-Z0-9-]+\/read$/)) {
      const convId = path.split("/")[3];
      const { data: convo } = await supabase
        .from("chat_conversations")
        .select("id")
        .eq("id", convId)
        .eq("seller_id", userId)
        .single();
      if (!convo) {
        return new Response(JSON.stringify({ success: false, error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await supabase.from("chat_messages").update({ is_read: true, read_at: new Date().toISOString() }).eq("conversation_id", convId).neq("sender_type", "seller");
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "POST" && path.match(/^\/chat\/conversations\/[a-zA-Z0-9-]+\/rate$/)) {
      const convId = path.split("/")[3];
      const { rating, feedback } = await req.json().catch(() => ({}));
      const { data: convo } = await supabase
        .from("chat_conversations")
        .select("id")
        .eq("id", convId)
        .eq("seller_id", userId)
        .single();
      if (!convo) {
        return new Response(JSON.stringify({ success: false, error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!rating || rating < 1 || rating > 5) {
        return new Response(JSON.stringify({ success: false, error: "rating 1-5 required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabase
        .from("chat_conversations")
        .update({ customer_satisfaction_rating: rating, customer_feedback: feedback || null, updated_at: new Date().toISOString() })
        .eq("id", convId);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Chat Agents
    if (method === "GET" && path === "/chat/agents") {
      const { data: agents, error } = await supabase
        .from("chat_agents")
        .select("*")
        .eq("seller_id", userId)
        .eq("is_active", true);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: agents || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "PATCH" && path === "/chat/agents/me/status") {
      const { status, status_message } = await req.json().catch(() => ({}));
      const { data: agent } = await supabase
        .from("chat_agents")
        .select("id")
        .eq("seller_id", userId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!agent) {
        const { data: profile } = await supabase.from("profiles").select("name, email").eq("user_id", userId).maybeSingle();
        const { data: created } = await supabase
          .from("chat_agents")
          .insert({
            seller_id: userId,
            user_id: userId,
            name: profile?.name || "Agent",
            email: profile?.email || "agent@example.com",
            status: status || "online",
            status_message: status_message || null,
            last_seen_at: new Date().toISOString(),
          })
          .select()
          .single();
        if (created) {
          return new Response(JSON.stringify({ success: true, data: created }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        await supabase
          .from("chat_agents")
          .update({ status: status || "online", status_message: status_message || null, last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", agent.id);
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Canned Responses
    if (method === "GET" && path === "/chat/canned-responses") {
      const { data: responses, error } = await supabase
        .from("chat_canned_responses")
        .select("*")
        .eq("seller_id", userId)
        .eq("is_active", true)
        .order("category")
        .order("title");
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: responses || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "POST" && path === "/chat/canned-responses") {
      const body = await req.json();
      const { title, content, shortcut, category } = body;
      if (!title || !content) {
        return new Response(JSON.stringify({ success: false, error: "title and content required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: resp, error } = await supabase
        .from("chat_canned_responses")
        .insert({
          seller_id: userId,
          title: title.slice(0, 255),
          content: content.slice(0, 5000),
          shortcut: shortcut || null,
          category: category || null,
          created_by: userId,
        })
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: resp }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "PATCH" && path.match(/^\/chat\/canned-responses\/[0-9]+$/)) {
      const id = path.split("/")[3];
      const body = await req.json();
      const { data: resp, error } = await supabase
        .from("chat_canned_responses")
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq("id", parseInt(id))
        .eq("seller_id", userId)
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: resp }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "DELETE" && path.match(/^\/chat\/canned-responses\/[0-9]+$/)) {
      const id = path.split("/")[3];
      await supabase.from("chat_canned_responses").update({ is_active: false }).eq("id", parseInt(id)).eq("seller_id", userId);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Widget Settings
    if (method === "GET" && path === "/chat/widget/settings") {
      const { data: settings, error } = await supabase.from("chat_widget_settings").select("*").eq("seller_id", userId).maybeSingle();
      if (error) throw error;
      if (!settings) {
        const { data: created } = await supabase
          .from("chat_widget_settings")
          .insert({ seller_id: userId })
          .select()
          .single();
        return new Response(JSON.stringify({ success: true, data: created }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true, data: settings }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "PATCH" && path === "/chat/widget/settings") {
      const body = await req.json();
      const { data: settings, error } = await supabase
        .from("chat_widget_settings")
        .upsert({ seller_id: userId, ...body, updated_at: new Date().toISOString() }, { onConflict: "seller_id" })
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: settings }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Chatbot Flows (Enterprise - available to all for now)
    if (method === "GET" && path === "/chat/chatbot/flows") {
      const { data: flows, error } = await supabase
        .from("chatbot_flows")
        .select("*")
        .eq("seller_id", userId)
        .eq("is_active", true);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: flows || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "POST" && path === "/chat/chatbot/flows") {
      const body = await req.json();
      const { name, description, trigger_type, trigger_value, flow_data } = body;
      if (!name || !trigger_type || !flow_data) {
        return new Response(JSON.stringify({ success: false, error: "name, trigger_type, flow_data required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: flow, error } = await supabase
        .from("chatbot_flows")
        .insert({
          seller_id: userId,
          name: name.slice(0, 255),
          description: description || null,
          trigger_type,
          trigger_value: trigger_value || null,
          flow_data: flow_data || {},
        })
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: flow }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Chat Analytics
    if (method === "GET" && path === "/chat/analytics") {
      const startDate = url.searchParams.get("start_date") || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const endDate = url.searchParams.get("end_date") || new Date().toISOString().slice(0, 10);
      const { data: rows, error } = await supabase
        .from("chat_analytics_daily")
        .select("*")
        .eq("seller_id", userId)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false });
      if (error) throw error;
      const summary = (rows || []).reduce(
        (acc: any, r) => {
          acc.total_conversations += r.total_conversations || 0;
          acc.new_conversations += r.new_conversations || 0;
          acc.resolved_conversations += r.resolved_conversations || 0;
          acc.total_messages += r.total_messages || 0;
          return acc;
        },
        { total_conversations: 0, new_conversations: 0, resolved_conversations: 0, total_messages: 0 }
      );
      return new Response(
        JSON.stringify({
          success: true,
          data: { daily: rows || [], summary },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== SUPPORT ====================
    // Helper: generate ticket number
    const genTicketNumber = () =>
      `TKT-${Date.now().toString(36).toUpperCase()}-${Array.from(crypto.getRandomValues(new Uint8Array(4)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()}`;

    if (method === "GET" && path === "/support/tickets") {
      const status = url.searchParams.get("status");
      const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
      const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20")));
      const offset = (page - 1) * limit;
      let q = supabase
        .from("support_tickets")
        .select("*", { count: "exact" })
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (status) q = q.eq("status", status);
      const { data: tickets, error, count } = await q;
      if (error) throw error;
      const total = count ?? tickets?.length ?? 0;
      return new Response(
        JSON.stringify({
          success: true,
          data: tickets || [],
          pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (method === "POST" && path === "/support/tickets") {
      const body = await req.json();
      const { subject, description, category, subcategory, priority } = body;
      if (!subject) {
        return new Response(JSON.stringify({ success: false, error: "subject required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const ticketNumber = genTicketNumber();
      const { data: ticket, error } = await supabase
        .from("support_tickets")
        .insert({
          user_id: userId,
          subject: subject.slice(0, 500),
          description: description || null,
          ticket_number: ticketNumber,
          category: category || "general",
          subcategory: subcategory || null,
          priority: priority || "normal",
          status: "open",
          response_sla_minutes: 1440,
          response_due_at: new Date(Date.now() + 1440 * 60 * 1000).toISOString(),
          resolution_sla_hours: 48,
          resolution_due_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      const { message } = body;
      if (message) {
        await supabase.from("support_messages").insert({
          ticket_id: ticket.id,
          sender_id: userId,
          is_staff: false,
          sender_type: "seller",
          message: message.slice(0, 5000),
        });
      }
      return new Response(JSON.stringify({ success: true, data: ticket }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "GET" && path.match(/^\/support\/tickets\/[a-zA-Z0-9-]+$/)) {
      const ticketId = path.split("/")[3];
      const { data: ticket, error: te } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("id", ticketId)
        .eq("user_id", userId)
        .single();
      if (te || !ticket) {
        return new Response(JSON.stringify({ success: false, error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: messages } = await supabase
        .from("support_messages")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      return new Response(JSON.stringify({ success: true, data: { ...ticket, messages: messages || [] } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (
      (method === "POST" && path.match(/^\/support\/tickets\/[a-zA-Z0-9-]+\/messages$/)) ||
      (method === "POST" && path.match(/^\/support\/tickets\/[a-zA-Z0-9-]+\/reply$/))
    ) {
      const ticketId = path.split("/")[3];
      const body = await req.json().catch(() => ({}));
      const message = body.message || body;
      if (!message || typeof message !== "string") {
        return new Response(JSON.stringify({ success: false, error: "message required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: ticket } = await supabase
        .from("support_tickets")
        .select("id, status")
        .eq("id", ticketId)
        .eq("user_id", userId)
        .single();
      if (!ticket) {
        return new Response(JSON.stringify({ success: false, error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if ((ticket as any).status === "closed") {
        return new Response(JSON.stringify({ success: false, error: "Cannot reply to closed ticket" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: msg, error } = await supabase
        .from("support_messages")
        .insert({ ticket_id: ticketId, sender_id: userId, is_staff: false, sender_type: "seller", message: message.slice(0, 5000) })
        .select()
        .single();
      if (error) throw error;
      await supabase
        .from("support_tickets")
        .update({ status: "in_progress", updated_at: new Date().toISOString() })
        .eq("id", ticketId);
      return new Response(JSON.stringify({ success: true, data: msg }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "POST" && path.match(/^\/support\/tickets\/[a-zA-Z0-9-]+\/close$/)) {
      const ticketId = path.split("/")[3];
      const { data: ticket } = await supabase
        .from("support_tickets")
        .select("id")
        .eq("id", ticketId)
        .eq("user_id", userId)
        .single();
      if (!ticket) {
        return new Response(JSON.stringify({ success: false, error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const now = new Date().toISOString();
      await supabase
        .from("support_tickets")
        .update({ status: "closed", closed_at: now, updated_at: now })
        .eq("id", ticketId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "POST" && path.match(/^\/support\/tickets\/[a-zA-Z0-9-]+\/rate$/)) {
      const ticketId = path.split("/")[3];
      const { rating, comment } = await req.json().catch(() => ({}));
      if (!rating || rating < 1 || rating > 5) {
        return new Response(JSON.stringify({ success: false, error: "rating 1-5 required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: ticket } = await supabase
        .from("support_tickets")
        .select("id")
        .eq("id", ticketId)
        .eq("user_id", userId)
        .single();
      if (!ticket) {
        return new Response(JSON.stringify({ success: false, error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await supabase
        .from("support_tickets")
        .update({ satisfaction_rating: rating, satisfaction_comment: comment || null, updated_at: new Date().toISOString() })
        .eq("id", ticketId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Account Manager
    if (method === "GET" && path === "/support/account-manager") {
      const { data: sam } = await supabase
        .from("seller_account_managers")
        .select("account_manager_id, assigned_at")
        .eq("seller_id", userId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (!sam?.account_manager_id) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "No account manager assigned",
            message: "Account managers are available for Business and Enterprise tiers",
          }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { data: am, error } = await supabase
        .from("account_managers")
        .select("*")
        .eq("id", sam.account_manager_id)
        .single();
      if (error || !am) {
        return new Response(JSON.stringify({ success: false, error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ success: true, data: { ...am, assigned_at: sam.assigned_at } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "GET" && path === "/support/account-manager/meetings") {
      const { data: meetings, error } = await supabase
        .from("account_manager_meetings")
        .select("*, account_managers(name, avatar_url)")
        .eq("seller_id", userId)
        .in("status", ["scheduled", "completed"])
        .order("scheduled_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: meetings || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "POST" && path === "/support/account-manager/meetings/request") {
      const { title, description, preferred_date, meeting_type } = await req.json().catch(() => ({}));
      if (!title) {
        return new Response(JSON.stringify({ success: false, error: "title required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: sam } = await supabase
        .from("seller_account_managers")
        .select("account_manager_id")
        .eq("seller_id", userId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (!sam?.account_manager_id) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Account managers are available for Business and Enterprise tiers",
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const scheduledAt = preferred_date ? new Date(preferred_date) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const { data: meeting, error } = await supabase
        .from("account_manager_meetings")
        .insert({
          seller_id: userId,
          account_manager_id: sam.account_manager_id,
          title: title.slice(0, 255),
          description: description || null,
          meeting_type: meeting_type || "check_in",
          scheduled_at: scheduledAt.toISOString(),
          status: "scheduled",
        })
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: meeting }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Knowledge Base
    if (method === "GET" && path === "/support/kb/search") {
      const q = url.searchParams.get("q") || "";
      const category = url.searchParams.get("category");
      const limit = Math.min(20, Math.max(1, parseInt(url.searchParams.get("limit") || "10")));
      if (!q.trim()) {
        let kbQ = supabase
          .from("kb_articles")
          .select("id, title, slug, excerpt, category, difficulty, helpful_count, not_helpful_count")
          .eq("status", "published")
          .order("published_at", { ascending: false })
          .limit(limit);
        if (category) kbQ = kbQ.eq("category", category);
        const { data: articles, error } = await kbQ;
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, data: articles || [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: articles, error } = await supabase
        .from("kb_articles")
        .select("id, title, slug, excerpt, category, difficulty, helpful_count, not_helpful_count")
        .eq("status", "published")
        .or(`title.ilike.%${q}%,content.ilike.%${q}%,excerpt.ilike.%${q}%`)
        .limit(limit);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: articles || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "GET" && path === "/support/kb/categories") {
      const { data: rows } = await supabase
        .from("kb_articles")
        .select("category")
        .eq("status", "published");
      const categories = [...new Set((rows || []).map((r: any) => r.category).filter(Boolean))];
      return new Response(JSON.stringify({ success: true, data: categories }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "GET" && path.match(/^\/support\/kb\/articles\/[a-zA-Z0-9_-]+$/)) {
      const slug = path.split("/").pop();
      const { data: article, error } = await supabase
        .from("kb_articles")
        .select("*")
        .eq("slug", slug)
        .eq("status", "published")
        .single();
      if (error || !article) {
        return new Response(JSON.stringify({ success: false, error: "Article not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabase.from("kb_articles").update({ view_count: ((article as any).view_count || 0) + 1 }).eq("id", article.id);
      return new Response(JSON.stringify({ success: true, data: { ...article, view_count: ((article as any).view_count || 0) + 1 } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "POST" && path.match(/^\/support\/kb\/articles\/[a-zA-Z0-9-]+\/feedback$/)) {
      const articleId = path.split("/")[4];
      const { helpful } = await req.json().catch(() => ({}));
      const { data: article } = await supabase.from("kb_articles").select("id, helpful_count, not_helpful_count").eq("id", articleId).single();
      if (!article) {
        return new Response(JSON.stringify({ success: false, error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const a = article as any;
      if (helpful === true) {
        await supabase.from("kb_articles").update({ helpful_count: (a.helpful_count || 0) + 1 }).eq("id", articleId);
      } else {
        await supabase.from("kb_articles").update({ not_helpful_count: (a.not_helpful_count || 0) + 1 }).eq("id", articleId);
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Live Chat
    if (method === "POST" && path === "/support/chat/start") {
      const { session_type = "text" } = await req.json().catch(() => ({}));
      const { data: session, error } = await supabase
        .from("support_chat_sessions")
        .insert({ seller_id: userId, session_type: session_type || "text", status: "waiting" })
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: session }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "GET" && path.match(/^\/support\/chat\/sessions\/[a-zA-Z0-9-]+$/)) {
      const sessionId = path.split("/")[4];
      const { data: session, error } = await supabase
        .from("support_chat_sessions")
        .select("*, support_chat_messages(*)")
        .eq("id", sessionId)
        .eq("seller_id", userId)
        .single();
      if (error || !session) {
        return new Response(JSON.stringify({ success: false, error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ success: true, data: session }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "POST" && path.match(/^\/support\/chat\/sessions\/[a-zA-Z0-9-]+\/end$/)) {
      const sessionId = path.split("/")[4];
      const { rating, feedback } = await req.json().catch(() => ({}));
      const { data: session } = await supabase
        .from("support_chat_sessions")
        .select("id")
        .eq("id", sessionId)
        .eq("seller_id", userId)
        .single();
      if (!session) {
        return new Response(JSON.stringify({ success: false, error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const now = new Date().toISOString();
      await supabase
        .from("support_chat_sessions")
        .update({ status: "ended", ended_at: now, rating: rating || null, feedback: feedback || null })
        .eq("id", sessionId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Onboarding
    if (method === "GET" && path === "/support/onboarding") {
      const { data: checklist, error } = await supabase.from("onboarding_checklists").select("*").eq("seller_id", userId).maybeSingle();
      if (error) throw error;
      if (!checklist) {
        const { data: created } = await supabase
          .from("onboarding_checklists")
          .insert({ seller_id: userId })
          .select()
          .single();
        return new Response(JSON.stringify({ success: true, data: created }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true, data: checklist }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "POST" && path.match(/^\/support\/onboarding\/complete\/[a-zA-Z0-9_]+$/)) {
      const step = path.split("/").pop();
      const { data: checklist } = await supabase.from("onboarding_checklists").select("*").eq("seller_id", userId).maybeSingle();
      let target = checklist;
      if (!target) {
        const { data: created } = await supabase
          .from("onboarding_checklists")
          .insert({ seller_id: userId })
          .select()
          .single();
        target = created;
      }
      if (!target) throw new Error("Failed to get checklist");
      const completed = (target as any).completed_steps || [];
      if (completed.includes(step)) {
        return new Response(JSON.stringify({ success: true, data: target }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const newSteps = [...completed, step];
      const total = (target as any).total_steps || 10;
      const pct = Math.min(100, Math.round((newSteps.length / total) * 100));
      const isCompleted = newSteps.length >= total;
      const { data: updated } = await supabase
        .from("onboarding_checklists")
        .update({
          completed_steps: newSteps,
          completion_percentage: pct,
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("seller_id", userId)
        .select()
        .single();
      return new Response(JSON.stringify({ success: true, data: updated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Support Resources
    if (method === "GET" && path === "/support/resources") {
      const category = url.searchParams.get("category");
      const type = url.searchParams.get("type");
      let q = supabase
        .from("support_resources")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false });
      if (category) q = q.eq("category", category);
      if (type) q = q.eq("resource_type", type);
      const { data: resources, error } = await q;
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: resources || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // System Status
    if (method === "GET" && path === "/support/status") {
      const { data: rows, error } = await supabase
        .from("system_status")
        .select("*")
        .order("started_at", { ascending: false });
      if (error) throw error;
      const latest = (rows || []).reduce((acc: any, r) => {
        if (!acc[r.component_name] || new Date(r.started_at) > new Date(acc[r.component_name].started_at)) acc[r.component_name] = r;
        return acc;
      }, {});
      const components = Object.values(latest);
      const hasOutage = (components as any[]).some((c) => c.status === "major_outage");
      const hasDegraded = (components as any[]).some((c) => c.status === "degraded" || c.status === "partial_outage");
      const overall = hasOutage ? "major_outage" : hasDegraded ? "degraded" : "operational";
      return new Response(
        JSON.stringify({ success: true, data: { overall_status: overall, components } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== MARKETING ====================
    if (storeId) {
      // Email Campaigns
      if (method === "GET" && path === "/marketing/campaigns/email") {
        const status = url.searchParams.get("status");
        const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
        const limit = Math.min(50, parseInt(url.searchParams.get("limit") || "20"));
        let q = supabase.from("email_campaigns").select("*", { count: "exact" }).eq("store_id", storeId).order("created_at", { ascending: false }).range((page - 1) * limit, page * limit - 1);
        if (status) q = q.eq("status", status);
        const { data: campaigns, error, count } = await q;
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, data: campaigns || [], pagination: { page, limit, total: count ?? 0, pages: Math.ceil((count ?? 0) / limit) } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (method === "POST" && path === "/marketing/campaigns/email") {
        const body = await req.json();
        const { name, subject, preview_text, from_name, from_email, reply_to_email, html_content, plain_text_content, segment_id } = body;
        if (!name || !subject || !from_name || !from_email) {
          return new Response(JSON.stringify({ success: false, error: "name, subject, from_name, from_email required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const { data: campaign, error } = await supabase.from("email_campaigns").insert({ store_id: storeId, name, subject, preview_text: preview_text || null, from_name, from_email, reply_to_email: reply_to_email || null, html_content: html_content || null, plain_text_content: plain_text_content || null, segment_id: segment_id || null, status: "draft" }).select().single();
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, data: campaign }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (method === "GET" && path.match(/^\/marketing\/campaigns\/email\/[a-zA-Z0-9-]+$/)) {
        const id = path.split("/")[4];
        const { data: campaign, error } = await supabase.from("email_campaigns").select("*").eq("id", id).eq("store_id", storeId).single();
        if (error || !campaign) return new Response(JSON.stringify({ success: false, error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        return new Response(JSON.stringify({ success: true, data: campaign }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (method === "PATCH" && path.match(/^\/marketing\/campaigns\/email\/[a-zA-Z0-9-]+$/)) {
        const id = path.split("/")[4];
        const body = await req.json();
        const { data: campaign, error } = await supabase.from("email_campaigns").update({ ...body, updated_at: new Date().toISOString() }).eq("id", id).eq("store_id", storeId).select().single();
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, data: campaign }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Abandoned Carts
      if (method === "GET" && path === "/marketing/abandoned-carts") {
        const status = url.searchParams.get("status");
        const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
        const limit = Math.min(50, parseInt(url.searchParams.get("limit") || "20"));
        let q = supabase.from("abandoned_carts").select("*", { count: "exact" }).eq("store_id", storeId).order("abandoned_at", { ascending: false }).range((page - 1) * limit, page * limit - 1);
        if (status) q = q.eq("status", status);
        const { data: carts, error, count } = await q;
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, data: carts || [], pagination: { page, limit, total: count ?? 0, pages: Math.ceil((count ?? 0) / limit) } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (method === "GET" && path === "/marketing/abandoned-carts/analytics") {
        const { data: rows } = await supabase.from("abandoned_carts").select("id, status, cart_total").eq("store_id", storeId).gte("abandoned_at", new Date(Date.now() - 30 * 86400000).toISOString());
        const total = rows?.length ?? 0;
        const recovered = rows?.filter((r: any) => r.status === "recovered").length ?? 0;
        const totalValue = rows?.reduce((s: number, r: any) => s + (Number(r.cart_total) || 0), 0) ?? 0;
        const recoveredValue = rows?.filter((r: any) => r.status === "recovered").reduce((s: number, r: any) => s + (Number(r.cart_total) || 0), 0) ?? 0;
        const recoveryRate = total > 0 ? ((recovered / total) * 100).toFixed(2) : "0";
        return new Response(JSON.stringify({ success: true, data: { total_abandoned: total, total_recovered: recovered, recovery_rate: recoveryRate, total_value: totalValue, recovered_value: recoveredValue } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (method === "POST" && path.match(/^\/marketing\/abandoned-carts\/[a-zA-Z0-9-]+\/recover$/)) {
        const cartId = path.split("/")[3];
        const { include_discount } = await req.json().catch(() => ({}));
        const { data: cart } = await supabase.from("abandoned_carts").select("*").eq("id", cartId).eq("store_id", storeId).single();
        if (!cart) return new Response(JSON.stringify({ success: false, error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const discountCode = include_discount ? `CART10-${Date.now().toString(36).toUpperCase()}` : null;
        if (discountCode) {
          await supabase.from("discount_codes").insert({ store_id: storeId, code: discountCode, discount_type: "percentage", discount_value: 10, usage_limit_per_customer: 1, valid_until: new Date(Date.now() + 7 * 86400000).toISOString() });
          await supabase.from("abandoned_carts").update({ discount_code: discountCode, discount_amount: 10, discount_type: "percentage" }).eq("id", cartId);
        }
        await supabase.from("abandoned_carts").update({ email_sent_count: (cart.email_sent_count || 0) + 1, last_recovery_sent_at: new Date().toISOString() }).eq("id", cartId);
        return new Response(JSON.stringify({ success: true, data: { discount_code: discountCode } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Discount Codes
      if (method === "GET" && path === "/marketing/discounts") {
        const { data: codes, error } = await supabase.from("discount_codes").select("*").eq("store_id", storeId).order("created_at", { ascending: false });
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, data: codes || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (method === "POST" && path === "/marketing/discounts") {
        const body = await req.json();
        const { code, description, discount_type, discount_value, applies_to, applies_to_ids, minimum_purchase_amount, usage_limit, usage_limit_per_customer, valid_from, valid_until } = body;
        if (!code || !discount_type || discount_value == null) {
          return new Response(JSON.stringify({ success: false, error: "code, discount_type, discount_value required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const { data: discount, error } = await supabase.from("discount_codes").insert({ store_id: storeId, code: String(code).toUpperCase(), description: description || null, discount_type, discount_value, applies_to: applies_to || "all", applies_to_ids: applies_to_ids || [], minimum_purchase_amount: minimum_purchase_amount || null, usage_limit: usage_limit || null, usage_limit_per_customer: usage_limit_per_customer ?? 1, valid_from: valid_from || new Date().toISOString(), valid_until: valid_until || null }).select().single();
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, data: discount }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (method === "PATCH" && path.match(/^\/marketing\/discounts\/[a-zA-Z0-9-]+$/)) {
        const id = path.split("/")[3];
        const body = await req.json();
        const { data: discount, error } = await supabase.from("discount_codes").update({ ...body, updated_at: new Date().toISOString() }).eq("id", id).eq("store_id", storeId).select().single();
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, data: discount }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (method === "DELETE" && path.match(/^\/marketing\/discounts\/[a-zA-Z0-9-]+$/)) {
        const id = path.split("/")[3];
        await supabase.from("discount_codes").update({ is_active: false }).eq("id", id).eq("store_id", storeId);
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Marketing Settings
      if (method === "GET" && path === "/marketing/settings") {
        const { data: settings, error } = await supabase.from("marketing_settings").select("*").eq("store_id", storeId).maybeSingle();
        if (error) throw error;
        if (!settings) {
          const { data: created } = await supabase.from("marketing_settings").insert({ store_id: storeId }).select().single();
          return new Response(JSON.stringify({ success: true, data: created }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ success: true, data: settings }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (method === "PATCH" && path === "/marketing/settings") {
        const body = await req.json();
        const { data: settings, error } = await supabase.from("marketing_settings").upsert({ store_id: storeId, ...body, updated_at: new Date().toISOString() }, { onConflict: "store_id" }).select().single();
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, data: settings }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Marketing Workflows
      if (method === "GET" && path === "/marketing/workflows") {
        const { data: workflows, error } = await supabase.from("marketing_workflows").select("*").eq("store_id", storeId).order("created_at", { ascending: false });
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, data: workflows || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (method === "POST" && path === "/marketing/workflows") {
        const body = await req.json();
        const { name, description, trigger_type, trigger_config, steps } = body;
        if (!name || !trigger_type) {
          return new Response(JSON.stringify({ success: false, error: "name, trigger_type required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const { data: workflow, error } = await supabase.from("marketing_workflows").insert({ store_id: storeId, name, description: description || null, trigger_type, trigger_config: trigger_config || {}, steps: steps || [] }).select().single();
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, data: workflow }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Customer Segments (for campaign audience)
      if (method === "GET" && path === "/marketing/segments") {
        const { data: segments, error } = await supabase.from("customer_segments").select("id, name, description, customer_count").eq("store_id", storeId);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, data: segments || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (method === "POST" && path === "/financial/payouts/instant") {
      return new Response(JSON.stringify({
        success: false,
        error: "Instant payout requires minimum balance and is available on Pro plan. Use standard withdrawal from Wallet.",
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "GET" && path === "/financial/integrations") {
      const { data, error } = await supabase
        .from("accounting_integrations")
        .select("*")
        .eq("seller_id", userId);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "POST" && path.match(/^\/financial\/integrations\/[a-zA-Z0-9-]+\/connect$/)) {
      const provider = path.split("/")[3];
      return new Response(JSON.stringify({
        success: false,
        error: `Connect ${provider}: OAuth integration coming soon. Export data from Financial tab.`,
      }), {
        status: 501,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "GET" && path === "/financial/reports/tax") {
      const year = parseInt(url.searchParams.get("year") || String(new Date().getFullYear()));
      const quarter = url.searchParams.get("quarter") || "";

      let startDate: string;
      let endDate: string;
      if (quarter && ["1", "2", "3", "4"].includes(quarter)) {
        const q = parseInt(quarter);
        startDate = `${year}-${String((q - 1) * 3 + 1).padStart(2, "0")}-01`;
        endDate = `${year}-${String(q * 3).padStart(2, "0")}-${q === 2 ? "30" : q === 4 ? "31" : "31"}`;
      } else {
        startDate = `${year}-01-01`;
        endDate = `${year}-12-31`;
      }

      const { data: txRows } = await supabase
        .from("transactions")
        .select("amount, seller_payout, platform_fee, status")
        .eq("seller_id", userId)
        .gte("created_at", startDate)
        .lte("created_at", endDate + "T23:59:59");

      const completed = (txRows || []).filter((t) => (t.status || "").toLowerCase() === "completed");
      const refunded = (txRows || []).filter((t) => (t.status || "").toLowerCase() === "refunded");
      const totalSales = completed.reduce((s, t) => s + (Number(t.seller_payout ?? t.amount ?? 0)), 0);
      const totalRefunds = refunded.reduce((s, t) => s + (Number(t.amount ?? 0)), 0);

      const { data: expenseRows } = await supabase
        .from("seller_expenses")
        .select("amount")
        .eq("seller_id", userId)
        .eq("status", "active")
        .gte("expense_date", startDate)
        .lte("expense_date", endDate);

      const totalExpenses = (expenseRows || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const taxableIncome = totalSales - totalRefunds - totalExpenses;

      return new Response(JSON.stringify({
        success: true,
        data: {
          report_type: quarter ? "quarterly" : "annual",
          year,
          quarter: quarter ? parseInt(quarter) : null,
          total_sales: totalSales,
          total_refunds: totalRefunds,
          total_expenses: totalExpenses,
          taxable_income: taxableIncome,
          status: "draft",
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==================== STORE SETTINGS ====================
    if (method === "GET" && path === "/settings") {
      if (!storeId) {
        return new Response(JSON.stringify({ success: true, data: {} }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const [settings, theme, seo, payment, shipping, tax] = await Promise.all([
        supabase.from("store_settings").select("*").eq("store_id", storeId).maybeSingle(),
        supabase.from("store_themes").select("*").eq("store_id", storeId).maybeSingle(),
        supabase.from("seo_settings").select("*").eq("store_id", storeId).maybeSingle(),
        supabase.from("payment_settings").select("*").eq("store_id", storeId).maybeSingle(),
        supabase.from("shipping_settings").select("*").eq("store_id", storeId).maybeSingle(),
        supabase.from("tax_settings").select("*").eq("store_id", storeId).maybeSingle(),
      ]);
      return new Response(JSON.stringify({
        success: true,
        data: {
          general: settings.data || null,
          theme: theme.data || null,
          seo: seo.data || null,
          payment: payment.data || null,
          shipping: shipping.data || null,
          tax: tax.data || null,
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "PATCH" && path === "/settings/general") {
      if (!storeId) throw new Error("Store not found");
      const body = await req.json();
      const allowed = ["store_description", "store_tagline", "contact_email", "contact_phone", "support_email", "business_address_line1", "business_address_line2", "business_city", "business_state", "business_postal_code", "business_country", "business_type", "tax_id", "timezone", "default_currency", "default_language", "checkout_guest_allowed", "order_prefix", "order_number_start", "email_from_name", "email_from_address", "maintenance_mode", "maintenance_message", "gdpr_enabled", "cookie_consent_enabled"];
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const k of allowed) {
        if (body[k] !== undefined) updateData[k] = body[k];
      }
      const { data, error } = await supabase.from("store_settings").upsert({ store_id: storeId, ...updateData }, { onConflict: "store_id" }).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if ((method === "GET" || method === "PATCH") && path === "/settings/theme") {
      if (!storeId) throw new Error("Store not found");
      if (method === "GET") {
        const { data, error } = await supabase.from("store_themes").select("*").eq("store_id", storeId).maybeSingle();
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, data: data || null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const body = await req.json();
      const allowed = ["primary_color", "secondary_color", "accent_color", "background_color", "text_color", "font_family_heading", "font_family_body", "layout_style", "header_style", "product_card_style", "custom_css", "favicon_url"];
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const k of allowed) {
        if (body[k] !== undefined) updateData[k] = body[k];
      }
      const { data, error } = await supabase.from("store_themes").upsert({ store_id: storeId, ...updateData }, { onConflict: "store_id" }).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if ((method === "GET" || method === "PATCH") && path === "/settings/domains") {
      if (!storeId) throw new Error("Store not found");
      if (method === "GET") {
        const { data, error } = await supabase.from("custom_domains").select("*").eq("store_id", storeId).order("is_primary", { ascending: false });
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, data: data || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ success: false, error: "Use POST to add domain" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "POST" && path === "/settings/domains") {
      if (!storeId) throw new Error("Store not found");
      const { domain } = await req.json();
      if (!domain || typeof domain !== "string") {
        return new Response(JSON.stringify({ success: false, error: "domain required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const token = `payloom-verify-${Math.random().toString(36).slice(2, 15)}`;
      const { data, error } = await supabase.from("custom_domains").insert({ store_id: storeId, domain: domain.trim().toLowerCase(), dns_verification_token: token, dns_records: { type: "CNAME", name: domain, value: "store.payloom.com" } }).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if ((method === "GET" || method === "PATCH") && path === "/settings/seo") {
      if (!storeId) throw new Error("Store not found");
      if (method === "GET") {
        const { data, error } = await supabase.from("seo_settings").select("*").eq("store_id", storeId).maybeSingle();
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, data: data || null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const body = await req.json();
      const allowed = ["meta_title", "meta_description", "og_title", "og_description", "og_image_url", "google_analytics_id", "google_tag_manager_id", "facebook_pixel_id", "google_site_verification", "sitemap_enabled", "noindex"];
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const k of allowed) {
        if (body[k] !== undefined) updateData[k] = body[k];
      }
      const { data, error } = await supabase.from("seo_settings").upsert({ store_id: storeId, ...updateData }, { onConflict: "store_id" }).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if ((method === "GET" || method === "PATCH") && path === "/settings/payment") {
      if (!storeId) throw new Error("Store not found");
      if (method === "GET") {
        const { data, error } = await supabase.from("payment_settings").select("*").eq("store_id", storeId).maybeSingle();
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, data: data || null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const body = await req.json();
      const allowed = ["payment_currency", "accepted_payment_methods", "bank_transfer_enabled", "bank_transfer_instructions", "cash_on_delivery_enabled"];
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const k of allowed) {
        if (body[k] !== undefined) updateData[k] = body[k];
      }
      const { data, error } = await supabase.from("payment_settings").upsert({ store_id: storeId, ...updateData }, { onConflict: "store_id" }).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if ((method === "GET" || method === "PATCH") && path === "/settings/shipping") {
      if (!storeId) throw new Error("Store not found");
      if (method === "GET") {
        const { data: settings, error: e1 } = await supabase.from("shipping_settings").select("*").eq("store_id", storeId).maybeSingle();
        const { data: zones, error: e2 } = await supabase.from("shipping_zones").select("*").eq("store_id", storeId).order("priority");
        if (e1 || e2) throw e1 || e2;
        return new Response(JSON.stringify({ success: true, data: { settings: settings || null, zones: zones || [] } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const body = await req.json();
      const allowed = ["origin_address_line1", "origin_city", "origin_state", "origin_postal_code", "origin_country", "free_shipping_enabled", "free_shipping_threshold", "flat_rate_enabled", "flat_rate_amount", "flat_rate_name", "local_pickup_enabled", "local_pickup_instructions", "international_shipping_enabled"];
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const k of allowed) {
        if (body[k] !== undefined) updateData[k] = body[k];
      }
      const { data, error } = await supabase.from("shipping_settings").upsert({ store_id: storeId, ...updateData }, { onConflict: "store_id" }).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "GET" && path === "/settings/shipping/zones") {
      if (!storeId) {
        return new Response(JSON.stringify({ success: true, data: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data, error } = await supabase.from("shipping_zones").select("*").eq("store_id", storeId).order("priority");
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: data || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "POST" && path === "/settings/shipping/zones") {
      if (!storeId) throw new Error("Store not found");
      const body = await req.json();
      const { name, countries, states, rates } = body;
      if (!name) {
        return new Response(JSON.stringify({ success: false, error: "name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data, error } = await supabase.from("shipping_zones").insert({ store_id: storeId, name, countries: countries || [], states: states || [], rates: rates || [] }).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if ((method === "GET" || method === "PATCH") && path === "/settings/tax") {
      if (!storeId) throw new Error("Store not found");
      if (method === "GET") {
        const { data: taxSettings, error: e1 } = await supabase.from("tax_settings").select("*").eq("store_id", storeId).maybeSingle();
        const { data: rates, error: e2 } = await supabase.from("tax_rates").select("*").eq("store_id", storeId);
        if (e1 || e2) throw e1 || e2;
        return new Response(JSON.stringify({ success: true, data: { settings: taxSettings || null, rates: rates || [] } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const body = await req.json();
      const allowed = ["tax_calculation_method", "prices_include_tax", "display_prices_with_tax", "vat_number", "taxjar_enabled", "taxjar_api_token"];
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const k of allowed) {
        if (body[k] !== undefined) updateData[k] = body[k];
      }
      const { data, error } = await supabase.from("tax_settings").upsert({ store_id: storeId, ...updateData }, { onConflict: "store_id" }).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "POST" && path === "/settings/tax/rates") {
      if (!storeId) throw new Error("Store not found");
      const body = await req.json();
      const { name, country, state, rate } = body;
      if (!name || !country || rate === undefined) {
        return new Response(JSON.stringify({ success: false, error: "name, country, rate required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data, error } = await supabase.from("tax_rates").insert({ store_id: storeId, name, country, state: state || null, rate: parseFloat(rate) }).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "GET" && path === "/settings/integrations") {
      if (!storeId) {
        return new Response(JSON.stringify({ success: true, data: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data, error } = await supabase.from("store_integrations").select("id, integration_type, status, last_sync_at").eq("store_id", storeId);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: data || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "GET" && path === "/settings/email-templates") {
      if (!storeId) {
        return new Response(JSON.stringify({ success: true, data: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data, error } = await supabase.from("email_templates").select("*").eq("store_id", storeId);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: data || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "GET" && path === "/settings/legal-pages") {
      if (!storeId) {
        return new Response(JSON.stringify({ success: true, data: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data, error } = await supabase.from("legal_pages").select("*").eq("store_id", storeId);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: data || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "PUT" && path.match(/^\/settings\/legal-pages\/[a-zA-Z0-9-]+$/)) {
      if (!storeId) throw new Error("Store not found");
      const pageType = path.split("/").pop();
      const body = await req.json();
      const { title, content, slug, meta_description, is_published } = body;
      if (!pageType || !title || !content || !slug) {
        return new Response(JSON.stringify({ success: false, error: "page_type, title, content, slug required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data, error } = await supabase.from("legal_pages").upsert({ store_id: storeId, page_type: pageType, title, content, slug, meta_description: meta_description || null, is_published: is_published !== false, published_at: is_published !== false ? new Date().toISOString() : null, updated_at: new Date().toISOString() }, { onConflict: "store_id,page_type" }).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "GET" && path === "/settings/webhooks") {
      if (!storeId) {
        return new Response(JSON.stringify({ success: true, data: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data, error } = await supabase.from("webhook_subscriptions").select("*").eq("store_id", storeId);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: data || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "POST" && path === "/settings/webhooks") {
      if (!storeId) throw new Error("Store not found");
      const body = await req.json();
      const { url, events } = body;
      if (!url || !Array.isArray(events) || events.length === 0) {
        return new Response(JSON.stringify({ success: false, error: "url and events array required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data, error } = await supabase.from("webhook_subscriptions").insert({ store_id: storeId, url, events }).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: false, error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Store API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
