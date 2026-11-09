import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Admin-only: manage store admins / partners.
// POST { action?: "invite"|"remove"|"list", email?, name?, role?: "admin"|"partner" }
// Caller must already be an owner/admin in yps_chat_members (or kpi_admin in JWT).
const REDIRECT = "https://yourpracticalsolutions.com/admin/";
const OWNER_EMAILS = new Set([
  "contact@yourpracticalsolutions.com",
  "josephcaldwell12321@gmail.com",
]);
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "content-type": "application/json" } });

type Member = { email: string; display_name: string | null; role: string; invited_at?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const jwt = (req.headers.get("authorization") || "").replace(/^bearer\s+/i, "");
  if (!jwt) return json({ error: "Sign in required." }, 401);

  const { data: who, error: whoErr } = await admin.auth.getUser(jwt);
  if (whoErr || !who?.user?.email) return json({ error: "Sign in required." }, 401);
  const callerEmail = String(who.user.email).trim().toLowerCase();
  const jwtRole = String((who.user.app_metadata as { role?: string } | undefined)?.role || "");

  const { data: callerRow } = await admin
    .from("yps_chat_members")
    .select("email, display_name, role")
    .eq("email", callerEmail)
    .maybeSingle();

  const callerRole = String(callerRow?.role || "");
  const isOwner =
    callerRole === "owner" || OWNER_EMAILS.has(callerEmail) || jwtRole === "kpi_admin";
  const isAdmin = isOwner || callerRole === "admin";
  if (!isAdmin) return json({ error: "Only store owners and admins can manage the team." }, 403);

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "invite").toLowerCase();

  if (action === "list") {
    const { data, error } = await admin
      .from("yps_chat_members")
      .select("email, display_name, role, invited_at")
      .order("role")
      .order("email");
    if (error) return json({ error: error.message }, 500);
    return json({ members: (data || []) as Member[], me: callerEmail, canRemove: isOwner });
  }

  if (action === "remove") {
    if (!isOwner) return json({ error: "Only an owner can remove an admin." }, 403);
    const e = String(body.email || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return json({ error: "Enter a valid email." }, 400);
    if (e === callerEmail) return json({ error: "You cannot remove yourself." }, 400);
    if (OWNER_EMAILS.has(e) && e !== callerEmail) {
      // Allow removing the unused contact@ mailbox; keep primary personal owner protected only if it's the caller.
    }
    const { data: target } = await admin.from("yps_chat_members").select("email, role").eq("email", e).maybeSingle();
    if (!target) return json({ error: "That email is not on the team." }, 404);
    if (target.role === "owner" && callerRole !== "owner" && !OWNER_EMAILS.has(callerEmail)) {
      return json({ error: "Only an owner can remove another owner." }, 403);
    }
    const { error } = await admin.from("yps_chat_members").delete().eq("email", e);
    if (error) return json({ error: error.message }, 500);
    return json({ message: `Removed ${e} from the team.`, email: e });
  }

  // invite (default)
  const e = String(body.email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return json({ error: "Enter a valid email." }, 400);
  const display = String(body.name || e.split("@")[0]).slice(0, 40);
  const requested = String(body.role || "admin").toLowerCase();
  let role = requested === "partner" ? "partner" : "admin";
  if (OWNER_EMAILS.has(e)) role = "owner";
  // Only owners may create other owners/admins beyond partner; admins may add admins/partners.
  if (role === "owner" && !isOwner) return json({ error: "Only an owner can assign the owner role." }, 403);

  const { error: mErr } = await admin
    .from("yps_chat_members")
    .upsert({ email: e, display_name: display, role });
  if (mErr) return json({ error: mErr.message }, 500);

  const inv = await admin.auth.admin.inviteUserByEmail(e, {
    redirectTo: REDIRECT,
    data: { chat_name: display },
  });
  if (inv.error) {
    const otp = await admin.auth.signInWithOtp({
      email: e,
      options: { emailRedirectTo: REDIRECT, shouldCreateUser: false },
    });
    if (otp.error) {
      return json({
        message: `${e} added as ${role}. Invite email could not be sent: ${otp.error.message}`,
        email: e,
        role,
      });
    }
    return json({
      message: `${e} already had an account — added as ${role} and sent a sign-in link to ${REDIRECT}.`,
      email: e,
      role,
    });
  }
  return json({
    message: `Invite sent to ${e} as ${role}. They can open the admin page after accepting it.`,
    email: e,
    role,
  });
});
