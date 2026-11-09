export const CONFIG = {
  siteName: "Your Practical Solutions",
  siteUrl: "https://yourpracticalsolutions.com",
  // shop.yourpracticalsolutions.com is not serving the store yet (no TLS / not attached in Shopify),
  // so links use the myshopify domain, which always redirects to the store's current primary domain.
  shopPublicUrl: "https://xvdkyq-xg.myshopify.com",
  shopFutureUrl: "https://shop.yourpracticalsolutions.com",
  shopifyDomain: "xvdkyq-xg.myshopify.com",
  supabaseUrl: "https://avcqqazytvvcfraowgsm.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2Y3FxYXp5dHZ2Y2ZyYW93Z3NtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1ODIwNTAsImV4cCI6MjEwMDE1ODA1MH0.B3ii21cGVQZJIu8DmdpHjeQ_jvI0WcpVL96XQcizTtA",
  adminEmail: "contact@yourpracticalsolutions.com",
  syncFunctionUrl: "https://avcqqazytvvcfraowgsm.supabase.co/functions/v1/kpi-sync",
  inviteFunctionUrl: "https://avcqqazytvvcfraowgsm.supabase.co/functions/v1/kpi-invite",
  chatInviteUrl: "https://avcqqazytvvcfraowgsm.supabase.co/functions/v1/chat-invite",
};

export const shopUrl = () => CONFIG.shopPublicUrl;
export const productUrl = (handle) => `${CONFIG.shopPublicUrl}/products/${handle}`;
export const collectionUrl = (handle) => `${CONFIG.shopPublicUrl}/collections/${handle}`;
