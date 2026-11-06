export const CONFIG = {
  siteName: "Your Practical Solutions",
  siteUrl: "https://yourpracticalsolutions.com",
  shopPublicUrl: "https://shop.yourpracticalsolutions.com",
  shopFallbackUrl: "https://xvdkyq-xg.myshopify.com",
  shopifyDomain: "xvdkyq-xg.myshopify.com",
  storefrontToken: "",
  storefrontApiVersion: "2024-10",
  supabaseUrl: "https://avcqqazytvvcfraowgsm.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2Y3FxYXp5dHZ2Y2ZyYW93Z3NtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1ODIwNTAsImV4cCI6MjEwMDE1ODA1MH0.B3ii21cGVQZJIu8DmdpHjeQ_jvI0WcpVL96XQcizTtA",
  adminEmail: "contact@yourpracticalsolutions.com",
  syncFunctionUrl: "https://avcqqazytvvcfraowgsm.supabase.co/functions/v1/kpi-sync",
  inviteFunctionUrl: "https://avcqqazytvvcfraowgsm.supabase.co/functions/v1/kpi-invite",
};

export function shopUrl() {
  return CONFIG.shopPublicUrl;
}

export function productUrl(handle) {
  return `${CONFIG.shopPublicUrl}/products/${handle}`;
}

export function collectionUrl(handle) {
  return `${CONFIG.shopPublicUrl}/collections/${handle}`;
}
