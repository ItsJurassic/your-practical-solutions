import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// POST { text } with Authorization: Bearer <bot reply key>
// Or POST { status: 'typing'|'thinking'|'idle' } (no text) to update the UI indicator.
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-shoppie-key, x-bot-key, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "content-type": "application/json" } });

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function resolveBot(
  db: ReturnType<typeof createClient>,
  key: string,
): Promise<"Shoppie" | string | null> {
  const envKey = Deno.env.get("SHOPPIE_REPLY_KEY");
  if (envKey && safeEqual(key, envKey)) return "Shoppie";
  const { data: shoppieOk } = await db.rpc("yps_shoppie_key_ok", { p_key: key });
  if (shoppieOk) return "Shoppie";
  const keyHash = await sha256(key);
  const { data: bot } = await db.from("yps_chat_bots")
    .select("bot_name")
    .eq("reply_key_hash", keyHash)
    .eq("status", "approved")
    .maybeSingle();
  return bot?.bot_name || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const auth = req.headers.get("authorization") || "";
  const key =
    req.headers.get("x-bot-key") ||
    req.headers.get("x-shoppie-key") ||
    (auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "");
  if (!key) return json({ error: "missing key" }, 401);
  const body = await req.json().catch(() => ({}));
  const statusRaw = body.status != null ? String(body.status).trim().toLowerCase() : "";
  const text = String(body.text ?? body.message ?? "").trim();
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const botName = await resolveBot(db, key);
  if (!botName) return json({ error: "invalid key" }, 401);

  if (statusRaw && !text) {
    if (!["thinking", "typing", "idle", "clear", "none", "done"].includes(statusRaw)) {
      return json({ error: "status must be thinking, typing, or idle" }, 400);
    }
    await db.rpc("yps_bot_status_set", { p_bot_name: botName, p_state: statusRaw });
    const normalized = ["idle", "clear", "none", "done"].includes(statusRaw) ? "idle" : statusRaw;
    return json({ ok: true, bot_name: botName, status: normalized });
  }

  if (!text) return json({ error: "text is required (or pass status)" }, 400);
  if (text.length > 4000) return json({ error: "text is over 4000 characters" }, 400);

  if (botName === "Shoppie") {
    const envKey = Deno.env.get("SHOPPIE_REPLY_KEY");
    if (envKey && safeEqual(key, envKey)) {
      const { data, error } = await db.from("yps_chat_messages")
        .insert({ user_id: null, sender_email: null, sender_name: "Shoppie", is_bot: true, body: text })
        .select("id, created_at").single();
      if (error) return json({ error: error.message }, 500);
      await db.rpc("yps_bot_status_set", { p_bot_name: "Shoppie", p_state: "idle" });
      return json({ ok: true, id: data.id, created_at: data.created_at, bot_name: "Shoppie" });
    }
    const { data: shoppiePost, error: shoppieErr } = await db.rpc("yps_shoppie_post", { p_key: key, p_body: text });
    if (shoppieErr) return json({ error: shoppieErr.message.includes("invalid key") ? "invalid key" : shoppieErr.message }, 401);
    await db.rpc("yps_bot_status_set", { p_bot_name: "Shoppie", p_state: "idle" });
    return json({ ok: true, id: shoppiePost.id, created_at: shoppiePost.created_at, bot_name: "Shoppie" });
  }

  const { data, error } = await db.from("yps_chat_messages")
    .insert({ user_id: null, sender_email: null, sender_name: botName, is_bot: true, body: text })
    .select("id, created_at").single();
  if (error) return json({ error: error.message }, 500);
  await db.rpc("yps_bot_status_set", { p_bot_name: botName, p_state: "idle" });
  return json({ ok: true, id: data.id, created_at: data.created_at, bot_name: botName });
});
