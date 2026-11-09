import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// GET → live catalog JSON in the same shape as the site's baked products.json.
// Source priority:
//   1. SHOPIFY_STOREFRONT_TOKEN secret  → Storefront GraphQL API
//   2. SHOPIFY_ADMIN_TOKEN secret       → Admin GraphQL API
//   3. no token                         → public https://<store>/products.json (+ collections.json)
// Results are cached in memory (5 min) and the last good result is kept in public.yps_products_cache.
// If the live source fails (e.g. store password page → 401) the response has ok:false and, when
// available, the last good cached catalog; the website then falls back to its baked products.json.
const SHOP = Deno.env.get("SHOPIFY_STORE_DOMAIN") || "xvdkyq-xg.myshopify.com";
const ORIGIN = Deno.env.get("SHOPIFY_ORIGIN_OVERRIDE") || `https://${SHOP}`; // testing hook
const LINK_BASE = Deno.env.get("SHOP_LINK_BASE") || "https://shop.yourpracticalsolutions.com"; // public links use the primary domain
const API_VERSION = "2025-10";
const TTL_MS = 5 * 60 * 1000;
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type, apikey, authorization, x-client-info", "access-control-allow-methods": "GET, OPTIONS" };

type Product = { title: string; handle: string; url: string; image: string | null; image_alt: string; price: string | null; price_max: string | null; currency: string; product_type: string; tags: string[]; collections: string[] };
type Collection = { handle: string; title: string; count: number; url: string };

let mem: { at: number; body: Record<string, unknown> } | null = null;

const json = (body: unknown, status = 200, maxAge = 300) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json; charset=utf-8", "cache-control": `public, max-age=${maxAge}` } });

async function getJson(url: string, init: RequestInit = {}) {
  let res: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(url, { ...init, redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (compatible; YPS-catalog/1.0; +https://yourpracticalsolutions.com)", accept: "application/json", ...(init.headers || {}) } });
    if (res.status !== 429) break;
    const wait = Math.min(Number(res.headers.get("retry-after")) || 2 ** attempt, 4);
    await res.body?.cancel();
    await new Promise((r) => setTimeout(r, wait * 1000));
  }
  res = res!;
  const ct = res.headers.get("content-type") || "";
  if (res.status === 401 || res.url.includes("/password")) throw Object.assign(new Error("store is password protected"), { code: "store_password" });
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} from ${new URL(url).pathname}`), { code: "http_" + res.status });
  if (!ct.includes("json")) throw Object.assign(new Error("store did not return JSON"), { code: "not_json" });
  return res.json();
}

async function fromPublicJson() {
  const products: Product[] = [];
  for (let page = 1; page <= 20; page++) {
    const j = await getJson(`${ORIGIN}/products.json?limit=250&page=${page}`);
    const batch = j.products || [];
    for (const p of batch) {
      const prices = (p.variants || []).map((v: { price: string }) => Number(v.price)).filter((n: number) => !Number.isNaN(n));
      products.push({
        title: p.title, handle: p.handle, url: `${LINK_BASE}/products/${p.handle}`,
        image: p.images?.[0]?.src || null, image_alt: p.images?.[0]?.alt || p.title,
        price: prices.length ? Math.min(...prices).toFixed(2) : null, price_max: prices.length ? Math.max(...prices).toFixed(2) : null,
        currency: "USD", product_type: p.product_type || "",
        tags: Array.isArray(p.tags) ? p.tags : String(p.tags || "").split(",").map((t: string) => t.trim()).filter(Boolean),
        collections: [],
      });
    }
    if (batch.length < 250) break;
  }
  let collections: Collection[] = [];
  try {
    const cj = await getJson(`${ORIGIN}/collections.json?limit=250`);
    const cols = (cj.collections || []).filter((c: { handle: string }) => c.handle !== "frontpage").slice(0, 50);
    const byHandle = new Map(products.map((p) => [p.handle, p]));
    for (const c of cols) {
      let count = 0;
      try {
        const pj = await getJson(`${ORIGIN}/collections/${c.handle}/products.json?limit=250`);
        for (const p of pj.products || []) { byHandle.get(p.handle)?.collections.push(c.handle); count++; }
      } catch { /* collection product list unavailable */ }
      collections.push({ handle: c.handle, title: c.title, count, url: `${LINK_BASE}/collections/${c.handle}` });
    }
  } catch { collections = []; }
  return { source: "public products.json", products, collections };
}

async function fromGraphql(kind: "storefront" | "admin", token: string) {
  const isSf = kind === "storefront";
  const url = isSf ? `https://${SHOP}/api/${API_VERSION}/graphql.json` : `https://${SHOP}/admin/api/${API_VERSION}/graphql.json`;
  const headers = isSf ? { "X-Shopify-Storefront-Access-Token": token } : { "X-Shopify-Access-Token": token };
  const products: Product[] = [];
  let after: string | null = null;
  for (let i = 0; i < 20; i++) {
    const q = isSf
      ? `query($after:String){ products(first:100, after:$after){ pageInfo{hasNextPage endCursor} nodes{ title handle productType tags featuredImage{url altText} priceRange{minVariantPrice{amount currencyCode} maxVariantPrice{amount}} collections(first:10){nodes{handle}} } } }`
      : `query($after:String){ products(first:100, after:$after, query:"status:active"){ pageInfo{hasNextPage endCursor} nodes{ title handle productType tags featuredMedia{preview{image{url altText}}} priceRangeV2{minVariantPrice{amount currencyCode} maxVariantPrice{amount}} collections(first:10){nodes{handle}} } } }`;
    const j = await getJson(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify({ query: q, variables: { after } }) });
    if (j.errors) throw Object.assign(new Error(JSON.stringify(j.errors).slice(0, 200)), { code: "graphql" });
    const conn = j.data.products;
    for (const p of conn.nodes) {
      const img = isSf ? p.featuredImage : p.featuredMedia?.preview?.image;
      const pr = isSf ? p.priceRange : p.priceRangeV2;
      products.push({
        title: p.title, handle: p.handle, url: `${LINK_BASE}/products/${p.handle}`,
        image: img?.url || null, image_alt: img?.altText || p.title,
        price: pr?.minVariantPrice?.amount ?? null, price_max: pr?.maxVariantPrice?.amount ?? null,
        currency: pr?.minVariantPrice?.currencyCode || "USD", product_type: p.productType || "", tags: p.tags || [],
        collections: (p.collections?.nodes || []).map((c: { handle: string }) => c.handle),
      });
    }
    if (!conn.pageInfo.hasNextPage) break;
    after = conn.pageInfo.endCursor;
  }
  const cq = `{ collections(first:100){ nodes{ handle title } } }`;
  const cj = await getJson(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify({ query: cq }) });
  const collections: Collection[] = (cj.data?.collections?.nodes || []).filter((c: { handle: string }) => c.handle !== "frontpage").map((c: { handle: string; title: string }) => ({
    handle: c.handle, title: c.title, count: products.filter((p) => p.collections.includes(c.handle)).length, url: `${LINK_BASE}/collections/${c.handle}`,
  }));
  return { source: `${kind} API`, products, collections };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const force = new URL(req.url).searchParams.has("refresh");
  if (!force && mem && Date.now() - mem.at < TTL_MS) return json({ ...mem.body, cache: "memory" });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const sf = Deno.env.get("SHOPIFY_STOREFRONT_TOKEN");
  const admin = Deno.env.get("SHOPIFY_ADMIN_TOKEN");
  try {
    const live = sf ? await fromGraphql("storefront", sf) : admin ? await fromGraphql("admin", admin) : await fromPublicJson();
    const body = {
      ok: true, generated_at: new Date().toISOString(), source: `live: ${live.source}`,
      store: { name: "Your Practical Solutions", url: LINK_BASE, myshopify: SHOP },
      product_count: live.products.length, products: live.products, collections: live.collections,
    };
    mem = { at: Date.now(), body };
    await db.from("yps_products_cache").upsert({ id: 1, fetched_at: body.generated_at, source: body.source, payload: body });
    return json(body);
  } catch (e) {
    const err = e as Error & { code?: string };
    const { data: cached } = await db.from("yps_products_cache").select("fetched_at, payload").eq("id", 1).maybeSingle();
    const body = {
      ok: false, reason: err.code || "error", message: err.message,
      ...(cached ? { ...cached.payload, ok: false, stale: true, cached_at: cached.fetched_at } : { product_count: 0, products: [], collections: [] }),
    };
    mem = { at: Date.now() - TTL_MS + 60_000, body }; // retry the live source after ~1 minute
    return json(body, 200, 60);
  }
});
