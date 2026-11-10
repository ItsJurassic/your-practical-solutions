#!/usr/bin/env python3
"""Assemble index.html and shop.html from templates/ + partials/, and write sitemap.xml.
Run after scripts/build-products.py:  python3 scripts/build-pages.py"""
import json, pathlib, datetime
ROOT = pathlib.Path(__file__).resolve().parent.parent
P = lambda n: (ROOT / "partials" / n).read_text().rstrip("\n")
cat = json.loads((ROOT / "products.json").read_text())
SITE = "https://yourpracticalsolutions.com"
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
items = [{"@type": "ListItem", "position": i + 1, "url": p["url"], "name": p["title"]} for i, p in enumerate(cat["products"])]
shop_ld = {"@context": "https://schema.org", "@type": "CollectionPage", "name": "Shop all products", "url": f"{SITE}/shop.html",
           "isPartOf": {"@id": f"{SITE}/#website"}, "mainEntity": {"@type": "ItemList", "numberOfItems": len(items), "itemListElement": items}}
for name in ("index.html", "shop.html"):
    t = (ROOT / "templates" / name).read_text()
    t = (t.replace("{{HEAD}}", P("head-common.html")).replace("{{HEADER}}", P("header.html"))
          .replace("{{FOOTER}}", P("footer.html")).replace("{{BOTTOMNAV}}", P("bottom-nav.html"))
          .replace("{{JSONLD}}", json.dumps(org, indent=2)).replace("{{JSONLD_SHOP}}", json.dumps(shop_ld, indent=2)))
    page = "home" if name == "index.html" else "shop"
    t = t.replace(f'data-nav="{page}"', f'data-nav="{page}" aria-current="page"')
    (ROOT / name).write_text(t)
import re, html
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
    t = (legal_t.replace("{{HEAD}}", P("head-common.html")).replace("{{HEADER}}", P("header.html"))
         .replace("{{FOOTER}}", P("footer.html")).replace("{{BOTTOMNAV}}", P("bottom-nav.html"))
         .replace("{{TITLE}}", title).replace("{{DESC}}", desc).replace("{{SLUG}}", f"{slug}.html")
         .replace("{{TOC}}", toc).replace("{{OTHERS}}", others).replace("{{BODY}}", body.strip())
         .replace("{{JSONLD_PAGE}}", json.dumps(ld, indent=2)))
    (ROOT / f"{slug}.html").write_text(t)
today = datetime.date.today().isoformat()
legal_lastmod = {"shipping": "2026-11-10", "returns": "2026-11-09", "privacy": "2026-11-09", "terms": "2026-11-10"}
legal_urls = "".join(f"  <url><loc>{SITE}/{s}.html</loc><lastmod>{legal_lastmod[s]}</lastmod><changefreq>yearly</changefreq><priority>0.4</priority></url>\n" for s, _ in LEGAL)
(ROOT / "sitemap.xml").write_text(f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>{SITE}/</loc><lastmod>{today}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>{SITE}/shop.html</loc><lastmod>{today}</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>
{legal_urls}</urlset>
""")
print("built index.html, shop.html, " + ", ".join(f"{s}.html" for s, _ in LEGAL) + ", sitemap.xml")
