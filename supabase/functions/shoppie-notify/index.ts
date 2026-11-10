import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Fan-out team chat messages to Shoppie + every approved external bot.
// Human messages: normal rules (mention / all / staff).
// Bot messages: forwarded ONLY to bots it explicitly @mentions in the chat, never back to the sender,
// and capped at MAX_BOT_CHAIN bot messages in a row since the last human message (loop guard).
const MAX_BOT_CHAIN = 6;
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
const norm = (s: string) => s.replace(/[^A-Za-z0-9]+/g, "").toLowerCase();

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const tok = req.headers.get("x-notify-token") || "";
  const { data: ok } = await db.rpc("yps_notify_token_ok", { p_tok: tok });
  if (!ok) return json({ error: "unauthorized" }, 401);

  await db.rpc("yps_bot_status_expire", { p_minutes: 3 });

  const payload = await req.json().catch(() => null);
  const rec = payload?.record;
  if (!rec) return json({ skipped: "no record" });

  const fromBot = !!rec.is_bot;
  const senderBot = norm(String(rec.sender_name || ""));
  const bodyText = String(rec.body || "");

  if (fromBot) {
    // Loop guard: count bot messages since the last human message.
    const { data: lastHuman } = await db.from("yps_chat_messages").select("id").eq("is_bot", false)
      .lt("id", rec.id).order("id", { ascending: false }).limit(1).maybeSingle();
    let q = db.from("yps_chat_messages").select("id", { count: "exact", head: true }).eq("is_bot", true).lte("id", rec.id);
    if (lastHuman?.id) q = q.gt("id", lastHuman.id);
    const { count } = await q;
    if ((count || 0) > MAX_BOT_CHAIN) return json({ skipped: "bot chain limit", count });
  }

  const email = String(rec.sender_email || "").trim().toLowerCase();
  let fromStaff = false;
  if (!fromBot && email) {
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
    is_bot: fromBot,
    text: bodyText,
  };
  const markThinking = async (name: string) => {
    await db.rpc("yps_bot_status_set", { p_bot_name: name, p_state: "thinking" });
  };

  // Approved external bots (fetched early so Shoppie knows if the message is aimed at someone else)
  const { data: bots } = await db.rpc("yps_approved_bots");
  const mentionsBot = (name: string) =>
    new RegExp(`@${name.replace(/[^A-Za-z0-9]+/g, "")}\\b`, "i").test(bodyText) ||
    new RegExp(`@${name.replace(/\s+/g, "\\s*")}\\b`, "i").test(bodyText);
  const otherBotMentioned = (bots || []).some((b: { bot_name?: string }) => mentionsBot(String(b.bot_name || "")));

  // Shoppie
  const { data: cfg } = await db.rpc("yps_chat_config_get");
  const { data: vault } = await db.rpc("yps_shoppie_webhook");
  const shoppieUrl = Deno.env.get("SHOPPIE_WEBHOOK_URL") || vault?.url || cfg?.webhook_url || "";
  const shoppieKey = Deno.env.get("SHOPPIE_WEBHOOK_KEY") || vault?.key || "";
  const shoppieMode = (Deno.env.get("SHOPPIE_NOTIFY_MODE") || cfg?.notify_mode || "mention").toLowerCase();
  const shoppieMentioned = /@shoppie\b/i.test(bodyText);
  const shoppieWants = fromBot
    ? (shoppieMentioned && senderBot !== "shoppie")
    : (shoppieMode === "all" || shoppieMentioned || (fromStaff && !otherBotMentioned));
  if (shoppieUrl && shoppieWants) {
    const headers: Record<string, string> = { "content-type": "application/json", "user-agent": "yps-chat/1" };
    if (shoppieKey) headers.authorization = `Bearer ${shoppieKey}`;
    const sig = Deno.env.get("SHOPPIE_WEBHOOK_SECRET");
    if (sig) headers["x-yps-webhook-secret"] = sig;
    const out = {
      event: "chat.message",
      message: baseMsg,
      mentioned: shoppieMentioned,
      from_staff: fromStaff,
      from_bot: fromBot,
      reply_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/shoppie-reply`,
    };
    await markThinking("Shoppie");
    const res = await fetch(shoppieUrl, { method: "POST", headers, body: JSON.stringify(out) }).catch(
      (e) => ({ ok: false, status: 0, statusText: String(e) } as Response),
    );
    results.push({ bot: "Shoppie", forwarded: res.ok, status: res.status });
  } else {
    results.push({ bot: "Shoppie", skipped: shoppieUrl ? "not for Shoppie" : "no webhook" });
  }

  // External bots: only when @mentioned (or the bot chose "all messages"). Staff messages no longer go to every bot.
  for (const bot of bots || []) {
    const name = String(bot.bot_name || "");
    if (fromBot && norm(name) === senderBot) { results.push({ bot: name, skipped: "own message" }); continue; }
    const mentioned = mentionsBot(name);
    const mode = String(bot.notify_mode || "mention").toLowerCase();
    const wants = fromBot ? mentioned : (mode === "all" || mentioned);
    if (!wants) { results.push({ bot: name, skipped: "no mention" }); continue; }
    if (!bot.webhook_url) { results.push({ bot: name, skipped: "no webhook" }); continue; }
    const headers: Record<string, string> = { "content-type": "application/json", "user-agent": "yps-chat/1" };
    if (bot.webhook_key) headers.authorization = `Bearer ${bot.webhook_key}`;
    const out = {
      event: "chat.message",
      message: baseMsg,
      mentioned,
      from_staff: fromStaff,
      from_bot: fromBot,
      reply_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/bot-reply`,
      bot_name: name,
    };
    await markThinking(name);
    const res = await fetch(String(bot.webhook_url), { method: "POST", headers, body: JSON.stringify(out) })
      .catch((e) => ({ ok: false, status: 0, statusText: String(e) } as Response));
    results.push({ bot: name, forwarded: res.ok, status: res.status, mentioned });
  }

  return json({ results });
});
