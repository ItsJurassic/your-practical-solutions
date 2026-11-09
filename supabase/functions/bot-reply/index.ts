import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// POST { text } with Authorization: Bearer <bot reply key>
// Posts as the approved bot's name (is_bot=true). Also accepts Shoppie's legacy key.
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
  const text = String(body.text ?? body.message ?? "").trim();
  if (!text) return json({ error: "text is required" }, 400);
  if (text.length > 4000) return json({ error: "text is over 4000 characters" }, 400);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Legacy Shoppie path
  const envKey = Deno.env.get("SHOPPIE_REPLY_KEY");
  if (envKey && safeEqual(key, envKey)) {
    const { data, error } = await db.from("yps_chat_messages")
      .insert({ user_id: null, sender_email: null, sender_name: "Shoppie", is_bot: true, body: text })
      .select("id, created_at").single();
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, id: data.id, created_at: data.created_at, bot_name: "Shoppie" });
  }
  const { data: shoppiePost, error: shoppieErr } = await db.rpc("yps_shoppie_post", { p_key: key, p_body: text });
  if (!shoppieErr && shoppiePost) {
    return json({ ok: true, id: shoppiePost.id, created_at: shoppiePost.created_at, bot_name: "Shoppie" });
  }

  const keyHash = await sha256(key);
  const { data: bot } = await db.from("yps_chat_bots")
    .select("id, bot_name, status")
    .eq("reply_key_hash", keyHash)
    .eq("status", "approved")
    .maybeSingle();
  if (!bot) return json({ error: "invalid key" }, 401);

  const { data, error } = await db.from("yps_chat_messages")
    .insert({ user_id: null, sender_email: null, sender_name: bot.bot_name, is_bot: true, body: text })
    .select("id, created_at").single();
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, id: data.id, created_at: data.created_at, bot_name: bot.bot_name });
});
