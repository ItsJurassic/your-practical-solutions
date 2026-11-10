// Desktop-only interactive floor plan controller. Loaded on demand by site.js.
import { initHouse } from "./house-plan.js?v=13";
import { productCard, emptyState } from "./site.js?v=14";

// Each spot lists the exact products it shows (site handles from data/coming-soon.json; published
// Shopify products keep the same site handle). Future products can also opt in with a Shopify tag
// "spot:<id>" (e.g. spot:kitchen). No broad collection matching, so a spot never shows unrelated items.
const P = {
  cleaner: "interior-windshield-cleaner", pickup: "led-magnetic-pickup-tool", snowBrush: "extendable-snow-brush-ice-scraper",
  snowCover: "windshield-snow-cover", lickMat: "silicone-lick-mat", basin: "collapsible-camping-basin",
  rugGrip: "rug-corner-grippers", workLight: "magnetic-cob-work-light", faucet: "outdoor-faucet-covers-2-pack",
};
export const HOTSPOT_META = {
  bed: { label: "Bed", products: [], blurb: "Bedding, frames, and bedroom comfort." },
  wardrobe: { label: "Wardrobe", products: [], blurb: "Closet storage and organizers." },
  "dresser-his": { label: "His dresser", products: [], blurb: "Men's clothing and dresser essentials." },
  "dresser-hers": { label: "Her dresser", products: [], blurb: "Women's clothing and dresser essentials." },
  nightstand: { label: "Bedside table", products: [], blurb: "Bedside storage and lamps." },
  sofa: { label: "Living room sofa", products: [P.rugGrip], blurb: "Living-room comfort." },
  rug: { label: "Living room rug", products: [P.rugGrip], blurb: "Keep area rugs flat and in place." },
  curtains: { label: "Curtains & windows", products: [], blurb: "Window treatments." },
  media: { label: "Media console", products: [], blurb: "Speakers, chargers, and media accessories." },
  "kitchen-sink": { label: "Kitchen sink", products: [P.basin], blurb: "Dish washing." },
  kitchen: { label: "Kitchen", products: [P.basin, P.lickMat], blurb: "Housewares and pet feeding." },
  "garage-storage": { label: "Garage storage", products: [P.snowBrush, P.cleaner, P.workLight, P.pickup], blurb: "Car-care and winter gear for the garage." },
  "garage-workstation": { label: "Garage workstation", products: [P.pickup, P.workLight], blurb: "Tools and garage work gear." },
  yard: { label: "Yard & outdoor faucets", products: [P.faucet], blurb: "Outdoor upkeep and winter faucet protection." },
  garden: { label: "Garden bed & spigot", products: [P.faucet], blurb: "Garden, hose, and spigot care." },
  car: { label: "Car", products: [P.snowCover, P.snowBrush, P.cleaner], blurb: "Winter car care: snow, ice, and clear glass." },
  rv: { label: "RV", products: [P.basin, P.workLight, P.cleaner], blurb: "RV living and travel gear.", zoom: "rv" },
  "rv-bed": { label: "RV bed", products: [], blurb: "RV bedding and sleep comfort." },
  "rv-bathroom": { label: "RV bathroom", products: [], blurb: "Compact bathroom and shower care." },
  "rv-dinette": { label: "RV dinette", products: [], blurb: "Dinette comfort and compact living." },
  "rv-kitchen": { label: "RV kitchenette", products: [P.basin], blurb: "Compact kitchen and dish-washing gear." },
  "rv-storage": { label: "RV storage", products: [P.basin, P.workLight], blurb: "Space-saving storage for the road." },
  "rv-cab": { label: "RV cabin", products: [P.cleaner, P.snowCover], blurb: "Driving comfort and clear windshields." },
};

function matchProducts(products, meta, id) {
  if (!meta || !products?.length) return [];
  const want = meta.products || [];
  const spotTag = id ? `spot:${id}` : null;
  const picked = products.filter((p) => want.includes(p.site_handle || p.handle)
    || (spotTag && (p.tags || []).some((t) => String(t).toLowerCase() === spotTag)));
  return picked.sort((a, b) => {
    const ia = want.indexOf(a.site_handle || a.handle), ib = want.indexOf(b.site_handle || b.handle);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
}

export async function startHouse(catalog) {
  const $ = (id) => document.getElementById(id);
  const sheet = $("product-sheet"), hoverLabel = $("hover-label"), stage = $("house-stage");
  const backHouse = $("back-house"), resetBtn = $("peek-house"), hint = $("view-hint"), status = $("scene-status");
  const openSheet = (meta, id) => {
    const items = matchProducts(catalog.products, meta, id);
    $("sheet-title").textContent = meta.label;
    $("sheet-blurb").textContent = meta.blurb || "";
    $("sheet-body").innerHTML = items.length ? items.map(productCard).join("")
      : emptyState(`More coming soon`, `We're still picking the right products for the ${String(meta.label || "this spot").toLowerCase()}. Browse the full store for everything available now.`);
    sheet.classList.add("open");
  };
  window.__openSpot = (id) => openSheet(HOTSPOT_META[id] || { label: id }, id);
  $("close-sheet").onclick = () => sheet.classList.remove("open");
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") sheet.classList.remove("open"); });
  try {
    const api = await initHouse(stage, {
      onHover(hs) {
        if (!hs) { hoverLabel.style.display = "none"; return; }
        hoverLabel.textContent = hs.label || hs.id;
        hoverLabel.style.display = "block";
      },
      onSelect(hs) { if (hs) openSheet(HOTSPOT_META[hs.id] || hs, hs.id); },
      onView(next) {
        backHouse.hidden = next !== "rv";
        hint.textContent = next === "rv" ? "Inside the RV" : "Live floor plan — click anything";
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
