/* Holiday decorations: inline SVG art layered on the page edges.
   Everything here is aria-hidden, pointer-events:none, and removed when the theme is default.
   Styles live in themes.css (section "Decorations"). No external images. */

const DECOR_ATTR = "data-decor";
let current = null;

const MOTION_SESSION_KEY = "yps-decor-motion-played";
const LEGACY_SLEIGH_KEY = "yps-sleigh-played";

function navigationType() {
  try {
    const entry = performance.getEntriesByType("navigation")[0];
    return entry && entry.type ? entry.type : "";
  } catch {
    return "";
  }
}

/* Moving decorations (fliers, flickers, canvas particles, etc.) play only on a
   fresh visit — first page of this tab/session, or a different-origin referrer —
   or an explicit reload. They do not replay on in-site clicks. */
function shouldPlayMotion() {
  if (navigationType() === "reload") return true;
  try {
    return !sessionStorage.getItem(MOTION_SESSION_KEY) && !sessionStorage.getItem(LEGACY_SLEIGH_KEY);
  } catch {
    try {
      if (!document.referrer) return true;
      return new URL(document.referrer).origin !== location.origin;
    } catch {
      return true;
    }
  }
}

function markMotionPlayed() {
  try { sessionStorage.setItem(MOTION_SESSION_KEY, "1"); } catch { /* private mode */ }
}

export const PLAY_MOTION = (() => {
  const play = shouldPlayMotion();
  if (play) markMotionPlayed();
  return play;
})();


const isAdmin = () => /\/admin(\/|$)/.test(location.pathname);

/* ---------- shared gradients (one hidden sprite, never display:none) ---------- */
const DEFS = `<svg class="yd-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>
  <radialGradient id="yd-pk" cx="45%" cy="38%" r="65%"><stop offset="0" stop-color="#ffb347"/><stop offset=".55" stop-color="#f08218"/><stop offset="1" stop-color="#b9510a"/></radialGradient>
  <radialGradient id="yd-pk2" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#f39a32"/><stop offset=".7" stop-color="#d9680f"/><stop offset="1" stop-color="#9c4307"/></radialGradient>
  <radialGradient id="yd-pkglow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffcf5c" stop-opacity=".55"/><stop offset="1" stop-color="#ff9b2f" stop-opacity="0"/></radialGradient>
  <linearGradient id="yd-tree" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3fae6a"/><stop offset=".6" stop-color="#1f7a46"/><stop offset="1" stop-color="#145a33"/></linearGradient>
  <linearGradient id="yd-red" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ef4b52"/><stop offset="1" stop-color="#a3141f"/></linearGradient>
  <linearGradient id="yd-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1b0"/><stop offset=".45" stop-color="#f2c84b"/><stop offset="1" stop-color="#b8860b"/></linearGradient>
  <linearGradient id="yd-sleigh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e63946"/><stop offset="1" stop-color="#8e1622"/></linearGradient>
  <radialGradient id="yd-rose" cx="45%" cy="40%" r="60%"><stop offset="0" stop-color="#ff5c86"/><stop offset=".7" stop-color="#d11f4f"/><stop offset="1" stop-color="#8f0f33"/></radialGradient>
  <linearGradient id="yd-heart" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7a9c"/><stop offset=".6" stop-color="#e0245e"/><stop offset="1" stop-color="#a3123f"/></linearGradient>
  <linearGradient id="yd-champ" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset="1" stop-color="#e0b43c"/></linearGradient>
  <linearGradient id="yd-wave" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".22" stop-color="#000" stop-opacity=".16"/><stop offset=".42" stop-color="#fff" stop-opacity=".14"/>
    <stop offset=".62" stop-color="#000" stop-opacity=".16"/><stop offset=".82" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></linearGradient>
  <pattern id="yd-garland" width="96" height="26" patternUnits="userSpaceOnUse">
    <path d="M0 3 Q48 24 96 3" fill="none" stroke="#17532f" stroke-width="7" stroke-linecap="round"/>
    <path d="M0 3 Q48 24 96 3" fill="none" stroke="#2f8f4e" stroke-width="7" stroke-dasharray="1.5 3" stroke-linecap="round"/>
    <path d="M0 3 Q48 24 96 3" fill="none" stroke="#e8c25a" stroke-width="1" stroke-dasharray="5 4" opacity=".9"/>
    <circle cx="30" cy="14" r="3.4" fill="#f2c84b"/><circle cx="48" cy="17.5" r="4.2" fill="url(#yd-red)"/><circle cx="66" cy="14" r="3.4" fill="#4ea8de"/>
    <circle cx="47" cy="16.2" r="1.1" fill="#fff" opacity=".7"/>
    <g transform="translate(0 4)"><path d="M0 0 C-7 -8 -13 -5 -11 0 C-10 4 -4 3 0 0Z M0 0 C7 -8 13 -5 11 0 C10 4 4 3 0 0Z" fill="url(#yd-red)"/><path d="M-1 1 L-5 10 L-2 9 L-1 11 L1 2Z M1 1 L5 10 L2 9 L1 11 L-1 2Z" fill="#b81d27"/><rect x="-2.6" y="-2.6" width="5.2" height="5.2" rx="1.6" fill="#8f1019"/></g>
    <g transform="translate(96 4)"><path d="M0 0 C-7 -8 -13 -5 -11 0 C-10 4 -4 3 0 0Z M0 0 C7 -8 13 -5 11 0 C10 4 4 3 0 0Z" fill="url(#yd-red)"/><path d="M-1 1 L-5 10 L-2 9 L-1 11 L1 2Z M1 1 L5 10 L2 9 L1 11 L-1 2Z" fill="#b81d27"/><rect x="-2.6" y="-2.6" width="5.2" height="5.2" rx="1.6" fill="#8f1019"/></g>
  </pattern>
  <pattern id="yd-bunting" width="78" height="26" patternUnits="userSpaceOnUse">
    <path d="M0 2 Q39 9 78 2" fill="none" stroke="#1d3557" stroke-width="1.4"/>
    <path d="M5 3.4 L23 5.2 L13 22Z" fill="#c81d25"/><path d="M29 5.6 L49 5.6 L39 23Z" fill="#fff" stroke="#d8dde8" stroke-width=".8"/>
    <path d="M55 5.2 L73 3.4 L65 22Z" fill="#1d3b8b"/><path d="M64 9 l1 2.2 2.4.2-1.8 1.6.6 2.3-2.2-1.2-2.1 1.2.6-2.3-1.8-1.6 2.4-.2z" fill="#fff"/>
    <path d="M14.5 8 l.9 1.9 2 .2-1.5 1.3.5 2-1.9-1-1.8 1 .5-2-1.5-1.3 2-.2z" fill="#fff" opacity=".9"/>
  </pattern>
  <pattern id="yd-hearts" width="70" height="26" patternUnits="userSpaceOnUse">
    <path d="M0 2 Q35 12 70 2" fill="none" stroke="#e89bb0" stroke-width="1.2"/>
    <path d="M20 6.8 V10 M50 6.8 V10 M35 7.5 V14" stroke="#e89bb0" stroke-width=".8"/>
    <path d="M20 19 C12 13 14 8 17.5 8.5 C19 8.7 20 10 20 10 C20 10 21 8.7 22.5 8.5 C26 8 28 13 20 19Z" fill="url(#yd-heart)"/>
    <path d="M50 19 C42 13 44 8 47.5 8.5 C49 8.7 50 10 50 10 C50 10 51 8.7 52.5 8.5 C56 8 58 13 50 19Z" fill="url(#yd-heart)"/>
    <path d="M35 24 C29.5 19.8 31 16 33.5 16.3 C34.4 16.4 35 17.3 35 17.3 C35 17.3 35.6 16.4 36.5 16.3 C39 16 40.5 19.8 35 24Z" fill="#ffd1dc"/>
  </pattern>
  <pattern id="yd-streamer" width="84" height="26" patternUnits="userSpaceOnUse">
    <path d="M0 2 Q42 20 84 2" fill="none" stroke="url(#yd-gold)" stroke-width="2.6"/>
    <path d="M0 2 Q42 20 84 2" fill="none" stroke="#fff" stroke-width=".8" stroke-dasharray="2 6" opacity=".8"/>
    <path d="M21 9 V15 M63 9 V15" stroke="#cbd5e1" stroke-width=".8"/>
    <path d="M21 14 l1.3 2.8 3 .3-2.3 2 .7 3-2.7-1.6-2.7 1.6.7-3-2.3-2 3-.3z" fill="#f2c84b"/>
    <path d="M63 14 l1.3 2.8 3 .3-2.3 2 .7 3-2.7-1.6-2.7 1.6.7-3-2.3-2 3-.3z" fill="#e2e8f0"/>
    <circle cx="42" cy="13.5" r="2.4" fill="url(#yd-gold)"/>
  </pattern>
</defs></svg>`;

/* ---------- art helpers ---------- */
const svg = (vb, body, cls = "") => `<svg class="${cls}" viewBox="${vb}" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">${body}</svg>`;
const star = (x, y, r, fill, cls = "") => {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push(`${(x + Math.cos(a) * rr).toFixed(1)},${(y + Math.sin(a) * rr).toFixed(1)}`);
  }
  return `<polygon class="${cls}" points="${pts.join(" ")}" fill="${fill}"/>`;
};

function pumpkin(x, y, s, face = 1, d = 0) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <ellipse cx="0" cy="34" rx="42" ry="5.5" fill="rgba(0,0,0,.28)"/>
    ${face ? `<ellipse class="yd-pkglow" style="--d:${d}s" cx="0" cy="2" rx="62" ry="52" fill="url(#yd-pkglow)"/>` : ""}
    <path d="M-3 -24 C-5 -33 -1 -40 7 -42 L9.5 -37 C4 -35 3 -29 4 -23Z" fill="#55702a"/>
    <path d="M6 -37 C12 -44 20 -40 18 -34" fill="none" stroke="#6f8f35" stroke-width="1.6" stroke-linecap="round"/>
    <ellipse cx="-19" cy="4" rx="22" ry="28.5" fill="url(#yd-pk2)"/>
    <ellipse cx="19" cy="4" rx="22" ry="28.5" fill="url(#yd-pk2)"/>
    <ellipse cx="0" cy="3" rx="21" ry="31" fill="url(#yd-pk)"/>
    <path d="M-9 -26 C-15 -12 -15 18 -9 33 M9 -26 C15 -12 15 18 9 33" stroke="#b8560b" stroke-width="1.5" fill="none" opacity=".55"/>
    <path d="M-30 -14 C-34 -4 -34 12 -30 22" stroke="#ffd08a" stroke-width="2" fill="none" opacity=".35" stroke-linecap="round"/>
    ${face ? `<g class="yd-pkface" style="--d:${d}s">
      <path d="M-23 -5 L-8 -5 L-15.5 -17Z"/><path d="M8 -5 L23 -5 L15.5 -17Z"/><path d="M-3 3 L3 3 L0 -3Z"/>
      <path d="M-26 9 Q0 31 26 9 L21 11 L18 6.5 L12 14 L6 9.5 L0 16 L-6 9.5 L-12 14 L-18 6.5 L-21 11Z"/></g>` : ""}
  </g>`;
}

function tree(x, y, s) {
  const orn = [[48, 58, "#e63946"], [71, 52, "#f2c84b"], [37, 92, "#4ea8de"], [61, 96, "#e63946"], [85, 88, "#f2c84b"],
    [27, 130, "#f2c84b"], [50, 132, "#4ea8de"], [74, 134, "#e63946"], [96, 126, "#fff"], [60, 74, "#fff"], [44, 112, "#e63946"], [80, 112, "#4ea8de"]];
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <ellipse cx="60" cy="156" rx="52" ry="5" fill="rgba(0,0,0,.14)"/>
    <rect x="53" y="134" width="14" height="20" rx="2" fill="#6b4226"/>
    <path d="M60 62 L108 136 Q60 150 12 136 Z" fill="url(#yd-tree)"/>
    <path d="M60 40 L95 98 Q60 108 25 98 Z" fill="url(#yd-tree)"/>
    <path d="M60 20 L84 63 Q60 71 36 63 Z" fill="url(#yd-tree)"/>
    <path d="M60 20 L84 63 Q72 67 60 68Z M60 40 L95 98 Q78 104 60 105Z M60 62 L108 136 Q84 144 60 146Z" fill="#000" opacity=".12"/>
    <path d="M40 60 Q60 70 80 56 M30 96 Q62 110 92 90 M18 134 Q64 150 104 128" stroke="#f2c84b" stroke-width="2" fill="none" stroke-linecap="round" opacity=".9"/>
    ${orn.map(([cx, cy, c], i) => `<circle class="yd-orn" style="--d:${(i * 0.37).toFixed(2)}s" cx="${cx}" cy="${cy}" r="3.8" fill="${c}"/><circle cx="${cx - 1.2}" cy="${cy - 1.2}" r="1.1" fill="#fff" opacity=".65"/>`).join("")}
    <circle class="yd-starglow" cx="60" cy="16" r="16" fill="url(#yd-pkglow)"/>
    ${star(60, 16, 11, "url(#yd-gold)", "yd-star")}
    <g transform="translate(8 134)"><rect width="28" height="22" rx="2" fill="url(#yd-red)"/><rect x="12" width="4" height="22" fill="#f2c84b"/><rect y="7" width="28" height="4" fill="#f2c84b"/><path d="M14 0 C8 -8 2 -4 6 0Z M14 0 C20 -8 26 -4 22 0Z" fill="#f2c84b"/></g>
    <g transform="translate(82 128)"><rect width="32" height="28" rx="2" fill="#2a6fdb"/><rect x="14" width="4" height="28" fill="#fff"/><rect y="10" width="32" height="4" fill="#fff"/><path d="M16 0 C9 -9 2 -5 6 0Z M16 0 C23 -9 30 -5 26 0Z" fill="#fff"/></g>
  </g>`;
}

function gifts(x, y, s) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <ellipse cx="44" cy="62" rx="46" ry="4" fill="rgba(0,0,0,.14)"/>
    <g transform="translate(0 22)"><rect width="44" height="38" rx="3" fill="url(#yd-red)"/><rect x="19" width="6" height="38" fill="#f2c84b"/><rect y="14" width="44" height="6" fill="#f2c84b"/></g>
    <g transform="translate(48 30)"><rect width="38" height="30" rx="3" fill="#1f7a46"/><rect x="16" width="6" height="30" fill="#fff"/><rect y="12" width="38" height="6" fill="#fff"/><path d="M19 0 C11 -10 3 -5 8 0Z M19 0 C27 -10 35 -5 30 0Z" fill="#fff"/></g>
    <g transform="translate(9 0)"><rect width="28" height="22" rx="2" fill="#2a6fdb"/><rect x="12" width="4" height="22" fill="#f2c84b"/><rect y="8" width="28" height="4" fill="#f2c84b"/><path d="M14 0 C7 -9 0 -4 5 0Z M14 0 C21 -9 28 -4 23 0Z" fill="#f2c84b"/></g>
  </g>`;
}

function bowSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 44"><defs><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ef4b52"/><stop offset="1" stop-color="#a3141f"/></linearGradient></defs>
    <path d="M22 18 L11 39 L16.5 37.5 L19 43 L25.5 21Z" fill="#b81d27"/><path d="M26 18 L37 39 L31.5 37.5 L29 43 L22.5 21Z" fill="#c42530"/>
    <path d="M24 17 C14 3 1 4 2.5 13.5 C4 23 16 22 24 17Z" fill="url(#b)"/><path d="M24 17 C34 3 47 4 45.5 13.5 C44 23 32 22 24 17Z" fill="url(#b)"/>
    <path d="M7 10 C10 7.5 15 8.5 19 13" stroke="#ff9aa0" stroke-width="1.6" fill="none" opacity=".75" stroke-linecap="round"/>
    <path d="M41 10 C38 7.5 33 8.5 29 13" stroke="#ff9aa0" stroke-width="1.2" fill="none" opacity=".5" stroke-linecap="round"/>
    <rect x="19.5" y="12.5" width="9" height="10" rx="3.4" fill="#8f1019"/></svg>`;
}
function heartBadgeSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 36"><defs><linearGradient id="h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7a9c"/><stop offset="1" stop-color="#c2184f"/></linearGradient></defs>
    <path d="M20 34 C4 22 1 12 6 6 C10 1.5 17 3 20 9 C23 3 30 1.5 34 6 C39 12 36 22 20 34Z" fill="url(#h)" stroke="#fff" stroke-width="2"/>
    <path d="M9 10 C10.5 7.5 13.5 7 15.5 8.5" stroke="#fff" stroke-width="1.8" fill="none" opacity=".7" stroke-linecap="round"/></svg>`;
}

function cobweb() {
  const W = 100, spokes = [0, 16, 34, 52, 70, 90].map((d) => (d * Math.PI) / 180);
  const P = (a, r) => [W - Math.cos(a) * r, Math.sin(a) * r];
  let d = spokes.map((a) => { const [x, y] = P(a, 100); return `M${W} 0 L${x.toFixed(1)} ${y.toFixed(1)}`; }).join(" ");
  for (const r of [20, 38, 57, 76, 94]) {
    for (let i = 0; i < spokes.length - 1; i++) {
      const [x1, y1] = P(spokes[i], r), [x2, y2] = P(spokes[i + 1], r);
      const [cx, cy] = P((spokes[i] + spokes[i + 1]) / 2, r * 0.8);
      d += ` M${x1.toFixed(1)} ${y1.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    }
  }
  return svg("0 0 100 100", `<path d="${d}" fill="none" stroke="currentColor" stroke-width=".9" stroke-linecap="round"/>`, "yd-web-svg");
}

function spider() {
  const legs = "M-3 -4 Q-11 -13 -17 -8 M-3.5 -1.5 Q-13 -5 -19 1 M-3.5 1 Q-13 3 -17 10 M-3 3 Q-9 9 -12 16";
  return svg("-20 -200 40 222", `<line x1="0" y1="-200" x2="0" y2="-6" stroke="currentColor" stroke-width=".8" opacity=".7"/>
    <g class="yd-spider-body"><path d="${legs}" stroke="#1b1020" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <path d="${legs}" transform="scale(-1 1)" stroke="#1b1020" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <circle cx="0" cy="-4" r="4" fill="#2a1a35"/><ellipse cx="0" cy="5" rx="6.5" ry="7.5" fill="#2a1a35"/>
    <path d="M-2.4 3 L0 6 L2.4 3 L0 9Z" fill="#e07a1f" opacity=".9"/>
    <circle cx="-1.4" cy="-5" r=".9" fill="#ffd36b"/><circle cx="1.4" cy="-5" r=".9" fill="#ffd36b"/></g>`, "yd-spider-svg");
}

function bat() {
  const wing = "M-3 -1 C-9 -11 -19 -12 -28 -6 C-23 -5 -21 -2 -21 1 C-17 -2 -13 -1 -11 3 C-9 -1 -6 -1 -3 3Z";
  return svg("-30 -16 60 28", `<g fill="#1e1029"><path class="yd-wing" d="${wing}"/><path class="yd-wing" d="${wing}" transform="scale(-1 1)"/>
    <ellipse cx="0" cy="1" rx="3.8" ry="6.2"/><circle cx="0" cy="-5" r="3.3"/><path d="M-2.8 -7 L-2.2 -11.5 L-.5 -7.6Z M2.8 -7 L2.2 -11.5 L.5 -7.6Z"/></g>
    <circle cx="-1.2" cy="-5.2" r=".75" fill="#ffb347"/><circle cx="1.2" cy="-5.2" r=".75" fill="#ffb347"/>`, "yd-bat-svg");
}

function reindeer(x, y, lead = false, d = 0) {
  return `<g transform="translate(${x} ${y})"><g class="yd-rd" style="--d:${d}s">
    <path class="yd-legs-b" d="M14 19 L5 27 M18 21 L12 31" stroke="#6b4423" stroke-width="2.6" stroke-linecap="round"/>
    <ellipse cx="25" cy="14" rx="16" ry="8.5" fill="#8b5a2b"/>
    <path d="M33 9 L43 -1 L49 3 L41 16Z" fill="#8b5a2b"/>
    <ellipse cx="48" cy="0" rx="6.2" ry="4" fill="#8b5a2b" transform="rotate(14 48 0)"/>
    <ellipse cx="53" cy="2.5" rx="3.6" ry="2.6" fill="#a06a36"/>
    <path d="M12 11 L5 8 L9 15Z" fill="#f2e3c9"/>
    <path d="M15 19 C23 23 34 22 40 17" stroke="#c49a6c" stroke-width="2" fill="none" opacity=".6"/>
    <path class="yd-legs-f" d="M38 18 L47 23 M35 20 L41 30" stroke="#6b4423" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M46 -3 L43 -11 M44.5 -7 L40 -9 M43 -11 L45 -16 M43 -11 L39 -15 M49 -3 L52 -10 M51 -7 L55 -9 M52 -10 L51 -15" stroke="#5a3a1c" stroke-width="1.5" stroke-linecap="round" fill="none"/>
    <path d="M44 -2 L39 -4 L42 1Z" fill="#6b4423"/><circle cx="48" cy="-1" r=".9" fill="#1a1a1a"/>
    <circle cx="56.5" cy="2.6" r="${lead ? 2.3 : 1.7}" fill="${lead ? "#ff3b3b" : "#4a2f17"}" ${lead ? 'class="yd-rudolph"' : ""}/>
    <path d="M34 6 C37 12 37 18 34 22" stroke="#c0392b" stroke-width="2.4" fill="none"/>
    <circle cx="36.3" cy="14" r="1.5" fill="#f2c84b"/></g></g>`;
}

function sleigh() {
  const sparkles = [[6, 50, 2.4, .35], [18, 40, 3, .55], [30, 56, 2.2, .6], [12, 62, 1.8, .4], [36, 44, 3.2, .8]]
    .map(([x, y, r, o], i) => `<g class="yd-spark" style="--d:${i * 0.2}s;opacity:${o}">${star(x, y, r * 1.6, "#ffe08a")}</g>`).join("");
  const body = `${sparkles}
    <path d="M121 38 C160 40 200 32 300 28" stroke="#f2c84b" stroke-width="1" fill="none" opacity=".9"/>
    <g transform="translate(40 26)">
      <path d="M12 26 C6 10 18 0 28 4 C38 0 44 12 38 26Z" fill="#7a4e2d"/>
      <rect x="20" y="0" width="12" height="10" rx="1" fill="#2a9d5c"/><rect x="25" y="0" width="2.4" height="10" fill="#f2c84b"/>
      <rect x="8" y="5" width="10" height="9" rx="1" fill="#2a6fdb"/><rect x="12" y="5" width="2" height="9" fill="#fff"/>
      <path d="M46 30 C44 14 51 8 59 8 C67 8 72 16 70 30Z" fill="#d62828"/>
      <rect x="46" y="20" width="24" height="4" fill="#1f1f1f"/><rect x="56" y="19.5" width="5" height="5" fill="#f2c84b"/>
      <circle cx="60" cy="2" r="6" fill="#f3c9a0"/>
      <path d="M53.5 2 C53 13 67 13 66.5 2 C63 6.5 57 6.5 53.5 2Z" fill="#fff"/>
      <path d="M53 -1 C54 -10 62 -13 71 -7 L67 -2.5 C63.5 -5.5 58 -4.5 57 -1Z" fill="#d62828"/>
      <rect x="52.5" y="-3" width="14.5" height="3.8" rx="1.9" fill="#fff"/><circle cx="72" cy="-7" r="2.5" fill="#fff"/>
      <path d="M66 15 L80 12" stroke="#d62828" stroke-width="5" stroke-linecap="round"/><circle cx="81" cy="12" r="2.7" fill="#2a2a2a"/>
      <path d="M6 24 H74 C82 24 86 18 88 10 L94 10 C92 30 82 44 64 44 H18 C10 44 4 36 6 24Z" fill="url(#yd-sleigh)" stroke="#7c1220" stroke-width="1"/>
      <path d="M12 31 H70 C78 31 82 25 84 18" stroke="#f2c84b" stroke-width="1.7" fill="none"/>
      <path d="M6 24 C1 18 3 11 9 12.5" stroke="#7c1220" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M4 55 H84 C92 55 96 51 96 45 C96 41 92 41 92 45" stroke="#d4a017" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <path d="M22 44 V55 M60 44 V55" stroke="#d4a017" stroke-width="2.2"/>
    </g>
    ${reindeer(150, 34, false, 0)}${reindeer(205, 29, false, 0.17)}${reindeer(260, 23, true, 0.34)}`;
  return svg("0 0 330 92", body, "yd-sleigh-svg");
}

function cupid() {
  const wing = "M-6 -4 C-14 -18 -30 -20 -38 -12 C-32 -11 -30 -8 -31 -5 C-26 -8 -22 -6 -21 -3 C-17 -6 -13 -4 -12 0 C-10 -3 -7 -3 -6 0Z";
  return svg("-40 -24 80 46", `<g class="yd-wing" fill="#fff" stroke="#f3b6c6" stroke-width=".8"><path d="${wing}"/></g>
    <g class="yd-wing" fill="#fff" stroke="#f3b6c6" stroke-width=".8"><path d="${wing}" transform="scale(-1 1)"/></g>
    <path d="M0 20 C-18 8 -20 -4 -14 -10 C-9 -14 -3 -12 0 -6 C3 -12 9 -14 14 -10 C20 -4 18 8 0 20Z" fill="url(#yd-heart)"/>
    <path d="M-10 -5 C-9 -8 -6 -9 -4 -8" stroke="#fff" stroke-width="1.6" fill="none" opacity=".7" stroke-linecap="round"/>
    <path d="M-26 14 L26 -10" stroke="#c9a227" stroke-width="1.4"/><path d="M26 -10 L20 -10.5 L23 -6Z" fill="#c9a227"/>
    <path d="M-26 14 L-30 11 M-26 14 L-29 17 M-23.5 13 L-27 10 M-23.5 13 L-26 16" stroke="#e0245e" stroke-width="1.2"/>`, "yd-cupid-svg");
}

function rose(x, y, s, rot = 0) {
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">
    <path d="M0 8 C-2 40 3 70 0 100" stroke="#2f7a3f" stroke-width="2.6" fill="none"/>
    <path d="M0 46 C-14 38 -20 44 -22 50 C-14 52 -6 50 0 46Z" fill="#3c9a4f"/><path d="M1 66 C14 58 21 63 23 69 C15 71 7 70 1 66Z" fill="#2f7a3f"/>
    <path d="M-11 2 C-14 14 -4 20 0 18 C-8 14 -10 8 -11 2Z" fill="#9c1239"/><path d="M11 2 C14 14 4 20 0 18 C8 14 10 8 11 2Z" fill="#a3133c"/>
    <circle cx="0" cy="4" r="10" fill="url(#yd-rose)"/>
    <path d="M-6 3 C-5 -4 5 -4 5 2 C5 7 -2 8 -3 4 C-3 1 2 0 2 3" stroke="#7d0c2c" stroke-width="1.3" fill="none" stroke-linecap="round"/>
    <path d="M-9 10 C-4 15 4 15 9 10" stroke="#7d0c2c" stroke-width="1" fill="none" opacity=".6"/></g>`;
}

function heartBalloon(x, y, s) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><g class="yd-balloon">
    <path d="M0 40 C-6 60 6 72 -2 96" stroke="#c9a227" stroke-width="1" fill="none"/>
    <path d="M0 40 C-30 20 -32 0 -22 -8 C-14 -14 -4 -10 0 -2 C4 -10 14 -14 22 -8 C32 0 30 20 0 40Z" fill="url(#yd-heart)"/>
    <path d="M-3 40 L3 40 L0 44Z" fill="#a3123f"/>
    <path d="M-18 -2 C-16 -7 -11 -8 -8 -6" stroke="#fff" stroke-width="2.4" fill="none" opacity=".6" stroke-linecap="round"/></g></g>`;
}

function envelope(x, y, s) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="30" cy="42" rx="32" ry="3" fill="rgba(0,0,0,.12)"/>
    <rect width="60" height="40" rx="3" fill="#fff6f0" stroke="#e8c4cf"/><path d="M0 2 L30 24 L60 2" fill="none" stroke="#e8c4cf" stroke-width="1.4"/>
    <path d="M30 30 C21 24 21 18 24.5 16.5 C27 15.5 29 17 30 19 C31 17 33 15.5 35.5 16.5 C39 18 39 24 30 30Z" fill="url(#yd-heart)"/></g>`;
}

function flute(x, y, rot, d) {
  return `<g transform="translate(${x} ${y}) rotate(${rot})">
    <path d="M-7 -40 L7 -40 L5 0 C4 5 2 7 0 7 C-2 7 -4 5 -5 0Z" fill="rgba(255,255,255,.16)" stroke="#f3e2a9" stroke-width="1.2"/>
    <path d="M-6.2 -28 L6.2 -28 L4.7 0 C3.8 4.4 1.8 6 0 6 C-1.8 6 -3.8 4.4 -4.7 0Z" fill="url(#yd-champ)" opacity=".92"/>
    <circle class="yd-bubble" style="--d:${d}s" cx="-1.5" cy="-2" r="1.1" fill="#fff"/><circle class="yd-bubble" style="--d:${d + 0.7}s" cx="1.5" cy="-6" r=".9" fill="#fff"/><circle class="yd-bubble" style="--d:${d + 1.3}s" cx="0" cy="-1" r=".8" fill="#fff"/>
    <path d="M0 7 V30" stroke="#f3e2a9" stroke-width="1.6"/><ellipse cx="0" cy="31" rx="10" ry="2.4" fill="#f3e2a9"/></g>`;
}

function clock(cx, cy, r) {
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6, r1 = r * (i % 3 ? 0.8 : 0.72), r2 = r * 0.88;
    return `M${(cx + Math.sin(a) * r1).toFixed(1)} ${(cy - Math.cos(a) * r1).toFixed(1)} L${(cx + Math.sin(a) * r2).toFixed(1)} ${(cy - Math.cos(a) * r2).toFixed(1)}`;
  }).join(" ");
  return `<circle cx="${cx}" cy="${cy}" r="${r + 4}" fill="url(#yd-gold)"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="#0f172a"/>
    <circle cx="${cx}" cy="${cy}" r="${r - 3}" fill="none" stroke="#f2c84b" stroke-width=".8" opacity=".5"/>
    <path d="${ticks}" stroke="#f2c84b" stroke-width="2" stroke-linecap="round"/>
    <path d="M${cx} ${cy} L${cx - r * 0.06} ${cy - r * 0.5}" stroke="#f8fafc" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M${cx} ${cy} L${cx - r * 0.1} ${cy - r * 0.74}" stroke="#f8fafc" stroke-width="2" stroke-linecap="round"/>
    <path class="yd-second" style="transform-origin:${cx}px ${cy}px" d="M${cx} ${cy + r * 0.12} L${cx} ${cy - r * 0.8}" stroke="#f472b6" stroke-width="1" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy}" r="2.6" fill="#f2c84b"/>`;
}

function flag(x, y, w, h) {
  const s = h / 13, N = 16;
  const wave = (px, base) => base + Math.sin((px / w) * Math.PI * 2.2) * (px / w) * h * 0.09;
  const band = (y0, y1, x1 = w) => {
    let top = "", bot = "";
    for (let i = 0; i <= N; i++) { const px = (x1 * i) / N; top += `${i ? "L" : "M"}${px.toFixed(1)} ${wave(px, y0).toFixed(1)} `; }
    for (let i = N; i >= 0; i--) { const px = (x1 * i) / N; bot += `L${px.toFixed(1)} ${wave(px, y1).toFixed(1)} `; }
    return top + bot + "Z";
  };
  let out = `<path d="${band(0, h)}" fill="#fff"/>`;
  for (let i = 0; i < 13; i += 2) out += `<path d="${band(i * s, (i + 1) * s)}" fill="#c81d25"/>`;
  const cw = w * 0.4;
  out += `<path d="${band(0, 7 * s, cw)}" fill="#1d3b8b"/>`;
  for (let r = 0; r < 9; r++) for (let c = 0; c < (r % 2 ? 5 : 6); c++) {
    const px = (cw / 12) * (c * 2 + (r % 2 ? 2 : 1)); const py = (7 * s / 10) * (r + 1);
    out += `<circle cx="${px.toFixed(1)}" cy="${wave(px, py).toFixed(1)}" r="${(s * 0.22).toFixed(2)}" fill="#fff"/>`;
  }
  out += `<path d="${band(0, h)}" fill="url(#yd-wave)"/>`;
  return `<g transform="translate(${x} ${y})"><g class="yd-flag">${out}</g></g>`;
}

/* ---------- per-theme scenes ---------- */
function nextYear() { const n = new Date(); return n.getMonth() === 0 ? n.getFullYear() : n.getFullYear() + 1; }

const SCENES = {
  christmas: {
    strip: "yd-garland",
    hero: () => svg("0 0 210 162", `${gifts(4, 98, 0.78)}${tree(76, 0, 1)}`),
    footL: () => svg("0 0 92 64", gifts(2, 2, 1)),
    footR: () => svg("0 0 124 162", tree(2, 0, 1)),
    fliers: () => `<div class="yd-flier yd-sleigh">${sleigh()}</div>`,
    badge: "bow",
  },
  halloween: {
    hero: () => svg("0 0 240 104", `${pumpkin(26, 82, 0.42, 0)}${pumpkin(92, 60, 1, 1, 0)}${pumpkin(172, 72, 0.7, 1, 0.6)}${pumpkin(222, 86, 0.36, 0)}`),
    footL: () => svg("0 0 140 70", `${pumpkin(44, 40, 0.78, 1, 0.3)}${pumpkin(108, 52, 0.48, 0)}`),
    footR: () => svg("0 0 140 70", `${pumpkin(34, 52, 0.48, 0)}${pumpkin(96, 40, 0.78, 1, 0.9)}`),
    corner: () => `<div class="yd-web">${cobweb()}</div><div class="yd-spider">${spider()}</div>`,
    fliers: () => `<div class="yd-flier yd-bat yd-bat1"><div class="yd-bob">${bat()}</div></div>
      <div class="yd-flier yd-bat yd-bat2"><div class="yd-bob">${bat()}</div></div>
      <div class="yd-flier yd-bat yd-bat3"><div class="yd-bob">${bat()}</div></div>`,
  },
  valentines: {
    strip: "yd-hearts",
    hero: () => svg("0 0 200 150", `${rose(40, 54, 0.95, -12)}${rose(70, 44, 1.05, 4)}${rose(100, 60, 0.9, 16)}${heartBalloon(156, 24, 0.95)}`),
    footL: () => svg("0 0 100 70", `${rose(30, 6, 0.62, -10)}${rose(56, 2, 0.66, 8)}`),
    footR: () => svg("0 0 80 54", envelope(10, 6, 1)),
    fliers: () => `<div class="yd-flier yd-cupid"><div class="yd-bob">${cupid()}</div></div>`,
    badge: "heart",
  },
  "new-years": {
    strip: "yd-streamer",
    hero: () => svg("0 0 250 150", `<text x="126" y="22" text-anchor="middle" class="yd-nytext">Happy New Year</text>
      <text x="126" y="146" text-anchor="middle" class="yd-nyyear">${nextYear()}</text>
      ${clock(168, 74, 40)}${flute(52, 96, -14, 0)}${flute(78, 96, 14, 0.5)}
      <g class="yd-clink">${star(65, 46, 7, "#fff1b0")}<path d="M65 34 V28 M55 40 L50 36 M75 40 L80 36" stroke="#f2c84b" stroke-width="1.6" stroke-linecap="round"/></g>`),
    footL: () => svg("0 0 90 70", `${flute(34, 40, -14, 0.2)}${flute(58, 40, 14, 0.8)}`),
    footR: () => svg("0 0 80 80", clock(40, 40, 32)),
  },
  "fourth-of-july": {
    strip: "yd-bunting",
    hero: () => svg("0 0 200 150", `<rect x="17" y="8" width="4" height="142" rx="2" fill="#b9a46a"/><circle cx="19" cy="7" r="5" fill="url(#yd-gold)"/>
      ${flag(21, 12, 126, 70)}
      ${star(170, 38, 9, "#1d3b8b", "yd-tw")}${star(186, 70, 6, "#c81d25", "yd-tw yd-tw2")}${star(160, 98, 7, "#e2b33c", "yd-tw yd-tw3")}`),
    footL: () => svg("0 0 110 70", `<rect x="8" y="4" width="3" height="66" rx="1.5" fill="#b9a46a"/>${flag(11, 8, 76, 42)}`),
    footR: () => svg("0 0 90 60", `${star(20, 36, 14, "#c81d25", "yd-tw")}${star(50, 22, 10, "#1d3b8b", "yd-tw yd-tw2")}${star(74, 42, 12, "#e2b33c", "yd-tw yd-tw3")}`),
  },
};

function el(html, parent, cls) {
  const div = document.createElement("div");
  div.className = cls;
  div.setAttribute(DECOR_ATTR, "");
  div.setAttribute("aria-hidden", "true");
  div.innerHTML = html;
  parent.appendChild(div);
  return div;
}

export function clearDecor() {
  document.querySelectorAll(`[${DECOR_ATTR}]`).forEach((n) => n.remove());
  document.documentElement.style.removeProperty("--yd-badge");
  document.documentElement.classList.remove("yd-play-motion");
  current = null;
}

export function renderDecor(theme) {
  if (isAdmin()) return;
  if (theme === current) return;
  clearDecor();
  const cfg = SCENES[theme];
  if (!cfg) return;
  current = theme;
  if (PLAY_MOTION) document.documentElement.classList.add("yd-play-motion");

  const layer = el(DEFS, document.body, "yd-layer");
  if (cfg.fliers && PLAY_MOTION) layer.insertAdjacentHTML("beforeend", cfg.fliers());

  const header = document.querySelector(".site-header");
  if (header && cfg.strip) {
    el(`<svg width="100%" height="26" aria-hidden="true" focusable="false"><rect width="100%" height="26" fill="url(#${cfg.strip})"/></svg>`, header, "yd-strip");
  }
  const main = document.querySelector("main");
  if (main && cfg.corner) el(cfg.corner(), main, "yd-corner");

  const hero = document.querySelector(".hero, .page-hero");
  if (hero && cfg.hero) el(cfg.hero(), hero, `yd-scene ${hero.classList.contains("hero") ? "yd-scene-home" : "yd-scene-page"}`);

  const footer = document.querySelector(".site-footer");
  if (footer) {
    if (cfg.footL) el(cfg.footL(), footer, "yd-foot yd-foot-l");
    if (cfg.footR) el(cfg.footR(), footer, "yd-foot yd-foot-r");
  }

  if (cfg.badge) {
    const raw = cfg.badge === "bow" ? bowSvg() : heartBadgeSvg();
    document.documentElement.style.setProperty("--yd-badge", `url("data:image/svg+xml,${encodeURIComponent(raw.replace(/\s+/g, " "))}")`);
  }
}

/* Pause CSS animations while the tab is hidden. */
document.addEventListener("visibilitychange", () => {
  document.documentElement.classList.toggle("yd-paused", document.hidden);
});
