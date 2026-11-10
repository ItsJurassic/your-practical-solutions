# Your Practical Solutions

Marketing site + catalog for Your Practical Solutions. Checkout happens on Shopify.
Live: https://itsjurassic.github.io/your-practical-solutions/ (custom domain plan: `DNS_PLAN.md`).

| Page | What it is |
|---|---|
| `/` (`index.html`) | Home. Desktop (≥900px) loads the interactive floor plan (`app.js` + `house-plan.js`); mobile never downloads it and gets a compact shop layout with a bottom nav. |
| `/shop.html` | Every Shopify product from `products.json`, with category filters, search and sort. Each card links to the live Shopify product page. |
| `/shipping.html`, `/returns.html`, `/privacy.html`, `/terms.html` | Policy pages (templates — have them reviewed). Built from `content/legal/*.html` + `templates/legal.html`. |
| `/admin/` | Team area: realtime **Team chat** (Supabase) and the **KPIs** dashboard (owner only). See `SHOPPIE_CHAT.md`. |

## Catalog: live sync + baked fallback

The shop loads `https://avcqqazytvvcfraowgsm.supabase.co/functions/v1/yps-products` first (4.5 s timeout).
That edge function (`supabase/functions/yps-products`) reads the live store — Storefront API if the
`SHOPIFY_STOREFRONT_TOKEN` secret is set, else Admin API if `SHOPIFY_ADMIN_TOKEN` is set, else the public
`https://xvdkyq-xg.myshopify.com/products.json` — caches it 5 min in memory and keeps the last good copy in
`public.yps_products_cache`. Active products are unchanged. When the Admin token is set, DRAFT products are
added with `coming_soon: true` and their live title, handle, price, and image. ARCHIVED products are omitted.
`data/coming-soon.json` is only the fallback for local photos, blurbs, collections, and rank. If the live
source fails (e.g. the store password page → `ok:false, reason:"store_password"`), the site uses the baked
`products.json` and that JSON fallback. `?refresh` forces a re-fetch.

### Rebuild the baked snapshot (e.g. daily)

1. Run the Admin GraphQL query from `scripts/build-products.py` with the Shopify connector (`write_to_file: true`).
2. `bash scripts/refresh-catalog.sh <that output file>` — extracts the JSON, rebuilds `products.json` and pages,
   and commits + pushes to `main` and `gh-pages` only if the catalog changed (prints `no change` otherwise).

Manual equivalent:

1. Refresh `data/shopify-snapshot.json` with the Admin GraphQL query documented in `scripts/build-products.py`.
2. `python3 scripts/build-products.py`  → `products.json`
3. `python3 scripts/build-pages.py`     → `index.html`, `shop.html` (from `templates/` + `partials/`), `sitemap.xml`

Edit `templates/*.html` and `partials/*.html`, not the generated `index.html` / `shop.html`.

## Deploy

`git push origin main && git push origin main:gh-pages` (GitHub Pages serves the `gh-pages` branch).
A push to `main` also runs `.github/workflows/pages.yml`, which publishes that same commit to `gh-pages` and leaves `CNAME` in the tree.
