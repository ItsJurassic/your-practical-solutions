import { CONFIG, shopUrl, collectionUrl, productUrl } from "./config.js";
import { fetchCatalog, collectionsFallback, matchProducts } from "./shopify.js";
import { initHouse } from "./house-scene.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const HOTSPOT_META = {
  bed: { label: "Bed", collections: ["home-decor"], tags: ["bedding", "bedroom", "bed"], blurb: "Bedding, frames, and bedroom comfort." },
  wardrobe: { label: "Wardrobe", collections: ["storage-organization"], tags: ["wardrobe", "closet", "storage"], blurb: "Closet storage and organizers." },
  "dresser-his": { label: "His dresser", collections: [], tags: ["men", "mens", "men's"], types: ["clothing"], blurb: "Men's clothing and dresser essentials." },
  "dresser-hers": { label: "Her dresser", collections: [], tags: ["women", "womens", "women's"], types: ["clothing"], blurb: "Women's clothing and dresser essentials." },
  nightstand: { label: "Bedside table", collections: ["storage-organization", "home-decor"], tags: ["bedroom", "nightstand"], blurb: "Bedside storage and lamps." },
  sofa: { label: "Living room sofa", collections: ["home-decor"], tags: ["living", "sofa", "cushion"], blurb: "Living-room comfort and decor." },
  rug: { label: "Living room rug", collections: ["home-decor"], tags: ["carpet", "rug"], blurb: "Carpets and area rugs." },
  curtains: { label: "Curtains", collections: ["home-decor"], tags: ["curtain", "drape"], blurb: "Curtains and window treatments." },
  media: { label: "Media console", collections: ["tech-accessories"], tags: ["speaker", "charger", "tv"], blurb: "Speakers, chargers, and media accessories." },
  "kitchen-sink": { label: "Kitchen sink", collections: ["home-decor"], tags: ["kitchen", "sink", "scrub", "cleaning"], blurb: "Sink care, scrub brushes, and kitchen cleaning." },
  kitchen: { label: "Kitchen", collections: ["home-decor", "storage-organization"], tags: ["kitchen"], blurb: "Kitchen tools, storage, and housewares." },
  "garage-workstation": { label: "Garage workstation", collections: ["garage-tools"], tags: ["tool", "workbench"], blurb: "Tools and garage work gear." },
  yard: { label: "Yard & garden", collections: [], tags: ["yard", "garden", "outdoor", "lawn"], blurb: "Yard work and outdoor upkeep." },
  garden: { label: "Garden bed", collections: [], tags: ["yard", "garden", "outdoor", "hose"], blurb: "Garden and yard-care tools." },
  car: { label: "Car", collections: ["car-rv", "tech-accessories"], tags: ["car", "charger"], blurb: "Car organizers, chargers, and travel gear." },
  rv: { label: "RV", collections: ["car-rv"], tags: ["rv", "camper"], blurb: "RV living and travel gear.", zoom: "rv" },
  "rv-bed": { label: "RV bed", collections: ["car-rv", "home-decor"], tags: ["bedding", "rv"], blurb: "RV bedding and sleep comfort." },
  "rv-bathroom": { label: "RV bathroom", collections: ["car-rv", "home-decor"], tags: ["bathroom", "shower", "rv"], blurb: "Compact bathroom and shower care." },
  "rv-dinette": { label: "RV dinette", collections: ["car-rv", "home-decor"], tags: ["dining", "rv"], blurb: "Dinette comfort and compact living." },
  "rv-kitchen": { label: "RV kitchenette", collections: ["car-rv"], tags: ["kitchen", "rv"], blurb: "Compact kitchen and sink-care gear." },
  "rv-storage": { label: "RV storage", collections: ["storage-organization", "car-rv"], tags: ["storage", "rv"], blurb: "Space-saving storage for the road." },
  "rv-cab": { label: "RV cabin", collections: ["tech-accessories", "car-rv"], tags: ["charger", "speaker"], blurb: "Chargers, speakers, and travel tech." },
};

// Percent boxes measured from a 10% grid overlay on the source renders.
const HOUSE_SPOTS = [
  { id: "rug", left: 34, top: 54, width: 20, height: 18 },
  { id: "bed", left: 22, top: 25.5, width: 13, height: 16 },
  { id: "wardrobe", left: 34, top: 17, width: 7.5, height: 20 },
  { id: "nightstand", left: 19, top: 29.5, width: 5, height: 9 },
  { id: "dresser-his", left: 15.8, top: 34.5, width: 5.2, height: 10 },
  { id: "dresser-hers", left: 38.5, top: 26, width: 7, height: 12 },
  { id: "kitchen", left: 51, top: 25, width: 11, height: 13 },
  { id: "kitchen-sink", left: 57, top: 16, width: 11, height: 14 },
  { id: "garage-workstation", left: 67.5, top: 21, width: 13, height: 17 },
  { id: "media", left: 31, top: 45, width: 12, height: 11 },
  { id: "sofa", left: 37, top: 52, width: 14, height: 14 },
  { id: "curtains", left: 50, top: 38, width: 9, height: 16 },
  { id: "yard", left: 19, top: 64, width: 11, height: 13 },
  { id: "garden", left: 48, top: 75, width: 16, height: 14 },
  { id: "car", left: 71.5, top: 55.5, width: 12, height: 16 },
  { id: "rv", left: 82.5, top: 50, width: 15.5, height: 33 },
];

const RV_SPOTS = [
  { id: "rv-bed", left: 33, top: 8, width: 34, height: 20 },
  { id: "rv-storage", left: 24, top: 7, width: 12, height: 16 },
  { id: "rv-storage", left: 66, top: 8, width: 11, height: 16 },
  { id: "rv-bathroom", left: 25, top: 22, width: 20, height: 20 },
  { id: "rv-kitchen", left: 57, top: 32, width: 20, height: 36 },
  { id: "rv-dinette", left: 24, top: 42, width: 30, height: 26 },
  { id: "rv-cab", left: 24, top: 71, width: 52, height: 20 },
];

const shopLinks = document.querySelectorAll("#shop-cta, #shop-cta-2");
shopLinks.forEach((a) => { a.href = shopUrl(); });

const sheet = document.getElementById("product-sheet");
const sheetTitle = document.getElementById("sheet-title");
const sheetBlurb = document.getElementById("sheet-blurb");
const sheetBody = document.getElementById("sheet-body");
const hoverLabel = document.getElementById("hover-label");
const houseStage = document.getElementById("house-stage");
const rvStage = document.getElementById("rv-stage");
const houseFrame = document.getElementById("house-frame");
const rvFrame = document.getElementById("rv-frame");
const houseHero = document.getElementById("house-hero");
const backHouse = document.getElementById("back-house");
const viewHint = document.getElementById("view-hint");

let catalog = { products: [], collections: collectionsFallback() };
let view = "house";
let houseApi = null;
const sceneStatus = document.getElementById("scene-status");
const imageFallback = document.getElementById("image-fallback");

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

function placeHotspots(frame, spots) {
  frame.querySelectorAll(".hotspot").forEach((el) => el.remove());
  for (const spot of spots) {
    const meta = HOTSPOT_META[spot.id];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "hotspot";
    btn.dataset.id = spot.id;
    btn.style.left = spot.left + "%";
    btn.style.top = spot.top + "%";
    btn.style.width = spot.width + "%";
    btn.style.height = spot.height + "%";
    btn.setAttribute("aria-label", meta?.label || spot.id);
    btn.addEventListener("pointerenter", (e) => showTip(meta?.label || spot.id, e));
    btn.addEventListener("pointermove", (e) => showTip(meta?.label || spot.id, e));
    btn.addEventListener("pointerleave", hideTip);
    btn.addEventListener("focus", (e) => {
      const r = btn.getBoundingClientRect();
      showTip(meta?.label || spot.id, { clientX: r.left + r.width / 2, clientY: r.top });
    });
    btn.addEventListener("blur", hideTip);
    btn.addEventListener("click", () => onSpotClick(spot.id));
    frame.appendChild(btn);
  }
}

function showTip(text, e) {
  hoverLabel.textContent = text;
  hoverLabel.style.display = "block";
  hoverLabel.style.left = e.clientX + "px";
  hoverLabel.style.top = e.clientY + "px";
}

function hideTip() {
  hoverLabel.style.display = "none";
}

function onSpotClick(id) {
  if (id === "rv") {
    showRv();
    return;
  }
  const meta = HOTSPOT_META[id];
  if (meta) openSheet(meta, matchProducts(catalog.products, meta));
}

function showRv() {
  view = "rv";
  hideTip();
  rvStage.hidden = false;
  backHouse.hidden = false;
  viewHint.textContent = "Inside the RV";
  requestAnimationFrame(() => houseHero.classList.add("is-rv"));
}

function showHouse() {
  view = "house";
  hideTip();
  houseHero.classList.remove("is-rv");
  viewHint.textContent = "Click around the house";
  backHouse.hidden = true;
  window.setTimeout(() => {
    if (view === "house") rvStage.hidden = true;
  }, 450);
}

backHouse.onclick = () => {
  if (houseApi) {
    houseApi.setView("house");
    backHouse.hidden = true;
    viewHint.textContent = "Explore the 3D house";
    view = "house";
    return;
  }
  showHouse();
};

function webglOk() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

function showImageFallback(reason) {
  console.warn("3D house unavailable, using image hotspots:", reason || "WebGL missing");
  if (sceneStatus) sceneStatus.textContent = "Showing a still house — 3D is not available on this device.";
  if (imageFallback) imageFallback.hidden = false;
  if (houseStage) houseStage.style.display = "none";
  placeHotspots(houseFrame, HOUSE_SPOTS);
  placeHotspots(rvFrame, RV_SPOTS);
  window.__SCENE_READY__ = true;
  window.__SCENE_MODE__ = "fallback";
}

async function startHouse() {
  if (!webglOk()) {
    showImageFallback("no-webgl");
    return;
  }
  try {
    houseApi = await initHouse(houseStage, {
      onHover(hs) {
        if (!hs) {
          hideTip();
          return;
        }
        hoverLabel.textContent = hs.label || hs.id;
        hoverLabel.style.display = "block";
      },
      onSelect(hs) {
        if (!hs) return;
        const meta = HOTSPOT_META[hs.id] || hs;
        openSheet(meta, matchProducts(catalog.products, meta));
      },
      onView(next) {
        view = next;
        if (next === "rv") {
          backHouse.hidden = false;
          viewHint.textContent = "Inside the RV";
        } else {
          backHouse.hidden = true;
          viewHint.textContent = "Explore the 3D house";
        }
      },
      onReady() {
        if (sceneStatus) sceneStatus.remove();
        window.__SCENE_READY__ = true;
        window.__SCENE_MODE__ = "3d";
      },
    });
    document.addEventListener("pointermove", (e) => {
      if (hoverLabel.style.display === "block") {
        hoverLabel.style.left = e.clientX + "px";
        hoverLabel.style.top = e.clientY + "px";
      }
    });
  } catch (err) {
    console.warn(err);
    showImageFallback(err && err.message);
  }
}

function renderCollections() {
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
await Promise.all([loadPublicStats(), startHouse()]);
if (!window.__SCENE_READY__) window.__SCENE_READY__ = true;
