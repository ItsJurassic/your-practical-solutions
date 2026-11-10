import { CONFIG, shopUrl, collectionUrl } from "./config.js";
import { loadCategoryData, visibleEntries, findCategory, isCategoryVisible } from "./categories.js";

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
  "living-room": svg('<path d="M4 13h16v7H4z"/><path d="M6 13V9h12v4M8 20v2M16 20v2"/>'),
  "kitchen": svg('<path d="M5 3v8a3 3 0 0 0 6 0V3M8 3v18"/><path d="M16 3v18M15 8h4v5a2 2 0 0 1-4 0z"/>'),
  "mens-clothing": svg('<path d="M9 4 12 6l3-2 3 3-3 2v11H9V9L6 7z"/>'),
  "womens-clothing": svg('<path d="M12 3v4M9 7h6l3 14H6L9 7z"/>'),
  "winter-essentials": svg('<path d="M12 2v20M4 12h16M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5"/>'),
  "gardening": svg('<path d="M12 21V11M8 21h8"/><path d="M12 11c-4-1-6-5-4-8 4 1 6 5 4 8zM12 11c4-1 6-5 4-8-4 1-6 5-4 8z"/>'),
  "bathroom": svg('<path d="M5 12h14v2a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5z"/><path d="M7 12V6a2 2 0 0 1 2-2h0"/>'),
  "outdoor-camping": svg('<path d="M3 20h18M12 4l9 16H3z"/><path d="M12 4v16"/>'),
  "christmas": svg('<path d="M12 2 7 9h3L6 14h3L5 20h14l-4-6h3l-4-5h3z"/>'),
  "halloween": svg('<path d="M12 4c4 0 7 4 7 8s-3 8-7 8-7-4-7-8 3-8 7-8z"/><path d="M9 13c.5 1 1.5 1.5 3 1.5s2.5-.5 3-1.5M9 10h.01M15 10h.01"/>'),
  "valentines-day": svg('<path d="M12 19S4 13 4 8.5A4 4 0 0 1 12 7a4 4 0 0 1 8 1.5C20 13 12 19 12 19z"/>'),
  "new-years": svg('<path d="M12 2v6M12 16v6M4 12h6M14 12h6M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3"/>'),
  "4th-of-july": svg('<path d="M12 3 14 8l5 .7-3.8 3.6.9 5.2L12 15.2 7.9 17.5l.9-5.2L5 8.7 10 8z"/>'),

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

function uniqueHandles(...lists) {
  const out = [];
  const seen = new Set();
  for (const list of lists) {
    for (const h of list || []) {
      if (h && !seen.has(h)) { seen.add(h); out.push(h); }
    }
  }
  return out;
}

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
    // DRAFT products can also come from yps-products with coming_soon.
    // Sanitized public catalog (no supplier cost/source) supplies local pages, approved prices,
    // blurbs, collections, and rank. coming-soon.json is build input only.
    // An ACTIVE product with the same handle drops the Coming soon card once live is flipped.
    const soon = await fetchJson(`${BASE}data/catalog-public.json`, 8000);
    const locals = soon?.products || [];
    if (locals.length || (cat.products || []).some((p) => p.coming_soon)) {
      const bySh = new Map(locals.map((p) => [p.shopify_handle, p]));
      const asset = window.__ASSET_BASE__ || BASE;
      const localImage = (p) => `${asset}images/products/${p.handle}-1.jpg?v=20261110`;
      const pageUrl = (p) => p.page_url || `products/${p.handle}/`;
      const products = (cat.products || []).map((p) => {
        const local = bySh.get(p.handle);
        if (!local && !p.coming_soon) return p;
        const live = !!(local && local.live);
        const coming = !live && (p.coming_soon || !!local);
        // Until Buy Now is on, prefer the approved site price over a stale Shopify draft price.
        const price = (!live && local?.price != null) ? local.price : (p.price ?? local?.price);
        return {
          ...p,
          url: local ? pageUrl(local) : (coming ? null : p.url),
          coming_soon: coming,
          live,
          title: p.title || local?.title,
          price,
          price_max: (!live && local?.price != null) ? local.price : (p.price_max ?? price),
          image: (local ? localImage(local) : "") || p.image || "",
          image_alt: p.image_alt || p.title || local?.title,
          site_handle: local?.handle || p.handle,
          rank: local?.rank ?? p.rank,
          blurb: local?.blurb || p.blurb || "",
          product_type: p.product_type || local?.category || "",
          tags: p.tags?.length ? p.tags : (local?.tags || []),
          collections: uniqueHandles(local?.collections, p.collections),
        };
      });
      const have = new Set(products.map((p) => p.handle));
      const fallback = locals.filter((p) => !have.has(p.shopify_handle || p.handle)).map((p) => ({
        title: p.title, handle: p.handle, site_handle: p.handle,
        url: pageUrl(p), coming_soon: !p.live, live: !!p.live, rank: p.rank,
        image: localImage(p), image_alt: p.title,
        price: p.price, price_max: p.price, currency: "USD", blurb: p.blurb || "",
        product_type: p.category || "", tags: p.tags || [], collections: p.collections || [],
      }));
      const active = products.filter((p) => !p.coming_soon);
      const drafts = [...products.filter((p) => p.coming_soon), ...fallback]
        .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
      cat = { ...cat, products: [...active, ...drafts] };
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

export function siteProductUrl(p) {
  const h = p.site_handle || (p.url && String(p.url).startsWith("products/") ? null : p.handle);
  if (p.url && !/^https?:/i.test(p.url)) return p.url;
  if (p.site_handle || p.coming_soon || p.page_url) return p.page_url || `products/${p.site_handle || p.handle}/`;
  if (h && !p.url) return `products/${h}/`;
  return p.url || `products/${p.handle}/`;
}

export function productCard(p) {
  const href = siteProductUrl(p);
  const external = /^https?:/i.test(href);
  const soon = !!p.coming_soon && !p.live;
  const price = p.price_max && Number(p.price_max) > Number(p.price) ? `From ${money(p.price, p.currency)}` : money(p.price, p.currency);
  const imgSrc = p.image ? (p.image.startsWith("http") ? sized(p.image, 600) : p.image) : "";
  const badge = soon ? `<span class="soon-badge">Coming soon</span>` : "";
  const pill = soon ? `<span class="soon-pill">Coming soon</span>` : "";
  const ptype = p.product_type ? `<span class="ptype">${esc(p.product_type)}</span>` : "";
  const blurb = p.blurb ? `<p class="blurb">${esc(p.blurb)}</p>` : "";
  return `<a class="product${soon ? " product-soon" : ""}" href="${esc(href)}"${external ? ' rel="noopener"' : ""}>
    <div class="ph">${badge}${imgSrc ? `<img src="${esc(imgSrc)}" alt="${esc(p.image_alt || p.title)}" loading="lazy" width="1000" height="1000">` : ""}</div>
    <div class="pb">${pill}${ptype}<h3>${esc(p.title)}</h3>${blurb}<span class="price">${price}</span><span class="cta">View product →</span></div>
  </a>`;
}

export function emptyState(title = "New products coming soon", text = "We're stocking this collection now. Check back shortly, or browse the rest of the shop.", { href = "shop.html", label = "Browse all products", external = false } = {}) {
  return `<div class="empty-state">
    <div class="ico">${ICONS.bag}</div>
    <h3>${esc(title)}</h3>
    <p>${esc(text)}</p>
    <a class="btn btn-primary" href="${esc(href)}"${external ? ' rel="noopener"' : ""}>${esc(label)} ${ICONS.arrow.replace("<svg", '<svg width="18" height="18"')}</a>
  </div>`;
}

export function categoryTile(c, { inShop = false } = {}) {
  const fallback = TILE[c.handle] || ["#f3f5f1", "#1f4a3d", "Shop the collection"];
  const bg = c.tile || fallback[0];
  const ink = c.ink || fallback[1];
  const sub = c.blurb || fallback[2];
  const title = c.name || c.title || c.handle;
  const href = `shop.html?c=${encodeURIComponent(c.handle)}`;
  return `<a class="cat" href="${href}" style="--tile:${bg};--tile-ink:${ink}">
    <span class="cat-ico">${ICONS[c.handle] || ICONS.grid}</span>
    <span><strong>${esc(title)}</strong><small>${esc(sub)}</small></span>
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
  const [cat, catData] = await Promise.all([loadCatalog(), loadCategoryData(BASE)]);
  const cols = visibleEntries(catData);
  const catsEl = document.getElementById("home-cats");
  if (catsEl) catsEl.innerHTML = cols.map((c) => categoryTile(c)).join("");
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
    import("./app.js?v=14").then((m) => m.startHouse(cat)).catch((e) => console.warn("house failed", e));
  };
  maybeLoad();
  mq.addEventListener?.("change", maybeLoad);
  if (!mq.matches) { window.__SCENE_READY__ = true; window.__SCENE_MODE__ = "mobile-none"; }
}

// ---------- shop ----------
async function initShop() {
  const [cat, catData] = await Promise.all([loadCatalog(), loadCategoryData(BASE)]);
  const params = new URLSearchParams(location.search);
  const state = {
    c: params.get("c") || "all",
    q: params.get("q") || "",
    sort: params.get("sort") || "featured",
    min: params.get("min") || "",
    max: params.get("max") || "",
    ship: params.get("ship") || "",
  };
  const visible = visibleEntries(catData);
  const requested = state.c !== "all" ? findCategory(catData, state.c) : null;
  // Direct links to an out-of-season category still work; it stays out of the regular filter list.
  const cols = visible.slice();
  if (requested && !cols.some((c) => c.handle === requested.handle)) cols.push(requested);
  const list = document.getElementById("filter-list");
  const chips = document.getElementById("chips");
  const grid = document.getElementById("shop-grid");
  const countEl = document.getElementById("result-count");
  const titleEl = document.getElementById("shop-title");
  const q = document.getElementById("shop-q");
  const sort = document.getElementById("shop-sort");
  const minEl = document.getElementById("price-min");
  const maxEl = document.getElementById("price-max");
  const shipEl = document.getElementById("ship-fast");
  if (q) q.value = state.q;
  if (sort) sort.value = ["featured", "price-asc", "price-desc", "newest", "az"].includes(state.sort) ? state.sort : "featured";
  if (minEl) minEl.value = state.min;
  if (maxEl) maxEl.value = state.max;
  if (shipEl) shipEl.checked = state.ship === "fast";

  const all = [{ handle: "all", name: "All products" }, ...cols];
  const countFor = (h) => (h === "all" ? cat.products.length : cat.products.filter((p) => (p.collections || []).includes(h)).length);
  const labelOf = (c) => c.name || c.title || (c.handle === "all" ? "All products" : c.handle);
  if (list) list.innerHTML = all.map((c) => `<button type="button" data-c="${c.handle}"><b style="font-weight:inherit">${esc(labelOf(c))}</b><span>${countFor(c.handle)}</span></button>`).join("");
  if (chips) chips.innerHTML = all.map((c) => `<button class="chip" type="button" data-c="${c.handle}">${esc(c.handle === "all" ? "All" : labelOf(c))}</button>`).join("");

  const inCategory = (p, handle) => handle === "all" || (p.collections || []).includes(handle);
  const shipsFast = (p) => !!(p.ships_fast || /3\s*[–-]\s*5/.test(p.shipping || p.blurb || ""));

  const render = () => {
    document.querySelectorAll("[data-c]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.c === state.c)));
    const col = all.find((c) => c.handle === state.c) || all[0];
    if (titleEl) titleEl.textContent = labelOf(col);
    let items = cat.products.filter((p) => inCategory(p, state.c));
    const inCatCount = items.length;
    const needle = state.q.trim().toLowerCase();
    if (needle) items = items.filter((p) => `${p.title} ${p.product_type} ${(p.tags || []).join(" ")}`.toLowerCase().includes(needle));
    const min = state.min === "" ? null : Number(state.min);
    const max = state.max === "" ? null : Number(state.max);
    if (min != null && !Number.isNaN(min)) items = items.filter((p) => Number(p.price) >= min);
    if (max != null && !Number.isNaN(max)) items = items.filter((p) => Number(p.price) <= max);
    if (state.ship === "fast") items = items.filter(shipsFast);
    if (state.sort === "price-asc") items.sort((a, b) => a.price - b.price);
    else if (state.sort === "price-desc") items.sort((a, b) => b.price - a.price);
    else if (state.sort === "az") items.sort((a, b) => a.title.localeCompare(b.title));
    else if (state.sort === "newest") items.sort((a, b) => (b.listed_at || "").localeCompare(a.listed_at || "") || (b.rank ?? 0) - (a.rank ?? 0));
    else items.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
    if (countEl) countEl.textContent = `${items.length} product${items.length === 1 ? "" : "s"}`;
    if (items.length) grid.innerHTML = items.map(productCard).join("");
    else if (!cat.products.length) grid.innerHTML = emptyState();
    else if (state.c !== "all" && inCatCount === 0 && !needle && state.ship !== "fast" && min == null && max == null) {
      grid.innerHTML = emptyState("New products coming soon", "We're stocking this collection now. Check back shortly, or browse the rest of the shop.");
    } else {
      grid.innerHTML = emptyState("No matches here yet", "Try another category, a wider price range, or a different search term.");
    }
    const url = new URL(location.href);
    const setOrDel = (k, v) => (v ? url.searchParams.set(k, v) : url.searchParams.delete(k));
    state.c === "all" ? url.searchParams.delete("c") : url.searchParams.set("c", state.c);
    setOrDel("q", state.q.trim());
    state.sort && state.sort !== "featured" ? url.searchParams.set("sort", state.sort) : url.searchParams.delete("sort");
    setOrDel("min", state.min);
    setOrDel("max", state.max);
    state.ship === "fast" ? url.searchParams.set("ship", "fast") : url.searchParams.delete("ship");
    history.replaceState(null, "", url);
  };

  const drawer = document.getElementById("shop-filters");
  const backdrop = document.getElementById("filter-backdrop");
  const openBtn = document.getElementById("filter-open");
  const closeBtn = document.getElementById("filter-close");
  const setOpen = (on) => {
    drawer?.classList.toggle("is-open", on);
    backdrop?.classList.toggle("is-open", on);
    if (backdrop) backdrop.hidden = !on;
    if (openBtn) openBtn.setAttribute("aria-expanded", String(on));
    if (on) closeBtn?.focus();
  };
  openBtn?.addEventListener("click", () => setOpen(true));
  closeBtn?.addEventListener("click", () => setOpen(false));
  backdrop?.addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });

  document.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-c]");
    if (!b) return;
    state.c = b.dataset.c; render();
  });
  q?.addEventListener("input", () => { state.q = q.value; render(); });
  sort?.addEventListener("change", () => { state.sort = sort.value; render(); });
  const onPrice = () => { state.min = minEl?.value || ""; state.max = maxEl?.value || ""; render(); };
  minEl?.addEventListener("input", onPrice);
  maxEl?.addEventListener("input", onPrice);
  shipEl?.addEventListener("change", () => { state.ship = shipEl.checked ? "fast" : ""; render(); });
  render();
}

async function initCategory() {
  const handle = document.body.dataset.category;
  const grid = document.getElementById("category-grid");
  if (!handle || !grid) return;
  const [cat, catData] = await Promise.all([loadCatalog(), loadCategoryData(BASE)]);
  const items = cat.products.filter((p) => (p.collections || []).includes(handle));
  if (items.length) grid.innerHTML = items.map(productCard).join("");
  else grid.innerHTML = emptyState("New products coming soon", "We're stocking this collection now. Check back shortly, or browse the rest of the shop.");
  const info = findCategory(catData, handle);
  if (info && info.kind === "seasonal" && !isCategoryVisible(info)) {
    const note = document.createElement("p");
    note.className = "muted";
    note.style.margin = "0 0 16px";
    note.textContent = "This seasonal collection is listed here year-round, but it is hidden from the main menu outside its dates.";
    grid.before(note);
  }
}


function initProduct() {
  const main = document.getElementById("pdp-main");
  const thumbs = document.querySelectorAll(".pdp-thumb");
  if (!main || !thumbs.length) return;
  thumbs.forEach((btn) => {
    btn.addEventListener("click", () => {
      const src = btn.getAttribute("data-src");
      if (!src) return;
      main.src = src;
      thumbs.forEach((b) => {
        const on = b === btn;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", String(on));
      });
    });
  });
}

wireShopLinks();
const page = document.body.dataset.page;
if (page === "home") initHome();
if (page === "shop") initShop();
if (page === "category") initCategory();
if (page === "product") initProduct();
export { CONFIG, collectionUrl };
