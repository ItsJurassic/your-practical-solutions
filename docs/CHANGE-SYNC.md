# Change-sync rule

**Every change — adding a product, removing one, a price change, a category change, or anything else — must update both spreadsheets, the website, and every sales channel.** This is a standing rule. The owner will test it.

What “everything” means on each change:

| Surface | What must update |
|---|---|
| Shopify (shop.yourpracticalsolutions.com) | The product itself (status, price, category collection, shipping weight, photos). Never delete; archive instead. |
| Marketing site (yourpracticalsolutions.com) | Baked catalog (`products.json`), local product pages, shop filters, category sections and pages, nav counts, and the **house navigator** (rooms, counts, and product links). |
| Master Operations Sheet | Product tab (`Shopify Drafts 11-11`) diffs, plus a **Change Log** row (newest first). `Products (Built)` only if one of the original 10 Top 10 drafts changed. |
| Margin breakdown | `Supplier costs` and **input columns only** on `Margin breakdown` (A–H, K, L, V–Y). Never write formula columns I, J, M–U or Settings F7:F10. Keep archived rows at the bottom under **Archived (not on the site)**. |
| Amazon | **Not connected yet.** Placeholder step: skip, and report that Amazon was skipped. When it is connected, push the same add / remove / price / category change and include Amazon in the consistency check. |

Pricing rules that still apply on every add or reprice: the customer pays half of supplier shipping via the band profiles; every item must net a profit; shipping weight must be accurate; the product must be in the correct category collection.

---

## One command

```bash
# Preferred pipeline (from /workspace/kpi-site)
python3 scripts/sync-everything.py --help
bash scripts/sync-everything.sh --check
```

| Command | What it does |
|---|---|
| `python3 scripts/sync-everything.py --check` | Consistency check only. Exits **1** on any mismatch. No writes. |
| `python3 scripts/sync-everything.py --dry-run` | Same check, plus prints the rebuild / payload / deploy steps it would take. Exits 1 on mismatch. |
| `python3 scripts/sync-everything.py --snapshot FILE --rebuild --write-payloads` | Ingest a Shopify connector snapshot, rebuild the site catalog, pages, filters, nav, and navigator, and write sheet payloads. Does **not** deploy and does **not** write to Google Sheets or Shopify. |
| `python3 scripts/sync-everything.py --check --sheets-dir /workspace/yps-research/sync-exports` | Also compare exported sheet CSVs (see below) to the snapshot and `products.json`. |
| `python3 scripts/sync-everything.py --deploy` | Pull/rebase, commit **only relevant files**, push `main` and `gh-pages`. Never commits `models/house/doll-house.glb` or `.secrets`. |
| `python3 scripts/sync-everything.py --checklist` | Print the checklist and exit. |
| `python3 scripts/build-navigator.py` | Rebuild `data/navigator-index.json` from the current `products.json` + `data/navigator.json`. |
| `python3 scripts/build-navigator.py --check` | Coverage check only (every ACTIVE product reachable). Exits 1 on gaps. |
| `python3 /workspace/yps-research/refresh_margin_sheet.py` | Refresh the local margin workbook and `margin-living/google-payload.json`. Does not touch Shopify or the site. |

`scripts/refresh-catalog.sh FILE` still exists as a shorter “rebuild + deploy if the catalog changed” path. Prefer `sync-everything.py` so the navigator, consistency check, and sheet payloads stay in the same run.

---

## Checklist for every product change

Run these in order. Steps marked **[agent + Shopify connector]** or **[agent + Google Drive connector]** cannot be done by the script itself; the agent (or a person) has to use those connectors.

### 1. Pull fresh Shopify data  —  **[agent + Shopify connector]**

Paginated Admin GraphQL query (`first: 100`, follow `pageInfo.hasNextPage` / `endCursor`, then merge `nodes`). Include ACTIVE, DRAFT, **and** ARCHIVED. Suggested query:

```graphql
query ($cursor: String) {
  shop { primaryDomain { host url } myshopifyDomain }
  products(first: 100, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id title handle status productType tags
      onlineStoreUrl publishedAt
      featuredMedia { preview { image { url altText } } }
      media(first: 20) { nodes { preview { image { url altText } } image { url } } }
      priceRangeV2 { minVariantPrice { amount currencyCode } maxVariantPrice { amount } }
      collections(first: 10) { nodes { handle title } }
      variants(first: 20) { nodes { id sku price } }
    }
  }
  collections(first: 50) {
    nodes { handle title productsCount { count } }
  }
}
```

Save the connector output to a file (for example `/tmp/shopify-snapshot.txt`). Do **not** delete Shopify products; archive them.

### 2. Rebuild the site and write payloads  —  **[script]**

```bash
cd /workspace/kpi-site
python3 scripts/sync-everything.py \
  --snapshot /tmp/shopify-snapshot.txt \
  --rebuild --write-payloads
```

This:

- Writes `data/shopify-snapshot.json`
- Builds `products.json` (ACTIVE only)
- Builds local product pages, `shop.html` / `index.html`, sitemap, category pages, and `data/catalog-public.json`
- Builds `data/navigator-index.json` from the category map in `data/navigator.json` (no hardcoded product lists)
- Runs the consistency check (exits 1 on mismatch)
- Writes sheet payloads to `/workspace/yps-research/sync-payloads/`:
  - `master-ops-payload.json` — Change Log row + suggested `Shopify Drafts 11-11` rows
  - `margin-google-payload.json` — copy of the margin refresher payload
  - `last-check.json` — the consistency report

### 3. Re-check against the live sheets  —  **[agent + Google Drive connector]** then **[script]**

Export, as CSV, into `/workspace/yps-research/sync-exports/`:

- Master Ops `Shopify Drafts 11-11` → `shopify-drafts.csv` (must include a Handle column, and Status)
- Margin `Margin breakdown` → `margin-breakdown.csv` (Handle and status / price if present)
- Margin `Supplier costs` → `supplier-costs.csv`

```bash
python3 scripts/sync-everything.py --check \
  --sheets-dir /workspace/yps-research/sync-exports
```

Exits **nonzero** on any mismatch (missing/extra handles, price or status or category drift, navigator coverage gaps, archived items still on the site, product pages missing).

### 4. Apply sheet payloads  —  **[agent + Google Drive connector]**

- **Master Ops Change Log** ([tab](https://docs.google.com/spreadsheets/d/1rxslOrac2OBzLb6Kdekal6H7Y7X15CX5XD8_4Ney5uQ/edit#gid=1444174024)): insert `change_log.row` at row 3 (newest first). Never delete prior rows.
- **Master Ops Shopify Drafts 11-11**: apply **diffs only** from `shopify_drafts_tab.rows` — add new handles, set Status to `ARCHIVED` for archived products, update title / price / category when they drifted. **Never delete a row.**
- **Margin breakdown** ([sheet](https://docs.google.com/spreadsheets/d/19dnW1_gBzWa-RpWCsy7Hhkl-75Aaw4hOuUjUV84uegQ/edit)): apply `margin-google-payload.json` using `payload["apply_steps"]` and `payload["format_spec"]`. Write **input columns only** (A–H, K, L, V–Y). **Never write formula columns I, J, M–U or Settings F7:F10.** Keep the archived block at the bottom under “Archived (not on the site)”. Re-apply number formats and the soft conditional-format palette. Delete leftover harsh `#F4CCCC` / `#990000` rules first (first-match wins).

### 5. Deploy the site  —  **[script]**

```bash
python3 scripts/sync-everything.py --deploy --message "Sync catalog and house navigator (<N> ACTIVE products)."
```

Rules: pull/rebase `origin/main` first; commit only relevant files; push **both** `main` and `gh-pages`; never commit `models/house/doll-house.glb` or anything under `.secrets` (and never print those secrets).

### 6. Amazon  —  **[placeholder]**

Amazon is not connected. Skip, and say so in the Change Log and in the check report. When a connector exists, this step will push the same change to Amazon and the `--check` run will compare Amazon listings to the Shopify snapshot.

### 7. Verify live

- `https://yourpracticalsolutions.com/products.json` — `product_count` matches ACTIVE
- `https://yourpracticalsolutions.com/data/navigator-index.json` — coverage_ok, no uncovered handles, archived handles absent, new products present in the right rooms
- A product page, a shop filter count, a category page, and a house-navigator room (desktop, viewport ≥ 900px)

---

## House navigator

The floor plan on the home page is **data-driven**.

- `data/navigator.json` maps each hotspot (room or piece of furniture) to **category handles**, plus optional `seasonal_categories` that follow the same America/Chicago show windows as the shop filters. It does not list product handles.
- `scripts/build-navigator.py` (also called from `build-products.py` and `sync-everything.py`) resolves that map against the current ACTIVE `products.json` and writes `data/navigator-index.json`.
- `app.js` matches the live catalog to those categories at runtime, so a catalog rebuild is enough for a new product to appear in the right room. Archived products drop out because they are not in `products.json`. Seasonal rooms (the Christmas tree, Halloween at the entry, and so on) hide outside their window.
- Every required category is assigned to at least one hotspot, and the consistency check fails if any ACTIVE product is unreachable.
- Optional opt-in: a Shopify tag `spot:<id>` (for example `spot:kitchen`) still adds a product to that spot.

To add a new room, add a hotspot on the plan (`house-plan.js`) **and** a matching entry in `data/navigator.json`, then rebuild. Do not hardcode a product list in `app.js`.

---

## What the consistency check compares

- Shopify snapshot ACTIVE / DRAFT / ARCHIVED vs `products.json` (handles, price, product type)
- `products.json` vs local product pages (every ACTIVE handle has `products/<handle>/index.html`; archived pages are gone)
- `products.json` vs `data/navigator-index.json` and vs the category map (every ACTIVE product reachable; archived absent)
- House-plan hotspot IDs vs the navigator map
- Optional sheet CSVs vs the same snapshot (missing / extra / mismatched price or status)
- Amazon: placeholder only, reported as skipped

---

## Standing “do not”

- Do not delete products (Shopify, sheets, or the site). Archive instead.
- Do not commit `models/house/doll-house.glb` or `.secrets`, and never print the team-chat key.
- Do not write margin formula columns I, J, M–U or Settings F7:F10.
- Do not place orders, including CJ auto-pay exceptions and bulk/MOQ, without the owner’s OK. CJ auto-fulfill orders that are already set to auto-pay are the existing exception.
- Do not send shoppers to the password-protected Shopify storefront while `data/coming-soon.json` (and `catalog-public.json`) has `live: false`.
