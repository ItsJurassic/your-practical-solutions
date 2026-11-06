import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutlinePass } from "three/addons/postprocessing/OutlinePass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";

const texCache = {};

function canvasTex(key, size, draw, repeatX = 2, repeatY = 2) {
  if (texCache[key]) return texCache[key];
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d"), size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  texCache[key] = tex;
  return tex;
}

function woodMap(key, base, ink) {
  return canvasTex(key, 512, (ctx, s) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 140; i++) {
      const y = (i / 140) * s + Math.sin(i * 1.7) * 2;
      ctx.strokeStyle = ink;
      ctx.globalAlpha = 0.08 + (i % 5) * 0.015;
      ctx.lineWidth = 0.8 + (i % 4) * 0.4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(s * 0.3, y + 3, s * 0.7, y - 3, s, y + 1);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, 1.5, 1.5);
}

function noiseMap(key, c1, c2) {
  return canvasTex(key, 256, (ctx, s) => {
    ctx.fillStyle = c1;
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      const t = Math.random();
      ctx.fillStyle = t > 0.5 ? c2 : c1;
      ctx.globalAlpha = 0.08 + Math.random() * 0.12;
      ctx.beginPath();
      ctx.ellipse(Math.random() * s, Math.random() * s, 6 + Math.random() * 16, 4 + Math.random() * 10, Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }, 3, 3);
}

function fabricMap(key, base) {
  return canvasTex(key, 256, (ctx, s) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    ctx.globalAlpha = 0.07;
    ctx.strokeStyle = "#000";
    for (let i = 0; i < s; i += 3) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(s, i); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, 4, 4);
}

const mats = {};
function mat(name, opts) {
  if (!mats[name]) mats[name] = new THREE.MeshPhysicalMaterial(opts);
  return mats[name];
}

function wood(name, color, mapKey, mapBase, mapInk) {
  return mat(name, {
    color, map: woodMap(mapKey, mapBase, mapInk),
    roughness: 0.42, metalness: 0.02, clearcoat: 0.18, clearcoatRoughness: 0.4,
  });
}

function std(name, opts) {
  if (!mats[name]) mats[name] = new THREE.MeshStandardMaterial(opts);
  return mats[name];
}

function rbox(w, h, d, r = 0.04, seg = 4) {
  return new RoundedBoxGeometry(w, h, d, seg, r);
}

function mesh(geo, material, x, y, z, parent, hotspot) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  if (hotspot) mark(m, hotspot);
  parent.add(m);
  return m;
}

function mark(obj, hotspot) {
  obj.userData.hotspot = hotspot;
  obj.traverse((c) => { c.userData.hotspot = hotspot; });
}

function group(parent, x, y, z, hotspot) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (hotspot) mark(g, hotspot);
  parent.add(g);
  return g;
}

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
  "pet-bed": { label: "Pet corner", collections: ["pet-supplies"], tags: ["pet", "dog", "cat"], blurb: "Beds, bowls, and everyday pet care." },
  "kitchen-sink": { label: "Kitchen sink", collections: ["home-decor"], tags: ["kitchen", "sink", "scrub", "cleaning"], blurb: "Sink care, scrub brushes, and kitchen cleaning." },
  kitchen: { label: "Kitchen", collections: ["home-decor", "storage-organization"], tags: ["kitchen"], blurb: "Kitchen tools, storage, and housewares." },
  "garage-workstation": { label: "Garage workstation", collections: ["garage-tools"], tags: ["tool", "workbench"], blurb: "Tools and garage work gear." },
  "garage-storage": { label: "Garage storage", collections: ["storage-organization", "garage-tools"], tags: ["garage", "storage"], blurb: "Bins, racks, and garage organization." },
  yard: { label: "Yard & garden", collections: [], tags: ["yard", "garden", "outdoor", "lawn"], blurb: "Yard work and outdoor upkeep." },
  car: { label: "Car", collections: ["car-rv", "tech-accessories"], tags: ["car", "charger"], blurb: "Car organizers, chargers, and travel gear." },
  rv: { label: "RV", collections: ["car-rv"], tags: ["rv", "camper"], blurb: "RV living and travel gear.", zoom: "rv" },
  "rv-bed": { label: "RV bed", collections: ["car-rv", "home-decor"], tags: ["bedding", "rv"], blurb: "RV bedding and sleep comfort." },
  "rv-kitchen": { label: "RV kitchenette", collections: ["car-rv"], tags: ["kitchen", "rv"], blurb: "Compact kitchen and sink-care gear." },
  "rv-storage": { label: "RV storage", collections: ["storage-organization", "car-rv"], tags: ["storage", "rv"], blurb: "Space-saving storage for the road." },
  "rv-tech": { label: "RV cabin", collections: ["tech-accessories", "car-rv"], tags: ["charger", "speaker"], blurb: "Chargers, speakers, and travel tech." },
};

function buildEnvironment(root) {
  const grass = std("grass", {
    color: "#7d9a63",
    map: noiseMap("grass", "#6f8f54", "#8aaa6e"),
    roughness: 0.95,
  });
  const dirt = std("dirt", { color: "#7a5a3a", roughness: 0.9 });
  const paver = std("paver", { color: "#d8c7ae", roughness: 0.62 });
  const hedge = std("hedge", { color: "#3f5c3a", roughness: 0.88 });
  const leaf = std("leaf", { color: "#4d7344", roughness: 0.85 });
  const leaf2 = std("leaf2", { color: "#3a5c36", roughness: 0.85 });
  const bark = wood("bark", "#6b4a32", "barkw", "#6b4a32", "#2a1810");

  mesh(new THREE.CircleGeometry(48, 64), grass, 2, 0, 2, root).rotation.x = -Math.PI / 2;
  mesh(new THREE.CircleGeometry(48, 64), grass, 2, 0, 2, root).rotation.x = -Math.PI / 2;

  const drive = mesh(rbox(10.5, 0.04, 8.2, 0.02), std("drive", { color: "#9aa0a4", roughness: 0.78 }), 12.2, 0.02, 10.4, root);
  drive.receiveShadow = true;

  for (let i = 0; i < 9; i++) {
    mesh(rbox(1.05, 0.05, 0.55, 0.02), paver, -1.2, 0.03, 4.2 + i * 0.72, root);
  }

  const garden = group(root, -12.5, 0, -1.5, { id: "yard", label: "Yard & garden" });
  mesh(rbox(6.2, 0.18, 3.4, 0.08), dirt, 0, 0.1, 0, garden);
  const flowerColors = ["#c45c26", "#d98a6a", "#e8c36a", "#8aa37a", "#f3eee4"];
  for (let i = 0; i < 28; i++) {
    const fx = (Math.random() - 0.5) * 5.4;
    const fz = (Math.random() - 0.5) * 2.6;
    mesh(new THREE.SphereGeometry(0.1 + Math.random() * 0.07, 10, 8), std("fl" + (i % 5), { color: flowerColors[i % 5], roughness: 0.55 }), fx, 0.32, fz, garden);
  }
  mesh(rbox(0.18, 0.7, 0.18, 0.04), wood("post", "#8a6239", "pw", "#8a6239", "#4a2e18"), 2.8, 0.45, 1.4, garden);
  mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.18, 16), std("pot", { color: "#a35b3a", roughness: 0.55 }), 2.8, 0.85, 1.4, garden);

  [[-16, -8], [-15, 6], [8, -12], [-6, -11], [20, -6]].forEach(([x, z], i) => {
    const t = group(root, x, 0, z);
    mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.6, 10), bark, 0, 0.8, 0, t);
    mesh(new THREE.IcosahedronGeometry(1.15, 1), i % 2 ? leaf : leaf2, 0, 2.1, 0, t);
    mesh(new THREE.IcosahedronGeometry(0.85, 1), leaf, 0.6, 1.85, 0.15, t);
    mesh(new THREE.IcosahedronGeometry(0.7, 1), leaf2, -0.45, 1.7, 0.3, t);
  });

  [[-10.5, 4.5, 7, 0.7, 0.55], [18.5, -2, 0.6, 0.75, 8], [-2, -10.8, 14, 0.65, 0.5]].forEach(([x, z, w, h, d]) => {
    mesh(rbox(w, h, d, 0.18), hedge, x, h / 2, z, root);
  });
}

function wall(parent, w, h, d, x, y, z) {
  return mesh(rbox(w, h, d, 0.01, 1), std("wall", { color: "#f3ece3", roughness: 0.72 }), x, y, z, parent);
}

function glassPane(parent, w, h, d, x, y, z, hotspot) {
  return mesh(rbox(w, h, d, 0.01, 1), mat("glass", {
    color: "#cde4ef", roughness: 0.08, metalness: 0.1, transmission: 0.65,
    thickness: 0.08, transparent: true, opacity: 0.55, ior: 1.45,
  }), x, y, z, parent, hotspot);
}

function buildHouseShell(root) {
  const floorOak = wood("floor", "#c29a72", "oak", "#c4a07a", "#6d4428");
  floorOak.roughness = 0.35;
  const tile = std("tile", { color: "#ddd4c6", roughness: 0.45 });
  const conc = std("conc", { color: "#b7b3ad", roughness: 0.86 });

  mesh(rbox(7.4, 0.12, 8.2, 0.02), floorOak, -4.7, 0.06, -1.9, root);
  mesh(rbox(8.2, 0.12, 8.2, 0.02), floorOak, 3.3, 0.06, -1.9, root);
  mesh(rbox(6.2, 0.12, 8.2, 0.02), tile, 10.4, 0.06, -1.9, root);
  mesh(rbox(6.2, 0.12, 6.4, 0.02), conc, 10.4, 0.06, 5.4, root);

  // Dollhouse cutaway: keep the far (north/west) walls, drop the roof and
  // camera-facing walls so furnished rooms stay visible in isometric view.
  wall(root, 21.6, 3.1, 0.16, 2.85, 1.65, -6.05);
  wall(root, 0.16, 3.1, 8.3, -8.45, 1.65, -1.95);
  wall(root, 0.16, 3.1, 8.2, 13.55, 1.65, -1.95);
  // low thresholds instead of south/east garage walls
  wall(root, 21.6, 0.16, 0.16, 2.85, 0.2, 2.2);
  wall(root, 6.2, 0.16, 0.16, 10.4, 0.2, 8.55);
  wall(root, 0.16, 0.16, 6.4, 13.55, 0.2, 5.35);
  wall(root, 0.16, 3.1, 0.16, 7.35, 1.65, 2.2);

  wall(root, 0.12, 3.0, 8.15, -1.05, 1.6, -1.95);
  wall(root, 0.12, 3.0, 8.15, 7.35, 1.6, -1.95);

  const curtainHot = { id: "curtains", label: "Curtains" };
  glassPane(root, 2.4, 1.7, 0.06, 2.2, 1.85, -5.96, curtainHot);
  mesh(rbox(0.16, 1.85, 0.08, 0.02), fabric("curtain", "#d9c1a2"), 0.95, 1.85, -5.9, root, curtainHot);
  mesh(rbox(0.16, 1.85, 0.08, 0.02), fabric("curtain", "#d9c1a2"), 3.45, 1.85, -5.9, root, curtainHot);
  glassPane(root, 1.8, 1.5, 0.06, -4.8, 1.8, -5.96);
  glassPane(root, 1.8, 1.5, 0.06, 10.4, 1.8, -5.96);
  glassPane(root, 0.06, 1.6, 2.2, 13.48, 1.7, 5.3);

  // slim back eave only — no covering roof
  mesh(rbox(22.2, 0.14, 0.55, 0.04), std("eave", { color: "#efe4d4", roughness: 0.55 }), 2.9, 3.22, -6.28, root);
  mesh(rbox(0.55, 0.14, 8.4, 0.04), std("eave2", { color: "#efe4d4", roughness: 0.55 }), -8.55, 3.22, -1.95, root);

  mesh(rbox(1.15, 2.15, 0.1, 0.02), wood("door", "#7a4e32", "dw", "#7a4e32", "#3a2416"), 1.6, 1.18, 2.16, root);
  mesh(new THREE.SphereGeometry(0.04, 10, 8), mat("knob", { color: "#c4a35a", metalness: 0.85, roughness: 0.25 }), 2.05, 1.15, 2.24, root);
}

function fabric(name, color) {
  return std(name, { color, map: fabricMap(name, color), roughness: 0.78 });
}

function addDrawers(parent, w, h, d, rows, cols, matte) {
  const gap = 0.04;
  const dw = (w - gap * (cols + 1)) / cols;
  const dh = (h - gap * (rows + 1)) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = -w / 2 + gap + dw / 2 + c * (dw + gap);
      const y = -h / 2 + gap + dh / 2 + r * (dh + gap);
      mesh(rbox(dw, dh, 0.04, 0.015), matte, x, y, d / 2 + 0.01, parent);
      mesh(new THREE.SphereGeometry(0.035, 10, 8), mat("knob", { color: "#c4a35a", metalness: 0.85, roughness: 0.25 }), x, y, d / 2 + 0.05, parent);
    }
  }
}

function buildBedroom(root) {
  const linen = fabric("linen", "#f1e6d6");
  const duvet = fabric("duvet", "#ead7c0");
  const pillow = fabric("pillow", "#f7f1e8");
  const walnut = wood("walnut", "#6b4226", "wal", "#6b4226", "#2d160c");
  const rose = wood("rose", "#8a5a44", "rose", "#8a5a44", "#3d2118");
  const oak = wood("boak", "#b08968", "boak", "#b08968", "#5a341c");

  const bed = group(root, -4.9, 0, -2.15, { id: "bed", label: "Bed" });
  mesh(rbox(2.55, 0.28, 2.15, 0.06), walnut, 0, 0.28, 0, bed);
  mesh(rbox(2.45, 0.22, 2.05, 0.08), linen, 0, 0.5, 0, bed);
  mesh(rbox(2.35, 0.16, 1.35, 0.1), duvet, 0, 0.66, 0.22, bed);
  mesh(rbox(2.5, 1.05, 0.14, 0.05), walnut, 0, 0.95, -1.05, bed);
  mesh(rbox(0.72, 0.18, 0.46, 0.08), pillow, -0.52, 0.74, -0.72, bed);
  mesh(rbox(0.72, 0.18, 0.46, 0.08), pillow, 0.52, 0.74, -0.72, bed);
  mesh(rbox(1.6, 0.03, 1.9, 0.01), fabric("brug", "#c4a07a"), 0, 0.125, 0.15, bed);

  const ns = group(root, -3.35, 0, -3.85, { id: "nightstand", label: "Bedside table" });
  mesh(rbox(0.62, 0.52, 0.48, 0.04), oak, 0, 0.38, 0, ns);
  mesh(rbox(0.52, 0.16, 0.06, 0.02), oak, 0, 0.38, 0.23, ns);
  mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.28, 12), mat("brass", { color: "#c4a35a", metalness: 0.8, roughness: 0.3 }), 0, 0.82, 0, ns);
  mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.14, 16), fabric("shade", "#f3eee4"), 0, 1.02, 0, ns);

  const his = group(root, -7.15, 0, -4.55, { id: "dresser-his", label: "His dresser" });
  mesh(rbox(1.15, 1.15, 0.52, 0.04), walnut, 0, 0.7, 0, his);
  addDrawers(his, 1.05, 1.0, 0.52, 4, 1, walnut);
  mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.04, 16), mat("tray", { color: "#2a2a2a", roughness: 0.35, metalness: 0.2 }), 0.28, 1.3, 0, his);

  const hers = group(root, -7.15, 0, 0.35, { id: "dresser-hers", label: "Her dresser" });
  mesh(rbox(1.15, 1.05, 0.52, 0.05), rose, 0, 0.65, 0, hers);
  addDrawers(hers, 1.05, 0.9, 0.52, 3, 2, rose);
  mesh(new THREE.SphereGeometry(0.07, 12, 10), mat("vase", { color: "#c45c26", roughness: 0.35 }), -0.22, 1.28, 0, hers);
  mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.18, 8), std("stem", { color: "#3f5c3a" }), -0.22, 1.4, 0, hers);

  const ward = group(root, -2.55, 0, 0.85, { id: "wardrobe", label: "Wardrobe" });
  mesh(rbox(1.45, 2.25, 0.62, 0.04), oak, 0, 1.25, 0, ward);
  mesh(rbox(0.6, 2.0, 0.04, 0.02), oak, -0.32, 1.22, 0.32, ward);
  mesh(rbox(0.6, 2.0, 0.04, 0.02), oak, 0.32, 1.22, 0.32, ward);
  mesh(rbox(0.28, 0.02, 0.02, 0.01), mat("brass", { color: "#c4a35a", metalness: 0.8, roughness: 0.3 }), -0.18, 1.22, 0.36, ward);
  mesh(rbox(0.28, 0.02, 0.02, 0.01), mat("brass", { color: "#c4a35a", metalness: 0.8, roughness: 0.3 }), 0.18, 1.22, 0.36, ward);
}

function buildLiving(root) {
  const sage = fabric("sage", "#c5c1ae");
  const cream = fabric("creams", "#efe6d6");
  const walnut = wood("lw", "#7a5233", "lw", "#7a5233", "#3a2416");

  const sofa = group(root, 2.55, 0, -4.15, { id: "sofa", label: "Living room sofa" });
  mesh(rbox(3.15, 0.38, 1.15, 0.1), sage, 0, 0.38, 0, sofa);
  mesh(rbox(3.15, 0.72, 0.32, 0.1), sage, 0, 0.82, -0.42, sofa);
  mesh(rbox(0.28, 0.55, 1.15, 0.1), sage, -1.48, 0.7, 0, sofa);
  mesh(rbox(0.28, 0.55, 1.15, 0.1), sage, 1.48, 0.7, 0, sofa);
  mesh(rbox(0.9, 0.16, 0.7, 0.08), cream, -0.85, 0.66, 0.08, sofa);
  mesh(rbox(0.9, 0.16, 0.7, 0.08), cream, 0.05, 0.66, 0.08, sofa);
  mesh(rbox(0.9, 0.16, 0.7, 0.08), cream, 0.9, 0.66, 0.08, sofa);
  mesh(rbox(0.18, 0.08, 0.18, 0.03), walnut, -1.35, 0.16, 0.42, sofa);
  mesh(rbox(0.18, 0.08, 0.18, 0.03), walnut, 1.35, 0.16, 0.42, sofa);

  const rug = group(root, 2.7, 0, -2.1, { id: "rug", label: "Living room rug" });
  mesh(rbox(3.8, 0.035, 2.5, 0.02), fabric("rug", "#c9a07a"), 0, 0.13, 0, rug);

  const table = group(root, 2.7, 0, -2.15);
  mesh(rbox(1.35, 0.06, 0.7, 0.04), mat("glass2", { color: "#d7e4ea", roughness: 0.12, metalness: 0.05, transmission: 0.4, transparent: true, opacity: 0.7 }), 0, 0.42, 0, table);
  mesh(rbox(1.3, 0.32, 0.08, 0.02), walnut, 0, 0.26, 0, table);
  mesh(rbox(0.08, 0.32, 0.62, 0.02), walnut, -0.58, 0.26, 0, table);
  mesh(rbox(0.08, 0.32, 0.62, 0.02), walnut, 0.58, 0.26, 0, table);

  mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.2, 12), std("pot2", { color: "#a35b3a", roughness: 0.55 }), 0.55, 0.22, -3.15, root);
  mesh(new THREE.IcosahedronGeometry(0.28, 1), std("plant2", { color: "#3f5c3a", roughness: 0.8 }), 0.55, 0.55, -3.15, root);
  const media = group(root, 5.55, 0, -5.15, { id: "media", label: "Media console" });
  mesh(rbox(2.15, 0.42, 0.48, 0.04), walnut, 0, 0.32, 0, media);
  mesh(rbox(1.15, 0.62, 0.08, 0.01), std("screen", { color: "#1b1d1c", roughness: 0.3, metalness: 0.4 }), 0, 1.05, -0.05, media);
  mesh(rbox(0.22, 0.42, 0.22, 0.03), std("spk", { color: "#2c2a28", roughness: 0.45 }), -0.95, 0.72, 0.05, media);
  mesh(rbox(0.22, 0.42, 0.22, 0.03), std("spk", { color: "#2c2a28", roughness: 0.45 }), 0.95, 0.72, 0.05, media);

  const pet = group(root, 0.35, 0, 0.15, { id: "pet-bed", label: "Pet corner" });
  mesh(new THREE.TorusGeometry(0.38, 0.12, 12, 24), fabric("pet", "#d7b48a"), 0, 0.2, 0, pet).rotation.x = Math.PI / 2;
  mesh(new THREE.CircleGeometry(0.34, 20), fabric("petin", "#efe0c8"), 0, 0.21, 0, pet).rotation.x = -Math.PI / 2;
  mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.08, 16), std("bowl", { color: "#c4a35a", metalness: 0.55, roughness: 0.35 }), 0.55, 0.18, 0.15, pet);
}

function buildKitchen(root) {
  const cab = std("cab", { color: "#efe7dc", roughness: 0.55 });
  const sageCab = std("scab", { color: "#8b9e7e", roughness: 0.58 });
  const quartz = mat("quartz", { color: "#e9e2d6", roughness: 0.28, clearcoat: 0.4, clearcoatRoughness: 0.3 });
  const steel = mat("steel", { color: "#8d9396", metalness: 0.75, roughness: 0.28 });

  const island = group(root, 10.15, 0, -1.55, { id: "kitchen", label: "Kitchen" });
  mesh(rbox(2.05, 0.78, 1.05, 0.04), sageCab, 0, 0.48, 0, island);
  mesh(rbox(2.15, 0.07, 1.15, 0.03), quartz, 0, 0.9, 0, island);
  mesh(rbox(0.35, 0.45, 0.35, 0.04), wood("stool", "#8a6239", "st", "#8a6239", "#3a2416"), -0.55, 0.35, 0.85, island);
  mesh(rbox(0.35, 0.45, 0.35, 0.04), wood("stool", "#8a6239", "st", "#8a6239", "#3a2416"), 0.55, 0.35, 0.85, island);

  mesh(rbox(5.6, 0.85, 0.62, 0.03), sageCab, 10.4, 0.52, -5.45, root);
  mesh(rbox(5.7, 0.08, 0.72, 0.02), quartz, 10.4, 0.98, -5.45, root);
  mesh(rbox(2.6, 0.85, 0.62, 0.03), sageCab, 12.95, 0.52, -3.6, root);
  mesh(rbox(0.72, 0.08, 2.5, 0.02), quartz, 12.95, 0.98, -3.6, root);
  mesh(rbox(0.55, 0.18, 0.42, 0.03), std("board", { color: "#c4a07a", roughness: 0.55 }), 11.5, 1.12, -5.35, root);
  mesh(new THREE.SphereGeometry(0.07, 10, 8), std("fruit1", { color: "#c45c26", roughness: 0.5 }), 11.45, 1.24, -5.3, root);
  mesh(new THREE.SphereGeometry(0.06, 10, 8), std("fruit2", { color: "#e8c36a", roughness: 0.5 }), 11.58, 1.22, -5.38, root);
  mesh(rbox(0.7, 0.12, 0.55, 0.03), std("stove", { color: "#2a2c2b", metalness: 0.45, roughness: 0.35 }), 12.9, 1.08, -4.15, root);

  const sink = group(root, 10.35, 0, -5.4, { id: "kitchen-sink", label: "Kitchen sink" });
  mesh(rbox(0.62, 0.12, 0.42, 0.02), steel, 0, 1.0, 0, sink);
  mesh(rbox(0.5, 0.1, 0.3, 0.02), std("basin", { color: "#6b7276", metalness: 0.6, roughness: 0.35 }), 0, 0.96, 0, sink);
  mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.28, 10), steel, 0, 1.2, -0.12, sink);
  mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 10), steel, 0, 1.32, -0.02, sink).rotation.x = Math.PI / 2;
  mesh(rbox(0.16, 0.04, 0.05, 0.01), std("brush", { color: "#c45c26", roughness: 0.55 }), 0.42, 1.05, 0.12, sink);

  mesh(rbox(1.8, 0.95, 0.38, 0.03), cab, 9.2, 2.35, -5.55, root);
  mesh(rbox(1.8, 0.95, 0.38, 0.03), cab, 11.6, 2.35, -5.55, root);
}

function buildGarage(root) {
  const bench = wood("bench", "#8a6a45", "bench", "#8a6a45", "#3d2816");
  const steel = mat("gsteel", { color: "#7d8386", metalness: 0.7, roughness: 0.32 });
  const bin = std("bin", { color: "#c45c26", roughness: 0.55 });

  const ws = group(root, 8.55, 0, 5.35, { id: "garage-workstation", label: "Garage workstation" });
  mesh(rbox(2.35, 0.12, 0.78, 0.03), bench, 0, 0.92, 0, ws);
  mesh(rbox(0.12, 0.88, 0.12, 0.02), bench, -1.02, 0.46, 0.28, ws);
  mesh(rbox(0.12, 0.88, 0.12, 0.02), bench, 1.02, 0.46, 0.28, ws);
  mesh(rbox(0.12, 0.88, 0.12, 0.02), bench, -1.02, 0.46, -0.28, ws);
  mesh(rbox(0.12, 0.88, 0.12, 0.02), bench, 1.02, 0.46, -0.28, ws);
  mesh(rbox(2.2, 1.15, 0.08, 0.01), std("peg", { color: "#c4a07a", roughness: 0.65 }), 0, 1.65, -0.34, ws);
  for (let i = 0; i < 5; i++) {
    mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8), steel, -0.8 + i * 0.4, 1.7, -0.26, ws).rotation.x = Math.PI / 2;
  }
  mesh(rbox(0.42, 0.08, 0.14, 0.02), steel, -0.35, 0.99, 0.15, ws);
  mesh(rbox(0.08, 0.22, 0.16, 0.02), steel, 0.55, 1.12, 0.1, ws);

  const st = group(root, 12.15, 0, 6.55, { id: "garage-storage", label: "Garage storage" });
  mesh(rbox(1.7, 1.85, 0.48, 0.03), wood("shelf", "#9a7a55", "sh", "#9a7a55", "#4a3018"), 0, 1.05, 0, st);
  mesh(rbox(0.42, 0.38, 0.38, 0.04), bin, -0.45, 1.55, 0.08, st);
  mesh(rbox(0.42, 0.32, 0.38, 0.04), std("bin2", { color: "#2c4a3e", roughness: 0.55 }), 0.4, 1.52, 0.08, st);
  mesh(rbox(0.5, 0.28, 0.38, 0.04), std("bin3", { color: "#efe7dc", roughness: 0.55 }), 0, 0.85, 0.08, st);
}

function wheel(parent, x, y, z) {
  const tire = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.16, 18), std("tire", { color: "#222", roughness: 0.7 }), x, y, z, parent);
  tire.rotation.z = Math.PI / 2;
  const cap = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.17, 16), mat("rim", { color: "#d9d4cc", metalness: 0.7, roughness: 0.3 }), x, y, z, parent);
  cap.rotation.z = Math.PI / 2;
}

function buildVehicles(root) {
  const car = group(root, 9.4, 0, 11.1, { id: "car", label: "Car" });
  mesh(rbox(1.7, 0.48, 3.15, 0.12), mat("car", { color: "#2f4a3c", roughness: 0.28, metalness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.2 }), 0, 0.55, 0, car);
  mesh(rbox(1.55, 0.42, 1.55, 0.1), mat("cabin", { color: "#24382e", roughness: 0.25, metalness: 0.2, transmission: 0.15, transparent: true, opacity: 0.85 }), 0, 1.02, -0.15, car);
  mesh(rbox(1.72, 0.08, 0.12, 0.03), std("lightf", { color: "#f3eee4", emissive: "#f3eee4", emissiveIntensity: 0.2 }), 0, 0.52, -1.55, car);
  mesh(rbox(1.72, 0.06, 0.08, 0.02), std("lightb", { color: "#c45c26", emissive: "#c45c26", emissiveIntensity: 0.15 }), 0, 0.52, 1.55, car);
  wheel(car, -0.82, 0.28, -0.95);
  wheel(car, 0.82, 0.28, -0.95);
  wheel(car, -0.82, 0.28, 0.95);
  wheel(car, 0.82, 0.28, 0.95);

  const rv = group(root, 14.6, 0, 11.15, { id: "rv", label: "RV" });
  mesh(rbox(2.15, 1.55, 5.1, 0.08), mat("rvbody", { color: "#efe6d6", roughness: 0.38, metalness: 0.08, clearcoat: 0.25 }), 0, 1.15, 0, rv);
  mesh(rbox(2.18, 0.16, 5.14, 0.04), std("stripe", { color: "#2c4a3e", roughness: 0.45 }), 0, 0.72, 0, rv);
  mesh(rbox(1.9, 0.55, 1.15, 0.08), mat("rvcab", { color: "#cfe0e6", roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.55 }), 0, 1.35, -1.85, rv);
  mesh(rbox(0.04, 0.45, 0.7, 0.01), mat("rvwin", { color: "#cfe0e6", roughness: 0.12, transparent: true, opacity: 0.5 }), 1.08, 1.35, 0.2, rv);
  mesh(rbox(0.04, 0.45, 0.7, 0.01), mat("rvwin", { color: "#cfe0e6", roughness: 0.12, transparent: true, opacity: 0.5 }), 1.08, 1.35, 1.3, rv);
  mesh(rbox(0.55, 1.15, 0.06, 0.02), wood("rvdoor", "#7a4e32", "rvd", "#7a4e32", "#3a2416"), 1.1, 0.9, -0.6, rv);
  wheel(rv, -0.95, 0.28, -1.5);
  wheel(rv, 0.95, 0.28, -1.5);
  wheel(rv, -0.95, 0.28, 1.55);
  wheel(rv, 0.95, 0.28, 1.55);
}

function buildRVInterior(root) {
  const floor = wood("rvf", "#c4a07a", "rvf", "#c4a07a", "#6d4428");
  const wall = std("rvw", { color: "#f4eee6", roughness: 0.7 });
  const linen = fabric("rvlin", "#efe6d6");

  mesh(rbox(2.4, 0.08, 6.4, 0.02), floor, 0, 0.04, 0, root);
  mesh(rbox(2.4, 0.9, 0.08, 0.01), wall, 0, 0.5, -3.2, root);
  mesh(rbox(2.4, 0.9, 0.08, 0.01), wall, 0, 0.5, 3.2, root);
  mesh(rbox(0.08, 0.9, 6.4, 0.01), wall, -1.2, 0.5, 0, root);
  mesh(rbox(0.08, 0.9, 6.4, 0.01), wall, 1.2, 0.5, 0, root);

  const bed = group(root, 0, 0, 2.35, { id: "rv-bed", label: "RV bed" });
  mesh(rbox(2.05, 0.28, 1.55, 0.06), linen, 0, 0.28, 0, bed);
  mesh(rbox(0.7, 0.14, 0.4, 0.06), fabric("rvp", "#f7f1e8"), -0.4, 0.48, 0.4, bed);
  mesh(rbox(0.7, 0.14, 0.4, 0.06), fabric("rvp", "#f7f1e8"), 0.4, 0.48, 0.4, bed);

  const kit = group(root, -0.55, 0, 0.15, { id: "rv-kitchen", label: "RV kitchenette" });
  mesh(rbox(0.85, 0.55, 1.35, 0.04), std("rvcab", { color: "#8b9e7e", roughness: 0.55 }), 0, 0.4, 0, kit);
  mesh(rbox(0.9, 0.06, 1.4, 0.02), mat("rvq", { color: "#e9e2d6", roughness: 0.3, clearcoat: 0.3 }), 0, 0.7, 0, kit);
  mesh(rbox(0.35, 0.08, 0.28, 0.02), mat("rvsink", { color: "#8d9396", metalness: 0.7, roughness: 0.3 }), 0, 0.76, 0.2, kit);

  const stor = group(root, 0.7, 0, 0.2, { id: "rv-storage", label: "RV storage" });
  mesh(rbox(0.7, 0.85, 1.2, 0.04), wood("rvs", "#b08968", "rvs", "#b08968", "#5a341c"), 0, 0.55, 0, stor);
  addDrawers(stor, 0.62, 0.7, 0.6, 3, 1, wood("rvs", "#b08968", "rvs", "#b08968", "#5a341c"));

  const tech = group(root, 0, 0, -1.85, { id: "rv-tech", label: "RV cabin" });
  mesh(rbox(0.7, 0.42, 0.7, 0.06), fabric("seat", "#4a5c4e"), -0.45, 0.35, 0, tech);
  mesh(rbox(0.7, 0.42, 0.7, 0.06), fabric("seat", "#4a5c4e"), 0.45, 0.35, 0, tech);
  mesh(rbox(1.6, 0.08, 0.35, 0.03), std("dash", { color: "#2c2a28", roughness: 0.4 }), 0, 0.48, -0.55, tech);
  mesh(rbox(0.2, 0.12, 0.2, 0.03), std("spk2", { color: "#1b1d1c", roughness: 0.4 }), 0.65, 0.62, -0.2, tech);
}

export async function initHouse(container, options = {}) {
  const width = () => container.clientWidth || 1920;
  const height = () => container.clientHeight || 1080;

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width(), height());
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0xe6dcc8, 1);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#e7dcc8");
  scene.fog = new THREE.Fog("#e7dcc8", 38, 70);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
  scene.environmentIntensity = 0.62;

  let aspect = width() / height();
  let frustum = options.frustum || 11.4;
  const camera = new THREE.OrthographicCamera(-frustum * aspect, frustum * aspect, frustum, -frustum, 0.1, 200);
  function applyFrustum(f) {
    frustum = f;
    camera.left = -frustum * aspect;
    camera.right = frustum * aspect;
    camera.top = frustum;
    camera.bottom = -frustum;
    camera.updateProjectionMatrix();
  }
  const houseTarget = new THREE.Vector3(3.2, 0.6, 1.6);
  const rvTarget = new THREE.Vector3(40, 0.2, 0);
  camera.position.set(houseTarget.x + 16, 22, houseTarget.z + 16);
  camera.lookAt(houseTarget);

  const hemi = new THREE.HemisphereLight(0xfff2dd, 0x6b7a4e, 0.72);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d6, 2.55);
  sun.position.set(16, 26, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.00018;
  sun.shadow.normalBias = 0.035;
  sun.shadow.radius = 3.5;
  const s = 28;
  sun.shadow.camera.left = -s;
  sun.shadow.camera.right = s;
  sun.shadow.camera.top = s;
  sun.shadow.camera.bottom = -s;
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 80;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xe8f0ff, 0.35);
  fill.position.set(-12, 10, -8);
  scene.add(fill);
  [
    [-4.8, 2.6, -2],
    [2.6, 2.6, -2],
    [10.3, 2.6, -2],
    [10.3, 2.4, 5.2],
  ].forEach(([x, y, z]) => {
    const p = new THREE.PointLight(0xffe0b8, 0.55, 7.5, 1.6);
    p.position.set(x, y, z);
    scene.add(p);
  });

  const world = new THREE.Group();
  scene.add(world);
  buildEnvironment(world);
  buildHouseShell(world);
  buildBedroom(world);
  buildLiving(world);
  buildKitchen(world);
  buildGarage(world);
  buildVehicles(world);

  const rvWorld = new THREE.Group();
  rvWorld.position.set(40, 0, 0);
  rvWorld.visible = false;
  scene.add(rvWorld);
  buildRVInterior(rvWorld);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const ssaoPass = new SSAOPass(scene, camera, width(), height());
  ssaoPass.kernelRadius = 12;
  ssaoPass.minDistance = 0.001;
  ssaoPass.maxDistance = 0.08;
  ssaoPass.output = SSAOPass.OUTPUT.Default;
  composer.addPass(ssaoPass);
  const outlinePass = new OutlinePass(new THREE.Vector2(width(), height()), scene, camera);
  outlinePass.edgeStrength = 4.2;
  outlinePass.edgeGlow = 0.35;
  outlinePass.edgeThickness = 1.2;
  outlinePass.visibleEdgeColor.set("#c45c26");
  outlinePass.hiddenEdgeColor.set("#e0a070");
  outlinePass.pulsePeriod = 0;
  composer.addPass(outlinePass);
  composer.addPass(new SMAAPass(width() * renderer.getPixelRatio(), height() * renderer.getPixelRatio()));
  composer.addPass(new OutputPass());

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hovered = null;
  let view = "house";
  let anim = null;

  function findHotspot(obj) {
    let o = obj;
    while (o) {
      if (o.userData && o.userData.hotspot) return o;
      o = o.parent;
    }
    return null;
  }

  function setHover(obj) {
    hovered = obj;
    outlinePass.selectedObjects = obj ? [obj] : [];
    container.style.cursor = obj ? "pointer" : "grab";
    const hs = obj?.userData?.hotspot;
    options.onHover?.(hs || null);
  }

  function onPointerMove(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(view === "house" ? world.children : rvWorld.children, true);
    const found = hits.length ? findHotspot(hits[0].object) : null;
    if (found !== hovered) setHover(found);
  }

  function onClick() {
    if (!hovered) return;
    const hs = hovered.userData.hotspot;
    if (hs?.id === "rv") {
      setView("rv");
      options.onSelect?.(hs);
      return;
    }
    options.onSelect?.(hs);
  }

  function setView(next) {
    view = next;
    applyFrustum(next === "rv" ? 4.2 : (options.frustum || 11.4));
    const fromPos = camera.position.clone();
    const fromTarget = camera.target ? camera.target.clone() : (next === "rv" ? houseTarget.clone() : rvTarget.clone());
    if (!camera.target) camera.target = (next === "rv" ? houseTarget : rvTarget).clone();
    const toPos = next === "rv"
      ? new THREE.Vector3(rvTarget.x, 16, rvTarget.z + 0.01)
      : new THREE.Vector3(houseTarget.x + 16, 22, houseTarget.z + 16);
    const toTarget = next === "rv" ? rvTarget.clone() : houseTarget.clone();
    rvWorld.visible = true;
    world.visible = true;
    const start = performance.now();
    anim = { fromPos, toPos, fromTarget: camera.target.clone(), toTarget, start, dur: 900, next };
  }

  camera.target = houseTarget.clone();

  function resize() {
    const w = width();
    const h = height();
    aspect = w / Math.max(h, 1);
    camera.left = -frustum * aspect;
    camera.right = frustum * aspect;
    camera.top = frustum;
    camera.bottom = -frustum;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    outlinePass.setSize(w, h);
    ssaoPass.setSize(w, h);
  }

  function tick(now) {
    requestAnimationFrame(tick);
    if (anim) {
      const t = Math.min(1, (now - anim.start) / anim.dur);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      camera.position.lerpVectors(anim.fromPos, anim.toPos, e);
      camera.target.lerpVectors(anim.fromTarget, anim.toTarget, e);
      camera.lookAt(camera.target);
      if (t >= 1) {
        if (anim.next === "rv") world.visible = false;
        else rvWorld.visible = false;
        anim = null;
      }
    }
    composer.render();
  }

  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("click", onClick);
  window.addEventListener("resize", resize);
  requestAnimationFrame(tick);
  requestAnimationFrame(() => {
    window.__SCENE_READY__ = true;
    options.onReady?.();
  });

  return {
    setView,
    getView: () => view,
    renderer,
    camera,
    resize,
    dispose() {
      window.removeEventListener("resize", resize);
      renderer.dispose();
    },
  };
}
