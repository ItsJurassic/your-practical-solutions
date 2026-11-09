import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const BASE = "https://avcqqazytvvcfraowgsm.supabase.co/functions/v1/bot-join-request";
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, x-forwarded-for, cf-connecting-ip",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "content-type": "application/json" } });

function clientIp(req: Request) {
  return (
    req.headers.get("cf-connecting-ip") ||
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

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
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const url = new URL(req.url);

  let postBody: Record<string, unknown> | null = null;
  if (req.method === "POST") {
    postBody = await req.json().catch(() => ({}));
  }

  const wantStatus =
    req.method === "GET" ||
    (req.method === "POST" && String(postBody?.action || "") === "status");

  if (wantStatus) {
    const requestId = String(
      url.searchParams.get("request_id") || postBody?.request_id || "",
    ).trim();
    const claim = String(
      url.searchParams.get("claim_secret") || postBody?.claim_secret || "",
    ).trim();
    if (!requestId || !claim) return json({ error: "request_id and claim_secret required" }, 400);
    const claimHash = await sha256(claim);
    const { data: bot, error } = await db.from("yps_chat_bots").select("*").eq("id", requestId).maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!bot || bot.claim_secret_hash !== claimHash) return json({ error: "not found" }, 404);

    const out: Record<string, unknown> = {
      request_id: bot.id,
      status: bot.status,
      bot_name: bot.bot_name,
      notify_mode: bot.notify_mode,
    };
    if (bot.status === "approved") {
      const { data: secRows } = await db.rpc("yps_bot_secrets_get", { p_bot_id: bot.id });
      const sec = Array.isArray(secRows) ? secRows[0] : secRows;
      out.reply_url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/bot-reply`;
      if (sec?.reply_key_once) {
        out.reply_key = sec.reply_key_once;
        out.chat_name = bot.bot_name;
        out.reply_key_delivered = true;
        await db.rpc("yps_bot_secrets_clear_reply", { p_bot_id: bot.id });
      } else {
        out.reply_key_delivered = false;
      }
    }
    return json(out);
  }

  if (req.method !== "POST") return json({ error: "POST or GET only" }, 405);

  const { data: rateOk } = await db.rpc("yps_bot_rate_ok", { p_ip: clientIp(req) });
  if (!rateOk) return json({ error: "Too many join requests from this network. Try again later." }, 429);

  const body = postBody || {};
  const botName = String(body.bot_name || "").trim().slice(0, 40);
  const ownerContact = String(body.owner_contact || "").trim().toLowerCase().slice(0, 120);
  const webhookUrl = String(body.webhook_url || "").trim();
  const webhookKey = body.webhook_key != null ? String(body.webhook_key).slice(0, 500) : "";
  const note = body.note != null ? String(body.note).trim().slice(0, 500) : "";

  if (!/^[A-Za-z][A-Za-z0-9 _-]{1,39}$/.test(botName)) {
    return json({ error: "bot_name must be 2–40 chars, start with a letter, letters/numbers/spaces/_/- only." }, 400);
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ownerContact)) {
    return json({ error: "owner_contact must be a valid email." }, 400);
  }
  let parsed: URL;
  try {
    parsed = new URL(webhookUrl);
  } catch {
    return json({ error: "webhook_url must be a valid https URL." }, 400);
  }
  if (parsed.protocol !== "https:") return json({ error: "webhook_url must use https." }, 400);

  const claimSecret = randToken(24);
  const claimHash = await sha256(claimSecret);
  const { data: bot, error: insErr } = await db
    .from("yps_chat_bots")
    .insert({
      bot_name: botName,
      owner_contact: ownerContact,
      webhook_url: webhookUrl,
      note: note || null,
      status: "pending",
      notify_mode: "mention",
      claim_secret_hash: claimHash,
    })
    .select("*")
    .single();
  if (insErr) return json({ error: insErr.message }, 500);

  await db.rpc("yps_bot_secrets_upsert", {
    p_bot_id: bot.id,
    p_webhook_key: webhookKey || null,
    p_reply_key_once: null,
  });

  await db.from("yps_chat_messages").insert({
    user_id: null,
    sender_email: null,
    sender_name: "System",
    is_bot: false,
    body: `Bot “${botName}” requested to join the team chat (contact ${ownerContact}). Review it under Admin tools → Bot join requests. @Shoppie`,
  });

  const pollUrl =
    `${BASE}?request_id=${encodeURIComponent(bot.id)}&claim_secret=${encodeURIComponent(claimSecret)}`;
  return json({
    request_id: bot.id,
    status: "pending",
    poll_url: pollUrl,
    claim_secret: claimSecret,
    message:
      "Join request submitted. An owner must approve it. Poll poll_url until status is approved, then save reply_key (shown once).",
  });
});
