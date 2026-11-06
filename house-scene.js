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

async function buildProperty(root) {
  const grass = pbr("grass", { rx: 18, ry: 18, color: 0x8aa56a, rough: 0.95, roughMap: false });
  mesh(new THREE.CircleGeometry(36, 64), grass, 1, 0, 0, root, { rotX: -Math.PI / 2, cast: false });

  const shell = new THREE.Group();
  shell.add(prepare(await loadGLB("house/bungalow.glb")));
  root.add(shell);

  const interiors = new THREE.Group();
  root.add(interiors);

  async function addRoom(file, x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.add(prepare(await loadGLB(file)));
    interiors.add(g);
    return g;
  }

  const bedroom = await addRoom("house/bedroom.glb", -2, -2);
  hitBox(bedroom, "bed", "Bed", 0.45, 0.55, -1.05, 2.05, 0.95, 1.65);
  hitBox(bedroom, "nightstand", "Bedside table", -0.65, 0.4, -1.4, 0.5, 0.7, 0.5);
  hitBox(bedroom, "wardrobe", "Wardrobe", -1.55, 1.0, -0.55, 0.75, 2.0, 0.7);
  hitBox(bedroom, "dresser-hers", "Her dresser", -0.7, 0.55, -1.55, 0.85, 0.95, 0.45);
  hitBox(bedroom, "dresser-his", "His dresser", -1.55, 0.4, 0.25, 0.7, 0.8, 0.55);

  const kitchen = await addRoom("house/kitchen.glb", -2, 2);
  hitBox(kitchen, "kitchen", "Kitchen", 0.15, 1.1, -0.2, 3.5, 2.2, 3.4);
  hitBox(kitchen, "kitchen-sink", "Kitchen sink", 0.05, 0.95, -1.55, 0.85, 0.7, 0.55);

  const living = await addRoom("house/living-room.glb", 2, -2);
  hitBox(living, "sofa", "Living room sofa", 0.55, 0.5, -0.15, 2.15, 0.9, 1.05);
  hitBox(living, "rug", "Living room rug", 0.2, 0.05, 0.35, 2.3, 0.1, 1.9);
  hitBox(living, "media", "Media console", -1.4, 0.45, -0.35, 1.35, 0.85, 0.55);
  hitBox(living, "curtains", "Curtains", 1.25, 1.45, -1.55, 0.9, 1.4, 0.35);

  const garage = new THREE.Group();
  garage.position.set(2, 0, 2);
  interiors.add(garage);
  const conc = pbr("concrete", { rx: 2, ry: 2, rough: 0.86 });
  mesh(new THREE.BoxGeometry(4, 0.08, 4), conc, 0, 0.04, 0, garage, { cast: false });
  mesh(new THREE.BoxGeometry(0.12, 2.6, 4), pbr("plaster", { rx: 2, ry: 2, color: 0xf4eee6 }), -1.94, 1.3, 0, garage);
  mesh(new THREE.BoxGeometry(4, 2.6, 0.12), pbr("plaster", { rx: 2, ry: 2, color: 0xf4eee6 }), 0, 1.3, -1.94, garage);
  await addModel(garage, "workbench.glb", 0.15, -0.85, { width: 2.15, rotY: 0, id: "garage-workstation", label: "Garage workstation" });
  await addModel(garage, "box.glb", 1.35, 1.2, { height: 0.4 });
  await addModel(garage, "box-open.glb", -1.2, 1.15, { height: 0.35 });

  const drive = pbr("asphalt", { rx: 3, ry: 3, rough: 0.9 });
  mesh(new THREE.BoxGeometry(6.4, 0.06, 10.2), drive, 8.15, 0.03, 0.15, root, { cast: false });

  const yard = new THREE.Group();
  yard.position.set(-7.4, 0, 0.2);
  mark(yard, "yard", "Yard & garden");
  root.add(yard);
  await addModel(yard, "bush.glb", 0.15, 0.2, { height: 0.85 });
  await addModel(yard, "bush-small.glb", -0.7, 0.85, { height: 0.5 });
  await addModel(yard, "plant.glb", 0.9, 0.55, { height: 0.7 });
  await addModel(root, "tree.glb", -8.2, -3.1, { height: 3.1, tint: "#7d8f4a" });
  await addModel(root, "tree-oak.glb", -7.6, 3.8, { height: 2.9, tint: "#6e8242" });

  const garden = new THREE.Group();
  garden.position.set(-6.6, 0, 3.15);
  mark(garden, "garden", "Garden bed");
  root.add(garden);
  mesh(new THREE.BoxGeometry(2.6, 0.14, 1.15), std("#6b4b32"), 0, 0.08, 0, garden);
  await addModel(garden, "flower-red.glb", -0.8, 0.1, { height: 0.26 });
  await addModel(garden, "flower-yellow.glb", -0.15, -0.15, { height: 0.24 });
  await addModel(garden, "flower-purple.glb", 0.45, 0.12, { height: 0.25 });
  await addModel(garden, "flower-red.glb", 0.85, -0.1, { height: 0.24 });

  const carWrap = new THREE.Group();
  carWrap.position.set(7.55, 0, 2.15);
  mark(carWrap, "car", "Car");
  root.add(carWrap);
  await addModel(carWrap, "sedan.glb", 0, 0, { depth: 3.8, rotY: 0 });

  const rvWrap = new THREE.Group();
  rvWrap.position.set(8.15, 0, -2.55);
  mark(rvWrap, "rv", "RV");
  root.add(rvWrap);
  await addModel(rvWrap, "rv.glb", 0, 0, { depth: 4.7, rotY: 0 });

  shell.visible = false;
  interiors.visible = true;
  return { shell, interiors };
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
  const houseFrustum = () => (width() < 700 ? (peek ? 6.2 : 6.6) : (peek ? 6.5 : 6.95));
  let frustum = houseFrustum();
  const camera = new THREE.OrthographicCamera(-frustum * aspect, frustum * aspect, frustum, -frustum, 0.1, 200);

  const peekTarget = new THREE.Vector3(0.15, 1.55, 0.1);
  const exteriorTarget = new THREE.Vector3(0.4, 2.15, 0.35);
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
  [
    [-2.0, 2.4, -2.0],
    [2.0, 2.4, -2.0],
    [-2.0, 2.4, 2.0],
    [2.0, 2.4, 2.0],
  ].forEach(([x, y, z]) => {
    const p = new THREE.PointLight(0xffe0b8, 0.38, 6.5, 1.6);
    p.position.set(x, y, z);
    scene.add(p);
  });

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
  function applyPeekVisibility() {
    if (shell) shell.visible = !peek;
    if (interiors) interiors.visible = peek;
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
