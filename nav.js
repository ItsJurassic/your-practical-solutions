import { loadCategoryData, visibleNavCategories, visibleSeasonal } from "./categories.js";

let ICONS = {};

const FEATURED = [
  { handle: "all", name: "All products", path: "shop.html", blurb: "Browse the full shop" },
  { handle: "new-arrivals", name: "New Arrivals", path: "shop.html?c=new-arrivals", blurb: "Just landed in the store" },
  { handle: "best-sellers", name: "Best Sellers", path: "shop.html?c=best-sellers", blurb: "What customers love most" },
];

const GROUPS = [
  { title: "Home", handles: ["living-room", "kitchen", "bathroom", "home-decor", "storage-organization"] },
  { title: "Garage & out", handles: ["car-rv", "garage-tools", "tech-accessories", "outdoor-camping", "gardening", "winter-essentials"] },
  { title: "Lifestyle", handles: ["pet-supplies", "mens-clothing", "womens-clothing"] },
];

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const icon = (h) => ICONS[h] || ICONS.grid;

function linkItem(c, { href } = {}) {
  const url = href || c.path || `shop.html?c=${encodeURIComponent(c.handle)}`;
  return `<a role="menuitem" class="mega-link" href="${esc(url)}"><span class="mega-ico">${icon(c.handle)}</span><span><strong>${esc(c.name)}</strong>${c.blurb ? `<small>${esc(c.blurb)}</small>` : ""}</span></a>`;
}

function closeMenus() {
  document.querySelectorAll(".nav-trigger[aria-expanded='true']").forEach((btn) => {
    btn.setAttribute("aria-expanded", "false");
    const menu = document.getElementById(btn.getAttribute("aria-controls"));
    if (menu) menu.hidden = true;
  });
  document.querySelectorAll(".nav-item.has-menu.is-open").forEach((el) => el.classList.remove("is-open"));
}

function toggleMenu(btn, on) {
  const menu = document.getElementById(btn.getAttribute("aria-controls"));
  if (!menu) return;
  const open = on ?? btn.getAttribute("aria-expanded") !== "true";
  if (open) closeMenus();
  btn.setAttribute("aria-expanded", String(open));
  menu.hidden = !open;
  btn.closest(".nav-item")?.classList.toggle("is-open", open);
}

function openDrawer() {
  const drawer = document.getElementById("nav-drawer");
  const backdrop = document.getElementById("nav-backdrop");
  if (!drawer) return;
  drawer.hidden = false;
  if (backdrop) backdrop.hidden = false;
  document.body.classList.add("nav-open");
  document.querySelectorAll("[data-open-menu]").forEach((b) => b.setAttribute("aria-expanded", "true"));
  drawer.querySelector("[data-close-menu]")?.focus();
  trap = drawer;
}

function closeDrawer() {
  const drawer = document.getElementById("nav-drawer");
  const backdrop = document.getElementById("nav-backdrop");
  if (drawer) drawer.hidden = true;
  if (backdrop) backdrop.hidden = true;
  document.body.classList.remove("nav-open");
  document.querySelectorAll("[data-open-menu]").forEach((b) => b.setAttribute("aria-expanded", "false"));
  trap = null;
}

let trap = null;

function fillNav(data) {
  const permanents = visibleNavCategories(data);
  const byHandle = Object.fromEntries(permanents.map((c) => [c.handle, c]));
  const featuredEl = document.getElementById("shop-menu-featured");
  const colsEl = document.getElementById("shop-menu-cats");
  if (featuredEl) {
    featuredEl.innerHTML = FEATURED.map((f) => linkItem({ ...f, handle: f.handle === "all" ? "bag" : f.handle })).join("");
  }
  if (colsEl) {
    colsEl.innerHTML = GROUPS.map((g) => {
      const items = g.handles.map((h) => byHandle[h]).filter(Boolean);
      if (!items.length) return "";
      return `<div class="mega-col"><h3>${esc(g.title)}</h3>${items.map((c) => linkItem(c)).join("")}</div>`;
    }).join("");
  }

  const seasonal = visibleSeasonal(data);
  const seasonItem = document.getElementById("seasonal-item");
  const seasonMenu = document.getElementById("seasonal-menu");
  if (seasonItem && seasonMenu) {
    if (seasonal.length) {
      seasonItem.hidden = false;
      seasonMenu.innerHTML = seasonal.map((c) => linkItem(c)).join("");
    } else {
      seasonItem.hidden = true;
      seasonMenu.innerHTML = "";
      closeMenus();
    }
  }

  const drawerShop = document.getElementById("drawer-shop");
  if (drawerShop) {
    drawerShop.innerHTML = [
      ...FEATURED.map((f) => `<a href="${esc(f.path)}">${esc(f.name)}</a>`),
      ...permanents.map((c) => `<a href="shop.html?c=${esc(c.handle)}">${esc(c.name)}</a>`),
    ].join("");
  }
  const wrap = document.getElementById("drawer-seasonal-wrap");
  const drawerSeason = document.getElementById("drawer-seasonal");
  if (wrap && drawerSeason) {
    if (seasonal.length) {
      wrap.hidden = false;
      drawerSeason.innerHTML = seasonal.map((c) => `<a href="shop.html?c=${esc(c.handle)}">${esc(c.name)}</a>`).join("");
    } else {
      wrap.hidden = true;
      drawerSeason.innerHTML = "";
    }
  }
}

function wire() {
  if (window.__YPS_NAV_WIRED__) return;
  window.__YPS_NAV_WIRED__ = true;
  document.querySelectorAll(".nav-trigger").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      toggleMenu(btn);
    });
    const item = btn.closest(".nav-item");
    let timer;
    item?.addEventListener("mouseenter", () => {
      if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        clearTimeout(timer);
        toggleMenu(btn, true);
      }
    });
    item?.addEventListener("mouseleave", () => {
      if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        timer = setTimeout(() => toggleMenu(btn, false), 180);
      }
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (document.body.classList.contains("nav-open")) {
        closeDrawer();
        document.querySelector("[data-open-menu]")?.focus();
      } else closeMenus();
    }
    if (e.key === "Tab" && trap) {
      const focusable = [...trap.querySelectorAll('a, button, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.hidden && !el.closest("[hidden]"));
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".has-menu")) closeMenus();
  });
  document.querySelectorAll("[data-open-menu]").forEach((b) => b.addEventListener("click", openDrawer));
  document.querySelectorAll("[data-close-menu]").forEach((b) => b.addEventListener("click", closeDrawer));
  document.getElementById("nav-backdrop")?.addEventListener("click", closeDrawer);
  document.addEventListener("click", (e) => {
    const acc = e.target.closest(".drawer-acc-btn");
    if (acc) {
      e.preventDefault();
      const panel = document.getElementById(acc.getAttribute("aria-controls"));
      const on = acc.getAttribute("aria-expanded") !== "true";
      acc.setAttribute("aria-expanded", String(on));
      if (panel) {
        panel.hidden = !on;
        panel.classList.toggle("is-open", on);
      }
    }
    if (e.target.closest("#nav-drawer a")) closeDrawer();
  });
}

export async function initNav(icons = {}) {
  ICONS = icons;
  wire();
  const data = await loadCategoryData(window.__SITE_BASE__ || "./");
  fillNav(data);
}
