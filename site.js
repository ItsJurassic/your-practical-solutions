import { CONFIG, shopUrl, collectionUrl } from "./config.js";

const BASE = window.__SITE_BASE__ || "./";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const ICONS = {
  "storage-organization": svg('<rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><path d="M10 7.5h4M10 16.5h4"/>'),
  "pet-supplies": svg('<circle cx="6" cy="9" r="2"/><circle cx="10" cy="5.5" r="2"/><circle cx="14" cy="5.5" r="2"/><circle cx="18" cy="9" r="2"/><path d="M12 11c-3 0-6 4.5-6 7a2.5 2.5 0 0 0 3 2.4c1-.2 2-.6 3-.6s2 .4 3 .6a2.5 2.5 0 0 0 3-2.4c0-2.5-3-7-6-7z"/>'),
  "garage-tools": svg('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8 6.2 21l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.5 2.5-2.6-.6-.6-2.6z"/>'),
  "car-rv": svg('<path d="M3 13l2-5a2 2 0 0 1 1.9-1.3h10.2A2 2 0 0 1 19 8l2 5v4a1 1 0 0 1-1 1h-1"/><path d="M5 18H4a1 1 0 0 1-1-1v-4h18"/><circle cx="7.5" cy="18" r="2"/><circle cx="16.5" cy="18" r="2"/><path d="M9.5 18h5"/>'),
  "tech-accessories": svg('<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M11 18.5h2"/>'),
  "home-decor": svg('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9v11h14V9"/><path d="M10 20v-5h4v5"/>'),
  "new-arrivals": svg('<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/>'),
  "best-sellers": svg('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>'),
  truck: svg('<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>'),
  lock: svg('<rect x="4" y="10.5" width="16" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>'),
  chat: svg('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/>'),
  check: svg('<path d="M20 6 9 17l-5-5"/>'),
  bag: svg('<path d="M5 8h14l-1 12.5H6z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  home: svg('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>'),
  grid: svg('<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>'),
  store: svg('<path d="M4 9.5 5.5 4h13L20 9.5"/><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0"/><path d="M5 11.5V20h14v-8.5M10 20v-5h4v5"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
};
const TILE = {
  "storage-organization": ["#eef3f8", "#2b5c8a", "Bins, shelves & closet kits"],
  "pet-supplies": ["#fdf1e7", "#b45f1b", "Beds, bowls & grooming"],
  "garage-tools": ["#eef1ee", "#3f5a4a", "Tools, racks & workbench gear"],
  "car-rv": ["#f1eefa", "#5b43a6", "Road-trip & camper essentials"],
  "tech-accessories": ["#ecf6f6", "#16736f", "Chargers, cables & mounts"],
  "home-decor": ["#fbf0f0", "#a6434b", "Rugs, curtains & comfort"],
  "new-arrivals": ["#fff7e3", "#a3700b", "Just landed in the store"],
  "best-sellers": ["#eaf2ee", "#1f4a3d", "What customers love most"],
};

const LIVE_URL = "https://avcqqazytvvcfraowgsm.supabase.co/functions/v1/yps-products";
const EMPTY = { products: [], collections: [], product_count: 0 };

async function fetchJson(url, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, cache: "no-cache" });
    return r.ok ? await r.json() : null;
  } catch { return null; } finally { clearTimeout(t); }
}

// Live Shopify catalog (Supabase edge function yps-products) first; baked products.json as fallback.
let catalogPromise;
export function loadCatalog() {
  catalogPromise ||= (async () => {
    const [live, baked] = await Promise.all([fetchJson(LIVE_URL, 4500), fetchJson(`${BASE}products.json`, 8000)]);
    let cat, source;
    if (live?.ok && Array.isArray(live.products)) { cat = live; source = "live"; }
    else if (baked?.products?.length) { cat = baked; source = "baked"; }
    else if (live?.stale && live.products?.length) { cat = live; source = "stale-cache"; }
    else { cat = baked || live || EMPTY; source = baked ? "baked" : "none"; }
    if (!cat.collections?.length && baked?.collections?.length) cat = { ...cat, collections: baked.collections };
    // Products still in DRAFT on Shopify (data/coming-soon.json) show as "Coming soon" cards until they go live.
    // Once a product is published, the live catalog lists its handle and its Coming-soon card is dropped.
    const soon = await fetchJson(`${BASE}data/coming-soon.json`, 8000);
    if (soon?.products?.length) {
      const bySh = new Map(soon.products.map((p) => [p.shopify_handle, p.handle]));
      cat = { ...cat, products: (cat.products || []).map((p) => (bySh.has(p.handle) ? { ...p, site_handle: bySh.get(p.handle) } : p)) };
      const have = new Set(cat.products.map((p) => p.handle));
      const extra = soon.products.filter((p) => !have.has(p.shopify_handle || p.handle)).map((p) => ({
        title: p.title, handle: p.handle, site_handle: p.handle, url: null, coming_soon: true, rank: p.rank,
        image: `${window.__ASSET_BASE__ || BASE}images/products/${p.handle}-1.jpg`, image_alt: p.title,
        price: p.price, price_max: p.price, currency: "USD", blurb: p.blurb || "",
        product_type: p.category || "", tags: p.tags || [], collections: p.collections || [],
      }));
      cat = { ...cat, products: [...(cat.products || []), ...extra] };
    }
    window.__CATALOG_SOURCE__ = { source, liveOk: !!live?.ok, liveReason: live?.reason || null, count: cat.products?.length || 0 };
    return { ...EMPTY, ...cat };
  })();
  return catalogPromise;
}

export function money(amount, currency = "USD") {
  if (amount == null || amount === "") return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(amount));
}

const sized = (u, w) => (u ? u + (u.includes("?") ? "&" : "?") + "width=" + w : "");

export function productCard(p) {
  if (p.coming_soon) {
    return `<div class="product product-soon" aria-label="${esc(p.title)} — coming soon">
    <div class="ph"><span class="soon-badge">Coming soon</span><img src="${esc(p.image)}" alt="${esc(p.image_alt || p.title)}" loading="lazy" width="1000" height="1000"></div>
    <div class="pb"><span class="soon-pill">Coming soon</span><span class="ptype">${esc(p.product_type)}</span><h3>${esc(p.title)}</h3>${p.blurb ? `<p class="blurb">${esc(p.blurb)}</p>` : ""}<span class="price">${money(p.price, p.currency)}</span><span class="btn btn-sm soon-btn" aria-disabled="true">Coming soon</span></div>
  </div>`;
  }
  const price = p.price_max && Number(p.price_max) > Number(p.price) ? `From ${money(p.price, p.currency)}` : money(p.price, p.currency);
  return `<a class="product" href="${esc(p.url)}" rel="noopener">
    <div class="ph">${p.image ? `<img src="${esc(sized(p.image, 600))}" alt="${esc(p.image_alt || p.title)}" loading="lazy" width="600" height="600">` : ""}</div>
    <div class="pb"><h3>${esc(p.title)}</h3><span class="price">${price}</span><span class="cta">View product →</span></div>
  </a>`;
}

export function emptyState(title = "New products are on the way", text = "We're stocking the shelves right now. Browse the full store for the latest arrivals — every item here links straight to our secure Shopify checkout.") {
  return `<div class="empty-state">
    <div class="ico">${ICONS.bag}</div>
    <h3>${esc(title)}</h3>
    <p>${esc(text)}</p>
    <a class="btn btn-primary" href="${shopUrl()}" rel="noopener">Shop on our store ${ICONS.arrow.replace("<svg", '<svg width="18" height="18"')}</a>
  </div>`;
}

export function categoryTile(c, { inShop = false } = {}) {
  const [bg, ink, sub] = TILE[c.handle] || ["#f3f5f1", "#1f4a3d", "Shop the collection"];
  const href = inShop ? `shop.html?c=${encodeURIComponent(c.handle)}` : `shop.html?c=${encodeURIComponent(c.handle)}`;
  return `<a class="cat" href="${href}" style="--tile:${bg};--tile-ink:${ink}">
    <span class="cat-ico">${ICONS[c.handle] || ICONS.grid}</span>
    <span><strong>${esc(c.title)}</strong><small>${esc(sub)}</small></span>
    <span class="arrow">${ICONS.arrow.replace("<svg", '<svg width="18" height="18"')}</span>
  </a>`;
}

function wireShopLinks() {
  document.querySelectorAll("[data-shop-link]").forEach((a) => {
    const path = a.getAttribute("data-shop-link");
    a.href = shopUrl() + (path || "");
    a.rel = "noopener";
  });
  document.querySelectorAll("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });
}

// ---------- home ----------
async function initHome() {
  const cat = await loadCatalog();
  const cols = cat.collections?.length ? cat.collections : Object.keys(TILE).map((h) => ({ handle: h, title: h }));
  const catsEl = document.getElementById("home-cats");
  if (catsEl) catsEl.innerHTML = cols.slice(0, 8).map((c) => categoryTile(c)).join("");
  const grid = document.getElementById("home-products");
  if (grid) grid.innerHTML = cat.products.length ? cat.products.slice(0, 8).map(productCard).join("") : emptyState();
  const count = document.getElementById("stat-products");
  if (count) count.textContent = String(cat.products.length);

  // Desktop only: load the interactive floor plan. Mobile never downloads it.
  const mq = window.matchMedia("(min-width: 900px)");
  let loaded = false;
  const maybeLoad = () => {
    if (loaded || !mq.matches) return;
    loaded = true;
    import("./app.js?v=10").then((m) => m.startHouse(cat)).catch((e) => console.warn("house failed", e));
  };
  maybeLoad();
  mq.addEventListener?.("change", maybeLoad);
  if (!mq.matches) { window.__SCENE_READY__ = true; window.__SCENE_MODE__ = "mobile-none"; }
}

// ---------- shop ----------
async function initShop() {
  const cat = await loadCatalog();
  const params = new URLSearchParams(location.search);
  const state = { c: params.get("c") || "all", q: params.get("q") || "", sort: "featured" };
  const cols = cat.collections || [];
  const list = document.getElementById("filter-list");
  const chips = document.getElementById("chips");
  const grid = document.getElementById("shop-grid");
  const countEl = document.getElementById("result-count");
  const titleEl = document.getElementById("shop-title");
  const q = document.getElementById("shop-q");
  const sort = document.getElementById("shop-sort");
  q.value = state.q;

  const all = [{ handle: "all", title: "All products", count: cat.products.length }, ...cols];
  const countFor = (h) => (h === "all" ? cat.products.length : cat.products.filter((p) => p.collections.includes(h)).length);
  list.innerHTML = all.map((c) => `<button type="button" data-c="${c.handle}"><b style="font-weight:inherit">${esc(c.title)}</b><span>${countFor(c.handle)}</span></button>`).join("");
  chips.innerHTML = all.map((c) => `<button class="chip" type="button" data-c="${c.handle}">${esc(c.handle === "all" ? "All" : c.title)}</button>`).join("");

  const render = () => {
    document.querySelectorAll("[data-c]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.c === state.c)));
    const col = all.find((c) => c.handle === state.c) || all[0];
    titleEl.textContent = col.title;
    let items = cat.products.filter((p) => state.c === "all" || p.collections.includes(state.c));
    const needle = state.q.trim().toLowerCase();
    if (needle) items = items.filter((p) => `${p.title} ${p.product_type} ${(p.tags || []).join(" ")}`.toLowerCase().includes(needle));
    if (state.sort === "price-asc") items.sort((a, b) => a.price - b.price);
    if (state.sort === "price-desc") items.sort((a, b) => b.price - a.price);
    if (state.sort === "az") items.sort((a, b) => a.title.localeCompare(b.title));
    countEl.textContent = `${items.length} product${items.length === 1 ? "" : "s"}`;
    if (items.length) grid.innerHTML = items.map(productCard).join("");
    else if (!cat.products.length) grid.innerHTML = emptyState();
    else grid.innerHTML = emptyState("No matches here yet", "Try another category or search term — or browse everything in our store.");
    const url = new URL(location.href);
    state.c === "all" ? url.searchParams.delete("c") : url.searchParams.set("c", state.c);
    state.q ? url.searchParams.set("q", state.q) : url.searchParams.delete("q");
    history.replaceState(null, "", url);
  };
  document.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-c]");
    if (!b) return;
    state.c = b.dataset.c; render();
  });
  q.addEventListener("input", () => { state.q = q.value; render(); });
  sort.addEventListener("change", () => { state.sort = sort.value; render(); });
  render();
}

wireShopLinks();
const page = document.body.dataset.page;
if (page === "home") initHome();
if (page === "shop") initShop();
export { CONFIG, collectionUrl };
