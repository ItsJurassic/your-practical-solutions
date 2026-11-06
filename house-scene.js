import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const BASE = window.__ASSET_BASE__ || window.__SITE_BASE__ || "./";
const loader = new GLTFLoader();
const cache = new Map();

async function loadGLB(file) {
  const url = `${BASE}models/${file}`;
  if (!cache.has(file)) cache.set(file, loader.loadAsync(url));
  const gltf = await cache.get(file);
  return gltf.scene.clone(true);
}

function boxOf(obj) {
  obj.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(obj);
}

function sizeOf(obj) {
  return boxOf(obj).getSize(new THREE.Vector3());
}

function prepare(obj) {
  obj.traverse((c) => {
    if (!c.isMesh) return;
    c.castShadow = true;
    c.receiveShadow = true;
    const mats = Array.isArray(c.material) ? c.material : [c.material];
    const next = mats.map((m) => {
      if (!m) return m;
      const mat = m.clone();
      if ("transmission" in mat && mat.transmission > 0) {
        mat.transmission = 0;
        mat.transparent = true;
        mat.opacity = Math.min(mat.opacity ?? 1, 0.5);
        mat.depthWrite = false;
      }
      if (mat.emissive) mat.userData.baseEmissive = mat.emissive.clone();
      return mat;
    });
    c.material = Array.isArray(c.material) ? next : next[0];
  });
  return obj;
}

function ground(obj) {
  const b = boxOf(obj);
  obj.position.y += -b.min.y;
  return obj;
}

function scaleTo(obj, opts) {
  const s = sizeOf(obj);
  let f = 1;
  if (opts.height) f = opts.height / Math.max(s.y, 0.001);
  else if (opts.max) f = opts.max / Math.max(s.x, s.y, s.z, 0.001);
  else if (opts.width && opts.depth) {
    f = Math.min(opts.width / Math.max(s.x, 0.001), opts.depth / Math.max(s.z, 0.001));
  } else if (opts.width) f = opts.width / Math.max(s.x, 0.001);
  else if (opts.depth) f = opts.depth / Math.max(s.z, 0.001);
  obj.scale.multiplyScalar(f);
  return obj;
}

function tint(obj, hex) {
  const color = new THREE.Color(hex);
  obj.traverse((c) => {
    if (!c.isMesh || !c.material) return;
    const mats = Array.isArray(c.material) ? c.material : [c.material];
    mats.forEach((m) => {
      if (m.color) m.color.multiply(color);
    });
  });
}

function mark(obj, id, label) {
  const hs = { id, label };
  obj.userData.hotspot = hs;
  obj.traverse((c) => { c.userData.hotspot = hs; });
  return obj;
}

async function addModel(parent, file, x, z, opts = {}) {
  const obj = prepare(await loadGLB(file));
  if (opts.scale) obj.scale.multiplyScalar(opts.scale);
  if (opts.height || opts.width || opts.depth || opts.max) scaleTo(obj, opts);
  obj.rotation.y = opts.rotY || 0;
  obj.position.set(x, opts.y || 0, z);
  ground(obj);
  if (opts.lift) obj.position.y += opts.lift;
  if (opts.tint) tint(obj, opts.tint);
  if (opts.id) mark(obj, opts.id, opts.label || opts.id);
  parent.add(obj);
  return obj;
}

function std(color, extras = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.04, ...extras });
}

function mesh(geo, mat, x, y, z, parent, extra = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = extra.cast !== false;
  m.receiveShadow = true;
  if (extra.rotX) m.rotation.x = extra.rotX;
  if (extra.rotY) m.rotation.y = extra.rotY;
  parent.add(m);
  return m;
}


const texLoader = new THREE.TextureLoader();
const texCache = new Map();

function loadMap(file, { color = false, rx = 1, ry = 1 } = {}) {
  const key = `${file}|${rx}|${ry}|${color}`;
  if (texCache.has(key)) return texCache.get(key);
  const tex = texLoader.load(`${BASE}textures/${file}`);
  if (color) tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(rx, ry);
  tex.anisotropy = 8;
  texCache.set(key, tex);
  return tex;
}

function pbr(prefix, { rx = 2, ry = 2, color = 0xffffff, rough = 0.72, metal = 0.03, maps = true, nor = true, roughMap = true } = {}) {
  const opts = { color, roughness: rough, metalness: metal };
  if (maps) {
    opts.map = loadMap(`${prefix}_diff.jpg`, { color: true, rx, ry });
    if (nor) opts.normalMap = loadMap(`${prefix}_nor.jpg`, { rx, ry });
    if (roughMap) opts.roughnessMap = loadMap(`${prefix}_rough.jpg`, { rx, ry });
  }
  return new THREE.MeshStandardMaterial(opts);
}

function frameArt(parent, x, y, z, rotY, w, h, paint) {
  const wood = pbr("wood", { rx: 1, ry: 1, rough: 0.45 });
  mesh(new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.04), wood, x, y, z, parent, { rotY });
  mesh(new THREE.BoxGeometry(w, h, 0.02), std(paint, { roughness: 0.55 }), x, y, z + (Math.cos(rotY) * 0.03), parent, { rotY });
}

function windowUnit(parent, x, y, z, w, h, { curtains = false } = {}) {
  const trim = pbr("wood", { rx: 1, ry: 1, color: 0xf4eee6, rough: 0.48 });
  const glass = new THREE.MeshStandardMaterial({
    color: "#9fc5d8", roughness: 0.06, metalness: 0.12, transparent: true, opacity: 0.38,
  });
  const t = 0.07;
  mesh(new THREE.BoxGeometry(w + 0.12, t, 0.1), trim, x, y + h / 2, z, parent);
  mesh(new THREE.BoxGeometry(w + 0.12, t, 0.1), trim, x, y - h / 2, z, parent);
  mesh(new THREE.BoxGeometry(t, h, 0.1), trim, x - w / 2, y, z, parent);
  mesh(new THREE.BoxGeometry(t, h, 0.1), trim, x + w / 2, y, z, parent);
  mesh(new THREE.BoxGeometry(0.04, h - 0.08, 0.04), trim, x, y, z, parent);
  mesh(new THREE.BoxGeometry(w - 0.08, 0.04, 0.04), trim, x, y, z, parent);
  mesh(new THREE.BoxGeometry(w - 0.05, h - 0.05, 0.03), glass, x, y, z - 0.02, parent);
  mesh(new THREE.BoxGeometry(w + 0.22, 0.08, 0.18), trim, x, y - h / 2 - 0.06, z + 0.04, parent);
  if (curtains) {
    const fabric = pbr("fabric", { rx: 2, ry: 2, color: 0xe8d5c4, maps: false });
    fabric.map = loadMap("fabric_diff.jpg", { color: true, rx: 2, ry: 3 });
    const grp = new THREE.Group();
    mesh(new THREE.BoxGeometry(0.16, h * 0.95, 0.06), fabric, x - w / 2 + 0.12, y - 0.02, z + 0.08, grp);
    mesh(new THREE.BoxGeometry(0.16, h * 0.95, 0.06), fabric, x + w / 2 - 0.12, y - 0.02, z + 0.08, grp);
    mark(grp, "curtains", "Curtains");
    parent.add(grp);
  }
}

function shakerCabinet(parent, x, y, z, w, h, d, { rotY = 0, drawers = 0 } = {}) {
  const wood = pbr("kwood", { rx: 1.4, ry: 1.4, rough: 0.48 });
  const body = new THREE.Group();
  body.position.set(x, y, z);
  body.rotation.y = rotY;
  mesh(new THREE.BoxGeometry(w, h, d), wood, 0, 0, 0, body);
  const inset = 0.045;
  const face = std("#efe6d4", { roughness: 0.55 });
  if (drawers) {
    const dh = (h - 0.08) / drawers;
    for (let i = 0; i < drawers; i++) {
      const fy = -h / 2 + 0.06 + dh * i + dh / 2;
      mesh(new THREE.BoxGeometry(w - 0.1, dh - 0.05, 0.03), face, 0, fy, d / 2 + 0.01, body);
      mesh(new THREE.BoxGeometry(0.16, 0.02, 0.04), std("#c4a35a", { metalness: 0.75, roughness: 0.3 }), 0, fy, d / 2 + 0.04, body);
    }
  } else {
    mesh(new THREE.BoxGeometry(w - 0.12, h - 0.12, 0.03), face, 0, 0, d / 2 + 0.012, body);
    mesh(new THREE.BoxGeometry(0.03, 0.22, 0.04), std("#c4a35a", { metalness: 0.75, roughness: 0.3 }), w * 0.28, 0.05, d / 2 + 0.04, body);
  }
  parent.add(body);
  return body;
}


function buildShell(root) {
  const grass = pbr("grass", { rx: 18, ry: 18, color: 0x8aa56a, rough: 0.95, roughMap: false });
  const drive = pbr("asphalt", { rx: 5, ry: 4, rough: 0.9 });
  const paver = pbr("concrete", { rx: 1, ry: 1, color: 0xe2d3b8, rough: 0.7 });
  const brick = pbr("brick", { rx: 3.2, ry: 1.6, rough: 0.78 });
  const plaster = pbr("plaster", { rx: 3, ry: 2, color: 0xf7f1e8, rough: 0.74 });
  const plasterBed = pbr("plaster", { rx: 3, ry: 2, color: 0xf3e2d0, rough: 0.74 });
  const plasterKit = pbr("plaster", { rx: 3, ry: 2, color: 0xf4eee4, rough: 0.74 });
  const parquet = pbr("parquet", { rx: 3.5, ry: 3.5, rough: 0.42 });
  const tile = pbr("tile", { rx: 4, ry: 4, rough: 0.35 });
  const conc = pbr("concrete", { rx: 3, ry: 3, rough: 0.86 });
  const trim = pbr("wood", { rx: 2, ry: 1, color: 0xf3ebe0, rough: 0.5 });
  const roof = pbr("roof", { rx: 5, ry: 2.2, rough: 0.7 });
  const hedge = std("#3d5a38", { roughness: 0.9 });
  const woodDoor = pbr("wood", { rx: 1, ry: 2, color: 0x6b3e24, rough: 0.48 });

  mesh(new THREE.CircleGeometry(46, 64), grass, 3, 0, 3, root, { rotX: -Math.PI / 2, cast: false });

  mesh(new THREE.BoxGeometry(4.6, 0.1, 6.4), parquet, -5.3, 0.05, -2.3, root, { cast: false });
  mesh(new THREE.BoxGeometry(5.4, 0.1, 6.4), parquet, -0.3, 0.05, -2.3, root, { cast: false });
  mesh(new THREE.BoxGeometry(4.8, 0.1, 6.4), tile, 4.8, 0.05, -2.3, root, { cast: false });
  mesh(new THREE.BoxGeometry(4.8, 0.1, 5.4), conc, 4.8, 0.05, 3.7, root, { cast: false });

  // Exterior brick (outside) + interior plaster
  mesh(new THREE.BoxGeometry(15.2, 3.15, 0.12), brick, -0.4, 1.62, -5.64, root);
  mesh(new THREE.BoxGeometry(0.12, 3.15, 6.6), brick, -7.74, 1.62, -2.3, root);
  mesh(new THREE.BoxGeometry(0.12, 3.15, 6.6), brick, 7.34, 1.62, -2.3, root);
  mesh(new THREE.BoxGeometry(0.12, 3.15, 5.6), brick, 7.34, 1.62, 3.7, root);

  mesh(new THREE.BoxGeometry(4.55, 2.95, 0.1), plasterBed, -5.28, 1.58, -5.5, root);
  mesh(new THREE.BoxGeometry(5.35, 2.95, 0.1), plaster, -0.32, 1.58, -5.5, root);
  mesh(new THREE.BoxGeometry(4.75, 2.95, 0.1), plasterKit, 4.82, 1.58, -5.5, root);
  mesh(new THREE.BoxGeometry(0.1, 2.95, 6.35), plasterBed, -7.58, 1.58, -2.3, root);
  mesh(new THREE.BoxGeometry(0.1, 2.95, 6.35), plasterKit, 7.22, 1.58, -2.3, root);
  mesh(new THREE.BoxGeometry(0.1, 2.95, 5.35), plaster, 7.22, 1.58, 3.7, root);

  mesh(new THREE.BoxGeometry(0.12, 2.95, 6.35), plaster, -3.0, 1.58, -2.3, root);
  mesh(new THREE.BoxGeometry(0.12, 2.95, 6.35), plaster, 2.42, 1.58, -2.3, root);
  mesh(new THREE.BoxGeometry(4.8, 2.95, 0.12), plasterKit, 4.8, 1.58, 0.92, root);

  // Baseboards
  mesh(new THREE.BoxGeometry(15.0, 0.12, 0.06), trim, -0.4, 0.18, -5.42, root);
  mesh(new THREE.BoxGeometry(0.06, 0.12, 6.3), trim, -7.5, 0.18, -2.3, root);

  mesh(new THREE.BoxGeometry(15.0, 0.18, 0.14), plaster, -0.4, 0.14, 0.92, root);

  // Garage bay
  mesh(new THREE.BoxGeometry(4.8, 0.32, 0.18), brick, 4.8, 2.88, 6.44, root);
  mesh(new THREE.BoxGeometry(0.24, 2.55, 0.18), brick, 2.5, 1.4, 6.44, root);
  mesh(new THREE.BoxGeometry(0.24, 2.55, 0.18), brick, 7.12, 1.4, 6.44, root);
  const gMetal = new THREE.MeshStandardMaterial({ color: "#8b9096", metalness: 0.42, roughness: 0.4 });
  for (let i = 0; i < 9; i++) {
    mesh(new THREE.BoxGeometry(4.18, 0.14, 0.08), gMetal, 4.8, 1.92 + i * 0.09, 6.28, root);
  }

  // Pitched cutaway roof + west gable
  const roofSlab = mesh(new THREE.BoxGeometry(15.8, 0.12, 4.1), roof, -0.4, 4.05, -6.55, root);
  roofSlab.rotation.x = 0.48;
  mesh(new THREE.BoxGeometry(15.9, 0.18, 0.16), trim, -0.4, 3.22, -5.82, root);
  const gable = new THREE.Shape();
  gable.moveTo(-3.3, 0);
  gable.lineTo(3.3, 0);
  gable.lineTo(0, 1.9);
  const gableMesh = new THREE.Mesh(new THREE.ShapeGeometry(gable), brick);
  gableMesh.position.set(-7.76, 3.18, -2.3);
  gableMesh.rotation.y = Math.PI / 2;
  gableMesh.castShadow = true;
  gableMesh.receiveShadow = true;
  root.add(gableMesh);
  const roofWest = mesh(new THREE.BoxGeometry(6.8, 0.12, 2.6), roof, -8.55, 4.05, -2.3, root);
  roofWest.rotation.z = -0.55;

  // Front door + porch + steps
  mesh(new THREE.BoxGeometry(1.22, 2.25, 0.12), woodDoor, 0.15, 1.22, 0.98, root);
  mesh(new THREE.BoxGeometry(0.38, 0.55, 0.04), pbr("wood", { rx: 1, ry: 1, color: 0x5c3318 }), 0.15, 1.55, 1.05, root);
  mesh(new THREE.BoxGeometry(0.38, 0.55, 0.04), pbr("wood", { rx: 1, ry: 1, color: 0x5c3318 }), 0.15, 0.85, 1.05, root);
  mesh(new THREE.BoxGeometry(0.08, 2.3, 0.14), trim, -0.52, 1.22, 0.98, root);
  mesh(new THREE.BoxGeometry(0.08, 2.3, 0.14), trim, 0.82, 1.22, 0.98, root);
  mesh(new THREE.BoxGeometry(1.4, 0.08, 0.16), trim, 0.15, 2.38, 0.98, root);
  mesh(new THREE.SphereGeometry(0.045, 12, 10), std("#c4a35a", { metalness: 0.82, roughness: 0.28 }), 0.52, 1.2, 1.08, root);
  mesh(new THREE.BoxGeometry(1.7, 0.1, 1.15), paver, 0.15, 0.08, 1.55, root, { cast: false });
  mesh(new THREE.BoxGeometry(1.45, 0.1, 0.38), paver, 0.15, 0.14, 2.05, root);
  mesh(new THREE.BoxGeometry(1.2, 0.1, 0.35), paver, 0.15, 0.24, 2.32, root);

  windowUnit(root, -5.2, 1.85, -5.46, 1.55, 1.4);
  windowUnit(root, -0.2, 1.9, -5.46, 1.95, 1.5, { curtains: true });
  windowUnit(root, 4.75, 1.85, -5.46, 1.55, 1.4);

  mesh(new THREE.BoxGeometry(8.8, 0.07, 7.6), drive, 8.4, 0.03, 9.4, root, { cast: false });
  for (let i = 0; i < 8; i++) {
    mesh(new THREE.BoxGeometry(0.95, 0.06, 0.48), paver, -1.1, 0.05, 1.55 + i * 0.7, root, { cast: false });
  }
  mesh(new THREE.BoxGeometry(5.6, 0.55, 0.45), hedge, -4.8, 0.35, 7.6, root);
  mesh(new THREE.BoxGeometry(0.45, 0.7, 6.2), hedge, -11.2, 0.42, -1.2, root);

  frameArt(root, -4.0, 1.85, -5.42, 0, 0.55, 0.7, "#c45c26");
  frameArt(root, 0.95, 1.85, -5.42, 0, 0.7, 0.5, "#2c4a3e");
}

async function buildYard(root) {
  const yard = new THREE.Group();
  yard.position.set(-7.6, 0, 3.8);
  mark(yard, "yard", "Yard & garden");
  root.add(yard);
  await addModel(yard, "bush.glb", 0.2, 0.4, { height: 0.85 });
  await addModel(yard, "bush-small.glb", -1.1, 1.1, { height: 0.55 });
  await addModel(yard, "plant.glb", 1.15, 0.8, { height: 0.7 });
  await addModel(root, "tree.glb", -10.2, -3.4, { height: 3.4, tint: "#7d8f4a" });
  await addModel(root, "tree-oak.glb", -9.4, 6.2, { height: 3.1, tint: "#6e8242" });
  await addModel(root, "tree.glb", 12.6, -9.2, { height: 3.2, tint: "#7d8f4a" });
  await addModel(root, "fence.glb", -11.4, 4.2, { height: 1.1, rotY: Math.PI / 2 });

  const garden = new THREE.Group();
  garden.position.set(-1.6, 0, 6.4);
  mark(garden, "garden", "Garden bed");
  root.add(garden);
  mesh(new THREE.BoxGeometry(3.6, 0.16, 1.6), std("#6b4b32"), 0, 0.1, 0, garden);
  await addModel(garden, "flower-red.glb", -1.1, 0.15, { height: 0.28 });
  await addModel(garden, "flower-yellow.glb", -0.35, -0.2, { height: 0.26 });
  await addModel(garden, "flower-purple.glb", 0.4, 0.2, { height: 0.27 });
  await addModel(garden, "flower-red.glb", 1.1, -0.15, { height: 0.25 });
  await addModel(garden, "flower-yellow.glb", 0.2, 0.35, { height: 0.24 });
}

async function buildBedroom(root) {
  // Bed against the north wall — only in the bedroom
  await addModel(root, "bed-q.glb", -5.15, -3.55, { width: 2.35, rotY: Math.PI, id: "bed", label: "Bed" });
  await addModel(root, "nightstand.glb", -3.7, -4.55, { height: 0.62, id: "nightstand", label: "Bedside table" });
  await addModel(root, "lamp.glb", -3.7, -4.55, { height: 0.42, lift: 0.62 });
  await addModel(root, "ph/drawer/drawer_1k.gltf", -6.85, -4.35, { height: 1.2, rotY: Math.PI / 2, id: "dresser-his", label: "His dresser" });
  await addModel(root, "ph/drawer/drawer_1k.gltf", -6.85, -1.2, { height: 1.15, rotY: Math.PI / 2, tint: "#e8c4b8", id: "dresser-hers", label: "Her dresser" });
  await addModel(root, "wardrobe.glb", -3.55, -0.15, { height: 2.15, rotY: Math.PI, id: "wardrobe", label: "Wardrobe" });
}

async function buildLiving(root) {
  const rugMat = pbr("fabric", { rx: 2, ry: 2, color: 0xc4a07a, maps: false });
  rugMat.map = loadMap("fabric_diff.jpg", { color: true, rx: 2, ry: 2 });
  const rug = mesh(new THREE.BoxGeometry(3.5, 0.04, 2.5), rugMat, -0.35, 0.13, -2.2, root);
  mark(rug, "rug", "Living room rug");
  await addModel(root, "ph/Sofa_01/Sofa_01_1k.gltf", -0.35, -4.05, { width: 2.85, id: "sofa", label: "Living room sofa" });
  await addModel(root, "coffee-table.glb", -0.35, -2.35, { width: 1.2 });
  const media = new THREE.Group();
  media.position.set(1.88, 0, -2.55);
  mark(media, "media", "Media console");
  root.add(media);
  mesh(new THREE.BoxGeometry(0.42, 0.5, 1.55), pbr("wood", { rx: 1, ry: 1, rough: 0.45 }), 0, 0.32, 0, media);
  await addModel(media, "ph/Television_01/Television_01_1k.gltf", 0, 0, { width: 1.05, lift: 0.55, rotY: -Math.PI / 2 });
  await addModel(root, "speaker.glb", 1.85, -1.7, { height: 0.45 });
  await addModel(root, "speaker.glb", 1.85, -3.4, { height: 0.45 });
  await addModel(root, "plant.glb", -2.45, -4.55, { height: 0.85 });
  await addModel(root, "lamp-floor.glb", 1.85, -4.55, { height: 1.35 });
}

async function buildKitchen(root) {
  const kit = new THREE.Group();
  mark(kit, "kitchen", "Kitchen");
  root.add(kit);
  const quartz = new THREE.MeshStandardMaterial({ color: "#e8e0d4", roughness: 0.28, metalness: 0.08 });
  const steel = new THREE.MeshStandardMaterial({ color: "#c5c8cc", metalness: 0.72, roughness: 0.28 });
  const black = new THREE.MeshStandardMaterial({ color: "#2a2c2b", metalness: 0.35, roughness: 0.4 });

  // Fridge
  mesh(new THREE.BoxGeometry(0.78, 1.85, 0.68), steel, 3.2, 1.02, -4.95, kit);
  mesh(new THREE.BoxGeometry(0.04, 1.72, 0.62), steel, 3.58, 1.02, -4.95, kit);
  mesh(new THREE.BoxGeometry(0.03, 0.7, 0.03), std("#8a8f94", { metalness: 0.8, roughness: 0.25 }), 3.62, 1.35, -4.95, kit);

  shakerCabinet(kit, 4.15, 0.46, -4.98, 0.7, 0.88, 0.58);
  const sinkGrp = new THREE.Group();
  sinkGrp.position.set(5.05, 0, -4.95);
  mark(sinkGrp, "kitchen-sink", "Kitchen sink");
  kit.add(sinkGrp);
  shakerCabinet(sinkGrp, 0, 0.46, 0, 0.85, 0.88, 0.58, { drawers: 2 });
  mesh(new THREE.BoxGeometry(0.7, 0.08, 0.42), steel, 0, 0.94, 0.02, sinkGrp);
  mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.28, 10), steel, 0, 1.16, -0.1, sinkGrp);
  mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.18, 8), steel, 0, 1.28, 0.0, sinkGrp).rotation.x = Math.PI / 2;

  shakerCabinet(kit, 5.9, 0.46, -4.98, 0.7, 0.88, 0.58, { drawers: 3 });

  // Stove
  mesh(new THREE.BoxGeometry(0.72, 0.88, 0.6), black, 6.65, 0.5, -4.92, kit);
  mesh(new THREE.BoxGeometry(0.7, 0.04, 0.58), black, 6.65, 0.96, -4.92, kit);
  for (const [ox, oz] of [[-0.16, -0.14], [0.16, -0.14], [-0.16, 0.14], [0.16, 0.14]]) {
    mesh(new THREE.TorusGeometry(0.09, 0.015, 8, 16), steel, 6.65 + ox, 0.99, -4.92 + oz, kit, { rotX: Math.PI / 2 });
  }
  mesh(new THREE.BoxGeometry(0.55, 0.28, 0.04), std("#1a1a1a", { roughness: 0.3 }), 6.65, 0.45, -4.6, kit);
  mesh(new THREE.BoxGeometry(0.7, 0.12, 0.55), steel, 6.65, 1.72, -5.05, kit);

  mesh(new THREE.BoxGeometry(4.6, 0.06, 0.68), quartz, 5.05, 0.94, -4.95, kit);
  mesh(new THREE.BoxGeometry(3.6, 0.55, 0.04), pbr("tile", { rx: 3, ry: 1.2, rough: 0.4 }), 5.15, 1.35, -5.36, kit);

  shakerCabinet(kit, 4.25, 2.05, -5.12, 0.85, 0.62, 0.36);
  shakerCabinet(kit, 5.2, 2.05, -5.12, 0.85, 0.62, 0.36);
  shakerCabinet(kit, 6.15, 2.05, -5.12, 0.85, 0.62, 0.36);

  shakerCabinet(kit, 4.9, 0.46, -2.2, 1.7, 0.88, 0.7, { rotY: 0 });
  mesh(new THREE.BoxGeometry(1.82, 0.06, 0.78), quartz, 4.9, 0.94, -2.2, kit);
  await addModel(kit, "stool.glb", 4.35, -1.4, { height: 0.72 });
  await addModel(kit, "stool.glb", 5.45, -1.4, { height: 0.72 });
  await addModel(kit, "plant-small.glb", 3.35, -3.55, { height: 0.32 });
}

async function buildGarage(root) {
  await addModel(root, "workbench.glb", 3.55, 2.35, { width: 1.85, rotY: Math.PI / 2, id: "garage-workstation", label: "Garage workstation" });
  await addModel(root, "bookcase.glb", 6.55, 4.85, { height: 1.7, rotY: -Math.PI / 2 });
  await addModel(root, "box.glb", 6.55, 4.55, { height: 0.32, lift: 1.15 });
  await addModel(root, "box-open.glb", 6.55, 5.15, { height: 0.28, lift: 0.55 });
  await addModel(root, "box.glb", 3.2, 5.35, { height: 0.38 });
  await addModel(root, "desk.glb", 5.7, 2.15, { width: 1.35, rotY: Math.PI });
}

async function attachWheels(car, parent) {
  const b = boxOf(car);
  const size = b.getSize(new THREE.Vector3());
  const y = 0.28;
  const xOff = size.x * 0.38;
  const zOff = size.z * 0.32;
  const spots = [
    [xOff, y, zOff], [-xOff, y, zOff], [xOff, y, -zOff], [-xOff, y, -zOff],
  ];
  // If the sedan already has dark tire-like meshes near the ground, skip extras
  let hasWheels = false;
  car.traverse((c) => {
    if (c.isMesh && /wheel|tire|tyre/i.test(c.name)) hasWheels = true;
  });
  if (hasWheels) return;
  for (const [x, wy, z] of spots) {
    const w = prepare(await loadGLB("wheel.glb"));
    scaleTo(w, { height: 0.58 });
    w.position.set(x, wy, z);
    parent.add(w);
  }
}

async function buildVehicles(root) {
  const carWrap = new THREE.Group();
  carWrap.position.set(7.15, 0, 9.55);
  mark(carWrap, "car", "Car");
  root.add(carWrap);
  await addModel(carWrap, "sedan.glb", 0, 0, { depth: 4.3, rotY: 0 });

  const rvWrap = new THREE.Group();
  rvWrap.position.set(11.55, 0, 8.15);
  mark(rvWrap, "rv", "RV");
  root.add(rvWrap);
  await addModel(rvWrap, "rv.glb", 0, 0, { depth: 5.15, rotY: 0 });
}

async function buildRVInterior(root) {
  const floor = std("#c4a07a");
  const wall = std("#f4eee6");
  mesh(new THREE.BoxGeometry(2.5, 0.08, 6.6), floor, 0, 0.04, 0, root, { cast: false });
  mesh(new THREE.BoxGeometry(2.5, 0.95, 0.08), wall, 0, 0.52, -3.3, root);
  mesh(new THREE.BoxGeometry(2.5, 0.95, 0.08), wall, 0, 0.52, 3.3, root);
  mesh(new THREE.BoxGeometry(0.08, 0.95, 6.6), wall, -1.25, 0.52, 0, root);
  mesh(new THREE.BoxGeometry(0.08, 0.95, 6.6), wall, 1.25, 0.52, 0, root);

  await addModel(root, "bed-single.glb", 0, 2.2, { width: 1.95, depth: 1.2, rotY: Math.PI, id: "rv-bed", label: "RV bed" });
  await addModel(root, "shower.glb", -0.72, 1.15, { height: 0.9, id: "rv-bathroom", label: "RV bathroom" });
  await addModel(root, "bath-sink.glb", 0.55, 1.2, { height: 0.62 });
  await addModel(root, "table.glb", -0.45, -0.2, { width: 0.72, depth: 0.72, id: "rv-dinette", label: "RV dinette" });
  await addModel(root, "chair.glb", -0.45, 0.4, { height: 0.5, rotY: Math.PI });
  await addModel(root, "chair.glb", -0.45, -0.8, { height: 0.5 });
  await addModel(root, "cabinet.glb", 0.78, 0.05, { height: 0.62, rotY: -Math.PI / 2, id: "rv-kitchen", label: "RV kitchenette" });
  await addModel(root, "sink.glb", 0.78, 0.5, { height: 0.48, rotY: -Math.PI / 2 });
  await addModel(root, "dresser.glb", 0.78, -1.15, { height: 0.72, rotY: -Math.PI / 2, id: "rv-storage", label: "RV storage" });
  await addModel(root, "chair.glb", -0.48, -2.4, { height: 0.55, rotY: Math.PI, id: "rv-cab", label: "RV cabin" });
  await addModel(root, "chair.glb", 0.48, -2.4, { height: 0.55, rotY: Math.PI });
}

export async function initHouse(container, options = {}) {
  const width = () => container.clientWidth || 960;
  const height = () => Math.max(container.clientHeight || 640, 320);

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: "default", failIfMajorPerformanceCaveat: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.setSize(width(), height());
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0xe7dcc8, 1);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#e7dcc8");
  scene.fog = new THREE.Fog("#e7dcc8", 42, 78);

  let aspect = width() / height();
  const houseFrustum = () => (width() < 700 ? 7.15 : 7.55);
  let frustum = houseFrustum();
  const camera = new THREE.OrthographicCamera(-frustum * aspect, frustum * aspect, frustum, -frustum, 0.1, 200);
  const houseTarget = new THREE.Vector3(3.35, 0.72, 2.55);
  const rvTarget = new THREE.Vector3(40, 0.25, 0);
  camera.position.set(houseTarget.x + 13.5, 17.2, houseTarget.z + 13.5);
  camera.lookAt(houseTarget);
  camera.userData.target = houseTarget.clone();

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.copy(houseTarget);
  controls.minZoom = 0.55;
  controls.maxZoom = 2.6;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = Math.PI / 2.15;
  controls.screenSpacePanning = true;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

  const hemi = new THREE.HemisphereLight(0xfff2dd, 0x6b7a4e, 0.42);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d6, 1.65);
  sun.position.set(18, 24, 12);
  sun.castShadow = true;
  const mapSize = width() < 700 ? 1024 : 2048;
  sun.shadow.mapSize.set(mapSize, mapSize);
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.04;
  const s = 26;
  sun.shadow.camera.left = -s;
  sun.shadow.camera.right = s;
  sun.shadow.camera.top = s;
  sun.shadow.camera.bottom = -s;
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 70;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xe8f0ff, 0.38);
  fill.position.set(-14, 10, -8);
  scene.add(fill);
  [
    [-5.2, 2.5, -2.2],
    [-0.2, 2.5, -2.2],
    [4.8, 2.5, -2.2],
    [4.8, 2.3, 3.6],
  ].forEach(([x, y, z]) => {
    const p = new THREE.PointLight(0xffe0b8, 0.42, 7.2, 1.6);
    p.position.set(x, y, z);
    scene.add(p);
  });

  try {
    const hdr = await new RGBELoader().loadAsync(`${BASE}textures/venice_sunset_1k.hdr`);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(hdr).texture;
    scene.environmentIntensity = 0.48;
    hdr.dispose();
    pmrem.dispose();
  } catch (err) {
    console.warn("HDRI unavailable", err);
  }

  const world = new THREE.Group();
  scene.add(world);
  buildShell(world);
  await Promise.all([
    buildYard(world),
    buildBedroom(world),
    buildLiving(world),
    buildKitchen(world),
    buildGarage(world),
    buildVehicles(world),
  ]);

  const rvWorld = new THREE.Group();
  rvWorld.position.copy(rvTarget);
  rvWorld.visible = false;
  scene.add(rvWorld);
  let rvBuilt = false;

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hovered = null;
  let view = "house";
  let anim = null;
  let ptrDown = null;

  function findHotspot(obj) {
    let o = obj;
    while (o) {
      if (o.userData && o.userData.hotspot) return o;
      o = o.parent;
    }
    return null;
  }

  function setEmissive(obj, hex, extra = 0) {
    if (!obj) return;
    obj.traverse((c) => {
      if (!c.isMesh) return;
      const mats = Array.isArray(c.material) ? c.material : [c.material];
      mats.forEach((m) => {
        if (!m || !m.emissive) return;
        const base = m.userData.baseEmissive || new THREE.Color(0x000000);
        if (hex) {
          m.emissive.set(hex);
          m.emissiveIntensity = 0.45 + extra;
        } else {
          m.emissive.copy(base);
          m.emissiveIntensity = 1;
        }
      });
    });
  }

  function setHover(obj) {
    if (hovered === obj) return;
    setEmissive(hovered, null);
    hovered = obj;
    setEmissive(obj, "#c45c26", 0.2);
    container.style.cursor = obj ? "pointer" : "grab";
    options.onHover?.(obj?.userData?.hotspot || null);
  }

  function applyFrustum(f) {
    frustum = f;
    camera.left = -frustum * aspect;
    camera.right = frustum * aspect;
    camera.top = frustum;
    camera.bottom = -frustum;
    camera.updateProjectionMatrix();
  }

  function pick(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const group = view === "house" ? world : rvWorld;
    const hits = raycaster.intersectObjects(group.children, true);
    return hits.length ? findHotspot(hits[0].object) : null;
  }

  function onPointerMove(e) {
    if (ptrDown && Math.hypot(e.clientX - ptrDown.x, e.clientY - ptrDown.y) > 8) ptrDown.moved = true;
    if (ptrDown && ptrDown.moved) return;
    setHover(pick(e.clientX, e.clientY));
  }

  async function setView(next) {
    view = next;
    if (next === "rv" && !rvBuilt) {
      await buildRVInterior(rvWorld);
      rvBuilt = true;
    }
    applyFrustum(next === "rv" ? 4.1 : houseFrustum());
    controls.enabled = false;
    const fromPos = camera.position.clone();
    const fromTarget = controls.target.clone();
    const toPos = next === "rv"
      ? new THREE.Vector3(rvTarget.x, 15.5, rvTarget.z + 0.12)
      : new THREE.Vector3(houseTarget.x + 13.5, 17.2, houseTarget.z + 13.5);
    const toTarget = next === "rv" ? rvTarget.clone() : houseTarget.clone();
    if (next === "rv") {
      controls.minPolarAngle = 0.02;
      controls.maxPolarAngle = 0.55;
    } else {
      controls.minPolarAngle = 0.35;
      controls.maxPolarAngle = Math.PI / 2.15;
    }
    rvWorld.visible = true;
    world.visible = true;
    setHover(null);
    anim = { fromPos, toPos, fromTarget, toTarget, start: performance.now(), dur: 900, next };
    options.onView?.(next);
  }

  function onPointerDown(e) {
    ptrDown = { x: e.clientX, y: e.clientY, moved: false };
  }

  function onPointerUp(e) {
    const wasTap = ptrDown && !ptrDown.moved && Math.hypot(e.clientX - ptrDown.x, e.clientY - ptrDown.y) < 10;
    ptrDown = null;
    if (!wasTap) return;
    const found = pick(e.clientX, e.clientY);
    setHover(found);
    if (!found) return;
    const hs = found.userData.hotspot;
    if (hs?.id === "rv" && view === "house") {
      setView("rv");
      return;
    }
    options.onSelect?.(hs);
  }

  function resize() {
    const w = width();
    const h = height();
    aspect = w / Math.max(h, 1);
    applyFrustum(frustum);
    renderer.setSize(w, h);
  }

  function focus(id) {
    const group = view === "house" ? world : rvWorld;
    let found = null;
    group.traverse((o) => {
      if (!found && o.userData?.hotspot?.id === id) found = o;
    });
    if (!found) return;
    const b = boxOf(found);
    const center = b.getCenter(new THREE.Vector3());
    controls.target.copy(center);
    camera.position.set(center.x + 8, center.y + 11, center.z + 8);
    camera.lookAt(center);
    applyFrustum(id === "rv" ? 6.2 : 5.4);
  }

  function tick(now) {
    requestAnimationFrame(tick);
    if (anim) {
      const t = Math.min(1, (now - anim.start) / anim.dur);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      camera.position.lerpVectors(anim.fromPos, anim.toPos, e);
      controls.target.lerpVectors(anim.fromTarget, anim.toTarget, e);
      camera.lookAt(controls.target);
      if (t >= 1) {
        camera.position.copy(anim.toPos);
        controls.target.copy(anim.toTarget);
        camera.lookAt(controls.target);
        if (anim.next === "rv") world.visible = false;
        else rvWorld.visible = false;
        controls.enabled = true;
        anim = null;
      }
    } else {
      controls.update();
    }
    renderer.render(scene, camera);
  }

  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointerup", onPointerUp);
  renderer.domElement.addEventListener("pointerleave", () => setHover(null));
  window.addEventListener("resize", resize);
  requestAnimationFrame(tick);

  const api = {
    setView,
    getView: () => view,
    focus,
    renderer,
    camera,
    scene,
    controls,
    resize,
    highlight(id) {
      let found = null;
      const group = view === "house" ? world : rvWorld;
      group.traverse((o) => { if (!found && o.userData?.hotspot?.id === id) found = o; });
      setHover(found);
    },
    dispose() {
      window.removeEventListener("resize", resize);
      controls.dispose();
      renderer.dispose();
    },
  };
  window.__HOUSE__ = api;
  options.onReady?.();
  return api;
}
