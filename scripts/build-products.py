#!/usr/bin/env python3
"""Build products.json from a Shopify Admin GraphQL snapshot.

The snapshot (data/shopify-snapshot.json) is the raw response of:

  query { shop { primaryDomain { host url } myshopifyDomain }
    products(first: 100) { pageInfo { hasNextPage } nodes {
      title handle status productType tags onlineStoreUrl publishedAt
      featuredMedia { preview { image { url altText } } }
      priceRangeV2 { minVariantPrice { amount currencyCode } maxVariantPrice { amount } }
      collections(first: 5) { nodes { handle title } } } }
    collections(first: 50) { nodes { handle title productsCount { count } } } }

Run:  python3 scripts/build-products.py
No Storefront token is needed at runtime: the site only reads products.json.
"""
import json, datetime, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SHOP_LINK_BASE = "https://shop.yourpracticalsolutions.com"  # Shopify primary domain
TYPE_TO_COLLECTION = {
    "Pet Supplies": "pet-supplies",
    "Kitchen": "kitchen",
    "Women's Clothing": "womens-clothing",
    "Christmas": "christmas",
    "Living Room": "living-room",
    "Men's Clothing": "mens-clothing",
    "Storage & Organization": "storage-organization",
    "Tech Accessories": "tech-accessories",
    "Bathroom": "bathroom",
    "Outdoor & Camping": "outdoor-camping",
    "Car & RV": "car-rv",
    "Winter Essentials": "winter-essentials",
    "Gardening": "gardening",
    "Home Decor": "home-decor",
    "Garage & Tools": "garage-tools",
}


snap = json.loads((ROOT / "data/shopify-snapshot.json").read_text())["data"]
products = []
for p in snap["products"]["nodes"]:
    if p.get("status") != "ACTIVE":
        continue
    img = ((p.get("featuredMedia") or {}).get("preview") or {}).get("image") or {}
    pr = p.get("priceRangeV2") or {}
    cols = [c["handle"] for c in (p.get("collections") or {}).get("nodes", [])]
    primary = TYPE_TO_COLLECTION.get(p.get("productType") or "")
    if primary and primary not in cols:
        cols.append(primary)
    products.append({
        "title": p["title"],
        "handle": p["handle"],
        "url": f"{SHOP_LINK_BASE}/products/{p['handle']}",
        "image": img.get("url"),
        "image_alt": img.get("altText") or p["title"],
        "price": (pr.get("minVariantPrice") or {}).get("amount"),
        "price_max": (pr.get("maxVariantPrice") or {}).get("amount"),
        "currency": (pr.get("minVariantPrice") or {}).get("currencyCode", "USD"),
        "product_type": p.get("productType") or "",
        "tags": p.get("tags") or [],
        "collections": cols,
        "description": (p.get("description") or "").strip(),
        "images": [
            (((m.get("preview") or {}).get("image") or {}).get("url") or ((m.get("image") or {}).get("url")))
            for m in ((p.get("media") or {}).get("nodes") or [])
            if ((m.get("preview") or {}).get("image") or {}).get("url") or (m.get("image") or {}).get("url")
        ] or ([img.get("url")] if img.get("url") else []),
    })

collections = [
    {"handle": c["handle"], "title": c["title"], "count": (c.get("productsCount") or {}).get("count", 0),
     "url": f"{SHOP_LINK_BASE}/collections/{c['handle']}"}
    for c in snap["collections"]["nodes"] if c["handle"] != "frontpage"
]

out = {
    "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
    "source": "Shopify Admin API snapshot (data/shopify-snapshot.json)",
    "store": {"name": "Your Practical Solutions", "url": SHOP_LINK_BASE,
              "primary_domain": snap["shop"]["primaryDomain"]["host"], "myshopify": snap["shop"]["myshopifyDomain"]},
    "product_count": len(products),
    "products": products,
    "collections": collections,
}
(ROOT / "products.json").write_text(json.dumps(out, indent=2) + "\n")
print(f"products.json: {len(products)} products, {len(collections)} collections")
