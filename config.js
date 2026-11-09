export const CONFIG = {
  siteName: "Your Practical Solutions",
  siteUrl: "https://yourpracticalsolutions.com",
  // Shopify primary domain (xvdkyq-xg.myshopify.com redirects here).
  shopPublicUrl: "https://shop.yourpracticalsolutions.com",
  shopifyDomain: "xvdkyq-xg.myshopify.com",
  supabaseUrl: "https://avcqqazytvvcfraowgsm.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2Y3FxYXp5dHZ2Y2ZyYW93Z3NtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1ODIwNTAsImV4cCI6MjEwMDE1ODA1MH0.B3ii21cGVQZJIu8DmdpHjeQ_jvI0WcpVL96XQcizTtA",
  adminEmail: "josephcaldwell12321@gmail.com",
  syncFunctionUrl: "https://avcqqazytvvcfraowgsm.supabase.co/functions/v1/kpi-sync",
  inviteFunctionUrl: "https://avcqqazytvvcfraowgsm.supabase.co/functions/v1/kpi-invite",
  chatInviteUrl: "https://avcqqazytvvcfraowgsm.supabase.co/functions/v1/chat-invite",
};

export const shopUrl = () => CONFIG.shopPublicUrl;
export const productUrl = (handle) => `${CONFIG.shopPublicUrl}/products/${handle}`;
export const collectionUrl = (handle) => `${CONFIG.shopPublicUrl}/collections/${handle}`;
