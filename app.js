// Desktop-only interactive floor plan controller. Loaded on demand by site.js.
import { initHouse } from "./house-plan.js";
import { productCard, emptyState } from "./site.js";

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
  "garage-storage": { label: "Garage storage", collections: ["storage-organization", "garage-tools"], tags: ["storage", "garage", "bike", "rack"], blurb: "Racks, bins, and wall storage for the garage." },
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

function matchProducts(products, meta) {
  if (!meta || !products?.length) return [];
  const tags = (meta.tags || []).map((t) => t.toLowerCase());
  const cols = (meta.collections || []).map((t) => t.toLowerCase());
  const types = (meta.types || []).map((t) => t.toLowerCase());
  return products.filter((p) => {
    const pTags = (p.tags || []).join(" ").toLowerCase();
    const pType = String(p.product_type || "").toLowerCase();
    const pTitle = String(p.title || "").toLowerCase();
    return cols.some((c) => (p.collections || []).includes(c))
      || tags.some((t) => pTags.includes(t) || pTitle.includes(t))
      || types.some((t) => pType.includes(t));
  });
}

export async function startHouse(catalog) {
  const $ = (id) => document.getElementById(id);
  const sheet = $("product-sheet"), hoverLabel = $("hover-label"), stage = $("house-stage");
  const backHouse = $("back-house"), resetBtn = $("peek-house"), hint = $("view-hint"), status = $("scene-status");
  const openSheet = (meta) => {
    const items = matchProducts(catalog.products, meta);
    $("sheet-title").textContent = meta.label;
    $("sheet-blurb").textContent = meta.blurb || "";
    $("sheet-body").innerHTML = items.length ? items.map(productCard).join("")
      : emptyState(`${meta.label}: coming soon`, "We haven't added products for this spot yet. Browse the full store for everything available now.");
    sheet.classList.add("open");
  };
  $("close-sheet").onclick = () => sheet.classList.remove("open");
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") sheet.classList.remove("open"); });
  try {
    const api = await initHouse(stage, {
      onHover(hs) {
        if (!hs) { hoverLabel.style.display = "none"; return; }
        hoverLabel.textContent = hs.label || hs.id;
        hoverLabel.style.display = "block";
      },
      onSelect(hs) { if (hs) openSheet(HOTSPOT_META[hs.id] || hs); },
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
