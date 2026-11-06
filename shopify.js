import { CONFIG, productUrl } from "./config.js";

const KNOWN_COLLECTIONS = [
  { title: "Storage & Organization", handle: "storage-organization" },
  { title: "Pet Supplies", handle: "pet-supplies" },
  { title: "Garage & Tools", handle: "garage-tools" },
  { title: "Car & RV", handle: "car-rv" },
  { title: "Tech Accessories", handle: "tech-accessories" },
  { title: "Home & Decor", handle: "home-decor" },
  { title: "New Arrivals", handle: "new-arrivals" },
  { title: "Best Sellers", handle: "best-sellers" },
];

export function collectionsFallback() {
  return KNOWN_COLLECTIONS;
}

export async function fetchCatalog() {
  if (!CONFIG.storefrontToken) {
    return { products: [], collections: KNOWN_COLLECTIONS, error: "no-token" };
  }
  const query = `{
    collections(first: 30) { nodes { title handle } }
    products(first: 50) {
      nodes {
        title handle vendor productType tags
        featuredImage { url altText }
        priceRange { minVariantPrice { amount currencyCode } }
        variants(first: 5) { nodes { id title availableForSale } }
      }
    }
  }`;
  const res = await fetch(`https://${CONFIG.shopifyDomain}/api/${CONFIG.storefrontApiVersion}/graphql.json`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Shopify-Storefront-Access-Token": CONFIG.storefrontToken,
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) return { products: [], collections: KNOWN_COLLECTIONS, error: "storefront-http" };
  const json = await res.json();
  const products = (json.data?.products?.nodes || []).map((p) => ({
    title: p.title,
    handle: p.handle,
    vendor: p.vendor,
    product_type: p.productType,
    tags: (p.tags || []).join(", "),
    image_url: p.featuredImage?.url || "",
    price: p.priceRange?.minVariantPrice?.amount,
    online_url: productUrl(p.handle),
    collection_handles: [],
  }));
  const collections = json.data?.collections?.nodes?.length ? json.data.collections.nodes : KNOWN_COLLECTIONS;
  return { products, collections, error: null };
}

export function matchProducts(products, meta) {
  if (!meta || !products?.length) return [];
  const tags = (meta.tags || []).map((t) => t.toLowerCase());
  const cols = (meta.collections || []).map((t) => t.toLowerCase());
  const types = (meta.types || []).map((t) => t.toLowerCase());
  return products.filter((p) => {
    const pTags = String(p.tags || "").toLowerCase();
    const pType = String(p.product_type || "").toLowerCase();
    const pCols = (p.collection_handles || []).map((h) => String(h).toLowerCase());
    const pTitle = String(p.title || "").toLowerCase();
    if (cols.some((c) => pCols.includes(c))) return true;
    if (tags.some((t) => pTags.includes(t) || pTitle.includes(t))) return true;
    if (types.some((t) => pType.includes(t))) return true;
    return false;
  });
}
