import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Owner-only: POST { email, name } with the owner's Supabase session token.
// Adds the email to yps_chat_members and sends a Supabase Auth invite (or magic link if the account exists).
const OWNER = "contact@yourpracticalsolutions.com";
const REDIRECT = "https://itsjurassic.github.io/your-practical-solutions/admin/";
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const jwt = (req.headers.get("authorization") || "").replace(/^bearer\s+/i, "");
  const { data: who } = await admin.auth.getUser(jwt);
  if (String(who?.user?.email || "").toLowerCase() !== OWNER) return json({ error: "Only the store owner can invite chat members." }, 403);
  const { email, name } = await req.json().catch(() => ({}));
  const e = String(email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return json({ error: "Enter a valid email." }, 400);
  const display = String(name || e.split("@")[0]).slice(0, 40);
  const { error: mErr } = await admin.from("yps_chat_members").upsert({ email: e, display_name: display, role: e === OWNER ? "owner" : "partner" });
  if (mErr) return json({ error: mErr.message }, 500);
  const inv = await admin.auth.admin.inviteUserByEmail(e, { redirectTo: REDIRECT, data: { chat_name: display } });
  if (inv.error) {
    const otp = await admin.auth.signInWithOtp({ email: e, options: { emailRedirectTo: REDIRECT, shouldCreateUser: false } });
    if (otp.error) return json({ message: `${e} added to chat. Invite email could not be sent: ${otp.error.message}` });
    return json({ message: `${e} already had an account — added to chat and sent a sign-in link.` });
  }
  return json({ message: `Invite sent to ${e}. They can join the chat after accepting it.` });
});
