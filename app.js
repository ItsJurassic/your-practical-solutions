// Interactive floor-plan controller. Loaded on demand by site.js (desktop only).
// Product lists are NOT hardcoded: each hotspot is mapped to category handles in
// data/navigator.json, and the current ACTIVE catalog (products.json / loadCatalog)
// is matched at runtime. data/navigator-index.json is the baked companion built
// whenever the catalog rebuilds, and is used to know which handles are ACTIVE.
import { initHouse } from "./house-plan.js?v=16";
import { productCard, emptyState, categoryHandlesFor } from "./site.js?v=20";
import { loadCategoryData, isCategoryVisible, findCategory, chicagoMonthDay } from "./categories.js?v=2";

const BASE = window.__ASSET_BASE__ || window.__SITE_BASE__ || "./";

async function fetchJson(url) {
  try {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function loadNavigator() {
  const [map, index] = await Promise.all([
    fetchJson(`${BASE}data/navigator.json`),
    fetchJson(`${BASE}data/navigator-index.json`),
  ]);
  return { map, index };
}

function activeHandleSet(index) {
  const set = new Set();
  for (const h of index?.all_active_handles || []) set.add(h);
  for (const hs of index?.hotspots || []) {
    for (const p of hs.products || []) if (p.handle) set.add(p.handle);
  }
  return set;
}

function isActiveProduct(p, activeHandles) {
  const status = String(p.shopify_status || p.status || "").toUpperCase();
  if (status === "DRAFT" || status === "ARCHIVED") return false;
  const handle = p.handle || "";
  const site = p.site_handle || "";
  const shopify = p.shopify_handle || "";
  if (activeHandles.size) {
    return activeHandles.has(handle) || activeHandles.has(site) || activeHandles.has(shopify);
  }
  // Fallback when the index has not loaded: hide ranked Top 10 coming-soon drafts.
  if (p.rank != null && p.coming_soon && !p.live) return false;
  return true;
}

function visibleHotspotCategories(hotspot, catData, monthDay) {
  const cats = [...(hotspot.categories || [])];
  for (const handle of hotspot.seasonal_categories || []) {
    const cat = findCategory(catData, handle);
    // A missing category entry is treated as visible so a stale map cannot drop coverage.
    const visible = cat ? isCategoryVisible(cat, monthDay) : true;
    if (visible && !cats.includes(handle)) cats.push(handle);
  }
  return cats;
}

function primaryGroup(p, allowed) {
  const handles = categoryHandlesFor(p);
  // Prefer the product's own type when it is one of the room's categories.
  const type = (p.product_type || p.productType || "").trim();
  const typeHandle = ({
    "Pet Supplies": "pet-supplies", Kitchen: "kitchen", "Women's Clothing": "womens-clothing",
    Christmas: "christmas", "Living Room": "living-room", "Men's Clothing": "mens-clothing",
    "Storage & Organization": "storage-organization", "Tech Accessories": "tech-accessories",
    Bathroom: "bathroom", "Outdoor & Camping": "outdoor-camping", "Car & RV": "car-rv",
    "Winter Essentials": "winter-essentials", Gardening: "gardening", "Home Decor": "home-decor",
    "Garage & Tools": "garage-tools",
  })[type];
  if (typeHandle && allowed.includes(typeHandle)) return typeHandle;
  return allowed.find((h) => handles.includes(h)) || allowed[0] || "";
}

export function matchProducts(products, hotspot, catData, monthDay, activeHandles) {
  if (!hotspot || !products?.length) return [];
  const allowed = visibleHotspotCategories(hotspot, catData, monthDay);
  const spotTag = hotspot.id ? `spot:${hotspot.id}` : null;
  const picked = products.filter((p) => {
    if (!isActiveProduct(p, activeHandles)) return false;
    const handles = categoryHandlesFor(p);
    if (allowed.some((h) => handles.includes(h))) return true;
    if (spotTag && (p.tags || []).some((t) => String(t).toLowerCase() === spotTag)) return true;
    return false;
  });
  return picked.sort((a, b) => {
    const ga = allowed.indexOf(primaryGroup(a, allowed));
    const gb = allowed.indexOf(primaryGroup(b, allowed));
    const ia = ga < 0 ? 99 : ga, ib = gb < 0 ? 99 : gb;
    if (ia !== ib) return ia - ib;
    return String(a.title || "").localeCompare(String(b.title || ""));
  });
}

function categoryName(catData, handle) {
  const c = findCategory(catData, handle);
  return (c && (c.name || c.title)) || handle;
}

function renderSheet(items, hotspot, catData, monthDay) {
  const allowed = visibleHotspotCategories(hotspot, catData, monthDay);
  if (!items.length) {
    if (hotspot.seasonal_only) {
      const seasonal = (hotspot.seasonal_categories || [])
        .map((h) => findCategory(catData, h))
        .filter(Boolean);
      const labels = seasonal.map((c) => {
        const win = c.show_window?.label || "";
        return win ? `${c.name} (${win})` : c.name;
      }).join(", ");
      return emptyState(
        "Back in season",
        labels
          ? `${hotspot.label} is shown during ${labels}. Browse the rest of the shop in the meantime.`
          : `This spot is seasonal. Browse the rest of the shop in the meantime.`,
      );
    }
    return emptyState(
      `More coming soon`,
      `We're still picking the right products for the ${String(hotspot.label || "this spot").toLowerCase()}. Browse the full store for everything available now.`,
    );
  }
  const groups = new Map();
  for (const p of items) {
    const g = primaryGroup(p, allowed) || "other";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(p);
  }
  const links = allowed.map((h) => {
    const n = (groups.get(h) || []).length;
    const name = categoryName(catData, h);
    return `<a class="spot-shop" href="shop.html?c=${encodeURIComponent(h)}">Shop ${name}${n ? ` (${n})` : ""} →</a>`;
  }).join("");
  const count = `<p class="spot-count">${items.length} product${items.length === 1 ? "" : "s"} for this spot</p>`;
  const body = [...groups.entries()].map(([handle, list]) => {
    const name = categoryName(catData, handle);
    const head = groups.size > 1
      ? `<div class="spot-group-head"><h4>${name}</h4><a href="shop.html?c=${encodeURIComponent(handle)}">See all in ${name} →</a></div>`
      : "";
    return `<section class="spot-group">${head}${list.map(productCard).join("")}</section>`;
  }).join("");
  return `${count}<div class="spot-links">${links}</div>${body}`;
}

function coverageSnapshot(products, map, catData, monthDay, activeHandles) {
  const active = (products || []).filter((p) => isActiveProduct(p, activeHandles));
  const byHotspot = {};
  const covered = new Set();
  for (const hs of map?.hotspots || []) {
    const items = matchProducts(active, hs, catData, monthDay, activeHandles);
    byHotspot[hs.id] = { count: items.length, handles: items.map((p) => p.handle || p.site_handle) };
    items.forEach((p) => covered.add(p.handle || p.site_handle));
  }
  const uncovered = active.map((p) => p.handle || p.site_handle).filter((h) => !covered.has(h));
  return {
    ready: true,
    activeCount: active.length,
    uncovered,
    byHotspot,
  };
}

export async function startHouse(catalog) {
  const $ = (id) => document.getElementById(id);
  const sheet = $("product-sheet"), hoverLabel = $("hover-label"), stage = $("house-stage");
  const backHouse = $("back-house"), resetBtn = $("peek-house"), hint = $("view-hint"), status = $("scene-status");
  const [nav, catData] = await Promise.all([loadNavigator(), loadCategoryData(BASE)]);
  const map = nav.map || { hotspots: [] };
  const byId = Object.fromEntries((map.hotspots || []).map((h) => [h.id, h]));
  const activeHandles = activeHandleSet(nav.index);
  const monthDay = chicagoMonthDay();
  window.__NAVIGATOR__ = coverageSnapshot(catalog.products, map, catData, monthDay, activeHandles);

  const openSheet = (hotspot, id) => {
    const meta = (hotspot && (hotspot.categories || hotspot.seasonal_categories))
      ? hotspot
      : (byId[id] || { id, label: (hotspot && hotspot.label) || id, categories: [], seasonal_categories: [] });
    const items = matchProducts(catalog.products, meta, catData, monthDay, activeHandles);
    $("sheet-title").textContent = meta.label || id;
    $("sheet-blurb").textContent = meta.blurb || "";
    $("sheet-body").innerHTML = renderSheet(items, meta, catData, monthDay);
    sheet.classList.add("open");
  };
  window.__openSpot = (id) => openSheet(byId[id] || { label: id, id }, id);
  $("close-sheet").onclick = () => sheet.classList.remove("open");
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") sheet.classList.remove("open"); });
  try {
    const api = await initHouse(stage, {
      onHover(hs) {
        if (!hs) { hoverLabel.style.display = "none"; return; }
        const meta = byId[hs.id];
        const n = window.__NAVIGATOR__?.byHotspot?.[hs.id]?.count;
        const label = (meta && meta.label) || hs.label || hs.id;
        hoverLabel.textContent = (n != null && n > 0) ? `${label} · ${n} product${n === 1 ? "" : "s"}` : label;
        hoverLabel.style.display = "block";
      },
      onSelect(hs) { if (hs) openSheet(byId[hs.id] || hs, hs.id); },
      onView(next) {
        backHouse.hidden = next !== "rv";
        hint.textContent = next === "rv" ? "Inside the RV" : "Live floor plan — click any room or piece of furniture";
      },
      onReady() {
        status?.remove();
        window.__SCENE_READY__ = true;
        window.__SCENE_MODE__ = "plan";
      },
    });
    resetBtn.onclick = () => (api.getView() === "rv" ? api.setView("house") : api.reset());
    backHouse.onclick = () => api.setView("house");
    document.addEventListener("pointermove", (e) => {
      if (hoverLabel.style.display === "block") { hoverLabel.style.left = e.clientX + "px"; hoverLabel.style.top = e.clientY + "px"; }
    });
    return api;
  } catch (err) {
    console.warn(err);
    if (status) status.textContent = "The floor plan could not load on this browser.";
    window.__SCENE_READY__ = true;
    window.__SCENE_MODE__ = "error";
  }
}
