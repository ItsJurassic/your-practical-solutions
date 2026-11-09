import { supabase, CONFIG } from "./client.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const COLORS = ["#1f4a3d", "#2b5c8a", "#a6434b", "#5b43a6", "#16736f", "#b45f1b"];
const colorFor = (name) => (name === "Shoppie" ? "#e08a3c" : COLORS[[...String(name)].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length]);
const initials = (name) => String(name || "?").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" });

let channel = null, me = null, messages = [];

function dayLabel(d) {
  const today = new Date(); const y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return dayFmt.format(d);
}

function render() {
  const log = $("chat-log");
  if (!messages.length) {
    log.innerHTML = `<div class="chat-empty"><b>No messages yet</b><p>Say hi to your partner — or type <span class="mention">@Shoppie</span> to ask the bot.</p></div>`;
    return;
  }
  let html = "", lastDay = "", lastSender = "", lastTime = 0;
  for (const m of messages) {
    const d = new Date(m.created_at);
    const day = d.toDateString();
    if (day !== lastDay) { html += `<div class="day-sep">${dayLabel(d)}</div>`; lastDay = day; lastSender = ""; }
    const mine = m.user_id && m.user_id === me.user.id;
    const cont = lastSender === (m.sender_email || m.sender_name) && d - lastTime < 5 * 60 * 1000;
    const body = esc(m.body).replace(/@shoppie\b/gi, (x) => `<span class="mention">${x}</span>`);
    html += `<div class="msg${mine ? " me" : ""}${m.is_bot ? " bot" : ""}${cont ? " cont" : ""}" data-id="${m.id}">
      <span class="avatar" style="background:${colorFor(m.sender_name)}">${m.is_bot ? "🤖" : esc(initials(m.sender_name))}</span>
      <div><div class="meta">${esc(mine ? "You" : m.sender_name)}${m.is_bot ? " · bot" : ""}</div>
      <div class="bubble">${body}<time datetime="${m.created_at}" title="${d.toLocaleString()}">${timeFmt.format(d)}</time></div></div></div>`;
    lastSender = m.sender_email || m.sender_name; lastTime = d;
  }
  const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 120;
  log.innerHTML = html;
  if (atBottom || render.first) log.scrollTop = log.scrollHeight;
  render.first = false;
}

async function loadMembers() {
  const { data } = await supabase.from("yps_chat_members").select("email, display_name, role").order("role", { ascending: true });
  const list = data || [];
  $("chat-avatars").innerHTML = [...list.map((m) => m.display_name), "Shoppie"].map((n) => `<span class="avatar" title="${esc(n)}" style="background:${colorFor(n)}">${n === "Shoppie" ? "🤖" : esc(initials(n))}</span>`).join("");
  $("chat-members").innerHTML = list.map((m) => `<li><b>${esc(m.display_name)}</b> <span class="muted">${esc(m.email)} · ${m.role}</span></li>`).join("") + `<li><b>Shoppie</b> <span class="muted">bot · replies via webhook</span></li>`;
}

async function loadMode() {
  const { data } = await supabase.rpc("yps_chat_get_mode");
  const mode = data || "mention";
  const sel = $("shoppie-mode");
  if (sel) sel.value = mode;
  $("shoppie-mode-label").textContent = mode === "all" ? "Shoppie sees every message" : "Shoppie sees messages that mention @Shoppie";
}

export async function startChat(user) {
  me = user;
  render.first = true;
  $("chat-me").textContent = user.displayName;
  $("owner-tools").hidden = !user.isAdmin;
  const remHint = $("admin-remove-hint");
  if (remHint) remHint.hidden = !!user.isOwner;
  const { data, error } = await supabase.from("yps_chat_messages").select("*").order("created_at", { ascending: false }).limit(300);
  if (error) $("chat-log").innerHTML = `<div class="chat-empty">Could not load messages: ${esc(error.message)}</div>`;
  messages = (data || []).reverse();
  render();
  loadMembers();
  loadAdmins();
  loadMode();
  stopChat();
  channel = supabase.channel("yps-chat")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "yps_chat_messages" }, ({ new: m }) => {
      if (!messages.some((x) => x.id === m.id)) { messages.push(m); render(); }
    })
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "yps_chat_messages" }, ({ old }) => {
      messages = messages.filter((x) => x.id !== old.id); render();
    })
    .subscribe((status) => {
      const on = status === "SUBSCRIBED";
      $("live-dot").classList.toggle("on", on);
      $("live-text").textContent = on ? "Live" : status === "CHANNEL_ERROR" ? "Reconnecting…" : "Connecting…";
    });
}

export function stopChat() {
  if (channel) { supabase.removeChannel(channel); channel = null; }
}

async function send() {
  const ta = $("chat-input");
  const body = ta.value.trim();
  if (!body || !me) return;
  ta.value = ""; ta.style.height = "";
  const { data, error } = await supabase.from("yps_chat_messages")
    .insert({ user_id: me.user.id, sender_email: me.email, sender_name: me.displayName, body })
    .select().single();
  if (error) { ta.value = body; alert(`Message not sent: ${error.message}`); return; }
  if (!messages.some((x) => x.id === data.id)) { messages.push(data); render.first = true; render(); }
}

$("chat-form").addEventListener("submit", (e) => { e.preventDefault(); send(); });
$("chat-input").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
$("chat-input").addEventListener("input", (e) => { const t = e.target; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 140) + "px"; });
$("mention-btn").addEventListener("click", () => { const t = $("chat-input"); t.value = (t.value ? t.value.trimEnd() + " " : "") + "@Shoppie "; t.focus(); });
$("shoppie-mode")?.addEventListener("change", async (e) => {
  const { error } = await supabase.rpc("yps_chat_set_mode", { p_mode: e.target.value });
  if (error) alert(error.message);
  loadMode();
});
async function callInvite(payload) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Sign in required.");
  const res = await fetch(CONFIG.chatInviteUrl, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || body.message || res.statusText);
  return body;
}

async function loadAdmins() {
  const box = $("admin-list");
  if (!box) return;
  try {
    const data = await callInvite({ action: "list" });
    const members = (data.members || []).filter((m) => m.role === "owner" || m.role === "admin");
    if (!members.length) {
      box.innerHTML = `<li class="muted">No admins yet.</li>`;
      return;
    }
    box.innerHTML = members.map((m) => {
      const mine = m.email === me?.email;
      const canRemove = data.canRemove && !mine;
      return `<li class="admin-row">
        <div><b>${esc(m.display_name || m.email)}</b>
        <span class="muted">${esc(m.email)} · ${esc(m.role)}</span></div>
        ${canRemove ? `<button type="button" class="btn btn-ghost btn-sm admin-remove" data-email="${esc(m.email)}">Remove</button>` : mine ? `<span class="muted">you</span>` : ""}
      </li>`;
    }).join("");
  } catch (err) {
    box.innerHTML = `<li class="muted">${esc(err.message)}</li>`;
  }
}

$("invite-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const out = $("invite-msg");
  out.textContent = "Sending invite…";
  try {
    const body = await callInvite({ action: "invite", email: fd.get("email"), name: fd.get("name"), role: "partner" });
    out.textContent = body.message || "Invite sent.";
    e.target.reset();
    loadMembers();
    loadAdmins();
  } catch (err) {
    out.textContent = err.message;
  }
});

$("admin-invite-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const out = $("admin-invite-msg");
  out.textContent = "Sending admin invite…";
  try {
    const body = await callInvite({ action: "invite", email: fd.get("email"), name: fd.get("name"), role: "admin" });
    out.textContent = body.message || "Admin invite sent.";
    e.target.reset();
    loadMembers();
    loadAdmins();
  } catch (err) {
    out.textContent = err.message;
  }
});

$("admin-list")?.addEventListener("click", async (e) => {
  const btn = e.target.closest(".admin-remove");
  if (!btn) return;
  const email = btn.dataset.email;
  if (!email || !confirm(`Remove ${email} from admins?`)) return;
  const out = $("admin-invite-msg");
  out.textContent = "Removing…";
  try {
    const body = await callInvite({ action: "remove", email });
    out.textContent = body.message || "Removed.";
    loadMembers();
    loadAdmins();
  } catch (err) {
    out.textContent = err.message;
  }
});
