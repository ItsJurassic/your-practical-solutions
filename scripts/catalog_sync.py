#!/usr/bin/env python3
"""Shared catalog + house-navigator sync helpers.

Used by build-navigator.py and sync-everything.py. Does not call Shopify or
Google Drive; those connector steps are documented in docs/CHANGE-SYNC.md.
"""
from __future__ import annotations

import datetime
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SNAPSHOT = ROOT / "data" / "shopify-snapshot.json"
PRODUCTS = ROOT / "products.json"
CATEGORIES = ROOT / "data" / "categories.json"
NAV_MAP = ROOT / "data" / "navigator.json"
NAV_INDEX = ROOT / "data" / "navigator-index.json"
CATALOG_PUBLIC = ROOT / "data" / "catalog-public.json"
PRODUCT_PAGES = ROOT / "products"

# Must stay in sync with scripts/build-products.py and site.js TYPE_TO_COLLECTION.
TYPE_TO_COLLECTION = {
    "Pet Supplies": "pet-supplies",
    "Kitchen": "kitchen",
    "Women's Clothing": "womens-clothing",
    "Christmas": "christmas",
    "Living Room": "living-room",
    "Men's Clothing": "mens-clothing",
    "Storage & Organization": "storage-organization",
    "Tech Accessories": "tech-accessories",
    "Bathroom": "bathroom",
    "Outdoor & Camping": "outdoor-camping",
    "Car & RV": "car-rv",
    "Winter Essentials": "winter-essentials",
    "Gardening": "gardening",
    "Home Decor": "home-decor",
    "Garage & Tools": "garage-tools",
}

MERCH = {"new-arrivals", "best-sellers"}
CHICAGO = datetime.timezone(datetime.timedelta(hours=-6))  # fallback only; prefer zoneinfo


def chicago_now() -> datetime.datetime:
    try:
        from zoneinfo import ZoneInfo
        return datetime.datetime.now(ZoneInfo("America/Chicago"))
    except Exception:
        return datetime.datetime.now(CHICAGO)


def chicago_month_day(when: datetime.datetime | None = None) -> str:
    now = when or chicago_now()
    return now.strftime("%m-%d")


def in_show_window(win: dict | None, month_day: str | None = None) -> bool:
    if not win:
        return True
    md = month_day or chicago_month_day()
    start = win.get("start_month_day") or "01-01"
    end = win.get("end_month_day") or "12-31"
    wraps = bool(win.get("wraps_year")) or start > end
    if wraps:
        return md >= start or md <= end
    return start <= md <= end


def is_category_visible(cat: dict | None, month_day: str | None = None) -> bool:
    if not cat:
        return False
    if cat.get("kind") == "seasonal":
        return in_show_window(cat.get("show_window"), month_day)
    return True


def load_json(path: Path, default=None):
    if not path.exists():
        if default is None:
            raise FileNotFoundError(path)
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def load_snapshot() -> dict:
    return load_json(SNAPSHOT)


def load_products() -> dict:
    return load_json(PRODUCTS)


def load_categories() -> dict:
    return load_json(CATEGORIES, {"timezone": "America/Chicago", "categories": [], "merchandising": []})


def load_nav_map() -> dict:
    return load_json(NAV_MAP)


def all_category_entries(data: dict) -> list[dict]:
    return list(data.get("categories") or []) + list(data.get("merchandising") or [])


def find_category(data: dict, handle: str) -> dict | None:
    return next((c for c in all_category_entries(data) if c.get("handle") == handle), None)


def snapshot_products_by_status(snap: dict | None = None) -> dict[str, list[dict]]:
    snap = snap or load_snapshot()
    nodes = ((snap.get("data") or {}).get("products") or {}).get("nodes") or []
    out = defaultdict(list)
    for n in nodes:
        out[(n.get("status") or "").upper()].append(n)
    return out


def category_handles_for(product: dict) -> list[str]:
    cols = list(product.get("collections") or [])
    # products.json uses a list of handle strings; snapshot uses {nodes:[{handle}]}
    if cols and isinstance(cols[0], dict):
        cols = [c.get("handle") for c in cols if c.get("handle")]
    primary = TYPE_TO_COLLECTION.get(product.get("product_type") or product.get("productType") or "")
    if primary and primary not in cols:
        cols.append(primary)
    return [c for c in cols if c]


def hotspot_categories(hotspot: dict, cat_data: dict, month_day: str, *, include_offseason: bool = False) -> list[str]:
    cats = list(hotspot.get("categories") or [])
    for handle in hotspot.get("seasonal_categories") or []:
        cat = find_category(cat_data, handle)
        # Missing category entries default to visible so a stale map cannot drop coverage.
        visible = is_category_visible(cat, month_day) if cat else True
        if (include_offseason or visible) and handle not in cats:
            cats.append(handle)
    return cats


def product_in_hotspot(product: dict, hotspot: dict, cat_data: dict, month_day: str) -> bool:
    allowed = set(hotspot_categories(hotspot, cat_data, month_day, include_offseason=False))
    if not allowed:
        return False
    have = set(category_handles_for(product))
    return bool(allowed & have)


def products_for_hotspot(products: list[dict], hotspot: dict, cat_data: dict, month_day: str) -> list[dict]:
    matched = [p for p in products if product_in_hotspot(p, hotspot, cat_data, month_day)]
    allowed = hotspot_categories(hotspot, cat_data, month_day)

    def sort_key(p):
        handles = category_handles_for(p)
        primary = TYPE_TO_COLLECTION.get(p.get("product_type") or "")
        idx = 99
        if primary in allowed:
            idx = allowed.index(primary)
        else:
            for i, h in enumerate(allowed):
                if h in handles:
                    idx = i
                    break
        return (idx, (p.get("title") or "").lower())

    return sorted(matched, key=sort_key)


def coverage_report(
    products: list[dict],
    nav_map: dict,
    cat_data: dict,
    month_day: str | None = None,
) -> dict:
    md = month_day or chicago_month_day()
    hotspots = nav_map.get("hotspots") or []
    required = list(nav_map.get("required_categories") or [])
    by_hotspot: dict[str, list[str]] = {}
    handle_to_spots: dict[str, list[str]] = defaultdict(list)
    for hs in hotspots:
        matched = products_for_hotspot(products, hs, cat_data, md)
        handles = [p["handle"] for p in matched]
        by_hotspot[hs["id"]] = handles
        for h in handles:
            handle_to_spots[h].append(hs["id"])

    all_handles = [p["handle"] for p in products]
    uncovered = [h for h in all_handles if h not in handle_to_spots]
    # Category coverage: every currently-visible required category has a hotspot.
    cats_missing_hotspot = []
    visible_required = []
    offseason_required = []
    for handle in required:
        cat = find_category(cat_data, handle)
        visible = is_category_visible(cat, md) if cat else True
        if visible:
            visible_required.append(handle)
            assigned = any(
                handle in (hs.get("categories") or [])
                or handle in (hs.get("seasonal_categories") or [])
                for hs in hotspots
            )
            if not assigned:
                cats_missing_hotspot.append(handle)
        else:
            offseason_required.append(handle)

    # Products in a visible required category must be reachable.
    uncovered_by_cat = defaultdict(list)
    for p in products:
        if p["handle"] in handle_to_spots:
            continue
        for h in category_handles_for(p):
            if h in MERCH:
                continue
            uncovered_by_cat[h].append(p["handle"])

    return {
        "month_day": md,
        "timezone": "America/Chicago",
        "active_count": len(products),
        "hotspot_count": len(hotspots),
        "by_hotspot": {k: len(v) for k, v in by_hotspot.items()},
        "by_hotspot_handles": by_hotspot,
        "uncovered": uncovered,
        "uncovered_count": len(uncovered),
        "uncovered_by_category": dict(uncovered_by_cat),
        "visible_required_categories": visible_required,
        "offseason_required_categories": offseason_required,
        "categories_missing_hotspot": cats_missing_hotspot,
        "ok": len(uncovered) == 0 and len(cats_missing_hotspot) == 0,
    }


def build_navigator_index(
    products_doc: dict | None = None,
    nav_map: dict | None = None,
    cat_data: dict | None = None,
    month_day: str | None = None,
    write: bool = True,
) -> dict:
    products_doc = products_doc or load_products()
    nav_map = nav_map or load_nav_map()
    cat_data = cat_data or load_categories()
    md = month_day or chicago_month_day()
    products = products_doc.get("products") or []
    cov = coverage_report(products, nav_map, cat_data, md)
    index = {
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "source": "scripts/build-navigator.py from products.json + data/navigator.json",
        "month_day": md,
        "timezone": "America/Chicago",
        "active_count": len(products),
        "all_active_handles": [p["handle"] for p in products],
        "coverage_ok": cov["ok"],
        "uncovered": cov["uncovered"],
        "hotspots": [],
    }
    by_handle = {p["handle"]: p for p in products}
    for hs in nav_map.get("hotspots") or []:
        handles = cov["by_hotspot_handles"].get(hs["id"], [])
        cats = hotspot_categories(hs, cat_data, md)
        index["hotspots"].append({
            "id": hs["id"],
            "label": hs.get("label") or hs["id"],
            "blurb": hs.get("blurb") or "",
            "categories": cats,
            "seasonal_only": bool(hs.get("seasonal_only")),
            "shop_paths": [f"shop.html?c={c}" for c in cats],
            "count": len(handles),
            "products": [
                {
                    "handle": h,
                    "title": by_handle[h].get("title"),
                    "price": by_handle[h].get("price"),
                    "product_type": by_handle[h].get("product_type"),
                    "page": f"products/{h}/",
                }
                for h in handles
                if h in by_handle
            ],
        })
    if write:
        NAV_INDEX.write_text(json.dumps(index, indent=2) + "\n", encoding="utf-8")
    return index


def plan_hotspot_ids(plan_js: Path | None = None) -> set[str]:
    text = (plan_js or (ROOT / "house-plan.js")).read_text(encoding="utf-8")
    ids = set(re.findall(r'\bhs\("([^"]+)"', text))
    ids.update(re.findall(r'data-id="([^"]+)"', text))
    # Ignore the hs() helper template itself (data-id="${id}").
    return {i for i in ids if i and "${" not in i}


def snapshot_vs_products(snap: dict | None = None, products_doc: dict | None = None) -> dict:
    snap = snap or load_snapshot()
    products_doc = products_doc or load_products()
    by_status = snapshot_products_by_status(snap)
    active = {n["handle"]: n for n in by_status.get("ACTIVE", [])}
    archived = {n["handle"]: n for n in by_status.get("ARCHIVED", [])}
    drafts = {n["handle"]: n for n in by_status.get("DRAFT", [])}
    baked = {p["handle"]: p for p in products_doc.get("products") or []}
    issues = []
    for h, n in active.items():
        if h not in baked:
            issues.append({"kind": "active_missing_from_products_json", "handle": h, "title": n.get("title")})
        else:
            snap_price = ((n.get("priceRangeV2") or {}).get("minVariantPrice") or {}).get("amount")
            baked_price = baked[h].get("price")
            if snap_price is not None and baked_price is not None:
                try:
                    if abs(float(snap_price) - float(baked_price)) > 0.001:
                        issues.append({
                            "kind": "price_mismatch",
                            "handle": h,
                            "snapshot_price": snap_price,
                            "products_json_price": baked_price,
                        })
                except (TypeError, ValueError):
                    issues.append({
                        "kind": "price_unparseable",
                        "handle": h,
                        "snapshot_price": snap_price,
                        "products_json_price": baked_price,
                    })
            snap_type = n.get("productType") or ""
            baked_type = baked[h].get("product_type") or ""
            if snap_type != baked_type:
                issues.append({
                    "kind": "category_mismatch",
                    "handle": h,
                    "snapshot_type": snap_type,
                    "products_json_type": baked_type,
                })
    for h, p in baked.items():
        if h in archived:
            issues.append({"kind": "archived_still_in_products_json", "handle": h, "title": p.get("title")})
        elif h in drafts:
            issues.append({"kind": "draft_in_products_json", "handle": h, "title": p.get("title")})
        elif h not in active:
            issues.append({"kind": "products_json_not_in_snapshot_active", "handle": h, "title": p.get("title")})
    return {
        "snapshot_counts": {k: len(v) for k, v in by_status.items()},
        "products_json_count": len(baked),
        "issues": issues,
        "ok": len(issues) == 0,
        "active_handles": sorted(active),
        "archived_handles": sorted(archived),
        "draft_handles": sorted(drafts),
    }


def product_pages_check(products_doc: dict | None = None, archived_handles: list[str] | None = None) -> dict:
    products_doc = products_doc or load_products()
    handles = [p["handle"] for p in products_doc.get("products") or []]
    missing_pages = []
    for h in handles:
        page = PRODUCT_PAGES / h / "index.html"
        if not page.exists():
            missing_pages.append(h)
    leftover_archived = []
    for h in archived_handles or []:
        page = PRODUCT_PAGES / h / "index.html"
        if page.exists():
            leftover_archived.append(h)
    on_disk = {p.name for p in PRODUCT_PAGES.iterdir() if p.is_dir()} if PRODUCT_PAGES.exists() else set()
    public = load_json(CATALOG_PUBLIC, {"products": []})
    draft_site_handles = {p.get("handle") for p in public.get("products") or []}
    extra_pages = sorted(on_disk - set(handles) - draft_site_handles)
    return {
        "missing_pages": missing_pages,
        "leftover_archived_pages": leftover_archived,
        "extra_pages": extra_pages,
        "page_dir_count": len(on_disk),
        "ok": not missing_pages and not leftover_archived,
    }


def navigator_plan_check(nav_map: dict | None = None) -> dict:
    nav_map = nav_map or load_nav_map()
    plan_ids = plan_hotspot_ids()
    map_ids = {hs["id"] for hs in nav_map.get("hotspots") or []}
    missing_on_plan = sorted(map_ids - plan_ids)
    missing_in_map = sorted(plan_ids - map_ids)
    return {
        "plan_ids": sorted(plan_ids),
        "map_ids": sorted(map_ids),
        "mapped_but_not_on_plan": missing_on_plan,
        "on_plan_but_not_mapped": missing_in_map,
        "ok": not missing_on_plan,  # extra plan IDs would be a gap; unmapped plan IDs are issues too
        "issues_unmapped_plan": missing_in_map,
    }


def sheet_compare(sheet_rows: list[dict], *, handle_key: str, status_key: str | None, price_key: str | None,
                  snapshot_cmp: dict, products_doc: dict) -> list[dict]:
    """Compare a sheet export (list of {handle, status, price, ...}) to the snapshot."""
    issues = []
    by_handle = {str(r.get(handle_key) or "").strip(): r for r in sheet_rows if r.get(handle_key)}
    baked = {p["handle"]: p for p in products_doc.get("products") or []}
    active = set(snapshot_cmp["active_handles"])
    archived = set(snapshot_cmp["archived_handles"])
    for h in active:
        if h not in by_handle:
            issues.append({"kind": "sheet_missing_active", "handle": h, "title": (baked.get(h) or {}).get("title")})
        else:
            row = by_handle[h]
            if status_key:
                st = str(row.get(status_key) or "").upper()
                if st and "ARCHIV" in st:
                    issues.append({"kind": "sheet_active_marked_archived", "handle": h, "sheet_status": row.get(status_key)})
                elif st and "DRAFT" in st and "ACTIVE" not in st and "PUBLISH" not in st:
                    # Shopify Drafts tab used "Active/Published" for live items. "DRAFT" is wrong for ACTIVE.
                    if "ACTIVE" not in st and "PUBLISH" not in st:
                        issues.append({"kind": "sheet_active_marked_draft", "handle": h, "sheet_status": row.get(status_key)})
            if price_key and row.get(price_key) not in (None, "") and h in baked:
                try:
                    sheet_price = float(str(row[price_key]).replace("$", "").replace(",", "").strip())
                    baked_price = float(baked[h]["price"])
                    if abs(sheet_price - baked_price) > 0.011:
                        issues.append({
                            "kind": "sheet_price_mismatch",
                            "handle": h,
                            "sheet_price": sheet_price,
                            "site_price": baked_price,
                        })
                except (TypeError, ValueError):
                    pass
    for h in archived:
        if h in by_handle and status_key:
            st = str(by_handle[h].get(status_key) or "").upper()
            if st and "ARCHIV" not in st and "REMOVED" not in st:
                issues.append({"kind": "sheet_archived_not_marked", "handle": h, "sheet_status": by_handle[h].get(status_key)})
    return issues


def run_consistency_check(
    *,
    sheet_issues: list[dict] | None = None,
    month_day: str | None = None,
) -> dict:
    products_doc = load_products()
    nav_map = load_nav_map()
    cat_data = load_categories()
    snap_cmp = snapshot_vs_products()
    cov = coverage_report(products_doc.get("products") or [], nav_map, cat_data, month_day)
    pages = product_pages_check(products_doc, snap_cmp["archived_handles"])
    plan = navigator_plan_check(nav_map)
    # Index drift: if navigator-index exists, compare handles.
    index_issues = []
    if NAV_INDEX.exists():
        index = load_json(NAV_INDEX)
        idx_handles = set(index.get("all_active_handles") or [])
        baked_handles = {p["handle"] for p in products_doc.get("products") or []}
        missing = sorted(baked_handles - idx_handles)
        extra = sorted(idx_handles - baked_handles)
        if missing:
            index_issues.append({"kind": "index_missing_active", "handles": missing})
        if extra:
            index_issues.append({"kind": "index_extra_handles", "handles": extra})
        # Archived must not appear
        for h in snap_cmp["archived_handles"]:
            if h in idx_handles:
                index_issues.append({"kind": "index_has_archived", "handle": h})

    issues = []
    issues.extend(snap_cmp["issues"])
    issues.extend(index_issues)
    for h in cov["uncovered"]:
        issues.append({"kind": "navigator_uncovered", "handle": h})
    for h in cov["categories_missing_hotspot"]:
        issues.append({"kind": "category_has_no_hotspot", "category": h})
    for h in pages["missing_pages"]:
        issues.append({"kind": "missing_product_page", "handle": h})
    for h in pages["leftover_archived_pages"]:
        issues.append({"kind": "archived_page_still_present", "handle": h})
    for h in plan["mapped_but_not_on_plan"]:
        issues.append({"kind": "hotspot_mapped_but_missing_on_plan", "id": h})
    for h in plan["on_plan_but_not_mapped"]:
        issues.append({"kind": "hotspot_on_plan_but_unmapped", "id": h})
    if sheet_issues:
        issues.extend(sheet_issues)

    report = {
        "ok": len(issues) == 0,
        "checked_at": chicago_now().strftime("%b %-d, %Y, %-I:%M %p America/Chicago"),
        "month_day": cov["month_day"],
        "snapshot": snap_cmp["snapshot_counts"],
        "products_json_count": snap_cmp["products_json_count"],
        "navigator": {
            "ok": cov["ok"],
            "uncovered": cov["uncovered"],
            "by_hotspot": cov["by_hotspot"],
            "visible_categories": cov["visible_required_categories"],
            "offseason_categories": cov["offseason_required_categories"],
        },
        "pages": pages,
        "plan": {
            "ok": plan["ok"] and not plan["issues_unmapped_plan"],
            "mapped_but_not_on_plan": plan["mapped_but_not_on_plan"],
            "on_plan_but_not_mapped": plan["on_plan_but_not_mapped"],
        },
        "amazon": {
            "connected": False,
            "status": "placeholder",
            "note": "Amazon is not connected yet. When it is, this check will compare Amazon listings to the same Shopify snapshot (handle, price, status, category) and the pipeline will push adds, removals, price changes, and category changes to Amazon.",
        },
        "issue_count": len(issues),
        "issues": issues,
    }
    return report


def print_report(report: dict, file=sys.stdout) -> None:
    status = "OK" if report["ok"] else "MISMATCH"
    print(f"sync check: {status}  ({report['issue_count']} issue(s))", file=file)
    print(f"  checked: {report['checked_at']}", file=file)
    snap = report["snapshot"]
    print(f"  snapshot: {snap}   products.json: {report['products_json_count']}", file=file)
    nav = report["navigator"]
    print(f"  navigator coverage: {'OK' if nav['ok'] else 'GAPS'}  uncovered={len(nav['uncovered'])}", file=file)
    for hid, n in sorted(nav["by_hotspot"].items(), key=lambda kv: (-kv[1], kv[0])):
        print(f"    {hid}: {n}", file=file)
    if nav["offseason_categories"]:
        print(f"  off-season categories (hidden): {', '.join(nav['offseason_categories'])}", file=file)
    print(f"  amazon: {report['amazon']['note']}", file=file)
    if report["issues"]:
        print("  issues:", file=file)
        for iss in report["issues"]:
            print(f"    - {iss}", file=file)


if __name__ == "__main__":
    # Convenience: python3 scripts/catalog_sync.py  -> check + print
    if "--build-index" in sys.argv:
        idx = build_navigator_index()
        print(f"navigator-index.json: {idx['active_count']} active, coverage_ok={idx['coverage_ok']}, uncovered={idx['uncovered']}")
        sys.exit(0 if idx["coverage_ok"] else 1)
    report = run_consistency_check()
    print_report(report)
    sys.exit(0 if report["ok"] else 1)
