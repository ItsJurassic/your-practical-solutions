const STORAGE_KEY = "yps-admin-chat-layout";
const DESKTOP_MQ = "(min-width: 900px)";
const MIN_W = 360;
const MIN_H = 320;
const MIN_SIDE = 220;
const DRAG_THRESHOLD = 5;
const MAX_DOCK_HEIGHT = () => Math.max(window.innerHeight * 3, 2000);

let bound = false;

function isDesktop() {
  return window.matchMedia(DESKTOP_MQ).matches;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function readState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s && typeof s === "object" ? s : null;
  } catch {
    return null;
  }
}

function writeState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function clearState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

function els() {
  return {
    chat: document.querySelector(".chat-layout .chat") || document.querySelector(".chat"),
    layout: document.querySelector(".chat-layout"),
    dock: document.querySelector(".chat-dock"),
    pop: document.getElementById("chat-pop-out"),
    reset: document.getElementById("chat-reset-size"),
  };
}

function headerOffset() {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--header-h");
  return parseFloat(v) || 68;
}

function stickyHeight() {
  return window.innerHeight - headerOffset() - 24;
}

function layoutMetrics(layout) {
  if (!layout) return { width: 0, gap: 20 };
  const cs = getComputedStyle(layout);
  const gap = parseFloat(cs.columnGap || cs.gap) || 20;
  return { width: layout.getBoundingClientRect().width, gap };
}

function setPopLabel(floating) {
  const { pop } = els();
  if (!pop) return;
  pop.textContent = floating ? "Dock" : "Pop out";
  pop.setAttribute("aria-pressed", floating ? "true" : "false");
}

function teardown() {
  const { chat, layout, dock } = els();
  if (chat) {
    chat.classList.remove("is-floating", "is-resized", "is-oversized", "is-dragging", "is-resizing");
    chat.style.width = "";
    chat.style.height = "";
    chat.style.left = "";
    chat.style.top = "";
    chat.style.position = "";
    chat.style.zIndex = "";
    chat.style.minHeight = "";
    chat.style.maxHeight = "";
    chat.style.maxWidth = "";
  }
  if (layout) {
    layout.classList.remove("is-floating", "is-resized", "is-stacked");
    layout.style.removeProperty("--chat-w");
    layout.style.removeProperty("--chat-slot-h");
  }
  if (dock) {
    dock.style.minHeight = "";
    dock.style.width = "";
  }
  setPopLabel(false);
}

function applyDockedSize(width, height) {
  const { chat, layout, dock } = els();
  if (!chat || !layout) return;
  const metrics = layoutMetrics(layout);
  const layoutW = metrics.width;
  const gap = metrics.gap;
  let w = clamp(width, MIN_W, Math.max(MIN_W, layoutW || width));
  const maxH = MAX_DOCK_HEIGHT();
  let h = clamp(height, MIN_H, maxH);

  chat.classList.remove("is-floating");
  chat.style.position = "";
  chat.style.left = "";
  chat.style.top = "";
  chat.style.zIndex = "";
  chat.style.maxWidth = "100%";
  chat.style.height = `${h}px`;
  chat.style.minHeight = "0";
  chat.classList.add("is-resized");
  chat.classList.toggle("is-oversized", h > stickyHeight() + 1);

  layout.classList.remove("is-floating");
  layout.classList.add("is-resized");
  layout.style.setProperty("--chat-w", `${w}px`);
  if (layoutW > 0 && w >= layoutW - gap - MIN_SIDE) {
    layout.classList.add("is-stacked");
    chat.style.width = `${Math.min(w, layoutW)}px`;
  } else {
    layout.classList.remove("is-stacked");
    chat.style.width = "";
  }
  if (dock) dock.style.minHeight = "";
  setPopLabel(false);
}

function applyFloating(state) {
  const { chat, layout, dock } = els();
  if (!chat || !layout) return;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = clamp(Number(state.width) || MIN_W, MIN_W, vw);
  const h = clamp(Number(state.height) || MIN_H, MIN_H, vh);
  const left = clamp(Number(state.left) || 0, 0, Math.max(0, vw - w));
  const top = clamp(Number(state.top) || 0, 0, Math.max(0, vh - h));
  const slotH = Number(state.dockHeight) || stickyHeight();

  chat.classList.add("is-floating", "is-resized");
  chat.classList.remove("is-oversized");
  chat.style.position = "fixed";
  chat.style.left = `${left}px`;
  chat.style.top = `${top}px`;
  chat.style.width = `${w}px`;
  chat.style.height = `${h}px`;
  chat.style.zIndex = "80";
  chat.style.minHeight = "0";
  chat.style.maxWidth = "none";

  layout.classList.add("is-floating", "is-resized");
  layout.classList.remove("is-stacked");
  layout.style.setProperty("--chat-slot-h", `${slotH}px`);
  if (dock) dock.style.minHeight = `${slotH}px`;
  setPopLabel(true);
}

function currentRect() {
  const { chat } = els();
  if (!chat) return null;
  const r = chat.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

function persist(partial = {}) {
  const { chat, layout } = els();
  if (!chat) return;
  const r = currentRect();
  const prev = readState() || {};
  const floating = chat.classList.contains("is-floating");
  const metrics = layoutMetrics(layout);
  const state = {
    floating,
    width: Math.round((partial.width ?? r?.width) || prev.width || 0),
    height: Math.round((partial.height ?? r?.height) || prev.height || 0),
    left: Math.round(partial.left ?? (floating ? r?.left : prev.left) ?? 0),
    top: Math.round(partial.top ?? (floating ? r?.top : prev.top) ?? 0),
    dockHeight: Math.round(
      partial.dockHeight ??
        (!floating ? r?.height : prev.dockHeight || stickyHeight()) ??
        0
    ),
  };
  if (metrics.width > 0 && !floating) {
    // Prefer the grid column width when docked and not stacked.
    const raw = getComputedStyle(layout).getPropertyValue("--chat-w");
    const col = parseFloat(raw);
    if (col) state.width = Math.round(col);
  }
  writeState(state);
  return state;
}

function apply() {
  const { chat, layout } = els();
  if (!chat || !layout) return;
  if (!isDesktop()) {
    teardown();
    return;
  }
  const state = readState();
  if (!state) {
    teardown();
    return;
  }
  if (state.floating) {
    applyFloating(state);
    return;
  }
  if (state.width || state.height) {
    const r = currentRect();
    applyDockedSize(state.width || r?.width || MIN_W, state.height || r?.height || stickyHeight());
  } else {
    teardown();
  }
}

function popOutAt(rect) {
  const { chat } = els();
  if (!chat) return;
  const current = rect || currentRect();
  const dockHeight = chat.classList.contains("is-floating")
    ? (readState()?.dockHeight || stickyHeight())
    : current.height;
  const state = {
    floating: true,
    width: current.width,
    height: current.height,
    left: current.left,
    top: current.top,
    dockHeight,
  };
  writeState(state);
  applyFloating(state);
}

function dockInPlace() {
  const r = currentRect();
  if (!r) return;
  const prev = readState() || {};
  const state = {
    floating: false,
    width: r.width,
    height: r.height,
    left: prev.left || 0,
    top: prev.top || 0,
    dockHeight: r.height,
  };
  writeState(state);
  applyDockedSize(state.width, state.height);
}

function resetLayout() {
  clearState();
  teardown();
}

function onHeadPointerDown(e) {
  if (!isDesktop() || e.button) return;
  if (e.target.closest("button, a, input, textarea, select, label")) return;
  const { chat } = els();
  if (!chat) return;
  const startX = e.clientX;
  const startY = e.clientY;
  const startRect = currentRect();
  let started = false;

  const move = (ev) => {
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    if (!started) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      started = true;
      if (!chat.classList.contains("is-floating")) popOutAt(startRect);
      chat.classList.add("is-dragging");
      try {
        chat.setPointerCapture(e.pointerId);
      } catch {}
    }
    ev.preventDefault();
    const w = chat.getBoundingClientRect().width;
    const h = chat.getBoundingClientRect().height;
    const left = clamp(startRect.left + dx, 0, Math.max(0, window.innerWidth - w));
    const top = clamp(startRect.top + dy, 0, Math.max(0, window.innerHeight - h));
    chat.style.left = `${left}px`;
    chat.style.top = `${top}px`;
  };

  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    chat.classList.remove("is-dragging");
    if (started) persist();
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
}

function onHandlePointerDown(e) {
  if (!isDesktop() || e.button) return;
  const handle = e.currentTarget;
  const edge = handle.dataset.edge || "";
  const { chat, layout } = els();
  if (!chat) return;
  e.preventDefault();
  e.stopPropagation();
  const startX = e.clientX;
  const startY = e.clientY;
  const start = currentRect();
  const floating = chat.classList.contains("is-floating");
  chat.classList.add("is-resizing");
  try {
    handle.setPointerCapture(e.pointerId);
  } catch {}

  const move = (ev) => {
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const metrics = layoutMetrics(layout);
    const maxDockW = Math.max(MIN_W, metrics.width || start.width);
    const maxW = floating ? vw : maxDockW;
    const maxH = floating ? vh : MAX_DOCK_HEIGHT();
    let width = start.width;
    let height = start.height;
    let left = start.left;
    let top = start.top;

    if (edge.includes("e")) width = start.width + dx;
    if (edge.includes("w")) width = start.width - dx;
    if (edge.includes("s")) height = start.height + dy;
    if (edge.includes("n")) height = start.height - dy;

    if (floating && edge.includes("w")) {
      width = clamp(width, MIN_W, start.left + start.width);
      left = start.left + start.width - width;
    } else {
      width = clamp(width, MIN_W, maxW);
    }
    if (floating && edge.includes("n")) {
      height = clamp(height, MIN_H, start.top + start.height);
      top = start.top + start.height - height;
    } else {
      height = clamp(height, MIN_H, maxH);
    }

    if (floating) {
      left = clamp(left, 0, Math.max(0, vw - width));
      top = clamp(top, 0, Math.max(0, vh - height));
      chat.style.left = `${left}px`;
      chat.style.top = `${top}px`;
      chat.style.width = `${width}px`;
      chat.style.height = `${height}px`;
    } else {
      applyDockedSize(width, height);
    }
  };

  const up = () => {
    handle.removeEventListener("pointermove", move);
    handle.removeEventListener("pointerup", up);
    handle.removeEventListener("pointercancel", up);
    chat.classList.remove("is-resizing");
    persist();
  };

  handle.addEventListener("pointermove", move);
  handle.addEventListener("pointerup", up);
  handle.addEventListener("pointercancel", up);
}

function bind() {
  if (bound) return;
  bound = true;
  const { chat, pop, reset } = els();
  const head = chat?.querySelector(".chat-head");
  if (head) head.addEventListener("pointerdown", onHeadPointerDown);
  document.querySelectorAll(".chat-handle").forEach((el) => {
    el.addEventListener("pointerdown", onHandlePointerDown);
  });
  pop?.addEventListener("click", () => {
    if (!isDesktop()) return;
    if (els().chat?.classList.contains("is-floating")) dockInPlace();
    else popOutAt();
  });
  reset?.addEventListener("click", () => {
    if (!isDesktop()) return;
    resetLayout();
  });
  window.addEventListener("resize", () => apply());
  window.matchMedia(DESKTOP_MQ).addEventListener("change", () => apply());
  const dash = document.getElementById("dash-view");
  if (dash) {
    new MutationObserver(() => apply()).observe(dash, {
      attributes: true,
      attributeFilter: ["hidden"],
    });
  }
}

export function refreshChatLayout() {
  apply();
}

export function initChatLayout() {
  bind();
  apply();
}
