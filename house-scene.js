import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
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

function buildShell(root) {
  const grass = std("#7d9a63");
  const dirt = std("#6b4b32");
  const paver = std("#d5c4a8");
  const drive = std("#9aa1a6");
  const wall = std("#f3ece3");
  const trim = std("#efe4d4");
  const oak = std("#c4a07a");
  const tile = std("#ddd4c6");
  const conc = std("#b8b4ae");
  const hedge = std("#3f5c3a");

  mesh(new THREE.CircleGeometry(46, 64), grass, 3, 0, 3, root, { rotX: -Math.PI / 2, cast: false });

  // Bedroom | Living | Kitchen floors (north)
  mesh(new THREE.BoxGeometry(4.6, 0.1, 6.4), oak, -5.3, 0.05, -2.3, root, { cast: false });
  mesh(new THREE.BoxGeometry(5.4, 0.1, 6.4), oak, -0.3, 0.05, -2.3, root, { cast: false });
  mesh(new THREE.BoxGeometry(4.8, 0.1, 6.4), tile, 4.8, 0.05, -2.3, root, { cast: false });
  // Garage floor (south of kitchen)
  mesh(new THREE.BoxGeometry(4.8, 0.1, 5.4), conc, 4.8, 0.05, 3.7, root, { cast: false });

  // Back (north) wall and west wall — dollhouse keeps these
  mesh(new THREE.BoxGeometry(15.0, 3.05, 0.14), wall, -0.4, 1.62, -5.52, root);
  mesh(new THREE.BoxGeometry(0.14, 3.05, 6.5), wall, -7.62, 1.62, -2.3, root);
  // East exterior wall behind kitchen / garage (kept but shorter visually on garage opening)
  mesh(new THREE.BoxGeometry(0.14, 3.05, 6.5), wall, 7.22, 1.62, -2.3, root);
  mesh(new THREE.BoxGeometry(0.14, 3.05, 5.5), wall, 7.22, 1.62, 3.7, root);

  // Partition: bedroom | living, living | kitchen
  mesh(new THREE.BoxGeometry(0.12, 2.95, 6.35), wall, -3.0, 1.58, -2.3, root);
  mesh(new THREE.BoxGeometry(0.12, 2.95, 6.35), wall, 2.42, 1.58, -2.3, root);
  // Kitchen | garage divider (full wall so a bed cannot visually sit in both)
  mesh(new THREE.BoxGeometry(4.8, 2.95, 0.12), wall, 4.8, 1.58, 0.92, root);

  // Low south thresholds (cutaway)
  mesh(new THREE.BoxGeometry(15.0, 0.18, 0.14), wall, -0.4, 0.14, 0.92, root);
  // Garage opening facing the driveway (south) — header + side jambs like a real bay
  mesh(new THREE.BoxGeometry(4.8, 0.28, 0.16), wall, 4.8, 2.85, 6.42, root);
  mesh(new THREE.BoxGeometry(0.22, 2.5, 0.16), wall, 2.52, 1.4, 6.42, root);
  mesh(new THREE.BoxGeometry(0.22, 2.5, 0.16), wall, 7.1, 1.4, 6.42, root);
  // Rolled-up garage door tucked under the header
  const doorMat = new THREE.MeshStandardMaterial({ color: "#8a8f93", metalness: 0.35, roughness: 0.45 });
  mesh(new THREE.BoxGeometry(4.2, 0.18, 0.55), doorMat, 4.8, 2.55, 6.15, root);

  // Slim eaves
  mesh(new THREE.BoxGeometry(15.4, 0.12, 0.5), trim, -0.4, 3.2, -5.7, root);
  mesh(new THREE.BoxGeometry(0.5, 0.12, 6.7), trim, -7.78, 3.2, -2.3, root);

  // Front door into living
  mesh(new THREE.BoxGeometry(1.05, 2.15, 0.1), std("#7a4e32"), 0.15, 1.18, 0.98, root);
  mesh(new THREE.SphereGeometry(0.04, 10, 8), new THREE.MeshStandardMaterial({ color: "#c4a35a", metalness: 0.8, roughness: 0.3 }), 0.48, 1.15, 1.06, root);

  // Windows + curtains (living, bedroom, kitchen)
  const glass = new THREE.MeshStandardMaterial({ color: "#c5dcea", roughness: 0.12, metalness: 0.08, transparent: true, opacity: 0.42 });
  mesh(new THREE.BoxGeometry(1.8, 1.45, 0.06), glass, -5.2, 1.85, -5.44, root);
  mesh(new THREE.BoxGeometry(2.2, 1.55, 0.06), glass, -0.2, 1.9, -5.44, root);
  mesh(new THREE.BoxGeometry(1.8, 1.45, 0.06), glass, 4.7, 1.85, -5.44, root);
  const curtain = std("#d9c1a2");
  const cGrp = new THREE.Group();
  mesh(new THREE.BoxGeometry(0.18, 1.7, 0.08), curtain, -1.25, 1.9, -5.38, cGrp);
  mesh(new THREE.BoxGeometry(0.18, 1.7, 0.08), curtain, 0.85, 1.9, -5.38, cGrp);
  mark(cGrp, "curtains", "Curtains");
  root.add(cGrp);

  // Driveway + walk
  mesh(new THREE.BoxGeometry(8.6, 0.06, 7.4), drive, 8.4, 0.03, 9.4, root, { cast: false });
  for (let i = 0; i < 8; i++) {
    mesh(new THREE.BoxGeometry(0.95, 0.05, 0.48), paver, -1.1, 0.04, 1.6 + i * 0.7, root, { cast: false });
  }
  mesh(new THREE.BoxGeometry(5.6, 0.55, 0.45), hedge, -4.8, 0.35, 7.6, root);
  mesh(new THREE.BoxGeometry(0.45, 0.7, 6.2), hedge, -11.2, 0.42, -1.2, root);
}

async function buildYard(root) {
  const yard = new THREE.Group();
  yard.position.set(-7.6, 0, 3.8);
  mark(yard, "yard", "Yard & garden");
  root.add(yard);
  await addModel(yard, "bush.glb", 0.2, 0.4, { height: 0.85 });
  await addModel(yard, "bush-small.glb", -1.1, 1.1, { height: 0.55 });
  await addModel(yard, "plant.glb", 1.15, 0.8, { height: 0.7 });
  await addModel(root, "tree.glb", -10.2, -3.4, { height: 3.4 });
  await addModel(root, "tree-oak.glb", -9.4, 6.2, { height: 3.1 });
  await addModel(root, "tree.glb", 11.8, -8.4, { height: 3.2 });
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
  await addModel(root, "dresser.glb", -6.95, -4.35, { height: 1.15, rotY: Math.PI / 2, tint: "#8a623c", id: "dresser-his", label: "His dresser" });
  await addModel(root, "dresser-wide.glb", -6.85, -1.15, { height: 1.05, rotY: Math.PI / 2, tint: "#c4897a", id: "dresser-hers", label: "Her dresser" });
  await addModel(root, "wardrobe.glb", -3.55, -0.15, { height: 2.15, rotY: Math.PI, id: "wardrobe", label: "Wardrobe" });
}

async function buildLiving(root) {
  await addModel(root, "rug.glb", -0.35, -2.15, { width: 3.4, id: "rug", label: "Living room rug" });
  await addModel(root, "sofa.glb", -0.35, -4.15, { width: 2.9, rotY: 0, id: "sofa", label: "Living room sofa" });
  await addModel(root, "coffee-table.glb", -0.35, -2.35, { width: 1.25 });
  await addModel(root, "tv-stand.glb", 1.85, -2.55, { width: 1.45, rotY: -Math.PI / 2, id: "media", label: "Media console" });
  await addModel(root, "tv.glb", 1.88, -2.55, { width: 1.15, lift: 0.48, rotY: -Math.PI / 2 });
  await addModel(root, "speaker.glb", 1.85, -1.7, { height: 0.5 });
  await addModel(root, "speaker.glb", 1.85, -3.4, { height: 0.5 });
  await addModel(root, "plant.glb", -2.45, -4.55, { height: 0.85 });
  await addModel(root, "lamp-floor.glb", 1.85, -4.55, { height: 1.35 });
}

async function buildKitchen(root) {
  // L-shaped run along the north and east walls: fridge, sink, stove. No bed.
  const kit = new THREE.Group();
  kit.position.set(0, 0, 0);
  mark(kit, "kitchen", "Kitchen");
  root.add(kit);

  await addModel(kit, "fridge.glb", 3.15, -4.85, { height: 1.85 });
  await addModel(kit, "cabinet.glb", 4.15, -4.95, { height: 0.9 });
  await addModel(kit, "sink.glb", 5.05, -4.95, { height: 0.95, id: "kitchen-sink", label: "Kitchen sink" });
  await addModel(kit, "cabinet-drawer.glb", 5.95, -4.95, { height: 0.9 });
  await addModel(kit, "stove.glb", 6.7, -4.85, { height: 0.95 });
  await addModel(kit, "hood.glb", 6.7, -4.85, { width: 0.85, lift: 1.55 });
  await addModel(kit, "cabinet-upper.glb", 4.2, -5.05, { height: 0.7, lift: 1.55 });
  await addModel(kit, "cabinet-upper-dbl.glb", 5.9, -5.05, { width: 1.5, lift: 1.55 });
  await addModel(kit, "kitchen-island.glb", 4.9, -2.15, { width: 1.7, rotY: Math.PI / 2 });
  await addModel(kit, "stool.glb", 4.35, -1.35, { height: 0.75 });
  await addModel(kit, "stool.glb", 5.45, -1.35, { height: 0.75 });
  await addModel(kit, "plant-small.glb", 3.2, -3.55, { height: 0.35 });
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
  carWrap.position.set(8.15, 0, 9.35);
  mark(carWrap, "car", "Car");
  root.add(carWrap);
  await addModel(carWrap, "sedan.glb", 0, 0, { depth: 4.3, rotY: 0 });

  const rvWrap = new THREE.Group();
  rvWrap.position.set(13.4, 0, 9.6);
  mark(rvWrap, "rv", "RV");
  root.add(rvWrap);
  await addModel(rvWrap, "rv.glb", 0, 0, { depth: 5.6, rotY: 0 });
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
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0xe7dcc8, 1);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#e7dcc8");
  scene.fog = new THREE.Fog("#e7dcc8", 42, 78);

  let aspect = width() / height();
  let frustum = 12.2;
  const camera = new THREE.OrthographicCamera(-frustum * aspect, frustum * aspect, frustum, -frustum, 0.1, 200);
  const houseTarget = new THREE.Vector3(2.6, 0.45, 2.0);
  const rvTarget = new THREE.Vector3(40, 0.25, 0);
  camera.position.set(houseTarget.x + 18, 24, houseTarget.z + 18);
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

  const hemi = new THREE.HemisphereLight(0xfff2dd, 0x6b7a4e, 0.78);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d6, 2.15);
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
    applyFrustum(next === "rv" ? 4.1 : 12.2);
    controls.enabled = false;
    const fromPos = camera.position.clone();
    const fromTarget = controls.target.clone();
    const toPos = next === "rv"
      ? new THREE.Vector3(rvTarget.x, 15.5, rvTarget.z + 0.12)
      : new THREE.Vector3(houseTarget.x + 18, 24, houseTarget.z + 18);
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
