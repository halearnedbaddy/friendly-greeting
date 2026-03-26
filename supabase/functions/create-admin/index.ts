import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const { email, password, name, bootstrap_secret } = await req.json().catch(() => ({})) as {
      email?: string;
      password?: string;
      name?: string;
      bootstrap_secret?: string;
    };

    // Security: require a bootstrap secret
    const expectedSecret = Deno.env.get("ADMIN_BOOTSTRAP_SECRET") || "PayLoom2026!Bootstrap";
    if (!bootstrap_secret || bootstrap_secret !== expectedSecret) {
      return json(401, { success: false, error: "Invalid bootstrap secret" });
    }

    if (!email || !password) {
      return json(400, { success: false, error: "Email and password are required" });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: name || "PayLoom Admin", role: "admin" },
    });

    if (authError) {
      // If user already exists, try to get them and update password
      if (authError.message?.includes("already been registered") || authError.message?.includes("already exists")) {
        const { data: users } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = users?.users?.find(u => u.email === email);
        
        if (existingUser) {
          // Update password
          await supabaseAdmin.auth.admin.updateUserById(existingUser.id, { password });
          
          // Ensure admin role exists
          const { data: existingRole } = await supabaseAdmin
            .from("user_roles")
            .select("id")
            .eq("user_id", existingUser.id)
            .eq("role", "admin")
            .maybeSingle();

          if (!existingRole) {
            await supabaseAdmin.from("user_roles").insert({ user_id: existingUser.id, role: "admin" });
          }

          // Ensure profile exists
          const { data: existingProfile } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("user_id", existingUser.id)
            .maybeSingle();

          if (!existingProfile) {
            await supabaseAdmin.from("profiles").insert({
              user_id: existingUser.id,
              full_name: name || "PayLoom Admin",
            });
          }

          return json(200, {
            success: true,
            message: "Existing user updated to admin",
            userId: existingUser.id,
          });
        }
      }
      return json(400, { success: false, error: authError.message });
    }

    const userId = authData.user.id;

    // Create profile
    await supabaseAdmin.from("profiles").insert({
      user_id: userId,
      full_name: name || "PayLoom Admin",
    });

    // Assign admin role
    await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      role: "admin",
    });

    return json(200, {
      success: true,
      message: "Admin user created successfully",
      userId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("create-admin error:", message);
    return json(500, { success: false, error: message });
  }
});
