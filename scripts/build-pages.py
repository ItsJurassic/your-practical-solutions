#!/usr/bin/env python3
"""Assemble index.html, shop.html, legal pages, product pages, sitemap.xml,
and a sanitized public catalog (data/catalog-public.json).

Run after scripts/build-products.py:  python3 scripts/build-pages.py

Buy Now / Coming soon is controlled by data/coming-soon.json:
  - Top-level "live" (default false) is inherited by every product.
  - A product may set its own "live" to override the default.
  - After approval, publish in Shopify, and remove the store password:
    set live to true, rerun this script, and push to main.
  - Internal fields (cost, ship_est, source) are never written to public pages
    or to data/catalog-public.json.
"""
import json, pathlib, datetime, re, html, shutil
from urllib.parse import quote

ROOT = pathlib.Path(__file__).resolve().parent.parent
P = lambda n: (ROOT / "partials" / n).read_text().rstrip("\n")
cat = json.loads((ROOT / "products.json").read_text())
soon_doc = json.loads((ROOT / "data" / "coming-soon.json").read_text())
SITE = "https://yourpracticalsolutions.com"
SHOP = "https://shop.yourpracticalsolutions.com"
PUBLIC_FIELDS = (
    "rank", "handle", "title", "category", "collections", "price", "blurb",
    "features", "tags", "photos", "shopify_id", "shopify_handle", "shopify_status",
    "shipping", "shipping_note", "includes", "variant_id", "sku", "live",
    "ships_fast", "listed_at",
)

def is_live(product):
    if "live" in product:
        return bool(product["live"])
    return bool(soon_doc.get("live", False))

def money(amount):
    return f"${float(amount):.2f}"

def product_href(handle):
    return f"products/{handle}/"

def apply_shell(t, **extra):
    t = (t.replace("{{HEAD}}", P("head-common.html")).replace("{{HEADER}}", P("header.html"))
          .replace("{{FOOTER}}", P("footer.html")).replace("{{BOTTOMNAV}}", P("bottom-nav.html")))
    for k, v in extra.items():
        t = t.replace("{{" + k + "}}", v)
    return t

org = {
    "@context": "https://schema.org",
    "@graph": [
        {"@type": "OnlineStore", "@id": f"{SITE}/#org", "name": "Your Practical Solutions", "url": f"{SITE}/",
         "logo": "https://yourpracticalsolutions.com/apple-touch-icon.png",
         "email": "support@yourpracticalsolutions.com",
         "description": "Practical goods for home, garage, car and RV.",
         "sameAs": [cat["store"]["url"]]},
        {"@type": "WebSite", "@id": f"{SITE}/#website", "url": f"{SITE}/", "name": "Your Practical Solutions",
         "publisher": {"@id": f"{SITE}/#org"},
         "potentialAction": {"@type": "SearchAction", "target": f"{SITE}/shop.html?q={{search_term_string}}", "query-input": "required name=search_term_string"}},
    ],
}

# Prefer local product pages in the shop ItemList (coming-soon + any live catalog).
listed = list(soon_doc.get("products") or [])
if not listed:
    listed = cat.get("products") or []
items = [{"@type": "ListItem", "position": i + 1, "url": f"{SITE}/{product_href(p['handle'])}", "name": p["title"]} for i, p in enumerate(listed)]
shop_ld = {"@context": "https://schema.org", "@type": "CollectionPage", "name": "Shop all products", "url": f"{SITE}/shop.html",
           "isPartOf": {"@id": f"{SITE}/#website"}, "mainEntity": {"@type": "ItemList", "numberOfItems": len(items), "itemListElement": items}}
for name in ("index.html", "shop.html"):
    t = (ROOT / "templates" / name).read_text()
    t = apply_shell(t, JSONLD=json.dumps(org, indent=2), JSONLD_SHOP=json.dumps(shop_ld, indent=2))
    page = "home" if name == "index.html" else "shop"
    t = t.replace(f'data-nav="{page}"', f'data-nav="{page}" aria-current="page"')
    (ROOT / name).write_text(t)

LEGAL = [("shipping", "Shipping Policy"), ("returns", "Return & Refund Policy"), ("privacy", "Privacy Policy"), ("terms", "Terms of Service")]
legal_t = (ROOT / "templates" / "legal.html").read_text()
for slug, _ in LEGAL:
    src = (ROOT / "content" / "legal" / f"{slug}.html").read_text()
    title = re.search(r"<!-- title: (.*?) -->", src).group(1)
    desc = re.search(r"<!-- desc: (.*?) -->", src).group(1)
    body = re.sub(r"<!-- (title|desc): .*? -->\n?", "", src)
    toc = "".join(f'<li><a href="{slug}.html#{i}">{t}</a></li>' for i, t in re.findall(r'<h2 id="([^"]+)">(.*?)</h2>', body))
    others = "".join(f'<a href="{s2}.html">{html.escape(t2)}</a>' for s2, t2 in LEGAL if s2 != slug)
    lastmod = {"shipping": "2026-11-10", "returns": "2026-11-09", "privacy": "2026-11-09", "terms": "2026-11-10"}[slug]
    ld = {"@context": "https://schema.org", "@type": "WebPage", "name": html.unescape(title), "url": f"{SITE}/{slug}.html",
          "dateModified": lastmod, "isPartOf": {"@id": f"{SITE}/#website"}, "publisher": {"@id": f"{SITE}/#org"}}
    t = apply_shell(legal_t, TITLE=title, DESC=desc, SLUG=f"{slug}.html", TOC=toc, OTHERS=others,
                    BODY=body.strip(), JSONLD_PAGE=json.dumps(ld, indent=2))
    (ROOT / f"{slug}.html").write_text(t)

# ---------- product pages ----------
def card_html(p, coming_soon=True):
    handle = p["handle"]
    href = product_href(handle)
    title = html.escape(p["title"])
    img = f"images/products/{handle}-1.jpg?v=20261110"
    badge = '<span class="soon-badge">Coming soon</span>' if coming_soon else ""
    pill = '<span class="soon-pill">Coming soon</span>' if coming_soon else ""
    blurb = f'<p class="blurb">{html.escape(p.get("blurb") or "")}</p>' if p.get("blurb") else ""
    ptype = f'<span class="ptype">{html.escape(p.get("category") or "")}</span>' if p.get("category") else ""
    cls = "product product-soon" if coming_soon else "product"
    cta = "View product →"
    return (
        f'<a class="{cls}" href="{html.escape(href)}">'
        f'<div class="ph">{badge}<img src="{html.escape(img)}" alt="{title}" loading="lazy" width="1000" height="1000"></div>'
        f'<div class="pb">{pill}{ptype}<h3>{title}</h3>{blurb}'
        f'<span class="price">{money(p["price"])}</span><span class="cta">{cta}</span></div></a>'
    )

def gallery_html(p):
    handle = p["handle"]
    n = int(p.get("photos") or 1)
    title = html.escape(p["title"])
    first = f"images/products/{handle}-1.jpg?v=20261110"
    thumbs = []
    for i in range(1, n + 1):
        src = f"images/products/{handle}-{i}.jpg?v=20261110"
        active = " is-active" if i == 1 else ""
        thumbs.append(
            f'<button type="button" class="pdp-thumb{active}" data-src="{html.escape(src)}" '
            f'aria-label="Photo {i} of {n}" aria-pressed="{"true" if i == 1 else "false"}">'
            f'<img src="{html.escape(src)}" alt="" width="160" height="160"></button>'
        )
    return (
        f'<div class="pdp-main-shot"><img id="pdp-main" src="{html.escape(first)}" alt="{title}" width="1000" height="1000"></div>'
        f'<div class="pdp-thumbs" role="group" aria-label="Product photos">{"".join(thumbs)}</div>'
    )

def buy_html(p, live):
    title = p["title"]
    if live and p.get("variant_id"):
        href = f"{SHOP}/cart/{p['variant_id']}:1"
        return (
            f'<a class="btn btn-primary btn-block pdp-buy" href="{html.escape(href)}" rel="noopener">Buy Now</a>\n'
            f'          <p class="muted pdp-buy-note">Secure checkout on Shopify. Free US shipping is included in the price.</p>'
        )
    if live:
        href = f"{SHOP}/products/{p.get('shopify_handle') or p['handle']}"
        return (
            f'<a class="btn btn-primary btn-block pdp-buy" href="{html.escape(href)}" rel="noopener">Buy Now</a>\n'
            f'          <p class="muted pdp-buy-note">Secure checkout on Shopify. Free US shipping is included in the price.</p>'
        )
    subject = quote(f"Notify me when {title} is available")
    body = quote(f"Hi, please email me when {title} is available to purchase.\n")
    href = f"mailto:support@yourpracticalsolutions.com?subject={subject}&body={body}"
    return (
        f'<a class="btn btn-block pdp-buy pdp-buy-soon" href="{html.escape(href)}">Coming soon – notify me</a>\n'
        f'          <p class="muted pdp-buy-note">This item isn’t for sale yet. Tap the button to email us and we’ll let you know when it is.</p>'
    )

products_root = ROOT / "products"
if products_root.exists():
    # Only remove generated product folders so we never delete unrelated files.
    for child in products_root.iterdir():
        if child.is_dir() and (child / "index.html").exists():
            shutil.rmtree(child)
products_root.mkdir(exist_ok=True)

product_t = (ROOT / "templates" / "product.html").read_text()
soon_products = soon_doc.get("products") or []
built = []
for p in soon_products:
    live = is_live(p)
    handle = p["handle"]
    title = p["title"]
    desc = (p.get("blurb") or title) + f" {money(p['price'])}. Free US shipping."
    og = f"{SITE}/images/products/{handle}-1.jpg"
    features = "".join(f"              <li>{html.escape(f)}</li>\n" for f in (p.get("features") or []))
    includes = "".join(f"              <li>{html.escape(i)}</li>\n" for i in (p.get("includes") or []))
    ship_note = ""
    extra_note = p.get("shipping_note") or ""
    shipping = p.get("shipping") or "Ships in about 5–12 business days."
    if extra_note and extra_note != shipping:
        ship_note = f"            <p>{html.escape(extra_note)}</p>\n"
    related = [o for o in soon_products if o["handle"] != handle][:4]
    related_html = "\n        ".join(card_html(o, coming_soon=not is_live(o)) for o in related)
    images = [f"{SITE}/images/products/{handle}-{i}.jpg" for i in range(1, int(p.get("photos") or 1) + 1)]
    availability = "https://schema.org/InStock" if live else "https://schema.org/PreOrder"
    offer_url = f"{SITE}/{product_href(handle)}"
    ld = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": title,
        "image": images,
        "description": p.get("blurb") or title,
        "sku": p.get("sku") or "",
        "brand": {"@type": "Brand", "name": "Your Practical Solutions"},
        "offers": {
            "@type": "Offer",
            "url": offer_url,
            "priceCurrency": "USD",
            "price": str(p["price"]),
            "availability": availability,
            "seller": {"@id": f"{SITE}/#org"},
            "shippingDetails": {
                "@type": "OfferShippingDetails",
                "shippingRate": {"@type": "MonetaryAmount", "value": "0", "currency": "USD"},
                "shippingDestination": {"@type": "DefinedRegion", "addressCountry": "US"},
            },
        },
        "isPartOf": {"@id": f"{SITE}/#website"},
    }
    t = apply_shell(
        product_t,
        TITLE=html.escape(title),
        DESC=html.escape(desc),
        HANDLE=handle,
        OG_IMAGE=og,
        PRICE=str(p["price"]),
        PRICE_FMT=money(p["price"]),
        CATEGORY=html.escape(p.get("category") or ""),
        BLURB=html.escape(p.get("blurb") or ""),
        GALLERY=gallery_html(p),
        BUY=buy_html(p, live),
        FEATURES=features.rstrip(),
        INCLUDES=includes.rstrip(),
        SHIPPING=html.escape(shipping),
        SHIP_NOTE=ship_note,
        RELATED=related_html,
        JSONLD_PRODUCT=json.dumps(ld, indent=2),
    )
    t = t.replace('data-nav="shop"', 'data-nav="shop" aria-current="page"')
    out = products_root / handle
    out.mkdir(parents=True, exist_ok=True)
    (out / "index.html").write_text(t)
    built.append(p)

# Sanitized catalog for the browser — no cost, ship_est, or supplier source.
public_products = []
for p in soon_products:
    row = {k: p[k] for k in PUBLIC_FIELDS if k in p}
    row["live"] = is_live(p)
    row["page_url"] = product_href(p["handle"])
    if row["live"] and p.get("variant_id"):
        row["buy_url"] = f"{SHOP}/cart/{p['variant_id']}:1"
    elif row["live"]:
        row["buy_url"] = f"{SHOP}/products/{p.get('shopify_handle') or p['handle']}"
    public_products.append(row)
public = {
    "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
    "live": bool(soon_doc.get("live", False)),
    "note": "Public catalog for the marketing site. Buy Now is on only when live is true. Internal cost and supplier fields are omitted on purpose.",
    "products": public_products,
}
(ROOT / "data" / "catalog-public.json").write_text(json.dumps(public, indent=2) + "\n")


# ---------- category landing pages (sitemap lists seasonal even when hidden) ----------
cat_doc = {}
cat_path = ROOT / "data" / "categories.json"
if cat_path.exists():
    cat_doc = json.loads(cat_path.read_text())
cat_entries = list(cat_doc.get("categories") or []) + list(cat_doc.get("merchandising") or [])
category_t = (ROOT / "templates" / "category.html").read_text()
cat_root = ROOT / "categories"
if cat_root.exists():
    for child in cat_root.iterdir():
        if child.is_dir() and (child / "index.html").exists():
            shutil.rmtree(child)
cat_root.mkdir(exist_ok=True)
built_cats = []
for c in cat_entries:
    handle = c["handle"]
    title = c["name"]
    blurb = c.get("blurb") or "Shop the collection."
    desc = html.escape(f"{title} at Your Practical Solutions. {blurb}")
    slug = f"categories/{handle}/"
    page = apply_shell(
        category_t,
        TITLE=html.escape(title),
        DESC=desc,
        HANDLE=html.escape(handle),
        BLURB=html.escape(blurb),
        SLUG=slug,
    )
    page = page.replace('data-nav="shop"', 'data-nav="shop" aria-current="page"')
    out = cat_root / handle
    out.mkdir(parents=True, exist_ok=True)
    (out / "index.html").write_text(page)
    built_cats.append(c)

today = datetime.date.today().isoformat()
legal_lastmod = {"shipping": "2026-11-10", "returns": "2026-11-09", "privacy": "2026-11-09", "terms": "2026-11-10"}
legal_urls = "".join(f"  <url><loc>{SITE}/{s}.html</loc><lastmod>{legal_lastmod[s]}</lastmod><changefreq>yearly</changefreq><priority>0.4</priority></url>\n" for s, _ in LEGAL)
product_urls = "".join(
    f"  <url><loc>{SITE}/{product_href(p['handle'])}</loc><lastmod>{today}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>\n"
    for p in built
)
category_urls = "".join(
    f"  <url><loc>{SITE}/categories/{c['handle']}/</loc><lastmod>{today}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>\n"
    for c in built_cats
)
(ROOT / "sitemap.xml").write_text(f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>{SITE}/</loc><lastmod>{today}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>{SITE}/shop.html</loc><lastmod>{today}</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>
{product_urls}{category_urls}{legal_urls}</urlset>
""")
print("built index.html, shop.html, " + ", ".join(f"{s}.html" for s, _ in LEGAL)
      + f", {len(built)} product pages, {len(built_cats)} category pages, data/catalog-public.json, sitemap.xml")
