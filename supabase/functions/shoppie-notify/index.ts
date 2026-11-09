import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Called by the yps_chat_notify DB trigger (pg_net) for every new human chat message.
// Forwards to SHOPPIE_WEBHOOK_URL when configured.
// Mode: "all" | "mention" (default). In mention mode, also forwards messages from
// owners/admins in yps_chat_members so the store team doesn't have to type @Shoppie.
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const tok = req.headers.get("x-notify-token") || "";
  const { data: ok } = await db.rpc("yps_notify_token_ok", { p_tok: tok });
  if (!ok) return json({ error: "unauthorized" }, 401);

  const payload = await req.json().catch(() => null);
  const rec = payload?.record;
  if (!rec || rec.is_bot) return json({ skipped: "no human message" });

  const { data: cfg } = await db.rpc("yps_chat_config_get");
  const { data: vault } = await db.rpc("yps_shoppie_webhook");
  const webhook = Deno.env.get("SHOPPIE_WEBHOOK_URL") || vault?.url || cfg?.webhook_url || "";
  const bearer = Deno.env.get("SHOPPIE_WEBHOOK_KEY") || vault?.key || "";
  const mode = (Deno.env.get("SHOPPIE_NOTIFY_MODE") || cfg?.notify_mode || "mention").toLowerCase();
  if (!webhook) return json({ skipped: "SHOPPIE_WEBHOOK_URL not set" });

  const mentioned = /@shoppie\b/i.test(rec.body || "");
  let fromStaff = false;
  const email = String(rec.sender_email || "").trim().toLowerCase();
  if (email) {
    const { data: member } = await db
      .from("yps_chat_members")
      .select("role")
      .eq("email", email)
      .maybeSingle();
    const role = String(member?.role || "");
    fromStaff = role === "owner" || role === "admin";
  }
  if (mode !== "all" && !mentioned && !fromStaff) {
    return json({ skipped: "no @Shoppie mention" });
  }

  const out = {
    event: "chat.message",
    message: {
      id: rec.id,
      created_at: rec.created_at,
      sender_name: rec.sender_name,
      sender_email: rec.sender_email,
      text: rec.body,
    },
    mentioned,
    from_staff: fromStaff,
    reply_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/shoppie-reply`,
  };
  const headers: Record<string, string> = { "content-type": "application/json", "user-agent": "yps-chat/1" };
  if (bearer) headers["authorization"] = `Bearer ${bearer}`;
  const sig = Deno.env.get("SHOPPIE_WEBHOOK_SECRET");
  if (sig) headers["x-yps-webhook-secret"] = sig;
  const res = await fetch(webhook, { method: "POST", headers, body: JSON.stringify(out) }).catch(
    (e) => ({ ok: false, status: 0, statusText: String(e) } as Response),
  );
  return json({ forwarded: res.ok, status: res.status, mentioned, from_staff: fromStaff });
});
