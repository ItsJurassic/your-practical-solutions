import { CONFIG } from "./config.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { renderDecor } from "./theme-decor.js?v=1";

export const THEME_STORAGE_KEY = "yps-theme";
export const THEMES = {
  default: { label: "Default", swatch: "#1f4a3d" },
  christmas: { label: "Christmas", swatch: "#8b1e2d" },
  halloween: { label: "Halloween", swatch: "#e07a1f" },
  valentines: { label: "Valentine's Day", swatch: "#c43b5c" },
  "new-years": { label: "New Year's", swatch: "#1a1a2e" },
  "fourth-of-july": { label: "4th of July", swatch: "#1d3b8b" },
};
const ALLOWED = new Set(Object.keys(THEMES));
const IS_ADMIN = /\/admin(\/|$)/.test(location.pathname);

/* ?previewTheme=halloween shows a theme on this page only. It never writes to
   Supabase or localStorage, and live theme changes are ignored while previewing. */
export const PREVIEW_THEME = (() => {
  try {
    const v = new URLSearchParams(location.search).get("previewTheme");
    return v && ALLOWED.has(v) ? v : null;
  } catch { return null; }
})();

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function normalizeTheme(name) {
  return ALLOWED.has(name) ? name : "default";
}

export function applyTheme(name) {
  const theme = normalizeTheme(name);
  document.documentElement.setAttribute("data-theme", theme);
  if (!PREVIEW_THEME) {
    try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch { /* private mode */ }
  }
  document.querySelectorAll("[data-theme-pick]").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.themePick === theme));
  });
  startFx(theme);
  renderDecor(theme);
  return theme;
}

function applyRemote(value) {
  if (PREVIEW_THEME && !IS_ADMIN) return;
  applyTheme(value);
}

function publicClient() {
  return createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
    auth: { persistSession: false, detectSessionInUrl: false, autoRefreshToken: false },
  });
}

export async function initTheme(client) {
  const sb = client || publicClient();
  try {
    const { data } = await sb.from("site_settings").select("value").eq("key", "theme").maybeSingle();
    if (data?.value) applyRemote(data.value);
  } catch (err) {
    console.warn("theme fetch failed", err);
  }
  sb.channel("site-theme")
    .on("postgres_changes", { event: "*", schema: "public", table: "site_settings", filter: "key=eq.theme" }, (payload) => {
      const value = payload.new?.value;
      if (value) applyRemote(value);
    })
    .subscribe();
}

export async function setSiteTheme(client, name) {
  const theme = normalizeTheme(name);
  applyTheme(theme);
  const { error } = await client.from("site_settings").upsert({ key: "theme", value: theme });
  if (error) throw error;
  return theme;
}

/* ---------- lightweight canvas effects (pointer-events: none) ---------- */
let fx = { raf: 0, canvas: null, ctx: null, theme: "default", particles: [], bursts: [], t: 0, last: 0 };

function ensureLayer() {
  let layer = document.getElementById("theme-fx");
  if (!layer) {
    layer = document.createElement("div");
    layer.id = "theme-fx";
    layer.className = "theme-fx";
    layer.setAttribute("aria-hidden", "true");
    document.body.appendChild(layer);
  }
  let lights = layer.querySelector(".theme-lights");
  if (!lights) {
    lights = document.createElement("div");
    lights.className = "theme-lights";
    const bulbs = Array.from({ length: 18 }, (_, i) => `<span style="--i:${i}"></span>`).join("");
    lights.innerHTML = bulbs;
    layer.appendChild(lights);
  }
  let canvas = layer.querySelector("canvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    layer.appendChild(canvas);
  }
  fx.canvas = canvas;
  fx.ctx = canvas.getContext("2d", { alpha: true });
  sizeCanvas();
  return layer;
}

function sizeCanvas() {
  if (!fx.canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const w = window.innerWidth;
  const h = window.innerHeight;
  fx.canvas.width = Math.floor(w * dpr);
  fx.canvas.height = Math.floor(h * dpr);
  fx.canvas.style.width = w + "px";
  fx.canvas.style.height = h + "px";
  fx.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  fx.w = w;
  fx.h = h;
}

function mobile() { return window.matchMedia("(max-width: 700px)").matches; }

function seed(theme) {
  fx.particles = [];
  fx.bursts = [];
  fx.t = 0;
  fx.nextBurst = 400;
  const n = mobile() ? 28 : 52;
  if (theme === "christmas") {
    for (let i = 0; i < n; i++) fx.particles.push(flake());
  } else if (theme === "halloween") {
    for (let i = 0; i < Math.round(n * 0.45); i++) fx.particles.push(orb("#e07a1f"));
    for (let i = 0; i < Math.round(n * 0.25); i++) fx.particles.push(leaf());
  } else if (theme === "valentines") {
    for (let i = 0; i < Math.round(n * 0.7); i++) fx.particles.push(heart());
  } else if (theme === "new-years" || theme === "fourth-of-july") {
    fx.palette = theme === "fourth-of-july"
      ? ["#e63946", "#f1faee", "#457b9d", "#1d3557", "#ffd166"]
      : ["#ffd700", "#fff", "#7dd3fc", "#f472b6", "#c4b5fd", "#34d399"];
    if (theme === "new-years") for (let i = 0; i < Math.round(n * 0.5); i++) fx.particles.push(confetti());
  }
}

function flake() {
  return { k: "snow", x: Math.random() * (fx.w || 800), y: Math.random() * (fx.h || 600), r: 1.2 + Math.random() * 2.6, s: 0.4 + Math.random() * 1.1, drift: (Math.random() - 0.5) * 0.6, a: 0.35 + Math.random() * 0.5 };
}
function orb(color) {
  return { k: "orb", x: Math.random() * (fx.w || 800), y: Math.random() * (fx.h || 600), r: 1.5 + Math.random() * 2.2, s: 0.2 + Math.random() * 0.5, drift: (Math.random() - 0.5) * 0.4, a: 0.25 + Math.random() * 0.4, color };
}
function leaf() {
  return { k: "leaf", x: Math.random() * (fx.w || 800), y: Math.random() * (fx.h || 600), r: 3 + Math.random() * 4, s: 0.35 + Math.random() * 0.7, drift: (Math.random() - 0.5) * 0.9, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 0.04, a: 0.55 };
}
function heart() {
  return { k: "heart", x: Math.random() * (fx.w || 800), y: (fx.h || 600) + Math.random() * 80, r: 4 + Math.random() * 6, s: 0.25 + Math.random() * 0.55, drift: (Math.random() - 0.5) * 0.5, a: 0.35 + Math.random() * 0.4, rot: Math.random() * 0.4 };
}

function confetti() {
  const colors = ["#ffd700", "#f8fafc", "#f472b6", "#7dd3fc", "#c4b5fd"];
  return { k: "conf", x: Math.random() * (fx.w || 800), y: Math.random() * (fx.h || 600), r: 2.5 + Math.random() * 2.5, s: 0.25 + Math.random() * 0.45, drift: (Math.random() - 0.5) * 0.5, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 0.008, a: 0.75, color: colors[Math.floor(Math.random() * colors.length)] };
}

function spawnBurst(x, y, colors) {
  const count = mobile() ? 18 : 28;
  const parts = [];
  for (let i = 0; i < count; i++) {
    const ang = (Math.PI * 2 * i) / count + Math.random() * 0.3;
    const sp = 1.2 + Math.random() * 3.2;
    parts.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 1, color: colors[i % colors.length], r: 1.4 + Math.random() * 1.8 });
  }
  fx.bursts.push({ parts });
}

function drawHeart(ctx, x, y, s, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(0, s * 0.3);
  ctx.bezierCurveTo(-s, -s * 0.4, -s * 0.5, -s, 0, -s * 0.45);
  ctx.bezierCurveTo(s * 0.5, -s, s, -s * 0.4, 0, s * 0.3);
  ctx.fill();
  ctx.restore();
}

function tick(ts) {
  if (!fx.ctx || fx.theme === "default" || reducedMotion() || document.hidden) {
    fx.raf = 0;
    return;
  }
  const dt = Math.min(32, ts - (fx.last || ts));
  fx.last = ts;
  fx.t += dt;
  const ctx = fx.ctx;
  const w = fx.w, h = fx.h;
  ctx.clearRect(0, 0, w, h);

  if (fx.particles.length) {
    for (const p of fx.particles) {
      if (p.k === "heart") {
        p.y -= p.s * dt * 0.04;
        p.x += Math.sin((fx.t + p.x) / 700) * p.drift;
        if (p.y < -20) { p.y = h + 20; p.x = Math.random() * w; }
        ctx.fillStyle = `rgba(196,59,92,${p.a})`;
        drawHeart(ctx, p.x, p.y, p.r, p.rot);
      } else {
        p.y += p.s * dt * 0.05;
        p.x += p.drift + Math.sin((fx.t / 400) + p.y / 40) * 0.15;
        if (p.y > h + 8) { p.y = -8; p.x = Math.random() * w; }
        if (p.x < -8) p.x = w + 8;
        if (p.x > w + 8) p.x = -8;
        if (p.k === "conf") {
          p.rot += p.spin * dt;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.globalAlpha = p.a;
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.r / 2, -p.r, p.r, p.r * 2 * Math.abs(Math.cos(p.rot * 1.7)) + 0.6);
          ctx.globalAlpha = 1;
          ctx.restore();
        } else if (p.k === "leaf") {
          p.rot += p.spin * dt;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = `rgba(224,122,31,${p.a})`;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.r, p.r * 0.45, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          ctx.fillStyle = p.k === "orb" ? `rgba(224,122,31,${p.a})` : `rgba(255,255,255,${p.a})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  if (fx.theme === "new-years" || fx.theme === "fourth-of-july") {
    if (fx.t >= fx.nextBurst) {
      spawnBurst(40 + Math.random() * (w - 80), 40 + Math.random() * (h * 0.45), fx.palette);
      fx.nextBurst = fx.t + 700 + Math.random() * 1100;
    }
    fx.bursts = fx.bursts.filter((b) => {
      b.parts = b.parts.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.03;
        p.life -= dt * 0.0009;
        if (p.life <= 0) return false;
        ctx.globalAlpha = Math.max(p.life, 0);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        return true;
      });
      return b.parts.length;
    });
  }

  fx.raf = requestAnimationFrame(tick);
}

function stopFx() {
  if (fx.raf) cancelAnimationFrame(fx.raf);
  fx.raf = 0;
  if (fx.ctx && fx.canvas) fx.ctx.clearRect(0, 0, fx.w || 0, fx.h || 0);
}

function startFx(theme) {
  if (IS_ADMIN) return;
  ensureLayer();
  fx.theme = theme;
  sizeCanvas();
  seed(theme);
  stopFx();
  if (theme === "default" || reducedMotion()) return;
  fx.last = performance.now();
  fx.raf = requestAnimationFrame(tick);
}

let sized = false;
function watchResize() {
  if (sized) return;
  sized = true;
  window.addEventListener("resize", () => {
    sizeCanvas();
    if (fx.theme !== "default") seed(fx.theme);
  }, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopFx();
    else if (fx.theme !== "default" && !reducedMotion()) {
      fx.last = performance.now();
      fx.raf = requestAnimationFrame(tick);
    }
  });
  window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", () => startFx(fx.theme));
}

watchResize();

if (PREVIEW_THEME && !IS_ADMIN) {
  applyTheme(PREVIEW_THEME);
} else {
  try {
    const cached = normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY) || "default");
    if (cached !== "default") applyTheme(cached);
  } catch { /* ignore */ }
}

if (!window.__YPS_THEME_MANUAL__) initTheme();
