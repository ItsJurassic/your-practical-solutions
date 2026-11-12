#!/usr/bin/env python3
"""One sync pipeline for Your Practical Solutions.

After any Shopify change (add, remove, price, category, status), this rebuilds
the site catalog, product pages, filters, category sections, nav counts and
house-navigator data; runs a consistency check across the Shopify snapshot,
products.json, the navigator, and optional sheet exports; writes Google Sheet
payloads; and can deploy the site.

This script does NOT call the Shopify or Google Drive connectors, and it does
not place orders or delete Shopify products. Connector steps are listed in
docs/CHANGE-SYNC.md and in the printed checklist.

Usage
-----
    python3 scripts/sync-everything.py --check
    python3 scripts/sync-everything.py --dry-run
    python3 scripts/sync-everything.py --rebuild --write-payloads
    python3 scripts/sync-everything.py --snapshot FILE --rebuild --write-payloads --deploy
    python3 scripts/sync-everything.py --check --sheets-dir /workspace/yps-research/sync-exports

Exit status is 1 when the consistency check finds any mismatch.
"""
from __future__ import annotations

import argparse
import csv
import datetime
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from catalog_sync import (  # noqa: E402
    NAV_INDEX,
    PRODUCTS,
    ROOT,
    SNAPSHOT,
    build_navigator_index,
    chicago_now,
    load_json,
    load_products,
    print_report,
    run_consistency_check,
    sheet_compare,
    snapshot_vs_products,
)

YPS = Path("/workspace/yps-research")
PAYLOAD_DIR = YPS / "sync-payloads"
MARGIN_REFRESH = YPS / "refresh_margin_sheet.py"
MARGIN_PAYLOAD = YPS / "margin-living" / "google-payload.json"
MASTER_SHEET_ID = "1rxslOrac2OBzLb6Kdekal6H7Y7X15CX5XD8_4Ney5uQ"
MASTER_SHEET_URL = f"https://docs.google.com/spreadsheets/d/{MASTER_SHEET_ID}/edit"
MARGIN_SHEET_ID = "19dnW1_gBzWa-RpWCsy7Hhkl-75Aaw4hOuUjUV84uegQ"
MARGIN_SHEET_URL = f"https://docs.google.com/spreadsheets/d/{MARGIN_SHEET_ID}/edit"
CHANGE_LOG_GID = 1444174024
DRAFTS_TAB = "Shopify Drafts 11-11"
CHANGE_LOG_TAB = "Change Log"
PRODUCTS_BUILT_TAB = "Products (Built)"

NEVER_COMMIT = (
    "models/house/doll-house.glb",
    ".secrets",
    ".secrets/",
)

AMAZON_PLACEHOLDER = {
    "connected": False,
    "step": "amazon",
    "status": "skipped",
    "note": (
        "Amazon is not connected yet. When an Amazon seller account / connector "
        "is available, this step will push the same product add, remove, price, "
        "and category change to the Amazon listing and the consistency check "
        "will compare Amazon against the Shopify snapshot. Until then, skip."
    ),
}


def run(cmd, *, cwd=None, check=True, capture=False):
    return subprocess.run(
        cmd, cwd=cwd or ROOT, check=check,
        text=True, capture_output=capture,
    )


def ingest_snapshot(src: Path) -> None:
    """Strip Shopify-connector wrapper text and write data/shopify-snapshot.json."""
    raw = src.read_text(encoding="utf-8")
    start = raw.find('{"data"')
    if start < 0:
        # maybe the file is already the raw GraphQL JSON
        obj = json.loads(raw)
    else:
        obj, _ = json.JSONDecoder().raw_decode(raw[start:])
    data = obj.get("data") or obj
    if "products" not in data or "collections" not in data:
        raise SystemExit("snapshot is missing products/collections")
    page = (data.get("products") or {}).get("pageInfo") or {}
    if page.get("hasNextPage"):
        print("WARNING: more than one page of products — paginate the Shopify "
              "query (after: endCursor) and merge nodes before ingesting.",
              file=sys.stderr)
    SNAPSHOT.write_text(json.dumps({"data": data} if "data" not in obj else obj, indent=2) + "\n")
    print(f"wrote {SNAPSHOT}")


def rebuild_catalog() -> None:
    run([sys.executable, str(ROOT / "scripts" / "build-products.py")])
    run([sys.executable, str(ROOT / "scripts" / "build-pages.py")])
    # build-products already calls build-navigator; run again in case pages
    # were the only change and products.json was already current.
    run([sys.executable, str(ROOT / "scripts" / "build-navigator.py")])
    print("rebuilt products.json, pages, and navigator-index.json")


def parse_sheet_csv(path: Path) -> tuple[list[str], list[dict]]:
    text = path.read_text(encoding="utf-8-sig")
    # Skip a possible title row: detect a header row containing Handle or Title.
    lines = text.splitlines()
    header_idx = 0
    for i, line in enumerate(lines[:5]):
        low = line.lower()
        if "handle" in low or ( "title" in low and "sku" in low) or ("item" in low and "status" in low):
            header_idx = i
            break
    sample = "\n".join(lines[header_idx:])
    reader = csv.DictReader(sample.splitlines())
    rows = list(reader)
    headers = reader.fieldnames or []
    return headers, rows


def pick(row: dict, *names) -> str | None:
    lower = {str(k).strip().lower(): k for k in row}
    for n in names:
        k = lower.get(n.lower())
        if k is not None and row.get(k) not in (None, ""):
            return row[k]
    return None


def load_sheet_exports(sheets_dir: Path) -> list[dict]:
    issues: list[dict] = []
    if not sheets_dir.exists():
        issues.append({"kind": "sheets_dir_missing", "path": str(sheets_dir)})
        return issues
    snap_cmp = snapshot_vs_products()
    products_doc = load_products()

    def consider(path: Path, handle_keys, status_keys, price_keys, label):
        if not path.exists():
            return
        headers, rows = parse_sheet_csv(path)
        handle_key = next((h for h in headers if h and h.strip().lower() in {k.lower() for k in handle_keys}), None)
        status_key = next((h for h in headers if h and h.strip().lower() in {k.lower() for k in status_keys}), None)
        price_key = next((h for h in headers if h and h.strip().lower() in {k.lower() for k in price_keys}), None)
        if not handle_key:
            # try to infer from first row keys
            print(f"  note: {path.name} has no Handle column ({headers[:6]}); skipping compare")
            return
        found = sheet_compare(
            rows,
            handle_key=handle_key,
            status_key=status_key,
            price_key=price_key,
            snapshot_cmp=snap_cmp,
            products_doc=products_doc,
        )
        for iss in found:
            iss["sheet"] = label
            iss["file"] = path.name
        issues.extend(found)
        print(f"  compared {path.name}: {len(rows)} rows, {len(found)} issue(s)")

    # Accept a few conventional filenames.
    for name, label, hk, sk, pk in [
        ("shopify-drafts.csv", DRAFTS_TAB, ("Handle", "handle", "Shopify handle"),
         ("Status", "status", "Shopify status"), ("Price", "Price ($)", "price")),
        ("master-ops-shopify-drafts.csv", DRAFTS_TAB, ("Handle", "handle"),
         ("Status", "status"), ("Price", "Price ($)", "price")),
        ("margin-breakdown.csv", "Margin breakdown", ("Handle", "handle"),
         ("Shopify status", "Status", "status"), ("Your price", "Price", "F", "price")),
        ("supplier-costs.csv", "Supplier costs", ("Handle", "handle"),
         ("Status", "status"), ("product_cost", "Product cost", "price")),
    ]:
        consider(sheets_dir / name, hk, sk, pk, label)

    # Also accept any other *.csv in the folder with a Handle column.
    known = {"shopify-drafts.csv", "master-ops-shopify-drafts.csv",
             "margin-breakdown.csv", "supplier-costs.csv"}
    for path in sorted(sheets_dir.glob("*.csv")):
        if path.name in known:
            continue
        consider(path, ("Handle", "handle"), ("Status", "status", "Shopify status"),
                 ("Price", "Price ($)", "Your price", "price"), path.stem)
    return issues


def write_master_ops_payload(report: dict, note: str | None = None) -> Path:
    PAYLOAD_DIR.mkdir(parents=True, exist_ok=True)
    products_doc = load_products()
    snap_cmp = snapshot_vs_products()
    stamp = chicago_now().strftime("%b %-d, %Y, %-I:%M %p America/Chicago")
    date_cell = chicago_now().strftime("%b %-d, %Y (CT)")
    n_active = snap_cmp["snapshot_counts"].get("ACTIVE", products_doc["product_count"])
    n_draft = snap_cmp["snapshot_counts"].get("DRAFT", 0)
    n_arch = snap_cmp["snapshot_counts"].get("ARCHIVED", 0)
    change = note or (
        f"Ran the catalog sync pipeline (scripts/sync-everything.py). "
        f"The baked catalog, product pages, shop filters, category sections, nav counts, "
        f"and house navigator were rebuilt from the current Shopify snapshot "
        f"({n_active} ACTIVE, {n_draft} DRAFT, {n_arch} ARCHIVED). "
        f"The house navigator is data-driven from data/navigator.json (rooms map to "
        f"categories, not a hardcoded product list) so a future product add, remove, "
        f"price change, or category change is picked up by one refresh. "
        f"Consistency check: {'passed' if report['ok'] else 'reported mismatches (see payload)'}. "
        f"No Shopify products were deleted. Amazon is not connected yet (placeholder step skipped)."
    )
    # Rows for Shopify Drafts 11-11: one suggested row per ACTIVE + DRAFT + ARCHIVED product.
    # The agent applies only the diffs (new handles, status/price/category changes).
    drafts_rows = []
    snap = json.loads(SNAPSHOT.read_text())
    nodes = ((snap.get("data") or {}).get("products") or {}).get("nodes") or []
    baked = {p["handle"]: p for p in products_doc.get("products") or []}
    for n in nodes:
        handle = n["handle"]
        baked_p = baked.get(handle)
        price = ((n.get("priceRangeV2") or {}).get("minVariantPrice") or {}).get("amount")
        status = n.get("status") or ""
        status_label = {
            "ACTIVE": "Active/Published",
            "DRAFT": "DRAFT",
            "ARCHIVED": "ARCHIVED",
        }.get(status, status)
        gid = n.get("id") or ""
        pid = gid.rsplit("/", 1)[-1] if gid else ""
        img_count = len(((n.get("media") or {}).get("nodes") or [])) or (
            1 if (n.get("featuredMedia") or {}).get("preview") else 0
        )
        drafts_rows.append({
            "Title": n.get("title"),
            "Product ID": gid,
            "Admin URL": f"https://admin.shopify.com/store/xvdkyq-xg/products/{pid}" if pid else "",
            "Status": status_label,
            "Image count": img_count,
            "Handle": handle,
            "Category": n.get("productType") or (baked_p or {}).get("product_type") or "",
            "Price": price or (baked_p or {}).get("price"),
            "Shopify status raw": status,
        })

    payload = {
        "spreadsheet_id": MASTER_SHEET_ID,
        "spreadsheet_url": MASTER_SHEET_URL,
        "written_at": stamp,
        "do_not_delete_rows": True,
        "change_log": {
            "tab": CHANGE_LOG_TAB,
            "gid": CHANGE_LOG_GID,
            "insert": "after header, newest first (row 3)",
            "columns": ["Date", "Area", "Change", "Commit", "Owner", "Notes"],
            "row": [
                date_cell,
                "Website / Shopify / finance",
                change,
                "COMMIT",  # filled in after deploy
                "Shoppie",
                (
                    f"Pipeline: docs/CHANGE-SYNC.md and python3 scripts/sync-everything.py. "
                    f"Margin sheet: {MARGIN_SHEET_URL}. "
                    f"Navigator map: data/navigator.json. Live site: https://yourpracticalsolutions.com/."
                ),
            ],
        },
        "shopify_drafts_tab": {
            "tab": DRAFTS_TAB,
            "note": (
                "Suggested current catalog for the Master Ops product tab. "
                "Apply diffs only: add rows for new handles, set Status to ARCHIVED "
                "(do not delete) for archived products, update price/category/title "
                "when they drifted. Never delete a row."
            ),
            "rows": drafts_rows,
            "counts": snap_cmp["snapshot_counts"],
        },
        "products_built_tab": {
            "tab": PRODUCTS_BUILT_TAB,
            "note": (
                "Products (Built) holds the original 10 Top 10 DRAFT items. "
                "Only touch it when one of those 10 changes. Do not add the 358 "
                "ACTIVE catalog products here."
            ),
        },
        "amazon": AMAZON_PLACEHOLDER,
        "consistency": {
            "ok": report["ok"],
            "issue_count": report["issue_count"],
            "issues": report["issues"],
        },
    }
    path = PAYLOAD_DIR / "master-ops-payload.json"
    path.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"wrote {path}")
    return path


def write_margin_payload(dry_run: bool = False) -> Path | None:
    if not MARGIN_REFRESH.exists():
        print(f"WARNING: {MARGIN_REFRESH} not found; skipping margin payload", file=sys.stderr)
        return None
    cmd = [sys.executable, str(MARGIN_REFRESH)]
    if dry_run:
        cmd.append("--dry-run")
    print(f"running {' '.join(cmd)}")
    run(cmd, cwd=str(YPS), check=True)
    if MARGIN_PAYLOAD.exists():
        dest = PAYLOAD_DIR / "margin-google-payload.json"
        PAYLOAD_DIR.mkdir(parents=True, exist_ok=True)
        shutil.copy2(MARGIN_PAYLOAD, dest)
        print(f"copied margin payload to {dest}")
        return dest
    return MARGIN_PAYLOAD if MARGIN_PAYLOAD.exists() else None


def deploy(message: str, extra_paths: list[str] | None = None) -> str:
    """Pull/rebase, commit relevant files, push main and gh-pages. Returns short SHA."""
    run(["git", "pull", "--rebase", "origin", "main"])
    paths = [
        "products.json",
        "data/shopify-snapshot.json",
        "data/navigator.json",
        "data/navigator-index.json",
        "data/catalog-public.json",
        "data/categories.json",
        "index.html",
        "shop.html",
        "sitemap.xml",
        "shipping.html",
        "returns.html",
        "privacy.html",
        "terms.html",
        "products",
        "categories",
        "house-plan.js",
        "app.js",
        "site.js",
        "styles.css",
        "nav.js",
        "categories.js",
        "scripts",
        "docs",
        "templates",
        "partials",
    ]
    if extra_paths:
        paths.extend(extra_paths)
    # Stage only existing paths; never the forbidden files.
    existing = [p for p in paths if (ROOT / p).exists()]
    run(["git", "add", "--"] + existing)
    # Unstage anything forbidden if it crept in.
    for forbidden in NEVER_COMMIT:
        run(["git", "reset", "-q", "HEAD", "--", forbidden], check=False)
    # Don't commit if there is nothing staged.
    cached = run(["git", "diff", "--cached", "--name-only"], capture=True)
    files = [f for f in cached.stdout.splitlines() if f]
    blocked = [f for f in files if f == "models/house/doll-house.glb" or f.startswith(".secrets")]
    if blocked:
        raise SystemExit(f"refusing to commit forbidden files: {blocked}")
    if not files:
        print("deploy: nothing to commit")
        sha = run(["git", "rev-parse", "--short", "HEAD"], capture=True).stdout.strip()
        return sha
    print("committing:")
    for f in files:
        print(f"  {f}")
    run(["git", "commit", "-m", message])
    run(["git", "push", "origin", "main"])
    run(["git", "push", "origin", "main:gh-pages"])
    sha = run(["git", "rev-parse", "--short", "HEAD"], capture=True).stdout.strip()
    print(f"deployed {sha} to main and gh-pages")
    return sha


def checklist(step: str) -> None:
    print()
    print("=" * 72)
    print("CHANGE SYNC CHECKLIST  (see docs/CHANGE-SYNC.md)")
    print("=" * 72)
    print("""
  1. [agent + Shopify connector] Pull a fresh Admin GraphQL snapshot
     (paginate if hasNextPage; include ACTIVE, DRAFT, and ARCHIVED;
     media, prices, collections, productType, status, variants/SKUs).
     Save the connector output to a file.

  2. [this script]  python3 scripts/sync-everything.py \\
         --snapshot FILE --rebuild --write-payloads
     Rebuilds products.json, product pages, filters, category pages,
     nav counts, and data/navigator-index.json. Writes sheet payloads
     to /workspace/yps-research/sync-payloads/.

  3. [this script]  python3 scripts/sync-everything.py --check \\
         --sheets-dir /workspace/yps-research/sync-exports
     Exits 1 on any mismatch. Export the Master Ops product tab and
     the margin sheet (Supplier costs + Margin breakdown input columns)
     into that folder first (Google Drive connector; this script cannot).

  4. [agent + Google Drive connector] Apply the payloads:
       - Master Ops Change Log: insert the row in the payload at row 3
         (newest first). Never delete prior rows.
       - Master Ops Shopify Drafts 11-11: apply diffs only (add, status,
         price, category). Never delete rows; archived = status ARCHIVED.
       - Margin sheet: apply margin-google-payload.json with
         payload['apply_steps'] and payload['format_spec'].
         Write input columns only (A–H, K, L, V–Y). NEVER write formula
         columns I, J, M–U or Settings F7:F10. Keep the archived block
         at the bottom under 'Archived (not on the site)'.

  5. [this script]  python3 scripts/sync-everything.py --deploy
     Pulls, commits only relevant files, pushes main and gh-pages.
     Never commits models/house/doll-house.glb or .secrets.

  6. [placeholder] Amazon — not connected yet. Skip. When it is
     connected, push the same add/remove/price/category change to Amazon
     and include Amazon in the consistency check.

  7. Verify live: fetch https://yourpracticalsolutions.com/products.json
     and /data/navigator-index.json; spot-check a product page, a category
     filter, and a house-navigator room.
""")
    if step:
        print(f"  (current invocation: {step})")
    print("=" * 72)
    print()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true",
                    help="consistency check only; exit 1 on any mismatch")
    ap.add_argument("--dry-run", action="store_true",
                    help="like --check, plus show rebuild/payload/deploy actions without doing them")
    ap.add_argument("--snapshot", metavar="FILE",
                    help="Shopify connector output (or raw GraphQL JSON) to ingest first")
    ap.add_argument("--rebuild", action="store_true",
                    help="rebuild products.json, pages, and navigator-index from the snapshot")
    ap.add_argument("--write-payloads", action="store_true",
                    help="write Master Ops + margin sheet payloads")
    ap.add_argument("--deploy", action="store_true",
                    help="commit relevant files and push main + gh-pages")
    ap.add_argument("--sheets-dir", metavar="DIR",
                    help="folder of exported sheet CSVs to compare in the check")
    ap.add_argument("--message", default=None, help="git commit message for --deploy")
    ap.add_argument("--checklist", action="store_true", help="print the checklist and exit")
    args = ap.parse_args()

    if args.checklist:
        checklist("checklist only")
        return 0

    # Default to check-only when no action flag is given.
    check_only = args.check or args.dry_run or not (args.rebuild or args.write_payloads or args.deploy or args.snapshot)
    step = "dry-run" if args.dry_run else (
        "check" if check_only and not args.rebuild else
        "pipeline"
    )
    checklist(step)

    if args.dry_run:
        print("DRY RUN: no snapshot write, no rebuild, no payload write, no deploy.")
        if args.snapshot:
            print(f"  would ingest snapshot: {args.snapshot}")
        if args.rebuild or args.snapshot:
            print("  would run: python3 scripts/build-products.py && python3 scripts/build-pages.py && python3 scripts/build-navigator.py")
        if args.write_payloads:
            print(f"  would write payloads to {PAYLOAD_DIR}")
            print(f"  would run: python3 {MARGIN_REFRESH} --dry-run")
        if args.deploy:
            print("  would git pull --rebase, commit relevant files, push main and gh-pages")
        print("  amazon:", AMAZON_PLACEHOLDER["note"])

    if args.snapshot and not args.dry_run:
        ingest_snapshot(Path(args.snapshot))

    if args.rebuild and not args.dry_run:
        rebuild_catalog()

    sheet_issues = []
    if args.sheets_dir:
        print(f"comparing sheet exports in {args.sheets_dir}")
        sheet_issues = load_sheet_exports(Path(args.sheets_dir))

    # Always run the consistency check (including after a rebuild).
    report = run_consistency_check(sheet_issues=sheet_issues or None)
    print_report(report)
    PAYLOAD_DIR.mkdir(parents=True, exist_ok=True)
    (PAYLOAD_DIR / "last-check.json").write_text(json.dumps(report, indent=2) + "\n")
    print(f"wrote {PAYLOAD_DIR / 'last-check.json'}")

    if args.write_payloads and not args.dry_run:
        write_master_ops_payload(report)
        write_margin_payload(dry_run=False)
    elif args.write_payloads and args.dry_run:
        write_margin_payload(dry_run=True)

    if args.deploy and not args.dry_run:
        if check_only:
            print("refusing to deploy in check-only mode", file=sys.stderr)
            return 1
        n = report["products_json_count"]
        msg = args.message or f"Sync catalog, navigator, and site pages ({n} ACTIVE products)."
        sha = deploy(msg)
        # Fill the commit hash into the Master Ops payload if we just wrote it.
        path = PAYLOAD_DIR / "master-ops-payload.json"
        if path.exists():
            payload = json.loads(path.read_text())
            row = payload.get("change_log", {}).get("row")
            if isinstance(row, list) and len(row) >= 4 and row[3] == "COMMIT":
                row[3] = sha
                path.write_text(json.dumps(payload, indent=2) + "\n")
                print(f"updated Change Log commit in {path} to {sha}")

    print()
    print("amazon:", AMAZON_PLACEHOLDER["note"])
    if not report["ok"]:
        print(f"CHECK FAILED: {report['issue_count']} issue(s). See {PAYLOAD_DIR / 'last-check.json'}")
        return 1
    print("CHECK PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
