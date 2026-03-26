/**
 * Disputes API Edge Function
 * - Creates disputes (1 dispute per transaction_id enforced by DB unique constraint)
 * - Creates notifications for admins and the dispute opener (service role)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type CreateDisputeBody = {
  transactionId?: string | null;
  reason?: string | null;
  description?: string | null;
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function toTitle(reason: string): string {
  return (reason || "")
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") {
    return json(405, { success: false, error: "Method not allowed" });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Client using the caller's JWT (auth checks)
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });

    // Service client (writes notifications; bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const {
      transactionId = null,
      reason = null,
      description = null,
    } = (await req.json().catch(() => ({}))) as CreateDisputeBody;

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return json(401, { success: false, error: "Unauthorized" });

    if (!reason || !description) {
      return json(400, { success: false, error: "reason and description are required" });
    }
    if (description.trim().length < 20) {
      return json(400, { success: false, error: "Description must be at least 20 characters" });
    }

    // If tied to a transaction, validate the user is a participant
    if (transactionId) {
      // Check duplicate first (unique(transaction_id))
      const { data: existing } = await supabaseAdmin
        .from("disputes")
        .select("id, status")
        .eq("transaction_id", transactionId)
        .maybeSingle();

      if (existing?.id) {
        return json(200, {
          success: false,
          code: "DISPUTE_EXISTS",
          disputeId: existing.id,
          status: existing.status,
        });
      }

      const { data: tx } = await supabaseAdmin
        .from("transactions")
        .select("id, buyer_id, seller_id")
        .eq("id", transactionId)
        .maybeSingle();

      if (!tx?.id) {
        return json(404, { success: false, error: "Transaction not found" });
      }

      const isParticipant = tx.buyer_id === user.id || tx.seller_id === user.id;
      if (!isParticipant) {
        return json(403, { success: false, error: "You are not allowed to dispute this transaction" });
      }
    }

    const disputeInsert: Record<string, unknown> = {
      opened_by_id: user.id,
      reason,
      description,
      status: "open",
      ...(transactionId ? { transaction_id: transactionId } : {}),
    };

    const { data: dispute, error: disputeError } = await supabaseAdmin
      .from("disputes")
      .insert(disputeInsert)
      .select("id, transaction_id, status")
      .single();

    // Unique constraint race (or multiple clicks)
    if (disputeError) {
      const anyErr = disputeError as any;
      if (anyErr?.code === "23505" && transactionId) {
        const { data: existing } = await supabaseAdmin
          .from("disputes")
          .select("id, status")
          .eq("transaction_id", transactionId)
          .maybeSingle();

        if (existing?.id) {
          return json(200, {
            success: false,
            code: "DISPUTE_EXISTS",
            disputeId: existing.id,
            status: existing.status,
          });
        }
      }
      throw disputeError;
    }

    // Initial message
    await supabaseAdmin.from("dispute_messages").insert({
      dispute_id: dispute.id,
      sender_id: user.id,
      message: description,
      is_admin: false,
    });

    // Notify admins + opener
    const { data: admins } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    const prettyReason = toTitle(reason);
    const notifPayload = {
      disputeId: dispute.id,
      transactionId: dispute.transaction_id,
      reason,
    };

    const notifications = [
      {
        user_id: user.id,
        type: "dispute_opened",
        title: "Dispute submitted",
        message: `Your dispute has been submitted to our admin team (${prettyReason}).`,
        data: notifPayload,
      },
      ...(admins || []).map((a) => ({
        user_id: a.user_id,
        type: "dispute_opened",
        title: "New dispute created",
        message: `A new dispute has been opened: ${prettyReason}.`,
        data: notifPayload,
      })),
    ];

    await supabaseAdmin.from("notifications").insert(notifications);

    return json(200, { success: true, data: { disputeId: dispute.id } });
  } catch (error: unknown) {
    console.error("Disputes API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return json(500, { success: false, error: message });
  }
});
