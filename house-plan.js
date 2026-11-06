// Top-down architectural floor plan (SVG). Units: centimetres.
const BASE = window.__ASSET_BASE__ || window.__SITE_BASE__ || "./";
const T = (f) => `${BASE}textures/${f}`;
const EXT = 26, INT = 12;
const WALL = "#2f2c29";

const ftin = (cm) => { const inch = Math.round(cm / 2.54); return `${Math.floor(inch / 12)}'${inch % 12}"`; };
const r = (x, y, w, h, a = "") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${a}/>`;
const c = (x, y, rr, a = "") => `<circle cx="${x}" cy="${y}" r="${rr}" ${a}/>`;
const ln = (x1, y1, x2, y2, a = "") => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${a}/>`;
const hs = (id, label, body) => `<g class="hs" data-id="${id}" data-label="${label}">${body}</g>`;

function defs() {
  const pat = (id, img, size, extra = "", base = "", op = 1) =>
    `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${size}" height="${size}"${extra}>${base ? `<rect width="${size}" height="${size}" fill="${base}"/>` : ""}<image href="${T(img)}" width="${size}" height="${size}" preserveAspectRatio="none" opacity="${op}"/></pattern>`;
  return `<defs>
    ${pat("p-grass", "grass_diff.jpg", 220, "", "#6f9a45", 0.28)}
    ${pat("p-oak", "parquet_diff.jpg", 140, "", "#e2c79f", 0.55)}
    ${pat("p-parq", "wood_diff.jpg", 150, ' patternTransform="rotate(90)"', "#d9b98c", 0.5)}
    ${pat("p-tile", "tile_diff.jpg", 80, "", "#eeeae3", 0.55)}
    ${pat("p-conc", "concrete_diff.jpg", 240)}
    ${pat("p-asph", "asphalt_diff.jpg", 300, "", "#4a4a4a", 0.6)}
    ${pat("p-kwood", "kwood_diff.jpg", 120)}
    ${pat("p-fab", "fabric_diff.jpg", 60)}
    <pattern id="p-pave" patternUnits="userSpaceOnUse" width="60" height="60"><rect width="60" height="60" fill="#cdbfa9"/><rect x="2" y="2" width="56" height="26" fill="#d9ccb6"/><rect x="2" y="32" width="26" height="26" fill="#d4c6af"/><rect x="32" y="32" width="26" height="26" fill="#dccfba"/></pattern>
    <pattern id="p-drive" patternUnits="userSpaceOnUse" width="240" height="240"><rect width="240" height="240" fill="#d6d2ca"/><image href="${T("concrete_diff.jpg")}" width="240" height="240" opacity=".35"/><path d="M0 0H240M0 0V240" stroke="#9c968c" stroke-width="2"/></pattern>
    <pattern id="p-garconc" patternUnits="userSpaceOnUse" width="320" height="320"><rect width="320" height="320" fill="#c9c5bd"/><image href="${T("concrete_diff.jpg")}" width="320" height="320" opacity=".4"/><path d="M0 0H320M0 0V320" stroke="#8e897f" stroke-width="2"/></pattern>
    <filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="5" dy="7" stdDeviation="6" flood-color="#000" flood-opacity=".32"/></filter>
    <filter id="shs" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="3" dy="4" stdDeviation="3" flood-color="#000" flood-opacity=".28"/></filter>
    <filter id="tree" x="-30%" y="-30%" width="170%" height="170%"><feDropShadow dx="22" dy="26" stdDeviation="14" flood-color="#0b1a05" flood-opacity=".45"/></filter>
    <radialGradient id="g-tree" cx="40%" cy="38%"><stop offset="0" stop-color="#7fa65a"/><stop offset=".6" stop-color="#4f7a35"/><stop offset="1" stop-color="#2f5222"/></radialGradient>
    <radialGradient id="g-shrub" cx="40%" cy="38%"><stop offset="0" stop-color="#8fb86a"/><stop offset="1" stop-color="#3f6a2b"/></radialGradient>
    <radialGradient id="g-pillow" cx="50%" cy="45%"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dcd7cf"/></radialGradient>
    <radialGradient id="g-lamp" cx="50%" cy="50%"><stop offset="0" stop-color="#fff6dc"/><stop offset="1" stop-color="#e2d3b0"/></radialGradient>
    <linearGradient id="g-duvet" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f1ec"/><stop offset="1" stop-color="#ddd6cb"/></linearGradient>
    <linearGradient id="g-sofa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8b9aa3"/><stop offset="1" stop-color="#6c7b84"/></linearGradient>
    <linearGradient id="g-stone" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3f1ec"/><stop offset=".5" stop-color="#e6e2da"/><stop offset="1" stop-color="#efece6"/></linearGradient>
    <linearGradient id="g-steel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e3e6e8"/><stop offset="1" stop-color="#b9bec2"/></linearGradient>
    <linearGradient id="g-car" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7e1f1f"/><stop offset=".5" stop-color="#c23b33"/><stop offset="1" stop-color="#7e1f1f"/></linearGradient>
    <linearGradient id="g-glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b3a45"/><stop offset="1" stop-color="#4f6675"/></linearGradient>
    <linearGradient id="g-rv" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d9d6cf"/><stop offset=".5" stop-color="#f6f4ef"/><stop offset="1" stop-color="#d9d6cf"/></linearGradient>
    <linearGradient id="g-walnut" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6b4630"/><stop offset="1" stop-color="#4c3020"/></linearGradient>
    <linearGradient id="g-whiteoak" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9dcc5"/><stop offset="1" stop-color="#cdb895"/></linearGradient>
  </defs>`;
}

// ---- walls -------------------------------------------------------------
// seg: [x1,y1,x2,y2,thick, openings[{a,b,kind,hinge,dir}]] axis-aligned. a/b absolute coords along axis.
function wallSeg(x1, y1, x2, y2, t, opens = []) {
  const horiz = y1 === y2;
  const lo = Math.min(horiz ? x1 : y1, horiz ? x2 : y2) - t / 2;
  const hi = Math.max(horiz ? x1 : y1, horiz ? x2 : y2) + t / 2;
  const fixed = horiz ? y1 : x1;
  const os = [...opens].sort((p, q) => p.a - q.a);
  let out = "", cur = lo, overlay = "";
  const piece = (a, b) => horiz ? r(a, fixed - t / 2, b - a, t, `fill="${WALL}"`) : r(fixed - t / 2, a, t, b - a, `fill="${WALL}"`);
  for (const o of os) {
    if (o.a > cur) out += piece(cur, o.a);
    cur = o.b;
    overlay += opening(horiz, fixed, t, o);
  }
  if (hi > cur) out += piece(cur, hi);
  return { walls: out, overlay };
}

function opening(horiz, f, t, o) {
  const w = o.b - o.a;
  const R = (a, b, th, attrs) => horiz ? r(a, f - th / 2, b - a, th, attrs) : r(f - th / 2, a, th, b - a, attrs);
  const L = (a1, f1, a2, f2, attrs) => horiz ? ln(a1, f1, a2, f2, attrs) : ln(f1, a1, f2, a2, attrs);
  if (o.kind === "window" || o.kind === "slider") {
    let s = R(o.a, o.b, t, 'fill="#f4f2ee" stroke="#2f2c29" stroke-width="2"');
    s += L(o.a, f - 3, o.b, f - 3, 'stroke="#6c8ea3" stroke-width="2"') + L(o.a, f + 3, o.b, f + 3, 'stroke="#6c8ea3" stroke-width="2"');
    if (o.kind === "slider") {
      const m = (o.a + o.b) / 2;
      s += L(o.a, f - 4, m + 8, f - 4, 'stroke="#2f2c29" stroke-width="3"') + L(m - 8, f + 4, o.b, f + 4, 'stroke="#2f2c29" stroke-width="3"');
    }
    return s;
  }
  if (o.kind === "garage") {
    let s = R(o.a, o.b, t, 'fill="#dedad3"');
    s += L(o.a, f, o.b, f, 'stroke="#2f2c29" stroke-width="3" stroke-dasharray="14 8"');
    return s;
  }
  if (o.kind === "open") return R(o.a, o.b, t, 'fill="none"');
  // door: threshold + leaf + swing arc
  const hinge = o.hinge === "b" ? o.b : o.a;
  const other = o.hinge === "b" ? o.a : o.b;
  const dir = o.dir;
  const face = f + dir * t / 2;
  let s = R(o.a, o.b, t, 'fill="#e9e3d8"');
  const leafEnd = face + dir * w;
  const P = (a, ff) => horiz ? `${a} ${ff}` : `${ff} ${a}`;
  s += horiz ? r(Math.min(hinge, hinge + (hinge === o.a ? 4 : -4)), Math.min(face, leafEnd), 4, Math.abs(leafEnd - face), 'fill="#8a6a4a" stroke="#2f2c29" stroke-width="1.5"')
             : r(Math.min(face, leafEnd), Math.min(hinge, hinge + (hinge === o.a ? 4 : -4)), Math.abs(leafEnd - face), 4, 'fill="#8a6a4a" stroke="#2f2c29" stroke-width="1.5"');
  const sweep = (() => {
    // choose sweep so arc bulges outward away from opening corner
    const ax = horiz ? hinge : face, ay = horiz ? face : hinge;
    const sx = horiz ? hinge : leafEnd, sy = horiz ? leafEnd : hinge;
    const ex = horiz ? other : face, ey = horiz ? face : other;
    const cross = (sx - ax) * (ey - ay) - (sy - ay) * (ex - ax);
    return cross > 0 ? 1 : 0;
  })();
  s += `<path d="M${P(hinge, leafEnd)} A${w} ${w} 0 0 ${sweep} ${P(other, face)}" fill="none" stroke="#7b746a" stroke-width="1.6" stroke-dasharray="6 5"/>`;
  return s;
}

// ---- furniture ---------------------------------------------------------
const rot = (x, y, deg, body) => `<g transform="translate(${x} ${y}) rotate(${deg})">${body}</g>`;

function bed(x, y) { // 160x205, head at top
  return r(x, y, 160, 205, 'rx="6" fill="#6b5442"') +
    r(x + 5, y + 10, 150, 192, 'rx="8" fill="#f7f5f1" stroke="#cfc8bd" stroke-width="1.5"') +
    r(x + 14, y + 16, 62, 38, 'rx="12" fill="url(#g-pillow)" stroke="#d2cbc0"') +
    r(x + 84, y + 16, 62, 38, 'rx="12" fill="url(#g-pillow)" stroke="#d2cbc0"') +
    r(x + 3, y + 68, 154, 136, 'rx="8" fill="url(#g-duvet)" stroke="#cfc6b8"') +
    r(x + 3, y + 68, 154, 22, 'rx="6" fill="#ebe5da"') +
    r(x + 3, y + 150, 154, 48, 'rx="4" fill="#b98a5e" opacity=".85"');
}
function nightstand(x, y) {
  return r(x, y, 48, 42, 'rx="3" fill="url(#g-walnut)"') + c(x + 24, y + 21, 13, 'fill="url(#g-lamp)" stroke="#bfae8a"') + c(x + 24, y + 21, 3, 'fill="#8e7c5a"');
}
function dresser(x, y, w, d, fill, knob) { // drawn with front facing -x (against right wall)
  let s = r(x, y, d, w, `rx="3" fill="${fill}"`);
  s += r(x + 4, y + 4, d - 8, w - 8, `rx="2" fill="none" stroke="${knob}" stroke-width="1.2" opacity=".6"`);
  s += ln(x + 4, y + w / 2, x + d - 4, y + w / 2, `stroke="${knob}" stroke-width="1.2" opacity=".6"`);
  return s;
}
function wardrobe(x, y, d, len) {
  let s = r(x, y, d, len, 'fill="#efe9df" stroke="#b8ad9c" stroke-width="1.5"');
  s += ln(x + d / 2, y + 4, x + d / 2, y + len - 4, 'stroke="#9e937f" stroke-width="2"');
  for (let i = 1; i < 9; i++) s += ln(x + 10, y + (len * i) / 9, x + d - 6, y + (len * i) / 9 + 6, 'stroke="#c2b6a3" stroke-width="2"');
  return s;
}
function tub(x, y) { // 170x78
  return r(x, y, 170, 78, 'rx="8" fill="#fafafa" stroke="#bfc4c7" stroke-width="2"') + r(x + 10, y + 10, 150, 58, 'rx="26" fill="#e6eef2" stroke="#c8d0d4"') + c(x + 148, y + 39, 4, 'fill="#9aa3a8"');
}
function toilet(x, y) { // tank against left wall, bowl to right
  return r(x, y, 20, 46, 'rx="3" fill="#fafafa" stroke="#bfc4c7" stroke-width="1.5"') + `<ellipse cx="${x + 46}" cy="${y + 23}" rx="28" ry="19" fill="#fafafa" stroke="#bfc4c7" stroke-width="1.5"/>` + `<ellipse cx="${x + 48}" cy="${y + 23}" rx="18" ry="11" fill="#e6eef2"/>`;
}
function vanity(x, y, w, d) { // against right wall, basin facing -x
  return r(x, y, d, w, 'rx="3" fill="url(#g-stone)" stroke="#b9b2a6" stroke-width="1.5"') + `<ellipse cx="${x + d / 2 - 2}" cy="${y + w / 2}" rx="${d / 2 - 12}" ry="${w / 4}" fill="#f9fbfc" stroke="#aab2b7" stroke-width="1.5"/>` + c(x + d - 8, y + w / 2, 3, 'fill="#8d969b"') + r(x + d - 3, y + 8, 3, w - 16, 'fill="#9fb7c4"');
}
function washer(x, y, label) {
  return r(x, y, 64, 64, 'rx="4" fill="url(#g-steel)" stroke="#9aa0a5" stroke-width="1.5"') + c(x + 32, y + 34, 20, 'fill="#cfd8de" stroke="#8a9196" stroke-width="2"') + r(x + 6, y + 4, 52, 8, 'rx="2" fill="#6f777d"') + `<text x="${x + 32}" y="${y + 38}" font-size="9" text-anchor="middle" fill="#5d656b">${label}</text>`;
}
function counterRun(x, y, w, d) {
  return r(x, y, w, d, 'fill="url(#g-stone)" stroke="#a9a196" stroke-width="1.5"') + ln(x, y + d - 3, x + w, y + d - 3, 'stroke="#c9c1b4" stroke-width="3"');
}
function sinkDbl(x, y) { // 90x46 basin top-down
  return r(x, y, 90, 46, 'rx="4" fill="url(#g-steel)" stroke="#8d949a" stroke-width="1.5"') + r(x + 6, y + 6, 37, 34, 'rx="5" fill="#d7dde1" stroke="#9aa1a6"') + r(x + 47, y + 6, 37, 34, 'rx="5" fill="#d7dde1" stroke="#9aa1a6"') + c(x + 45, y + 3, 4, 'fill="#6f777d"');
}
function stove(x, y, rotDeg = 0) { // 76x62
  const body = r(0, 0, 76, 62, 'rx="3" fill="#2d2f31"') + [[19, 18, 11], [57, 18, 9], [19, 44, 9], [57, 44, 11]].map(([a, b, rr]) => c(a, b, rr, 'fill="none" stroke="#8b9094" stroke-width="2.5"') + c(a, b, rr / 3, 'fill="#55595c"')).join("");
  return rot(x, y, rotDeg, body);
}
function fridge(x, y) { // 90x76
  return r(x, y, 90, 76, 'rx="4" fill="url(#g-steel)" stroke="#8d949a" stroke-width="2"') + ln(x + 45, y + 4, x + 45, y + 72, 'stroke="#8d949a" stroke-width="2"') + r(x + 38, y + 64, 4, 10, 'fill="#5e666b"') + r(x + 48, y + 64, 4, 10, 'fill="#5e666b"');
}
function island(x, y, w, d) {
  return r(x, y, w, d, 'rx="4" fill="url(#g-stone)" stroke="#a9a196" stroke-width="2"') + r(x + 6, y + 6, w - 12, d - 12, 'rx="3" fill="none" stroke="#d8d1c5" stroke-width="1.5"');
}
function stool(x, y) { return c(x, y, 19, 'fill="#3b3a38"') + c(x, y, 14, 'fill="#8a6a4a"'); }
function chair(x, y, deg) {
  return rot(x, y, deg, r(-22, -22, 44, 44, 'rx="8" fill="#d8cbb4" stroke="#9c8c72" stroke-width="1.5"') + r(-22, -22, 44, 10, 'rx="4" fill="#a8916c"'));
}
function diningTable(x, y, w, d) {
  return r(x, y, w, d, 'rx="6" fill="url(#p-kwood)" stroke="#5c4330" stroke-width="2"') + c(x + w / 2, y + d / 2, 14, 'fill="#e8e2d6" stroke="#b8ae9c"') + c(x + w / 2, y + d / 2, 8, 'fill="#7a9a5c"');
}
function sofaL(x, y) { // 300 wide x 95 deep, back at bottom, chaise at right going up
  const s = 'fill="url(#g-sofa)" stroke="#55626a" stroke-width="1.5"';
  return r(x, y, 300, 95, `rx="10" ${s}`) + r(x, y + 70, 300, 25, 'rx="8" fill="#5f6d75"') + r(x, y, 20, 95, 'rx="8" fill="#5f6d75"') + r(x + 280, y - 70, 20, 165, 'rx="8" fill="#5f6d75"') + r(x + 205, y - 70, 95, 165, `rx="10" ${s}`) + r(x + 205, y - 70, 95, 20, 'rx="8" fill="#5f6d75"') +
    r(x + 24, y + 6, 88, 62, 'rx="6" fill="#8796a0" stroke="#66747c"') + r(x + 114, y + 6, 88, 62, 'rx="6" fill="#8796a0" stroke="#66747c"') +
    r(x + 40, y + 50, 26, 20, 'rx="6" fill="#d8b46a"') + r(x + 250, y - 40, 24, 22, 'rx="6" fill="#e4dccd"');
}
function armchair(x, y, deg) {
  return rot(x, y, deg, r(-42, -40, 84, 80, 'rx="12" fill="#c9b79a" stroke="#8f7d61" stroke-width="1.5"') + r(-42, 22, 84, 18, 'rx="8" fill="#a99474"') + r(-42, -40, 14, 80, 'rx="6" fill="#a99474"') + r(28, -40, 14, 80, 'rx="6" fill="#a99474"'));
}
function coffeeTable(x, y, w, d) { return r(x, y, w, d, 'rx="10" fill="url(#p-kwood)" stroke="#5c4330" stroke-width="2"') + r(x + 20, y + 18, 34, 22, 'rx="3" fill="#6b8f71"') + c(x + w - 30, y + d / 2, 9, 'fill="#efe6d6" stroke="#b7a98f"'); }
function tvConsole(x, y, w) { return r(x, y, w, 42, 'rx="3" fill="url(#g-walnut)"') + r(x + w / 2 - 75, y + 4, 150, 8, 'rx="2" fill="#151617"') + r(x + 12, y + 18, 28, 18, 'rx="2" fill="#2f3133"') + c(x + w - 26, y + 24, 9, 'fill="#5c7d4a"'); }
function rug(x, y, w, h, fill = "url(#p-fab)") { return r(x, y, w, h, `rx="4" fill="${fill}" stroke="#a88d6a" stroke-width="4" opacity=".95"`); }
function plant(x, y, rr = 22) { return c(x, y, rr * 0.75, 'fill="#cdbba0" stroke="#9b8668"') + `<g filter="url(#shs)">${[0, 72, 144, 216, 288].map((a) => { const ax = x + Math.cos(a * Math.PI / 180) * rr * 0.55, ay = y + Math.sin(a * Math.PI / 180) * rr * 0.55; return `<ellipse cx="${ax}" cy="${ay}" rx="${rr * 0.55}" ry="${rr * 0.28}" transform="rotate(${a} ${ax} ${ay})" fill="#5d8a45"/>`; }).join("")}${c(x, y, rr * 0.3, 'fill="#79a65a"')}</g>`; }
function tree(x, y, rr) { return `<g filter="url(#tree)">${c(x, y, rr, 'fill="url(#g-tree)"')}${c(x - rr * 0.3, y - rr * 0.25, rr * 0.45, 'fill="#86ad62" opacity=".55"')}${c(x + rr * 0.35, y + rr * 0.2, rr * 0.4, 'fill="#3f6a2b" opacity=".45"')}</g>`; }
function shrub(x, y, rr) { return `<g filter="url(#shs)">${c(x, y, rr, 'fill="url(#g-shrub)"')}</g>`; }
function flower(x, y, col) { return c(x, y, 7, `fill="${col}"`) + c(x, y, 2.5, 'fill="#f6e27a"'); }

function car(x, y) { // 190 x 470, nose at top
  return `<g filter="url(#sh)">` +
    r(x, y, 190, 470, 'rx="60" fill="url(#g-car)" stroke="#5a1414" stroke-width="2"') +
    r(x + 22, y + 120, 146, 70, 'rx="22" fill="url(#g-glass)"') +
    r(x + 26, y + 190, 138, 150, 'rx="14" fill="#a8302a"') +
    r(x + 26, y + 340, 138, 60, 'rx="18" fill="url(#g-glass)"') +
    r(x - 8, y + 150, 12, 26, 'rx="4" fill="#5a1414"') + r(x + 186, y + 150, 12, 26, 'rx="4" fill="#5a1414"') +
    r(x + 18, y + 6, 40, 14, 'rx="6" fill="#fff3c9"') + r(x + 132, y + 6, 40, 14, 'rx="6" fill="#fff3c9"') +
    r(x + 18, y + 452, 40, 10, 'rx="4" fill="#e04040"') + r(x + 132, y + 452, 40, 10, 'rx="4" fill="#e04040"') +
    `</g>`;
}
function rvExterior(x, y) { // 255 x 960, cab at bottom (faces street)
  let s = `<g filter="url(#sh)">` + r(x, y, 255, 960, 'rx="18" fill="url(#g-rv)" stroke="#8c877e" stroke-width="2.5"');
  s += r(x + 8, y + 770, 239, 180, 'rx="26" fill="#ece9e2" stroke="#9a948a"') + r(x + 28, y + 880, 199, 50, 'rx="12" fill="url(#g-glass)"');
  s += r(x + 60, y + 90, 135, 110, 'rx="6" fill="#d3d0c9" stroke="#9c968b"') + r(x + 72, y + 102, 111, 86, 'rx="4" fill="#bfbcb4"');
  s += r(x + 80, y + 420, 95, 95, 'rx="6" fill="#cfcbc3" stroke="#9c968b"') + c(x + 127, y + 300, 26, 'fill="#c7c3bb" stroke="#9c968b"');
  s += r(x + 30, y + 560, 195, 150, 'rx="4" fill="#1f2c3a" stroke="#76808a"') + ln(x + 30, y + 635, x + 225, y + 635, 'stroke="#76808a"') + ln(x + 127, y + 560, x + 127, y + 710, 'stroke="#76808a"');
  s += r(x - 3, y + 120, 6, 500, 'fill="#2c4a3e"') + `</g>`;
  return s;
}

// ---- RV interior (separate view) --------------------------------------
function rvInterior() {
  const W = 240, H = 900;
  let s = r(-14, -14, W + 28, H + 28, 'rx="30" fill="#ebe7df" stroke="#7d776d" stroke-width="10"');
  s += r(0, 0, W, H, 'fill="url(#p-oak)"');
  // rear bed
  s += hs("rv-bed", "RV bed", `<g filter="url(#sh)">${r(20, 8, 200, 190, 'rx="8" fill="#6b5442"')}${r(26, 14, 188, 178, 'rx="8" fill="url(#g-duvet)" stroke="#cfc6b8"')}${r(36, 20, 76, 34, 'rx="12" fill="url(#g-pillow)"')}${r(128, 20, 76, 34, 'rx="12" fill="url(#g-pillow)"')}${r(26, 130, 188, 40, 'fill="#b98a5e" opacity=".85"')}</g>`);
  s += hs("rv-storage", "RV storage", `<g filter="url(#shs)">${wardrobe(0, 210, 46, 150)}${r(194, 210, 46, 90, 'fill="#efe9df" stroke="#b8ad9c" stroke-width="1.5"')}</g>`);
  // bathroom
  s += r(150, 310, 90, 150, 'fill="url(#p-tile)"') + r(146, 310, 6, 150, `fill="${WALL}"`) + r(146, 456, 94, 6, `fill="${WALL}"`);
  s += hs("rv-bathroom", "RV bathroom", `<g filter="url(#shs)">${r(160, 318, 72, 72, 'rx="6" fill="#f5f7f8" stroke="#aab2b7" stroke-width="2"')}${c(196, 354, 6, 'fill="#9aa3a8"')}${`<ellipse cx="196" cy="420" rx="18" ry="24" fill="#fafafa" stroke="#bfc4c7" stroke-width="1.5"/>`}${r(180, 440, 32, 14, 'rx="3" fill="#fafafa" stroke="#bfc4c7"')}</g>`);
  // kitchenette
  s += hs("rv-kitchen", "RV kitchenette", `<g filter="url(#shs)">${counterRun(0, 380, 60, 210)}${r(8, 395, 44, 50, 'rx="4" fill="url(#g-steel)" stroke="#8d949a"')}${r(13, 400, 34, 40, 'rx="5" fill="#d7dde1"')}${r(6, 470, 48, 60, 'rx="3" fill="#2d2f31"')}${c(30, 486, 10, 'fill="none" stroke="#8b9094" stroke-width="2.5"')}${c(30, 514, 10, 'fill="none" stroke="#8b9094" stroke-width="2.5"')}${r(0, 595, 60, 70, 'rx="4" fill="url(#g-steel)" stroke="#8d949a" stroke-width="2"')}</g>`);
  // dinette
  s += hs("rv-dinette", "RV dinette", `<g filter="url(#shs)">${r(150, 520, 90, 46, 'rx="8" fill="#7a8c96"')}${r(160, 572, 80, 60, 'rx="4" fill="url(#p-kwood)" stroke="#5c4330" stroke-width="2"')}${r(150, 638, 90, 46, 'rx="8" fill="#7a8c96"')}</g>`);
  s += rug(70, 470, 70, 180, "#b7a27f");
  // cab
  s += r(0, 720, W, 180, 'fill="#3a3a3a"');
  s += hs("rv-cab", "RV cabin", `<g filter="url(#shs)">${r(22, 740, 80, 84, 'rx="16" fill="#5d4a3c"')}${r(138, 740, 80, 84, 'rx="16" fill="#5d4a3c"')}${c(62, 850, 26, 'fill="none" stroke="#1d1d1d" stroke-width="7"')}${r(10, 868, 220, 26, 'rx="6" fill="#2a2a2a"')}</g>`);
  return { svg: s, box: { x: -40, y: -40, w: W + 80, h: H + 80 } };
}

// ---- plan --------------------------------------------------------------
const H = { x0: 0, y0: 0, x1: 1400, y1: 1300 }; // house
const G = { x0: 1400, y0: 300, x1: 2060, y1: 1300 }; // garage

function roomLabel(x, y, name, w, h) {
  return `<g class="lbl" data-x="${x}" data-y="${y}"><text x="${x}" y="${y}" class="room-label" text-anchor="middle">${name}</text><text x="${x}" y="${y + 24}" class="room-dim" text-anchor="middle">${ftin(w)} × ${ftin(h)}</text></g>`;
}

function buildPlan() {
  let ground = "", floors = "", furn = "", wallsSvg = "", over = "", labels = "", outdoor = "";
  // site
  ground += r(-2500, -1500, 7000, 5000, 'fill="url(#p-grass)"');
  
  // street + sidewalk
  ground += r(-2500, 2000, 7000, 400, 'fill="url(#p-asph)"') + r(-2500, 1930, 7000, 70, 'fill="#cfcac0"') + ln(-2500, 2160, 4500, 2160, 'stroke="#f2d16b" stroke-width="5" stroke-dasharray="60 40"');
  // driveway + RV pad + walkway + patio
  ground += r(1400, 1300, 660, 630, 'fill="url(#p-drive)"');
  ground += r(2100, 760, 320, 1170, 'fill="url(#p-drive)"');
  ground += r(810, 1300, 100, 300, 'fill="url(#p-pave)"') + r(810, 1500, 590, 100, 'fill="url(#p-pave)"');
  ground += r(-460, 600, 460, 460, 'fill="url(#p-pave)" stroke="#a89878" stroke-width="3"');
  ground += r(-12, -12, 1424, 1324, 'fill="#000" opacity=".22" filter="url(#tree)"');
  ground += r(1400, 288, 672, 1024, 'fill="#000" opacity=".2" filter="url(#tree)"');

  // floors
  floors += r(0, 0, 560, 520, 'fill="url(#p-parq)"');           // bedroom
  floors += r(560, 0, 300, 520, 'fill="url(#p-tile)"');         // bath + laundry
  floors += r(0, 0, 1400, 1300, 'fill="url(#p-oak)"');          // open plan
  floors += r(770, 1120, 190, 180, 'fill="url(#p-tile)"');      // entry
  floors += r(G.x0, G.y0, G.x1 - G.x0, G.y1 - G.y0, 'fill="url(#p-garconc)"');

  // walls
  const segs = [
    [0, 0, 1400, 0, EXT, [{ a: 160, b: 400, kind: "window" }, { a: 660, b: 760, kind: "window" }, { a: 1010, b: 1250, kind: "window" }]],
    [0, 0, 0, 1300, EXT, [{ a: 150, b: 380, kind: "window" }, { a: 690, b: 950, kind: "slider" }, { a: 1060, b: 1220, kind: "window" }]],
    [0, 1300, 1400, 1300, EXT, [{ a: 150, b: 480, kind: "window" }, { a: 815, b: 905, kind: "door", hinge: "a", dir: -1 }, { a: 1040, b: 1300, kind: "window" }]],
    [1400, 0, 1400, 300, EXT, []],
    [1400, 300, 1400, 1300, EXT, [{ a: 380, b: 462, kind: "door", hinge: "a", dir: -1 }]],
    [1400, 300, 2060, 300, EXT, []],
    [2060, 300, 2060, 1300, EXT, [{ a: 850, b: 1010, kind: "window" }, { a: 1080, b: 1162, kind: "door", hinge: "b", dir: -1 }]],
    [1400, 1300, 2060, 1300, EXT, [{ a: 1470, b: 1990, kind: "garage" }]],
    [0, 520, 860, 520, INT, [{ a: 380, b: 465, kind: "door", hinge: "a", dir: -1 }, { a: 690, b: 775, kind: "door", hinge: "b", dir: -1 }]],
    [560, 0, 560, 520, INT, []],
    [860, 0, 860, 520, INT, []],
    [560, 300, 860, 300, INT, [{ a: 590, b: 670, kind: "door", hinge: "a", dir: 1 }]],
  ];
  for (const sgm of segs) { const o = wallSeg(...sgm); wallsSvg += o.walls; over += o.overlay; }
  // kitchen peninsula stub
  wallsSvg += r(854, 514, 106, INT, `fill="${WALL}"`);

  // ---- bedroom
  furn += rug(150, 140, 260, 210);
  furn += hs("bed", "Bed", bed(200, 14));
  furn += hs("nightstand", "Bedside table", nightstand(144, 16) + nightstand(368, 16));
  furn += hs("wardrobe", "Wardrobe", wardrobe(14, 250, 62, 230));
  furn += hs("dresser-his", "His dresser", dresser(500, 230, 120, 52, "url(#g-walnut)", "#d8c3a0") + `<text x="526" y="296" class="tag" text-anchor="middle" transform="rotate(90 526 290)">HIS</text>`);
  furn += hs("dresser-hers", "Her dresser", dresser(500, 368, 120, 52, "url(#g-whiteoak)", "#8a7356") + `<text x="526" y="434" class="tag" text-anchor="middle" transform="rotate(90 526 428)">HERS</text>`);
  furn += plant(40, 40, 22);
  // ---- bath
  furn += tub(684, 8);
  furn += toilet(568, 150);
  furn += vanity(800, 120, 120, 54);
  furn += r(700, 210, 80, 50, 'rx="4" fill="#d9cfc0" opacity=".9"');
  // ---- laundry
  furn += washer(792, 318, "WASH") + washer(792, 386, "DRY");
  furn += r(568, 450, 120, 62, 'fill="url(#g-stone)" stroke="#a9a196"');
  // ---- kitchen
  furn += hs("kitchen", "Kitchen", `<g>${counterRun(956, 6, 438, 64)}${counterRun(1330, 70, 64, 230)}${fridge(864, 6)}${stove(1394, 196, 90)}${island(1010, 230, 230, 100)}${stool(1060, 360)}${stool(1125, 360)}${stool(1190, 360)}</g>`);
  furn += hs("kitchen-sink", "Kitchen sink", sinkDbl(1085, 10));
  // ---- dining
  furn += rug(1010, 700, 330, 250, "#b9a27e");
  furn += chair(1095, 742, 0) + chair(1175, 742, 0) + chair(1255, 742, 0) + chair(1095, 908, 180) + chair(1175, 908, 180) + chair(1255, 908, 180) + chair(1040, 825, -90) + chair(1310, 825, 90);
  furn += diningTable(1065, 778, 220, 94);
  furn += r(1340, 1000, 52, 180, 'rx="3" fill="url(#g-walnut)"') + plant(1365, 1240, 24);
  // ---- living
  furn += hs("rug", "Living room rug", rug(80, 640, 420, 330));
  furn += hs("media", "Media console", tvConsole(110, 528, 300));
  furn += hs("sofa", "Living room sofa", sofaL(90, 920));
  furn += coffeeTable(190, 730, 160, 90);
  furn += armchair(560, 760, 90);
  furn += r(520, 840, 46, 46, 'rx="23" fill="url(#p-kwood)" stroke="#5c4330"');
  furn += plant(40, 1250, 26) + plant(720, 560, 22);
  furn += hs("curtains", "Curtains", r(6, 676, 16, 288, 'fill="#e7dcc6" stroke="#b8a888" stroke-width="2"') + r(160, 1278, 330, 14, 'fill="#e7dcc6" stroke="#b8a888" stroke-width="2"'));
  // ---- entry
  furn += r(800, 1210, 120, 70, 'rx="4" fill="#7c6a54" opacity=".9"') + r(930, 1140, 24, 110, 'fill="url(#g-walnut)"');

  // ---- garage
  furn += hs("garage-workstation", "Garage workstation", `<g>${r(1660, 312, 250, 16, 'fill="#d8c09a" stroke="#8a6a44"')}${Array.from({length:24},(_,i)=>c(1668+i*10,320,1.6,'fill="#7a5c3a"')).join("")}${[1700, 1730, 1755, 1785, 1810, 1840, 1870].map((x, i) => r(x, 322, i % 2 ? 6 : 14, i % 2 ? 26 : 18, `rx="2" fill="${["#c0392b", "#555", "#2c6aa0", "#555", "#d4a017", "#555", "#2e7d32"][i]}"`)).join("")}${r(1413, 800, 18, 330, 'fill="#d8c09a" stroke="#8a6a44"')}${[["#c0392b",28,10],["#555",18,6],["#2c6aa0",34,8],["#d4a017",22,12],["#555",30,5],["#2e7d32",26,10],["#c0392b",20,14],["#555",34,6],["#2c6aa0",24,10],["#d4a017",30,6]].map(([col,len,wd],i)=>r(1431, 815+i*31, len, wd, `rx="2" fill="${col}"`)).join("")}${r(1680, 314, 210, 66, 'fill="url(#p-kwood)" stroke="#5c4330" stroke-width="2"')}${r(1700, 330, 40, 24, 'rx="3" fill="#c0392b"')}${r(1820, 330, 50, 20, 'fill="#4b5563"')}${r(1910, 314, 70, 50, 'rx="3" fill="#b91c1c" stroke="#7f1d1d"')}</g>`);
  furn += r(2000, 420, 52, 360, 'fill="#8b8f93" stroke="#555" stroke-width="2"') + [440, 520, 600, 680].map((y) => r(2006, y, 40, 60, 'rx="3" fill="#c8a36a" stroke="#8a6a44"')).join("");
  furn += r(1412, 560, 60, 220, 'fill="#8b8f93" stroke="#555" stroke-width="2"') + [575, 645, 715].map((y) => r(1418, y, 48, 55, 'rx="3" fill="#5b7fa6" stroke="#3b5a7a"')).join("");
  furn += r(1790, 1080, 90, 140, 'rx="10" fill="#2e7d32" stroke="#1b5e20"') + c(1835, 1140, 28, 'fill="#1f2937"');
  furn += `<ellipse cx="1610" cy="1040" rx="40" ry="26" fill="#000" opacity=".12"/>`;
  furn += hs("car", "Car", car(1520, 760));

  // ---- RV
  furn += hs("rv", "RV — tap to look inside", rvExterior(2130, 860));

  // ---- outdoor: patio, yard, garden
  outdoor += `<g filter="url(#shs)">${c(-230, 830, 70, 'fill="url(#p-kwood)" stroke="#5c4330" stroke-width="2"')}${[0, 90, 180, 270].map((a) => { const x = -230 + Math.cos(a * Math.PI / 180) * 105, y = 830 + Math.sin(a * Math.PI / 180) * 105; return c(x, y, 24, 'fill="#e9e2d4" stroke="#9c8c72"'); }).join("")}${r(-420, 640, 90, 60, 'rx="6" fill="#3a3a3a"')}${c(-375, 670, 20, 'fill="#5a5a5a"')}</g>`;
  outdoor += hs("yard", "Yard & garden", `<g>${tree(-420, -250, 170)}${tree(300, -330, 140)}${tree(-500, 1600, 150)}${tree(2500, 200, 160)}${shrub(-80, 300, 50)}${shrub(-90, 420, 40)}${shrub(1250, -90, 46)}</g>`);
  let flowers = "";
  for (let i = 0; i < 26; i++) flowers += flower(30 + i * 27, 1352 + (i % 3) * 18, ["#e45b7a", "#f2a65a", "#b06ad9", "#f4d35e"][i % 4]);
  outdoor += hs("garden", "Garden bed", `<g>${r(10, 1325, 740, 80, 'rx="10" fill="#5b4330" stroke="#3e2d1f" stroke-width="3"')}${shrub(60, 1365, 30)}${shrub(700, 1365, 30)}${flowers}</g>`);
  outdoor += shrub(990, 1360, 34) + shrub(1060, 1370, 26) + shrub(1340, 1360, 30);

  // labels
  labels += roomLabel(300, 300, "PRIMARY BEDROOM", 560, 520);
  labels += roomLabel(640, 115, "BATH", 300, 300);
  labels += roomLabel(690, 420, "LAUNDRY", 300, 220);
  labels += roomLabel(1130, 200, "KITCHEN", 540, 520);
  labels += roomLabel(1175, 1050, "DINING", 540, 780);
  labels += roomLabel(300, 1150, "LIVING ROOM", 860, 780);
  labels += roomLabel(865, 1080, "ENTRY", 190, 180);
  labels += roomLabel(1760, 560, "GARAGE", 660, 1000);
  labels += roomLabel(-230, 990, "PATIO", 460, 460);
  labels += `<g class="lbl" data-x="1730" data-y="1700"><text x="1730" y="1700" class="room-label" text-anchor="middle">DRIVEWAY</text></g>`;

  const svg = `<g class="ground">${ground}</g><g class="floors">${floors}</g><g class="outdoor">${outdoor}</g><g class="furn" filter="url(#sh)">${furn}</g><g class="walls" filter="url(#shs)">${wallsSvg}</g><g class="openings">${over}</g><g class="labels">${labels}</g>`;
  return { svg, box: { x: -520, y: -150, w: 3000, h: 2200 } };
}

// ---- viewer ------------------------------------------------------------
export async function initHouse(container, options = {}) {
  container.innerHTML = "";
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "plan-svg");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  container.appendChild(svg);
  const hl = `<rect id="hl" fill="rgba(196,92,38,.10)" stroke="#c45c26" stroke-width="6" rx="10" visibility="hidden" pointer-events="none"/>`;

  const plan = buildPlan();
  const rv = rvInterior();
  let view = "house";
  let rvWide = false;
  let planRot = false;
  const size = () => ({ w: container.clientWidth || 960, h: container.clientHeight || 640 });
  function render() {
    const wide = size().w > size().h * 1.1;
    rvWide = wide;
    planRot = size().h > size().w * 1.15;
    const content = view === "rv" ? (wide ? `<g transform="rotate(90)">${rv.svg}</g>` : rv.svg) : (planRot ? `<g transform="rotate(90)">${plan.svg}</g>` : plan.svg);
    const bg = view === "rv" ? r(-2000, -2000, 5000, 5000, 'fill="#e9e1d2"') : "";
    svg.innerHTML = defs() + bg + `<g id="content">${content}</g>` + hl;
    if (view === "house" && planRot) svg.querySelectorAll(".lbl").forEach((g) => g.setAttribute("transform", `rotate(-90 ${g.dataset.x} ${g.dataset.y})`));
  }
  render();

  // camera: centre (cx,cy) + zoom = px per cm
  let cam = { cx: 0, cy: 0, k: 1 };
  let anim = null;
  function fitBox(b, pad = 1) { const { w, h } = size(); return { cx: b.x + b.w / 2, cy: b.y + b.h / 2, k: Math.min(w / b.w, h / b.h) * pad }; }
  const rotBox = (b) => ({ x: -b.y - b.h, y: b.x, w: b.h, h: b.w });
  const planBox = () => (planRot ? rotBox(plan.box) : plan.box);
  const rvBox = () => (rvWide ? { x: -rv.box.y - rv.box.h, y: rv.box.x, w: rv.box.h, h: rv.box.w } : rv.box);
  const homeCam = () => (view === "rv" ? fitBox(rvBox(), 0.98) : (planRot ? fitBox(rotBox({ x: -80, y: -40, w: 2540, h: 1500 }), 1) : fitBox(plan.box, 1)));
  function apply() {
    const { w, h } = size();
    svg.setAttribute("viewBox", `${cam.cx - w / 2 / cam.k} ${cam.cy - h / 2 / cam.k} ${w / cam.k} ${h / cam.k}`);
  }
  const limits = () => { const base = homeCam().k; return [base * 0.7, base * 7]; };
  function clampCam() {
    const [lo, hi] = limits();
    cam.k = Math.min(hi, Math.max(lo, cam.k));
    const b = view === "rv" ? rvBox() : planBox();
    cam.cx = Math.min(b.x + b.w, Math.max(b.x, cam.cx));
    cam.cy = Math.min(b.y + b.h, Math.max(b.y, cam.cy));
  }
  function animateTo(target, dur = 650) {
    const from = { ...cam }, start = performance.now();
    anim = (now) => {
      const t = Math.min(1, (now - start) / dur), e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      cam.cx = from.cx + (target.cx - from.cx) * e;
      cam.cy = from.cy + (target.cy - from.cy) * e;
      cam.k = from.k * Math.pow(target.k / from.k, e);
      apply();
      if (t < 1) requestAnimationFrame(anim); else anim = null;
    };
    requestAnimationFrame(anim);
    return new Promise((res) => setTimeout(res, dur + 30));
  }
  cam = homeCam(); apply();

  const toWorld = (px, py) => { const rc = svg.getBoundingClientRect(); const { w, h } = size(); return { x: cam.cx + (px - rc.left - w / 2) / cam.k, y: cam.cy + (py - rc.top - h / 2) / cam.k }; };

  // hover / highlight
  let hovered = null;
  function bboxOf(g) {
    let b; try { b = g.getBBox(); } catch { return null; }
    const rotated = (view === "house" && planRot) || (view === "rv" && rvWide);
    if (!rotated) return b;
    const rb = rotBox({ x: b.x, y: b.y, w: b.width, h: b.height });
    return { x: rb.x, y: rb.y, width: rb.w, height: rb.h };
  }
  function setHover(g) {
    if (hovered === g) return;
    hovered = g;
    const box = svg.querySelector("#hl");
    if (!g) { box.setAttribute("visibility", "hidden"); container.style.cursor = "grab"; options.onHover?.(null); return; }
    const b = bboxOf(g);
    if (b) { box.setAttribute("x", b.x - 8); box.setAttribute("y", b.y - 8); box.setAttribute("width", b.width + 16); box.setAttribute("height", b.height + 16); box.setAttribute("visibility", "visible"); }
    container.style.cursor = "pointer";
    options.onHover?.({ id: g.dataset.id, label: g.dataset.label });
  }
  const hsAt = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.closest ? el.closest(".hs") : null; };

  // pointer: pan, pinch, tap
  const pts = new Map();
  let drag = null, pinch = null;
  svg.addEventListener("pointerdown", (e) => {
    svg.setPointerCapture?.(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) drag = { x: e.clientX, y: e.clientY, cx: cam.cx, cy: cam.cy, moved: false, target: hsAt(e.clientX, e.clientY) };
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: cam.k, mid: toWorld((a.x + b.x) / 2, (a.y + b.y) / 2) };
      drag = null;
    }
  });
  svg.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId)) { if (e.pointerType === "mouse") setHover(hsAt(e.clientX, e.clientY)); return; }
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pts.size === 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      cam.k = pinch.k * d / pinch.d;
      const rc = svg.getBoundingClientRect(); const { w, h } = size();
      const mx = (a.x + b.x) / 2 - rc.left - w / 2, my = (a.y + b.y) / 2 - rc.top - h / 2;
      cam.cx = pinch.mid.x - mx / cam.k; cam.cy = pinch.mid.y - my / cam.k;
      clampCam(); apply(); return;
    }
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.hypot(dx, dy) > 6) drag.moved = true;
      if (drag.moved) { cam.cx = drag.cx - dx / cam.k; cam.cy = drag.cy - dy / cam.k; clampCam(); apply(); setHover(null); container.style.cursor = "grabbing"; }
    }
  });
  const end = (e) => {
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (drag && !drag.moved && pts.size === 0) {
      const g = hsAt(e.clientX, e.clientY) || drag.target;
      setHover(g);
      if (g) {
        const id = g.dataset.id;
        if (id === "rv" && view === "house") setView("rv");
        else options.onSelect?.({ id, label: g.dataset.label });
      }
    }
    if (pts.size === 0) drag = null;
  };
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);
  svg.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") setHover(null); });
  svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    const before = toWorld(e.clientX, e.clientY);
    cam.k *= Math.exp(-e.deltaY * 0.0015);
    clampCam();
    const rc = svg.getBoundingClientRect(); const { w, h } = size();
    cam.cx = before.x - (e.clientX - rc.left - w / 2) / cam.k;
    cam.cy = before.y - (e.clientY - rc.top - h / 2) / cam.k;
    clampCam(); apply();
  }, { passive: false });

  function find(id) { return svg.querySelector(`.hs[data-id="${id}"]`); }
  async function setView(next) {
    if (next === view) { await animateTo(homeCam()); return; }
    setHover(null);
    if (next === "rv") {
      const g = find("rv"); const b = g && bboxOf(g);
      if (b) await animateTo(fitBox({ x: b.x, y: b.y, w: b.width, h: b.height }, 0.95), 700);
      svg.style.opacity = "0";
      await new Promise((res) => setTimeout(res, 220));
      view = "rv"; render(); cam = homeCam(); cam.k *= 0.6; apply();
      svg.style.opacity = "1";
      options.onView?.("rv");
      await animateTo(homeCam(), 600);
    } else {
      svg.style.opacity = "0";
      await new Promise((res) => setTimeout(res, 220));
      view = "house"; render();
      const g = find("rv"); const b = g && bboxOf(g);
      cam = b ? fitBox({ x: b.x, y: b.y, w: b.width, h: b.height }, 0.95) : homeCam(); apply();
      svg.style.opacity = "1";
      options.onView?.("house");
      await animateTo(homeCam(), 700);
    }
  }
  function focus(id, pad = 2.2) {
    const g = find(id); if (!g) return;
    const b = bboxOf(g); if (!b) return;
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2, w = Math.max(b.width, 260) * pad, h = Math.max(b.height, 260) * pad;
    cam = fitBox({ x: cx - w / 2, y: cy - h / 2, w, h }); clampCam(); apply();
  }
  function focusBox(x, y, w, h) { let b = { x, y, w, h }; if (view === "house" && planRot) b = rotBox(b); cam = fitBox(b); clampCam(); apply(); }
  let lastW = size().w;
  window.addEventListener("resize", () => { const was = [planRot, rvWide]; const s = size(); const nowRot = s.h > s.w * 1.15, nowWide = s.w > s.h * 1.1; if (nowRot !== was[0] || nowWide !== was[1]) { render(); cam = homeCam(); } clampCam(); apply(); });

  const api = {
    setView, getView: () => view, focus, focusBox,
    reset: () => animateTo(homeCam()),
    setPeek() {}, getPeek: () => true,
    highlight(id) { setHover(find(id)); },
    resize() { apply(); },
  };
  window.__HOUSE__ = api;
  options.onReady?.();
  return api;
}
