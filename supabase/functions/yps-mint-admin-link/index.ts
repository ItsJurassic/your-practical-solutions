import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Internal: mint a magic-link token_hash for an owner email.
// Auth: Bearer <shoppie_reply_key> (Vault). Do not call from the browser.
const ALLOWED = new Set([
  "josephcaldwell12321@gmail.com",
  "contact@yourpracticalsolutions.com",
]);
const ADMIN = "https://yourpracticalsolutions.com/admin/";
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-shoppie-key, content-type",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const auth = req.headers.get("authorization") || "";
  const key = req.headers.get("x-shoppie-key") ||
    (auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "");
  if (!key) return json({ error: "missing key" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const envKey = Deno.env.get("SHOPPIE_REPLY_KEY");
  if (envKey) {
    if (!safeEqual(key, envKey)) return json({ error: "invalid key" }, 401);
  } else {
    const { data: ok, error } = await admin.rpc("yps_check_shoppie_key", { p_key: key });
    if (error) return json({ error: error.message }, 500);
    if (!ok) return json({ error: "invalid key" }, 401);
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  if (!ALLOWED.has(email)) return json({ error: "email not allowed" }, 403);

  const link = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: ADMIN },
  });
  if (link.error) return json({ error: link.error.message }, 500);
  const props = (link.data.properties || {}) as {
    hashed_token?: string;
    redirect_to?: string;
  };
  const token_hash = props.hashed_token;
  if (!token_hash) return json({ error: "no token_hash returned" }, 500);
  return json({
    email,
    token_hash,
    type: "email",
    admin_url: `${ADMIN}?token_hash=${encodeURIComponent(token_hash)}&type=email`,
    supabase_redirect_to: props.redirect_to || null,
  });
});
