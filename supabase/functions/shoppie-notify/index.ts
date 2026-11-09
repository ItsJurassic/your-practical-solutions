import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Fan-out human chat messages to Shoppie + every approved external bot.
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

  const bodyText = String(rec.body || "");
  const email = String(rec.sender_email || "").trim().toLowerCase();
  let fromStaff = false;
  if (email) {
    const { data: member } = await db.from("yps_chat_members").select("role").eq("email", email).maybeSingle();
    const role = String(member?.role || "");
    fromStaff = role === "owner" || role === "admin";
  }

  const results: Array<Record<string, unknown>> = [];
  const baseMsg = {
    id: rec.id,
    created_at: rec.created_at,
    sender_name: rec.sender_name,
    sender_email: rec.sender_email,
    text: bodyText,
  };

  // Shoppie (legacy vault/env)
  const { data: cfg } = await db.rpc("yps_chat_config_get");
  const { data: vault } = await db.rpc("yps_shoppie_webhook");
  const shoppieUrl = Deno.env.get("SHOPPIE_WEBHOOK_URL") || vault?.url || cfg?.webhook_url || "";
  const shoppieKey = Deno.env.get("SHOPPIE_WEBHOOK_KEY") || vault?.key || "";
  const shoppieMode = (Deno.env.get("SHOPPIE_NOTIFY_MODE") || cfg?.notify_mode || "mention").toLowerCase();
  const shoppieMentioned = /@shoppie\b/i.test(bodyText);
  if (shoppieUrl && (shoppieMode === "all" || shoppieMentioned || fromStaff)) {
    const headers: Record<string, string> = { "content-type": "application/json", "user-agent": "yps-chat/1" };
    if (shoppieKey) headers.authorization = `Bearer ${shoppieKey}`;
    const sig = Deno.env.get("SHOPPIE_WEBHOOK_SECRET");
    if (sig) headers["x-yps-webhook-secret"] = sig;
    const out = {
      event: "chat.message",
      message: baseMsg,
      mentioned: shoppieMentioned,
      from_staff: fromStaff,
      reply_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/shoppie-reply`,
    };
    const res = await fetch(shoppieUrl, { method: "POST", headers, body: JSON.stringify(out) }).catch(
      (e) => ({ ok: false, status: 0, statusText: String(e) } as Response),
    );
    results.push({ bot: "Shoppie", forwarded: res.ok, status: res.status });
  } else if (!shoppieUrl) {
    results.push({ bot: "Shoppie", skipped: "no webhook" });
  } else {
    results.push({ bot: "Shoppie", skipped: "no @Shoppie mention" });
  }

  // Approved external bots
  const { data: bots } = await db.rpc("yps_approved_bots");
  for (const bot of bots || []) {
    const name = String(bot.bot_name || "");
    const mentionRe = new RegExp(`@${name.replace(/[^A-Za-z0-9]+/g, "")}\\b`, "i");
    const alsoLoose = new RegExp(`@${name.replace(/\s+/g, "\\s*")}\\b`, "i");
    const mentioned = mentionRe.test(bodyText) || alsoLoose.test(bodyText);
    const mode = String(bot.notify_mode || "mention").toLowerCase();
    if (mode !== "all" && !mentioned && !fromStaff) {
      results.push({ bot: name, skipped: "no mention" });
      continue;
    }
    if (!bot.webhook_url) {
      results.push({ bot: name, skipped: "no webhook" });
      continue;
    }
    const headers: Record<string, string> = { "content-type": "application/json", "user-agent": "yps-chat/1" };
    if (bot.webhook_key) headers.authorization = `Bearer ${bot.webhook_key}`;
    const out = {
      event: "chat.message",
      message: baseMsg,
      mentioned,
      from_staff: fromStaff,
      reply_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/bot-reply`,
      bot_name: name,
    };
    const res = await fetch(String(bot.webhook_url), {
      method: "POST",
      headers,
      body: JSON.stringify(out),
    }).catch((e) => ({ ok: false, status: 0, statusText: String(e) } as Response));
    results.push({ bot: name, forwarded: res.ok, status: res.status, mentioned });
  }

  return json({ results });
});
