import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

function randToken(bytes = 24) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const jwt = (req.headers.get("authorization") || "").replace(/^bearer\s+/i, "");
  if (!jwt) return json({ error: "Sign in required." }, 401);
  const { data: who } = await db.auth.getUser(jwt);
  if (!who?.user?.email) return json({ error: "Sign in required." }, 401);
  const callerEmail = String(who.user.email).trim().toLowerCase();
  const jwtRole = String((who.user.app_metadata as { role?: string } | undefined)?.role || "");
  const { data: callerRow } = await db.from("yps_chat_members").select("role").eq("email", callerEmail).maybeSingle();
  const callerRole = String(callerRow?.role || "");
  const isOwner = callerRole === "owner" || OWNER_EMAILS.has(callerEmail) || jwtRole === "kpi_admin";
  const isAdmin = isOwner || callerRole === "admin";
  if (!isAdmin) return json({ error: "Only store owners and admins can manage bots." }, 403);

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "list").toLowerCase();

  if (action === "list") {
    const { data, error } = await db.from("yps_chat_bots").select(
      "id, bot_name, owner_contact, webhook_url, note, status, notify_mode, created_at, decided_at, decided_by",
    ).order("created_at", { ascending: false });
    if (error) return json({ error: error.message }, 500);
    const bots = (data || []).map((b) => {
      let host = "";
      try { host = new URL(b.webhook_url).host; } catch { host = ""; }
      return { ...b, webhook_host: host };
    });
    return json({ bots, me: callerEmail });
  }

  const id = String(body.id || body.request_id || "").trim();
  if (!id) return json({ error: "id required" }, 400);
  const { data: bot } = await db.from("yps_chat_bots").select("*").eq("id", id).maybeSingle();
  if (!bot) return json({ error: "Bot request not found." }, 404);

  if (action === "deny") {
    const { error } = await db.from("yps_chat_bots").update({
      status: "denied",
      decided_at: new Date().toISOString(),
      decided_by: callerEmail,
    }).eq("id", id);
    if (error) return json({ error: error.message }, 500);
    await db.from("yps_chat_messages").insert({
      user_id: null, sender_email: null, sender_name: "System", is_bot: false,
      body: `Bot join request for “${bot.bot_name}” was denied.`,
    });
    return json({ message: `Denied ${bot.bot_name}.`, id, status: "denied" });
  }

  if (action === "revoke") {
    const { error } = await db.from("yps_chat_bots").update({
      status: "revoked",
      decided_at: new Date().toISOString(),
      decided_by: callerEmail,
      reply_key_hash: null,
    }).eq("id", id);
    if (error) return json({ error: error.message }, 500);
    await db.rpc("yps_bot_secrets_clear_reply", { p_bot_id: id });
    await db.from("yps_chat_messages").insert({
      user_id: null, sender_email: null, sender_name: "System", is_bot: false,
      body: `Bot “${bot.bot_name}” was revoked and can no longer post or receive chat events.`,
    });
    return json({ message: `Revoked ${bot.bot_name}.`, id, status: "revoked" });
  }

  if (action === "set_mode") {
    const mode = String(body.notify_mode || "").toLowerCase();
    if (mode !== "mention" && mode !== "all") return json({ error: "notify_mode must be mention or all" }, 400);
    if (bot.status !== "approved") return json({ error: "Only approved bots have a notify mode." }, 400);
    const { error } = await db.from("yps_chat_bots").update({ notify_mode: mode }).eq("id", id);
    if (error) return json({ error: error.message }, 500);
    return json({ message: `${bot.bot_name} notify mode set to ${mode}.`, id, notify_mode: mode });
  }

  if (action === "approve") {
    if (bot.status === "approved") return json({ message: "Already approved.", id, status: "approved" });
    const replyKey = randToken(32);
    const replyHash = await sha256(replyKey);
    const { error } = await db.from("yps_chat_bots").update({
      status: "approved",
      decided_at: new Date().toISOString(),
      decided_by: callerEmail,
      reply_key_hash: replyHash,
      notify_mode: bot.notify_mode || "mention",
    }).eq("id", id);
    if (error) return json({ error: error.message }, 500);
    await db.rpc("yps_bot_secrets_set_reply", { p_bot_id: id, p_reply_key: replyKey });

    const replyUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/bot-reply`;
    const payload = {
      event: "bot.approved",
      request_id: id,
      reply_url: replyUrl,
      reply_key: replyKey,
      chat_name: bot.bot_name,
      notify_mode: bot.notify_mode || "mention",
    };
    const { data: secRows } = await db.rpc("yps_bot_secrets_get", { p_bot_id: id });
    const sec = Array.isArray(secRows) ? secRows[0] : secRows;
    const headers: Record<string, string> = { "content-type": "application/json", "user-agent": "yps-chat/1" };
    if (sec?.webhook_key) headers.authorization = `Bearer ${sec.webhook_key}`;
    let webhookStatus = 0;
    try {
      const res = await fetch(bot.webhook_url, { method: "POST", headers, body: JSON.stringify(payload) });
      webhookStatus = res.status;
    } catch {
      webhookStatus = 0;
    }

    await db.from("yps_chat_messages").insert({
      user_id: null, sender_email: null, sender_name: "System", is_bot: false,
      body: `Bot “${bot.bot_name}” was approved and can join the chat. Mention @${bot.bot_name.replace(/\s+/g, "")} (or ask an owner to set its mode to all messages).`,
    });

    return json({
      message: `Approved ${bot.bot_name}. Reply key delivered via webhook (status ${webhookStatus}) and available once on the bot’s poll_url.`,
      id,
      status: "approved",
      webhook_status: webhookStatus,
    });
  }

  return json({ error: "Unknown action. Use list, approve, deny, revoke, set_mode." }, 400);
});
