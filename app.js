import { CONFIG, shopUrl, collectionUrl, productUrl } from "./config.js";
import { fetchCatalog, collectionsFallback, matchProducts } from "./shopify.js";
import { initHouse, HOTSPOT_META } from "./house-scene.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const shopLinks = document.querySelectorAll("#shop-cta, #shop-cta-2");
shopLinks.forEach((a) => { a.href = shopUrl(); });

const sheet = document.getElementById("product-sheet");
const sheetTitle = document.getElementById("sheet-title");
const sheetBlurb = document.getElementById("sheet-blurb");
const sheetBody = document.getElementById("sheet-body");
const hoverLabel = document.getElementById("hover-label");
const fallbackMap = document.getElementById("fallback-map");
const houseStage = document.getElementById("house-stage");
const toggle3d = document.getElementById("toggle-3d");
const backHouse = document.getElementById("back-house");
const viewHint = document.getElementById("view-hint");

let catalog = { products: [], collections: collectionsFallback() };
let houseApi = null;

function productCard(p) {
  const price = p.price != null && p.price !== "" ? `$${Number(p.price).toFixed(2)}` : "";
  return `<article class="card">
    ${p.image_url ? `<img src="${p.image_url}" alt="${escapeHtml(p.title)}" />` : ""}
    <div class="pad">
      <h3>${escapeHtml(p.title)}</h3>
      <p class="muted">${price}</p>
      <a class="btn btn-primary" href="${p.online_url || productUrl(p.handle)}">View on shop</a>
    </div>
  </article>`;
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function comingSoon(label, blurb) {
  return `<div class="empty"><strong>${escapeHtml(label)} — coming soon</strong><p>${escapeHtml(blurb || "We have not added products for this spot yet. Nothing here is filler inventory.")}</p><p><a href="${shopUrl()}">Browse the shop</a></p></div>`;
}

function openSheet(meta, products) {
  sheetTitle.textContent = meta.label;
  sheetBlurb.textContent = meta.blurb || "";
  if (!products.length) sheetBody.innerHTML = comingSoon(meta.label, meta.blurb);
  else sheetBody.innerHTML = products.map(productCard).join("");
  sheet.classList.add("open");
}

document.getElementById("close-sheet").onclick = () => sheet.classList.remove("open");

function renderCollections() {
  const extra = [
    { title: "Yard & garden", handle: null, note: "coming soon" },
  ];
  const html = catalog.collections.filter((c) => c.handle !== "frontpage").map((c) =>
    `<a class="cat" href="${collectionUrl(c.handle)}"><strong>${escapeHtml(c.title)}</strong><p class="muted">Shop this collection</p></a>`
  ).join("");
  document.getElementById("collection-grid").innerHTML = html;
}

function renderProducts() {
  const el = document.getElementById("product-grid");
  if (!catalog.products.length) {
    el.innerHTML = comingSoon("The shelves are still being stocked", "As soon as products are published in Shopify, they will appear here and inside the house.");
    return;
  }
  el.innerHTML = catalog.products.map(productCard).join("");
}

function webglOk() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

function showFallback(on) {
  fallbackMap.classList.toggle("show", on);
  houseStage.style.display = on ? "none" : "block";
  toggle3d.textContent = on ? "Open 3D house" : "Use simple map";
}

function buildFallback() {
  fallbackMap.innerHTML = Object.entries(HOTSPOT_META).filter(([id]) => id !== "rv").map(([id, meta]) =>
    `<button class="hot" data-id="${id}">${escapeHtml(meta.label)}</button>`
  ).join("") + `<button class="hot" data-id="rv">Step inside the RV</button>`;
  fallbackMap.onclick = (e) => {
    const id = e.target.dataset?.id;
    if (!id) return;
    const meta = HOTSPOT_META[id];
    if (id === "rv" && houseApi && !fallbackMap.classList.contains("forced")) {
      houseApi.setView("rv");
      backHouse.hidden = false;
      viewHint.textContent = "RV interior";
    }
    if (meta) openSheet(meta, matchProducts(catalog.products, meta));
  };
}

const preferFallback = window.matchMedia("(max-width: 700px), (prefers-reduced-motion: reduce)").matches;

async function startHouse() {
  buildFallback();
  if (!webglOk() || preferFallback) {
    showFallback(true);
    return;
  }
  try {
    houseApi = await initHouse(houseStage, {
      onHover(hs) {
        hoverLabel.style.display = hs ? "block" : "none";
        hoverLabel.textContent = hs?.label || "";
      },
      onSelect(hs) {
        if (!hs) return;
        if (hs.id === "rv") {
          backHouse.hidden = false;
          viewHint.textContent = "RV interior";
        }
        const meta = HOTSPOT_META[hs.id] || hs;
        openSheet(meta, matchProducts(catalog.products, meta));
      },
      onReady() { window.__SCENE_READY__ = true; },
    });
    document.addEventListener("pointermove", (e) => {
      hoverLabel.style.left = e.clientX + "px";
      hoverLabel.style.top = e.clientY + "px";
    });
  } catch (err) {
    console.warn(err);
    showFallback(true);
  }
}

toggle3d.onclick = () => {
  const on = !fallbackMap.classList.contains("show");
  showFallback(on);
  if (!on && !houseApi) startHouse();
};
backHouse.onclick = () => {
  houseApi?.setView("house");
  backHouse.hidden = true;
  viewHint.textContent = "Isometric house";
};

async function loadPublicStats() {
  const box = document.getElementById("public-stats");
  try {
    const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
    const { data } = await supabase.from("kpi_public_stats").select("*").limit(1).maybeSingle();
    const shipped = data?.orders_shipped ?? 0;
    const customers = data?.happy_customers ?? 0;
    const days = data?.avg_delivery_days;
    box.innerHTML = `
      <div class="stat"><b>${shipped}</b><span>Orders shipped</span></div>
      <div class="stat"><b>${customers}</b><span>Customers</span></div>
      <div class="stat"><b>${days != null ? days + " days" : "5–12 days"}</b><span>${days != null ? "Average delivery" : "Typical delivery window"}</span></div>
      <div class="stat"><b>${data?.products_offered ?? catalog.products.length}</b><span>Products offered</span></div>`;
    if (!shipped) {
      box.insertAdjacentHTML("afterend", `<p class="empty">We are just getting started — these figures will fill in from real orders, never sample data.</p>`);
    }
  } catch {
    box.innerHTML = `<div class="stat"><b>5–12 days</b><span>Typical delivery window</span></div>`;
  }
}

catalog = await fetchCatalog();
if (!catalog.products.length) {
  try {
    const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
    const { data } = await supabase.from("kpi_public_products").select("*");
    if (data?.length) catalog.products = data;
    const { data: cols } = await supabase.from("kpi_public_collections").select("*");
    if (cols?.length) catalog.collections = cols;
  } catch {}
}
renderCollections();
renderProducts();
await startHouse();
await loadPublicStats();
