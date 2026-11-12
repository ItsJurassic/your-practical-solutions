#!/usr/bin/env bash
# Rebuild the baked catalog from a Shopify connector result and deploy it if anything changed.
#
#   bash scripts/refresh-catalog.sh <file>
#
# <file> = the raw output of the user-Shopify graphql_query call (write_to_file:true is fine — the
# connector's wrapper text around the JSON is stripped) using the query in scripts/build-products.py.
# Exits 0 with "no change" when products.json is already up to date.
#
# For the full change-sync pipeline (navigator, consistency check, sheet payloads,
# Amazon placeholder) prefer:  python3 scripts/sync-everything.py --snapshot FILE --rebuild --write-payloads
# See docs/CHANGE-SYNC.md.
set -euo pipefail
cd "$(dirname "$0")/.."
src="${1:?usage: refresh-catalog.sh <connector-output-file>}"
python3 - "$src" <<'PY'
import json, sys
raw = open(sys.argv[1], encoding="utf-8").read()
start = raw.index('{"data"')
obj, _ = json.JSONDecoder().raw_decode(raw[start:])
assert "products" in obj["data"] and "collections" in obj["data"], "snapshot is missing products/collections"
if obj["data"]["products"].get("pageInfo", {}).get("hasNextPage"):
    print("WARNING: more than 100 products — paginate the query (after: endCursor) and merge nodes", file=sys.stderr)
json.dump(obj, open("data/shopify-snapshot.json", "w"), indent=2)
PY
python3 scripts/build-products.py
python3 scripts/build-pages.py
python3 scripts/build-navigator.py
# ignore the timestamp-only change in products.json / sitemap lastmod / navigator generated_at
if git diff --quiet -I'"generated_at"' -I'<lastmod>' -- products.json data/shopify-snapshot.json data/navigator-index.json index.html shop.html; then
  git checkout -- products.json sitemap.xml data/shopify-snapshot.json data/navigator-index.json 2>/dev/null || true
  echo "no change"; exit 0
fi
git add products.json data/shopify-snapshot.json data/navigator-index.json data/catalog-public.json \
        index.html shop.html sitemap.xml products categories
# never commit the 3D model or secrets
git reset -q HEAD -- models/house/doll-house.glb .secrets 2>/dev/null || true
git commit -qm "Refresh Shopify catalog snapshot ($(python3 -c 'import json;print(json.load(open("products.json"))["product_count"])') products)"
git push -q origin main && git push -q origin main:gh-pages
echo "deployed $(git rev-parse --short HEAD)"
