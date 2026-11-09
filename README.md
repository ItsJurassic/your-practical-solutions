# Your Practical Solutions

Marketing site + catalog for Your Practical Solutions. Checkout happens on Shopify.
Live: https://itsjurassic.github.io/your-practical-solutions/ (custom domain plan: `DNS_PLAN.md`).

| Page | What it is |
|---|---|
| `/` (`index.html`) | Home. Desktop (≥900px) loads the interactive floor plan (`app.js` + `house-plan.js`); mobile never downloads it and gets a compact shop layout with a bottom nav. |
| `/shop.html` | Every Shopify product from `products.json`, with category filters, search and sort. Each card links to the live Shopify product page. |
| `/admin/` | Team area: realtime **Team chat** (Supabase) and the **KPIs** dashboard (owner only). See `SHOPPIE_CHAT.md`. |

## Rebuild the catalog

`products.json` is baked at build time, so no Storefront token is needed:

1. Refresh `data/shopify-snapshot.json` with the Admin GraphQL query documented in `scripts/build-products.py`.
2. `python3 scripts/build-products.py`  → `products.json`
3. `python3 scripts/build-pages.py`     → `index.html`, `shop.html` (from `templates/` + `partials/`), `sitemap.xml`

Edit `templates/*.html` and `partials/*.html`, not the generated `index.html` / `shop.html`.

## Deploy

`git push origin main && git push origin main:gh-pages` (GitHub Pages serves the `gh-pages` branch).
