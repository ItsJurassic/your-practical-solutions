import { CONFIG } from "../config.js";
import { supabase } from "./client.js";
import { startChat, stopChat } from "./chat.js";
const loginView = document.getElementById("login-view");
const dashView = document.getElementById("dash-view");
const msg = document.getElementById("login-msg");
const logout = document.getElementById("logout");
let chart;

function periodStart(range) {
  const now = new Date();
  if (range === "all") return new Date(2000, 0, 1);
  if (range === "ytd") return new Date(now.getFullYear(), 0, 1);
  const d = new Date(now);
  d.setDate(d.getDate() - Number(range));
  return d;
}

async function sessionUser() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user;
}

function showDash(on) {
  loginView.hidden = on;
  dashView.hidden = !on;
  logout.hidden = !on;
}

function selectTab(name) {
  document.querySelectorAll(".tabs [data-tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === name)));
  document.getElementById("tab-chat").hidden = name !== "chat";
  document.getElementById("tab-kpis").hidden = name !== "kpis";
  if (name === "kpis" && !kpisLoaded) { kpisLoaded = true; loadKpis(); }
}
let kpisLoaded = false;
document.querySelectorAll(".tabs [data-tab]").forEach((b) => (b.onclick = () => selectTab(b.dataset.tab)));

document.getElementById("login-form").onsubmit = async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const { error } = await supabase.auth.signInWithPassword({ email: fd.get("email"), password: fd.get("password") });
  msg.textContent = error ? error.message : "";
};

document.getElementById("magic").onclick = async () => {
  const email = document.querySelector("[name=email]").value;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.href.split("#")[0] },
  });
  msg.textContent = error ? error.message : `Check ${email} for a sign-in link.`;
};

document.getElementById("reset").onclick = async () => {
  const email = document.querySelector("[name=email]").value;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.href.split("#")[0] });
  msg.textContent = error ? error.message : "Password reset email sent if that inbox can receive mail.";
};

logout.onclick = async () => { stopChat(); await supabase.auth.signOut(); showDash(false); };

async function loadKpis() {
  const range = document.getElementById("range").value;
  const start = periodStart(range).toISOString();
  const [{ data: orders }, { data: items }, { data: products }, { data: costs }, { data: ads }, { data: sessions }, { data: customers }, { data: notes }, { data: settings }] = await Promise.all([
    supabase.from("kpi_orders").select("*"),
    supabase.from("kpi_order_items").select("*"),
    supabase.from("kpi_products").select("*"),
    supabase.from("kpi_product_costs").select("*"),
    supabase.from("kpi_ad_spend").select("*").order("spend_date", { ascending: false }),
    supabase.from("kpi_sessions").select("*"),
    supabase.from("kpi_customers").select("*"),
    supabase.from("kpi_inventory_notes").select("*").order("updated_at", { ascending: false }),
    supabase.from("kpi_settings").select("*"),
  ]);
  const setting = Object.fromEntries((settings || []).map((s) => [s.key, s.value]));
  const feePct = Number(setting.payment_fee_percent ?? 2.9);
  const feeFix = Number(setting.payment_fee_fixed ?? 0.3);
  const lateAfter = Number(setting.late_after_days ?? 3);
  const inRange = (orders || []).filter((o) => o.created_at >= start && !o.cancelled_at);
  const revenue = inRange.reduce((s, o) => s + Number(o.total_price || 0), 0);
  const refunds = inRange.reduce((s, o) => s + Number(o.total_refunded || 0), 0);
  const count = inRange.length;
  const aov = count ? revenue / count : 0;
  const costMap = Object.fromEntries((costs || []).map((c) => [c.product_shopify_id, c]));
  const orderIds = new Set(inRange.map((o) => o.id));
  const lineItems = (items || []).filter((i) => orderIds.has(i.order_id));
  let cogs = 0, shipCost = 0, missingCost = 0;
  for (const li of lineItems) {
    const snap = li.supplier_cost_snapshot ?? costMap[li.product_shopify_id]?.supplier_cost;
    if (snap == null) missingCost += 1;
    else cogs += Number(snap) * Number(li.quantity || 1);
    shipCost += Number(costMap[li.product_shopify_id]?.shipping_cost || 0) * Number(li.quantity || 1);
  }
  const fees = revenue * (feePct / 100) + feeFix * count;
  const net = revenue - refunds;
  const profit = net - cogs - shipCost - fees;
  const margin = net ? (profit / net) * 100 : 0;
  const sess = (sessions || []).filter((s) => s.day >= start.slice(0, 10)).reduce((n, s) => n + Number(s.sessions), 0);
  const conversion = sess ? (count / sess) * 100 : null;
  const refundRate = count ? (inRange.filter((o) => Number(o.total_refunded) > 0).length / count) * 100 : 0;
  const unfulfilled = inRange.filter((o) => !o.shipped_at && !["fulfilled"].includes(o.fulfillment_status || "")).length;
  const shipped = inRange.filter((o) => o.shipped_at);
  const avgShip = shipped.length ? shipped.reduce((s, o) => s + (new Date(o.shipped_at) - new Date(o.created_at)), 0) / shipped.length / 86400000 : null;
  const late = inRange.filter((o) => !o.shipped_at && (Date.now() - new Date(o.created_at)) / 86400000 > lateAfter).length;
  const repeats = (customers || []).filter((c) => Number(c.orders_count) >= 2).length;
  const repeatRate = customers?.length ? (repeats / customers.length) * 100 : 0;
  const adTotal = (ads || []).filter((a) => a.spend_date >= start.slice(0, 10)).reduce((s, a) => s + Number(a.amount), 0);
  const roas = adTotal ? net / adTotal : null;

  const cards = [
    ["Revenue", money(revenue)],
    ["Orders", String(count)],
    ["AOV", money(aov)],
    ["Gross profit", missingCost ? `${money(profit)} (incomplete costs)` : money(profit)],
    ["Margin", `${margin.toFixed(1)}%`],
    ["Conversion", conversion == null ? "N/A — add sessions" : `${conversion.toFixed(1)}%`],
    ["Refund rate", `${refundRate.toFixed(1)}%`],
    ["Unfulfilled", String(unfulfilled)],
    ["Avg time to ship", avgShip == null ? "N/A" : `${avgShip.toFixed(1)} days`],
    ["Late orders", String(late)],
    ["Customers", String(customers?.length || 0)],
    ["Repeat rate", `${repeatRate.toFixed(1)}%`],
    ["Ad spend", money(adTotal)],
    ["ROAS", roas == null ? "N/A" : roas.toFixed(2)],
  ];
  document.getElementById("kpis").innerHTML = cards.map(([k, v]) => `<div class="kpi"><span>${k}</span><strong>${v}</strong></div>`).join("");
  if (!count) document.getElementById("kpis").insertAdjacentHTML("afterend", `<p class="empty">No orders in this range yet. Sync after sales start.</p>`);

  const byDay = {};
  for (const o of inRange) {
    const d = o.created_at.slice(0, 10);
    byDay[d] = (byDay[d] || 0) + Number(o.total_price || 0);
  }
  const labels = Object.keys(byDay).sort();
  const ctx = document.getElementById("rev-chart");
  chart?.destroy();
  chart = new Chart(ctx, {
    type: "line",
    data: { labels, datasets: [{ label: "Revenue", data: labels.map((d) => byDay[d]), borderColor: "#2c4a3e", backgroundColor: "rgba(44,74,62,.12)", fill: true, tension: .3 }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
  });

  const sold = {};
  for (const li of lineItems) {
    const key = li.title || li.product_shopify_id || "Item";
    sold[key] = sold[key] || { title: key, qty: 0, rev: 0 };
    sold[key].qty += Number(li.quantity || 1);
    sold[key].rev += Number(li.price || 0) * Number(li.quantity || 1);
  }
  const top = Object.values(sold).sort((a, b) => b.rev - a.rev).slice(0, 8);
  document.getElementById("top-products").innerHTML = top.length
    ? `<table><tr><th>Product</th><th>Qty</th><th>Revenue</th></tr>${top.map((t) => `<tr><td>${t.title}</td><td>${t.qty}</td><td>${money(t.rev)}</td></tr>`).join("")}</table>`
    : `<div class="empty">No orders yet.</div>`;

  const vendors = {};
  for (const li of lineItems) {
    const v = li.vendor || "Unknown";
    vendors[v] = (vendors[v] || 0) + Number(li.price || 0) * Number(li.quantity || 1);
  }
  document.getElementById("suppliers").innerHTML = Object.keys(vendors).length
    ? `<table>${Object.entries(vendors).map(([k, v]) => `<tr><td>${k}</td><td>${money(v)}</td></tr>`).join("")}</table>`
    : `<div class="empty">No supplier data yet.</div>`;

  document.getElementById("costs").innerHTML = (products || []).length
    ? `<table><tr><th>Product</th><th>Supplier</th><th>Cost</th><th>Ship</th><th></th></tr>${(products || []).map((p) => {
        const c = costMap[p.shopify_id] || {};
        return `<tr data-id="${p.shopify_id}"><td>${p.title}</td>
          <td><input value="${c.supplier_name || p.vendor || ""}" data-f="supplier_name" /></td>
          <td><input type="number" step="0.01" value="${c.supplier_cost ?? ""}" data-f="supplier_cost" /></td>
          <td><input type="number" step="0.01" value="${c.shipping_cost ?? ""}" data-f="shipping_cost" /></td>
          <td><button class="btn btn-ghost save-cost" type="button">Save</button></td></tr>`;
      }).join("")}</table>`
    : `<div class="empty">No products synced yet.</div>`;

  document.getElementById("ads").innerHTML = (ads || []).length
    ? `<table>${ads.map((a) => `<tr><td>${a.spend_date}</td><td>${money(a.amount)}</td><td>${a.channel}</td><td>${a.notes || ""}</td></tr>`).join("")}</table>`
    : `<div class="empty">No ad spend entered.</div>`;
  document.getElementById("notes").innerHTML = (notes || []).length
    ? notes.map((n) => `<p><strong>${n.stock_status}</strong> ${n.note} <span class="muted">${n.product_shopify_id || ""}</span></p>`).join("")
    : `<div class="empty">No inventory notes yet.</div>`;
}

function money(n) { return `$${(Number(n) || 0).toFixed(2)}`; }

document.getElementById("range").onchange = loadKpis;
document.getElementById("costs").addEventListener("click", async (e) => {
  if (!e.target.classList.contains("save-cost")) return;
  const tr = e.target.closest("tr");
  const id = tr.dataset.id;
  const payload = { product_shopify_id: id };
  tr.querySelectorAll("[data-f]").forEach((el) => { payload[el.dataset.f] = el.value === "" ? null : (el.type === "number" ? Number(el.value) : el.value); });
  await supabase.from("kpi_product_costs").upsert(payload);
  loadKpis();
});
document.getElementById("ad-form").onsubmit = async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  await supabase.from("kpi_ad_spend").insert({ spend_date: fd.get("spend_date"), amount: Number(fd.get("amount")), channel: fd.get("channel"), notes: fd.get("notes") });
  e.target.reset(); loadKpis();
};
document.getElementById("sess-form").onsubmit = async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  await supabase.from("kpi_sessions").upsert({ day: fd.get("day"), sessions: Number(fd.get("sessions")) });
  e.target.reset(); loadKpis();
};
document.getElementById("note-form").onsubmit = async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  await supabase.from("kpi_inventory_notes").insert({ product_shopify_id: fd.get("product_shopify_id") || null, stock_status: fd.get("stock_status"), note: fd.get("note") });
  e.target.reset(); loadKpis();
};
document.getElementById("sync").onclick = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(CONFIG.syncFunctionUrl, { method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, apikey: CONFIG.supabaseAnonKey } });
  const body = await res.json().catch(() => ({}));
  document.getElementById("sync-msg").textContent = body.message || body.error || res.statusText;
  loadKpis();
};

let booted = null;
async function boot() {
  const user = await sessionUser();
  const email = String(user?.email || "").toLowerCase();
  if (!user) { stopChat(); booted = null; showDash(false); return; }
  if (booted === user.id) return;
  const isOwner = email === CONFIG.adminEmail;
  let member = null;
  const { data } = await supabase.from("yps_chat_members").select("email, display_name, role").eq("email", email).maybeSingle();
  member = data;
  if (!isOwner && !member) {
    msg.textContent = "This area is limited to the store team. Ask the owner for an invite.";
    await supabase.auth.signOut();
    showDash(false);
    return;
  }
  booted = user.id;
  showDash(true);
  document.getElementById("tab-btn-kpis").hidden = !isOwner;
  document.getElementById("whoami").textContent = `${member?.display_name || "Owner"} · ${email}`;
  await startChat({ user, email, isOwner, displayName: member?.display_name || (isOwner ? "Joe" : email.split("@")[0]) });
  selectTab("chat");
}
supabase.auth.onAuthStateChange((evt) => { if (evt === "SIGNED_IN" || evt === "SIGNED_OUT" || evt === "INITIAL_SESSION") setTimeout(boot, 0); });
