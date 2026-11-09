# Domain plan (not applied — DNS changes need the owner)

## What DNS looks like today (checked 2026-11-09)

| Name | Record | Points to | Result |
|---|---|---|---|
| `yourpracticalsolutions.com` | A | `23.227.38.65` (Shopify) | Serves the **Shopify store** (password page during trial) |
| `www.yourpracticalsolutions.com` | CNAME | `shops.myshopify.com` | 301 → apex (Shopify) |
| `shop.yourpracticalsolutions.com` | CNAME | `shops.myshopify.com` | **Not attached in Shopify** → TLS fails, nothing served |
| `xvdkyq-xg.myshopify.com` | — | Shopify | 301 → `yourpracticalsolutions.com` |

The marketing site lives at **https://itsjurassic.github.io/your-practical-solutions/**.

## Target

- `yourpracticalsolutions.com` + `www` → **GitHub Pages** (this site).
- `shop.yourpracticalsolutions.com` → **Shopify** (store + checkout).

## Steps, in this order

1. **Shopify admin → Settings → Domains**: *Connect existing domain* → `shop.yourpracticalsolutions.com`
   (its CNAME to `shops.myshopify.com` already exists). Wait for "Connected" + SSL, then **set it as the
   primary domain**. Remove `yourpracticalsolutions.com` and `www` from Shopify domains.
   After this, `xvdkyq-xg.myshopify.com` links on the site redirect to `shop.yourpracticalsolutions.com`.
2. **At the DNS host** for `yourpracticalsolutions.com`:
   - Delete apex `A 23.227.38.65`.
   - Add apex `A` records: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
     (optional `AAAA`: `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`).
   - Change `www` → `CNAME itsjurassic.github.io.`
   - Keep `shop` → `CNAME shops.myshopify.com.`
3. **Repo**: rename `CNAME.pending` to `CNAME` (contains `yourpracticalsolutions.com`), commit, push to
   `gh-pages`. Then GitHub → Settings → Pages → Custom domain = `yourpracticalsolutions.com`,
   wait for the certificate, tick **Enforce HTTPS**.
4. Optional: set `CONFIG.shopPublicUrl` in `config.js` and `SHOP_LINK_BASE` in
   `scripts/build-products.py` to `https://shop.yourpracticalsolutions.com` (the myshopify links keep
   working either way because they redirect to the primary domain).
5. Submit `https://yourpracticalsolutions.com/sitemap.xml` in Google Search Console.

## Why the CNAME file is not committed yet

A `CNAME` file in the published branch makes GitHub Pages redirect
`itsjurassic.github.io/your-practical-solutions/` to `yourpracticalsolutions.com`. Today that domain
points at Shopify, so visitors would land on the store's password page and the site would disappear.
It must only be committed after step 2.
