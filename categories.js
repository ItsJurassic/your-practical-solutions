/** Category helpers. Seasonal windows use month-day only, America/Chicago, recurring each year. */

export const TZ = "America/Chicago";

export function chicagoMonthDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${month}-${day}`;
}

export function inShowWindow(win, monthDay = chicagoMonthDay()) {
  if (!win) return true;
  const start = win.start_month_day;
  const end = win.end_month_day;
  const wraps = win.wraps_year === true || start > end;
  if (wraps) return monthDay >= start || monthDay <= end;
  return monthDay >= start && monthDay <= end;
}

export function isCategoryVisible(cat, monthDay = chicagoMonthDay()) {
  if (!cat) return false;
  if (cat.kind === "seasonal") return inShowWindow(cat.show_window, monthDay);
  return true;
}

export async function loadCategoryData(base = "./") {
  const url = `${base}data/categories.json`;
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) return { timezone: TZ, categories: [], merchandising: [] };
  return res.json();
}

export function allCatalogEntries(data) {
  return [...(data?.categories || []), ...(data?.merchandising || [])];
}

export function visibleEntries(data, monthDay = chicagoMonthDay()) {
  return allCatalogEntries(data).filter((c) => isCategoryVisible(c, monthDay));
}

export function visibleNavCategories(data, monthDay = chicagoMonthDay()) {
  return (data?.categories || []).filter((c) => c.website_nav === true && isCategoryVisible(c, monthDay));
}

export function visibleSeasonal(data, monthDay = chicagoMonthDay()) {
  return (data?.categories || []).filter((c) => c.kind === "seasonal" && isCategoryVisible(c, monthDay));
}

export function findCategory(data, handle) {
  return allCatalogEntries(data).find((c) => c.handle === handle) || null;
}
