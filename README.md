# Your Practical Solutions

Marketing site + catalog for Your Practical Solutions. Checkout happens on Shopify.
Live: https://itsjurassic.github.io/your-practical-solutions/ (custom domain plan: `DNS_PLAN.md`).

| Page | What it is |
|---|---|
| `/` (`index.html`) | Home. Desktop (≥900px) loads the interactive floor plan (`app.js` + `house-plan.js`); mobile never downloads it and gets a compact shop layout with a bottom nav. |
| `/shop.html` | Every product, with category filters, search and sort. Each card opens its product page on this site. |
| `/products/<handle>/` | Product listing: photo gallery, price, description, what's included, shipping time, returns, and a Buy Now button. |
| `/shipping.html`, `/returns.html`, `/privacy.html`, `/terms.html` | Policy pages (templates — have them reviewed). Built from `content/legal/*.html` + `templates/legal.html`. |
| `/admin/` | Team area: realtime **Team chat** (Supabase) and the **KPIs** dashboard (owner only). See `SHOPPIE_CHAT.md`. |

## Catalog: live sync + baked fallback

The shop loads `https://avcqqazytvvcfraowgsm.supabase.co/functions/v1/yps-products` first (4.5 s timeout).
That edge function (`supabase/functions/yps-products`) reads the live store — Storefront API if the
`SHOPIFY_STOREFRONT_TOKEN` secret is set, else Admin API if `SHOPIFY_ADMIN_TOKEN` is set, else the public
`https://xvdkyq-xg.myshopify.com/products.json` — caches it 5 min in memory and keeps the last good copy in
`public.yps_products_cache`. Active products are unchanged. When the Admin token is set, DRAFT products are
added with `coming_soon: true` and their live title, handle, price, and image. ARCHIVED products are omitted.
The browser reads the generated `data/catalog-public.json` (no cost or supplier fields) for local photos, blurbs, collections, rank, and product-page URLs. If the live
source fails (e.g. the store password page → `ok:false, reason:"store_password"`), the site uses the baked
`products.json` and that public catalog. `?refresh` forces a re-fetch.

### Rebuild the baked snapshot (e.g. daily)

1. Run the Admin GraphQL query from `scripts/build-products.py` with the Shopify connector (`write_to_file: true`).
2. `bash scripts/refresh-catalog.sh <that output file>` — extracts the JSON, rebuilds `products.json` and pages,
   and commits + pushes to `main` and `gh-pages` only if the catalog changed (prints `no change` otherwise).

Manual equivalent:

1. Refresh `data/shopify-snapshot.json` with the Admin GraphQL query documented in `scripts/build-products.py`.
2. `python3 scripts/build-products.py`  → `products.json`
3. `python3 scripts/build-pages.py`     → `index.html`, `shop.html`, `products/<handle>/index.html`, `data/catalog-public.json`, `sitemap.xml`

Edit `templates/*.html`, `partials/*.html`, and `data/coming-soon.json`, not the generated HTML.

### Turning on Buy Now

Products are draft (and the Shopify store is password-protected) until Joe and Joey approve, so Buy Now stays off.

1. In `data/coming-soon.json`, the top-level `"live"` flag is `false`. Every product inherits that unless it sets its own `"live"` value.
2. After products are **published (ACTIVE)** in Shopify and the store password is removed, set `"live": true` (globally, or on individual products), then run `python3 scripts/build-pages.py` and push to `main`.
3. When `live` is true, the button becomes **Buy Now** and goes to a Shopify cart permalink (`https://shop.yourpracticalsolutions.com/cart/<variantId>:1`). Until then it reads **Coming soon – notify me** and opens a mailto to support@yourpracticalsolutions.com.

`data/coming-soon.json` also contains internal `cost`, `ship_est`, and supplier `source` fields. Those must never be shown on public pages. The site reads the generated, sanitized `data/catalog-public.json` instead. The source file is still in the repo (and currently deployed with the rest of the site), so those fields are still reachable if someone opens the JSON directly.

## Deploy

`git push origin main && git push origin main:gh-pages` (GitHub Pages serves the `gh-pages` branch).
A push to `main` also runs `.github/workflows/pages.yml`, which publishes that same commit to `gh-pages` and leaves `CNAME` in the tree.
