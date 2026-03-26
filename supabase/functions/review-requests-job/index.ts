/**
 * Review Requests Job - Run periodically (e.g. hourly via cron)
 * Finds fulfilled orders past delay_days and creates review requests
 * that haven't been sent yet. Updates status to 'sent'.
 * Email/SMS sending would be integrated with your notification service.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const cronSecret = req.headers.get("x-cron-secret") || req.headers.get("authorization");
  if (Deno.env.get("CRON_SECRET") && cronSecret !== `Bearer ${Deno.env.get("CRON_SECRET")}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: settings } = await supabase
      .from("seller_review_settings")
      .select("seller_id, review_auto_request_delay_days, review_auto_request_method")
      .eq("review_auto_request_enabled", true);

    if (!settings?.length) {
      return new Response(JSON.stringify({ success: true, processed: 0, message: "No auto-request config" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    const delayDays = Math.max(0, settings[0]?.review_auto_request_delay_days ?? 7);
    const cutoff = new Date(Date.now() - delayDays * 86400000).toISOString().slice(0, 10);

    for (const s of settings) {
      const { data: orders } = await supabase
        .from("transactions")
        .select("id, buyer_id, product_id, completed_at, created_at")
        .eq("seller_id", s.seller_id)
        .or("status.eq.completed,status.eq.delivered")
        .lte("completed_at", cutoff + "T23:59:59")
        .limit(100);

      for (const o of orders || []) {
        const compAt = o.completed_at || o.created_at;
        if (!compAt) continue;
        const compDate = new Date(compAt).toISOString().slice(0, 10);
        if (compDate > cutoff) continue;

        const { data: existing } = await supabase
          .from("review_requests")
          .select("id")
          .eq("order_id", o.id)
          .maybeSingle();

        if (existing) continue;

        await supabase.from("review_requests").insert({
          seller_id: s.seller_id,
          order_id: o.id,
          customer_id: o.buyer_id,
          product_ids: o.product_id ? [o.product_id] : [],
          request_type: s.review_auto_request_method || "email",
          status: "sent",
          sent_at: new Date().toISOString(),
        });
        processed++;
      }
    }

    return new Response(JSON.stringify({ success: true, processed }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Review requests job error:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
