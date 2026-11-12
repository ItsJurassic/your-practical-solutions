#!/usr/bin/env python3
"""Build data/navigator-index.json from the current baked catalog.

Resolves each house-navigator hotspot's category map (data/navigator.json)
against products.json so the index always matches the live catalog. Run
automatically from scripts/build-products.py, refresh-catalog.sh, and
sync-everything.py.

    python3 scripts/build-navigator.py
    python3 scripts/build-navigator.py --check
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from catalog_sync import (  # noqa: E402
    build_navigator_index,
    coverage_report,
    load_categories,
    load_nav_map,
    load_products,
    print_report,
    run_consistency_check,
)

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--check", action="store_true", help="do not write; exit 1 if coverage fails")
    args = ap.parse_args()
    products_doc = load_products()
    nav_map = load_nav_map()
    cat_data = load_categories()
    if args.check:
        cov = coverage_report(products_doc.get("products") or [], nav_map, cat_data)
        print(f"navigator coverage: {'OK' if cov['ok'] else 'GAPS'}  "
              f"{cov['active_count']} active, {cov['uncovered_count']} uncovered")
        if cov["uncovered"]:
            print("  uncovered:", ", ".join(cov["uncovered"]))
        for hid, n in sorted(cov["by_hotspot"].items(), key=lambda kv: (-kv[1], kv[0])):
            print(f"  {hid}: {n}")
        return 0 if cov["ok"] else 1
    index = build_navigator_index(products_doc, nav_map, cat_data, write=True)
    print(f"navigator-index.json: {index['active_count']} active products, "
          f"{len(index['hotspots'])} hotspots, coverage_ok={index['coverage_ok']}, "
          f"uncovered={index['uncovered']}")
    return 0 if index["coverage_ok"] else 1

if __name__ == "__main__":
    raise SystemExit(main())
