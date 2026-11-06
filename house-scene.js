import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const BASE = window.__ASSET_BASE__ || window.__SITE_BASE__ || "./";
const loader = new GLTFLoader();
const cache = new Map();
const SCALE = 11;

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
    mats.forEach((m) => { if (m.color) m.color.multiply(color); });
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

function hitBox(parent, id, label, x, y, z, w, h, d) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshBasicMaterial({ visible: false, transparent: true, opacity: 0, depthWrite: false })
  );
  m.position.set(x, y, z);
  mark(m, id, label);
  parent.add(m);
  return m;
}


const WALL_H = 2.62;
const WALL_T = 0.11;
const DOOR_W = 0.92;
const DOOR_H = 2.12;
const CLIP_Y = 2.72;

function baseboard(parent, x, y, z, w, d) {
  const trim = pbr("wood", { rx: 2, ry: 1, color: 0xf3ebe0, rough: 0.5 });
  mesh(new THREE.BoxGeometry(w, 0.1, d), trim, x, y, z, parent);
}

function wallX(parent, plaster, trim, x, z0, z1, { doorZ, open = 0 } = {}) {
  const zMin = Math.min(z0, z1), zMax = Math.max(z0, z1);
  const segs = [];
  if (doorZ == null) segs.push([zMin, zMax]);
  else {
    const d0 = doorZ - DOOR_W / 2, d1 = doorZ + DOOR_W / 2;
    if (d0 - zMin > 0.05) segs.push([zMin, d0]);
    if (zMax - d1 > 0.05) segs.push([d1, zMax]);
    const head = WALL_H - DOOR_H;
    mesh(new THREE.BoxGeometry(WALL_T, head, DOOR_W), plaster, x, DOOR_H + head / 2, doorZ, parent);
    hungDoor(parent, x, 0, doorZ, Math.PI / 2, open);
  }
  for (const [a, b] of segs) {
    const len = b - a, mid = (a + b) / 2;
    mesh(new THREE.BoxGeometry(WALL_T, WALL_H, len), plaster, x, WALL_H / 2, mid, parent);
    baseboard(parent, x, 0.06, mid, WALL_T + 0.04, len);
  }
}

function wallZ(parent, plaster, trim, z, x0, x1, { doorX, open = 0 } = {}) {
  const xMin = Math.min(x0, x1), xMax = Math.max(x0, x1);
  const segs = [];
  if (doorX == null) segs.push([xMin, xMax]);
  else {
    const d0 = doorX - DOOR_W / 2, d1 = doorX + DOOR_W / 2;
    if (d0 - xMin > 0.05) segs.push([xMin, d0]);
    if (xMax - d1 > 0.05) segs.push([d1, xMax]);
    const head = WALL_H - DOOR_H;
    mesh(new THREE.BoxGeometry(DOOR_W, head, WALL_T), plaster, doorX, DOOR_H + head / 2, z, parent);
    hungDoor(parent, doorX, 0, z, 0, open);
  }
  for (const [a, b] of segs) {
    const len = b - a, mid = (a + b) / 2;
    mesh(new THREE.BoxGeometry(len, WALL_H, WALL_T), plaster, mid, WALL_H / 2, z, parent);
    baseboard(parent, mid, 0.06, z, len, WALL_T + 0.04);
  }
}

function hungDoor(parent, x, y, z, facing, open = 0) {
  const wood = pbr("wood", { rx: 1, ry: 2, color: 0x6b3e24, rough: 0.48 });
  const brass = std("#c4a35a", { metalness: 0.82, roughness: 0.28 });
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = facing;
  const leaf = new THREE.Group();
  leaf.position.set(-DOOR_W / 2, 0, 0);
  leaf.rotation.y = open;
  mesh(new THREE.BoxGeometry(DOOR_W - 0.04, DOOR_H - 0.04, 0.05), wood, DOOR_W / 2, DOOR_H / 2, 0, leaf);
  mesh(new THREE.BoxGeometry(0.22, 0.72, 0.02), pbr("wood", { rx: 1, ry: 1, color: 0x5c3318 }), DOOR_W / 2, 1.35, 0.03, leaf);
  mesh(new THREE.BoxGeometry(0.22, 0.72, 0.02), pbr("wood", { rx: 1, ry: 1, color: 0x5c3318 }), DOOR_W / 2, 0.55, 0.03, leaf);
  mesh(new THREE.SphereGeometry(0.035, 10, 8), brass, DOOR_W - 0.16, 1.02, 0.05, leaf);
  g.add(leaf);
  parent.add(g);
  return g;
}

function ceilingLamp(parent, x, z) {
  const shade = std("#f7f0e4", { roughness: 0.45, emissive: new THREE.Color("#ffd9a8"), emissiveIntensity: 0.35 });
  mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.08, 12), shade, x, 2.52, z, parent);
  mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 8), std("#d8d0c4"), x, 2.6, z, parent, { cast: false });
  const light = new THREE.PointLight(0xffe0b8, 0.55, 5.8, 1.5);
  light.position.set(x, 2.35, z);
  parent.add(light);
}

async function buildProperty(root) {
  const grass = pbr("grass", { rx: 18, ry: 18, color: 0x8aa56a, rough: 0.95, roughMap: false });
  mesh(new THREE.CircleGeometry(36, 64), grass, 2, 0, 0, root, { rotX: -Math.PI / 2, cast: false });

  const shell = new THREE.Group();
  const bungalow = prepare(await loadGLB("house/bungalow.glb"));
  shell.add(bungalow);
  root.add(shell);

  const interiors = new THREE.Group();
  root.add(interiors);

  const plaster = pbr("plaster", { rx: 3, ry: 2, color: 0xf7f1e8, rough: 0.74 });
  const plasterBed = pbr("plaster", { rx: 3, ry: 2, color: 0xf3e2d0, rough: 0.74 });
  const plasterKit = pbr("plaster", { rx: 3, ry: 2, color: 0xf4eee4, rough: 0.74 });
  const trim = pbr("wood", { rx: 2, ry: 1, color: 0xf3ebe0, rough: 0.5 });
  const parquet = pbr("parquet", { rx: 4, ry: 4, rough: 0.42 });
  const tile = pbr("tile", { rx: 4, ry: 4, rough: 0.35 });
  const conc = pbr("concrete", { rx: 3, ry: 3, rough: 0.86 });
  const fabric = pbr("fabric", { rx: 2, ry: 2, color: 0xc4a07a, maps: false });
  fabric.map = loadMap("fabric_diff.jpg", { color: true, rx: 2, ry: 2 });

  // Interior of the bungalow (inset from the exterior walls).
  const x0 = -5.72, x1 = 5.72, z0 = -4.28, z1 = 3.28;
  const hx = -0.88; // hallway / kitchen split
  const lx = 0.28;  // living split
  const kz = 0.92;  // kitchen / bath split
  const bz = -0.88; // bedroom north wall

  mesh(new THREE.BoxGeometry(hx - x0, 0.08, z1 - kz), tile, (x0 + hx) / 2, 0.07, (kz + z1) / 2, interiors, { cast: false });
  mesh(new THREE.BoxGeometry(hx - x0, 0.08, kz - bz), tile, (x0 + hx) / 2, 0.07, (bz + kz) / 2, interiors, { cast: false });
  mesh(new THREE.BoxGeometry(lx - x0, 0.08, bz - z0), parquet, (x0 + lx) / 2, 0.07, (z0 + bz) / 2, interiors, { cast: false });
  mesh(new THREE.BoxGeometry(x1 - lx, 0.08, z1 - z0), parquet, (lx + x1) / 2, 0.07, (z0 + z1) / 2, interiors, { cast: false });
  mesh(new THREE.BoxGeometry(lx - hx, 0.08, z1 - bz), parquet, (hx + lx) / 2, 0.07, (bz + z1) / 2, interiors, { cast: false });

  wallX(interiors, plasterKit, trim, hx, kz, z1, { doorZ: 2.05, open: -1.05 });
  wallX(interiors, plaster, trim, hx, bz, kz, { doorZ: 0.05, open: -0.35 });
  wallZ(interiors, plasterKit, trim, kz, x0, hx);
  wallZ(interiors, plasterBed, trim, bz, x0, lx, { doorX: -0.15, open: 1.15 });
  wallX(interiors, plaster, trim, lx, z0, bz);

  ceilingLamp(interiors, -3.2, 2.05);
  ceilingLamp(interiors, 2.6, 0.35);
  ceilingLamp(interiors, 2.6, -2.4);
  ceilingLamp(interiors, -2.6, -2.5);
  ceilingLamp(interiors, -3.2, 0.05);
  ceilingLamp(interiors, -0.3, 1.6);

  // Kitchen (front-left)
  const kitchen = new THREE.Group();
  interiors.add(kitchen);
  mark(kitchen, "kitchen", "Kitchen");
  await addModel(kitchen, "fridge.glb", -5.28, 1.25, { height: 1.9, rotY: Math.PI / 2 });
  await addModel(kitchen, "stove.glb", -5.28, 2.15, { height: 0.98, rotY: Math.PI / 2 });
  await addModel(kitchen, "hood.glb", -5.28, 2.15, { width: 0.78, lift: 1.38, rotY: Math.PI / 2 });
  await addModel(kitchen, "sink.glb", -5.28, 2.95, { width: 0.82, rotY: Math.PI / 2, id: "kitchen-sink", label: "Kitchen sink" });
  await addModel(kitchen, "cabinet.glb", -5.28, 1.7, { height: 0.9, rotY: Math.PI / 2 });
  await addModel(kitchen, "cabinet-drawer.glb", -5.28, 2.55, { height: 0.9, rotY: Math.PI / 2 });
  await addModel(kitchen, "cabinet-upper.glb", -5.28, 2.95, { width: 0.78, lift: 1.42, rotY: Math.PI / 2 });
  await addModel(kitchen, "cabinet-upper.glb", -5.28, 1.7, { width: 0.78, lift: 1.42, rotY: Math.PI / 2 });
  await addModel(kitchen, "kitchen-island.glb", -3.15, 2.05, { width: 1.45 });
  await addModel(kitchen, "stool.glb", -3.15, 1.55, { height: 0.72 });
  await addModel(kitchen, "stool.glb", -2.65, 2.45, { height: 0.72, rotY: 0.25 });
  await addModel(kitchen, "plant-small.glb", -1.45, 1.45, { height: 0.32 });

  // Bathroom
  await addModel(interiors, "shower.glb", -5.15, 0.05, { height: 2.05 });
  await addModel(interiors, "bath-sink.glb", -2.05, 0.35, { height: 0.85, rotY: Math.PI / 2 });

  // Bedroom (back-left)
  await addModel(interiors, "bed-q.glb", -2.85, -3.15, { width: 2.25, rotY: Math.PI, id: "bed", label: "Bed" });
  await addModel(interiors, "pillow.glb", -2.45, -3.55, { width: 0.55 });
  await addModel(interiors, "pillow.glb", -3.25, -3.55, { width: 0.55 });
  await addModel(interiors, "nightstand.glb", -1.55, -3.35, { height: 0.62, id: "nightstand", label: "Bedside table" });
  await addModel(interiors, "lamp.glb", -1.55, -3.35, { height: 0.4, lift: 0.62 });
  await addModel(interiors, "nightstand.glb", -4.15, -3.35, { height: 0.62 });
  await addModel(interiors, "lamp.glb", -4.15, -3.35, { height: 0.4, lift: 0.62 });
  await addModel(interiors, "ph/drawer/drawer_1k.gltf", -5.25, -2.15, { height: 1.15, rotY: Math.PI / 2, id: "dresser-his", label: "His dresser" });
  await addModel(interiors, "ph/drawer/drawer_1k.gltf", -5.25, -3.35, { height: 1.08, rotY: Math.PI / 2, tint: "#e8c4b8", id: "dresser-hers", label: "Her dresser" });
  await addModel(interiors, "wardrobe.glb", -0.22, -3.45, { height: 2.05, rotY: Math.PI, id: "wardrobe", label: "Wardrobe" });
  await addModel(interiors, "plant.glb", -0.55, -1.35, { height: 0.8 });
  const bedRug = mesh(new THREE.BoxGeometry(2.4, 0.04, 1.7), fabric, -2.85, 0.12, -2.35, interiors);
  mark(bedRug, "rug", "Living room rug");

  // Living (east)
  const sofa = await addModel(interiors, "ph/Sofa_01/Sofa_01_1k.gltf", 2.45, 0.95, { width: 2.6, rotY: Math.PI / 2, tint: "#6a4a38", id: "sofa", label: "Living room sofa" });
  await addModel(interiors, "coffee-table.glb", 3.5, 0.95, { width: 1.2 });
  await addModel(interiors, "sofa-kenney.glb", 3.85, 2.25, { width: 1.45, rotY: Math.PI, tint: "#7a3d32" });
  await addModel(interiors, "plant.glb", 1.15, 1.15, { height: 0.95 });
  const rugMat = std("#8a4332", { roughness: 0.9 });
  const liveRug = mesh(new THREE.BoxGeometry(3.25, 0.05, 2.7), rugMat, 3.3, 0.12, 0.85, interiors);
  mark(liveRug, "rug", "Living room rug");
  const media = new THREE.Group();
  media.position.set(5.15, 0, 0.85);
  mark(media, "media", "Media console");
  interiors.add(media);
  mesh(new THREE.BoxGeometry(0.42, 0.48, 1.55), pbr("wood", { rx: 1, ry: 1, rough: 0.45 }), 0, 0.3, 0, media);
  await addModel(media, "ph/Television_01/Television_01_1k.gltf", 0, 0, { width: 1.1, lift: 0.52, rotY: -Math.PI / 2 });
  await addModel(interiors, "lamp-floor.glb", 4.85, 2.25, { height: 1.45 });
  await addModel(interiors, "sidetable.glb", 4.85, -0.85, { height: 0.72 });
  await addModel(interiors, "plant.glb", 1.05, 2.85, { height: 0.95 });
  await addModel(interiors, "bookcase.glb", 5.2, -3.35, { height: 1.85, rotY: -Math.PI / 2 });
  await addModel(interiors, "table.glb", 2.45, -1.85, { width: 1.4 });
  await addModel(interiors, "chair.glb", 2.45, -1.3, { height: 0.88 });
  await addModel(interiors, "chair.glb", 2.45, -2.4, { height: 0.88, rotY: Math.PI });
  await addModel(interiors, "chair.glb", 1.85, -1.85, { height: 0.88, rotY: Math.PI / 2 });
  const curtains = new THREE.Group();
  interiors.add(curtains);
  mark(curtains, "curtains", "Curtains");
  mesh(new THREE.BoxGeometry(0.12, 1.55, 0.08), fabric, 2.05, 1.55, 3.15, curtains);
  mesh(new THREE.BoxGeometry(0.12, 1.55, 0.08), fabric, 3.35, 1.55, 3.15, curtains);

  await addModel(interiors, "sidetable.glb", -0.25, 2.65, { height: 0.75 });
  await addModel(interiors, "plant-small.glb", -0.25, 2.65, { height: 0.28, lift: 0.75 });
  await addModel(interiors, "chair.glb", 2.05, 1.45, { height: 0.88, rotY: 0.4 });
  hungDoor(interiors, 5.66, 0, 1.35, Math.PI / 2, -1.2);

  // Attached garage wing on the +X side
  const garage = new THREE.Group();
  garage.position.set(0, 0, 0);
  interiors.add(garage);
  const gx0 = 6.42, gx1 = 11.55, gz0 = -3.05, gz1 = 3.05;
  mesh(new THREE.BoxGeometry(gx1 - gx0, 0.08, gz1 - gz0), conc, (gx0 + gx1) / 2, 0.06, (gz0 + gz1) / 2, garage, { cast: false });
  const siding = std("#e6c45c", { roughness: 0.72 });
  const stone = pbr("concrete", { rx: 2, ry: 0.6, color: 0xc5bba8, rough: 0.86 });
  const roofMat = std("#de7a62", { roughness: 0.56, map: loadMap("roof_diff.jpg", { color: true, rx: 4, ry: 2 }) });
  roofMat.color.multiply(new THREE.Color("#ffd2c4"));
  // inner (house) wall is the bungalow itself; build the other three
  mesh(new THREE.BoxGeometry(gx1 - gx0, 0.4, WALL_T), stone, (gx0 + gx1) / 2, 0.2, gz0, garage);
  mesh(new THREE.BoxGeometry(gx1 - gx0, WALL_H - 0.4, WALL_T), siding, (gx0 + gx1) / 2, 0.4 + (WALL_H - 0.4) / 2, gz0, garage);
  mesh(new THREE.BoxGeometry(gx1 - gx0, 0.4, WALL_T), stone, (gx0 + gx1) / 2, 0.2, gz1, garage);
  mesh(new THREE.BoxGeometry(gx1 - gx0, WALL_H - 0.4, WALL_T), siding, (gx0 + gx1) / 2, 0.4 + (WALL_H - 0.4) / 2, gz1, garage);
  const pane = new THREE.MeshStandardMaterial({ color: "#cfe7f2", roughness: 0.08, metalness: 0.15, transparent: true, opacity: 0.45 });
  mesh(new THREE.BoxGeometry(1.15, 0.85, 0.04), pane, 8.4, 1.55, gz1 + 0.04, garage, { cast: false });
  mesh(new THREE.BoxGeometry(1.25, 0.08, 0.06), std("#6a5844"), 8.4, 1.12, gz1 + 0.05, garage);
  mesh(new THREE.BoxGeometry(1.25, 0.08, 0.06), std("#6a5844"), 8.4, 1.98, gz1 + 0.05, garage);
  // outer wall with roll-up opening
  const openW = 2.7, openH = 2.15, midZ = 0;
  const side = ((gz1 - gz0) - openW) / 2;
  mesh(new THREE.BoxGeometry(WALL_T, WALL_H, side), siding, gx1, WALL_H / 2, gz0 + side / 2, garage);
  mesh(new THREE.BoxGeometry(WALL_T, WALL_H, side), siding, gx1, WALL_H / 2, gz1 - side / 2, garage);
  mesh(new THREE.BoxGeometry(WALL_T, WALL_H - openH, openW), siding, gx1, openH + (WALL_H - openH) / 2, midZ, garage);
  mesh(new THREE.BoxGeometry(WALL_T, 0.4, gz1 - gz0), stone, gx1, 0.2, 0, garage);
  const gMetal = new THREE.MeshStandardMaterial({ color: "#8b9096", metalness: 0.45, roughness: 0.38 });
  for (let i = 0; i < 10; i++) {
    mesh(new THREE.BoxGeometry(0.06, 0.13, openW - 0.1), gMetal, gx1 - 0.04, 1.72 + i * 0.08, midZ, garage);
  }
  const roof = mesh(new THREE.BoxGeometry(gx1 - gx0 + 0.45, 0.12, gz1 - gz0 + 0.5), roofMat, (gx0 + gx1) / 2, 3.55, 0, garage);
  roof.rotation.x = 0.12;
  ceilingLamp(garage, 8.9, 0);
  await addModel(garage, "workbench.glb", 8.15, -2.15, { width: 2.05, rotY: 0, id: "garage-workstation", label: "Garage workstation" });
  // pegboard
  mesh(new THREE.BoxGeometry(0.06, 1.15, 1.7), pbr("wood", { rx: 1, ry: 1, color: 0x8a5a32 }), 8.15, 1.55, -2.55, garage);
  for (let i = 0; i < 5; i++) {
    mesh(new THREE.BoxGeometry(0.04, 0.35, 0.04), std("#888"), 8.22, 1.35, -2.15 + i * 0.28, garage);
  }
  mesh(new THREE.BoxGeometry(0.42, 1.55, 1.15), pbr("wood", { rx: 1, ry: 1 }), 10.95, 0.85, -2.15, garage);
  mesh(new THREE.BoxGeometry(0.42, 1.55, 1.15), pbr("wood", { rx: 1, ry: 1 }), 10.95, 0.85, 2.15, garage);
  await addModel(garage, "box.glb", 10.95, -2.15, { height: 0.32, lift: 1.55 });
  await addModel(garage, "box-open.glb", 10.95, 2.15, { height: 0.3, lift: 0.55 });
  await addModel(garage, "bookcase.glb", 7.15, 2.45, { height: 1.65, rotY: Math.PI });

  const drive = pbr("asphalt", { rx: 3, ry: 3, rough: 0.9 });
  mesh(new THREE.BoxGeometry(7.4, 0.05, 8.6), drive, 13.3, 0.03, 0.15, root, { cast: false });

  const yard = new THREE.Group();
  yard.position.set(-7.6, 0, 0.15);
  mark(yard, "yard", "Yard & garden");
  root.add(yard);
  await addModel(yard, "bush.glb", 0.15, 0.2, { height: 0.85 });
  await addModel(yard, "bush-small.glb", -0.7, 0.85, { height: 0.5 });
  await addModel(yard, "plant.glb", 0.9, 0.55, { height: 0.7 });
  await addModel(root, "tree.glb", -8.4, -3.2, { height: 3.1, tint: "#7d8f4a" });
  await addModel(root, "tree-oak.glb", -7.8, 3.9, { height: 2.9, tint: "#6e8242" });

  const garden = new THREE.Group();
  garden.position.set(-6.8, 0, 3.2);
  mark(garden, "garden", "Garden bed");
  root.add(garden);
  mesh(new THREE.BoxGeometry(2.6, 0.14, 1.15), std("#6b4b32"), 0, 0.08, 0, garden);
  await addModel(garden, "flower-red.glb", -0.8, 0.1, { height: 0.26 });
  await addModel(garden, "flower-yellow.glb", -0.15, -0.15, { height: 0.24 });
  await addModel(garden, "flower-purple.glb", 0.45, 0.12, { height: 0.25 });

  const carWrap = new THREE.Group();
  carWrap.position.set(8.7, 0, 0.15);
  mark(carWrap, "car", "Car");
  root.add(carWrap);
  await addModel(carWrap, "sedan.glb", 0, 0, { depth: 3.7, rotY: Math.PI / 2 });

  const rvWrap = new THREE.Group();
  rvWrap.position.set(12.6, 0, -4.85);
  mark(rvWrap, "rv", "RV");
  root.add(rvWrap);
  await addModel(rvWrap, "rv.glb", 0, 0, { depth: 4.6, rotY: Math.PI / 2 });

  return { shell, interiors, bungalow };
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
  renderer.toneMappingExposure = 1.04;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;
  renderer.setClearColor(0xe7dcc8, 1);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#e7dcc8");
  scene.fog = new THREE.Fog("#e7dcc8", 48, 86);

  let aspect = width() / height();
  let peek = true;
  const houseFrustum = () => (width() < 700 ? (peek ? 7.15 : 7.45) : (peek ? 7.45 : 7.7));
  let frustum = houseFrustum();
  const camera = new THREE.OrthographicCamera(-frustum * aspect, frustum * aspect, frustum, -frustum, 0.1, 200);

  const peekTarget = new THREE.Vector3(1.35, 1.45, 0.05);
  const exteriorTarget = new THREE.Vector3(1.6, 2.05, 0.25);
  const rvTarget = new THREE.Vector3(40, 0.25, 0);

  function houseCamPos(isPeek) {
    const t = houseLook(isPeek);
    const d = isPeek ? 9.6 : 10.8;
    const y = isPeek ? 10.8 : 11.6;
    return new THREE.Vector3(t.x + d, y, t.z + d);
  }
  function houseLook(isPeek) {
    return isPeek ? peekTarget.clone() : exteriorTarget.clone();
  }

  camera.position.copy(houseCamPos(true));
  camera.lookAt(peekTarget);
  camera.userData.target = peekTarget.clone();

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.copy(peekTarget);
  controls.minZoom = 0.55;
  controls.maxZoom = 2.6;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = Math.PI / 2.15;
  controls.screenSpacePanning = true;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

  const hemi = new THREE.HemisphereLight(0xfff2dd, 0x6b7a4e, 0.48);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d6, 1.55);
  sun.position.set(16, 22, 10);
  sun.castShadow = true;
  const mapSize = width() < 700 ? 1024 : 2048;
  sun.shadow.mapSize.set(mapSize, mapSize);
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.04;
  const s = 28;
  sun.shadow.camera.left = -s;
  sun.shadow.camera.right = s;
  sun.shadow.camera.top = s;
  sun.shadow.camera.bottom = -s;
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 70;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xe8f0ff, 0.42);
  fill.position.set(-14, 10, -8);
  scene.add(fill);

  try {
    const hdr = await new RGBELoader().loadAsync(`${BASE}textures/venice_sunset_1k.hdr`);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(hdr).texture;
    scene.environmentIntensity = 0.34;
    hdr.dispose();
    pmrem.dispose();
  } catch (err) {
    console.warn("HDRI unavailable", err);
  }

  let shell = null;
  let interiors = null;
  const roofClip = new THREE.Plane(new THREE.Vector3(0, -1, 0), CLIP_Y);
  const waistClip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1.28);
  function applyPlanes(obj, planes) {
    if (!obj) return;
    obj.traverse((c) => {
      if (!c.isMesh) return;
      if (c.name === "bungalow_door_l" || c.parent?.name === "bungalow_door_l") {
        c.material.clippingPlanes = planes ? [roofClip] : [];
        return;
      }
      const mats = Array.isArray(c.material) ? c.material : [c.material];
      mats.forEach((m) => {
        if (!m) return;
        m.clippingPlanes = planes || [];
        m.clipShadows = true;
      });
    });
  }
  function setBungalowDoor(open) {
    if (!shell) return;
    shell.traverse((o) => {
      if (o.name === "bungalow_door_l") o.rotation.y = open ? -1.15 : 0;
    });
  }
  function applyPeekVisibility() {
    if (shell) shell.visible = true;
    if (interiors) interiors.visible = true;
    renderer.clippingPlanes = peek ? [roofClip] : [];
    applyPlanes(shell, peek ? [roofClip, waistClip] : []);
    setBungalowDoor(peek);
  }

  const world = new THREE.Group();
  scene.add(world);
  const built = await buildProperty(world);
  shell = built.shell;
  interiors = built.interiors;
  applyPeekVisibility();

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

  function setPeek(next) {
    peek = !!next;
    applyPeekVisibility();
    applyFrustum(houseFrustum());
    controls.enabled = false;
    const fromPos = camera.position.clone();
    const fromTarget = controls.target.clone();
    const toPos = houseCamPos(peek);
    const toTarget = houseLook(peek);
    anim = { fromPos, toPos, fromTarget, toTarget, start: performance.now(), dur: 800, next: "house" };
    options.onPeek?.(peek);
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
      : houseCamPos(peek);
    const toTarget = next === "rv" ? rvTarget.clone() : houseLook(peek);
    if (next === "rv") {
      applyPeekVisibility();
      controls.minPolarAngle = 0.02;
      controls.maxPolarAngle = 0.55;
    } else {
      applyPeekVisibility();
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
    camera.position.set(center.x + 7, center.y + 9, center.z + 7);
    camera.lookAt(center);
    applyFrustum(id === "rv" ? 6.4 : 5.6);
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
    setPeek,
    getPeek: () => peek,
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
  options.onPeek?.(peek);
  return api;
}
