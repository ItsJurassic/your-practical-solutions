import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// POST { "text": "..." } with Authorization: Bearer <SHOPPIE_REPLY_KEY>
// Or POST { "status": "typing"|"thinking"|"idle" } to update the chat indicator.
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-shoppie-key, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "content-type": "application/json" } });

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function shoppieKeyOk(db: ReturnType<typeof createClient>, key: string) {
  const envKey = Deno.env.get("SHOPPIE_REPLY_KEY");
  if (envKey && safeEqual(key, envKey)) return true;
  const { data } = await db.rpc("yps_shoppie_key_ok", { p_key: key });
  return !!data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const auth = req.headers.get("authorization") || "";
  const key = req.headers.get("x-shoppie-key") || (auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "");
  if (!key) return json({ error: "missing key" }, 401);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "body must be JSON" }, 400); }
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  if (typeof body.set_webhook_key === "string") {
    const { data, error } = await db.rpc("yps_shoppie_set_webhook_key", { p_reply_key: key, p_value: body.set_webhook_key as string });
    if (error) return json({ error: error.message.includes("invalid key") ? "invalid key" : error.message }, error.message.includes("invalid key") ? 401 : 400);
    return json({ ok: true, stored_length: data });
  }

  if (!(await shoppieKeyOk(db, key))) return json({ error: "invalid key" }, 401);

  const statusRaw = body.status != null ? String(body.status).trim().toLowerCase() : "";
  const text = String(body.text ?? body.message ?? "").trim();

  if (statusRaw && !text) {
    if (!["thinking", "typing", "idle", "clear", "none", "done"].includes(statusRaw)) {
      return json({ error: "status must be thinking, typing, or idle" }, 400);
    }
    await db.rpc("yps_bot_status_set", { p_bot_name: "Shoppie", p_state: statusRaw });
    const normalized = ["idle", "clear", "none", "done"].includes(statusRaw) ? "idle" : statusRaw;
    return json({ ok: true, bot_name: "Shoppie", status: normalized });
  }

  if (!text) return json({ error: "text is required (or pass status)" }, 400);
  if (text.length > 4000) return json({ error: "text is over 4000 characters" }, 400);

  const envKey = Deno.env.get("SHOPPIE_REPLY_KEY");
  if (envKey && safeEqual(key, envKey)) {
    const { data, error } = await db.from("yps_chat_messages")
      .insert({ user_id: null, sender_email: null, sender_name: "Shoppie", is_bot: true, body: text })
      .select("id, created_at").single();
    if (error) return json({ error: error.message }, 500);
    await db.rpc("yps_bot_status_set", { p_bot_name: "Shoppie", p_state: "idle" });
    return json({ ok: true, id: data.id, created_at: data.created_at });
  }
  const { data, error } = await db.rpc("yps_shoppie_post", { p_key: key, p_body: text });
  if (error) return json({ error: error.message.includes("invalid key") ? "invalid key" : error.message }, error.message.includes("invalid key") ? 401 : 500);
  await db.rpc("yps_bot_status_set", { p_bot_name: "Shoppie", p_state: "idle" });
  return json({ ok: true, id: data.id, created_at: data.created_at });
});
