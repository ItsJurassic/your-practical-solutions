import { supabase, CONFIG } from "./client.js?v=15";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const COLORS = ["#1f4a3d", "#2b5c8a", "#a6434b", "#5b43a6", "#16736f", "#b45f1b"];
const colorFor = (name) => (name === "Shoppie" ? "#e08a3c" : COLORS[[...String(name)].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length]);
const initials = (name) => String(name || "?").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" });

let channel = null, me = null, messages = [];
let typingNames = new Set(); // other humans currently typing
let botStatuses = new Map(); // bot_name -> { state, updated_at }
let typingExpireTimer = null;
let myTyping = false;
let botStatusPoll = null;
const HUMAN_TYPING_MS = 4000;
const BOT_STATUS_TTL_MS = 3 * 60 * 1000;

function formatActorList(names) {
  const list = [...names].filter(Boolean);
  if (!list.length) return "";
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(", ")}, and ${list[list.length - 1]}`;
}

function renderTypingBar() {
  const bar = $("typing-bar");
  const textEl = $("typing-text");
  if (!bar || !textEl) return;
  const now = Date.now();
  const parts = [];
  const humans = [...typingNames].filter((n) => n && (!me || n !== me.displayName));
  if (humans.length) {
    const who = formatActorList(humans);
    parts.push(`${who} ${humans.length === 1 ? "is" : "are"} typing`);
  }
  for (const [name, info] of botStatuses) {
    const age = now - new Date(info.updated_at).getTime();
    if (age > BOT_STATUS_TTL_MS) continue;
    const verb = info.state === "typing" ? "typing" : "thinking";
    parts.push(`${name} is ${verb}`);
  }
  if (!parts.length) {
    bar.hidden = true;
    textEl.textContent = "";
    return;
  }
  bar.hidden = false;
  textEl.textContent = parts.join(" · ") + "…";
}

function syncPresenceTyping() {
  if (!channel || !me) return;
  const state = channel.presenceState() || {};
  const names = new Set();
  for (const metas of Object.values(state)) {
    for (const m of metas || []) {
      if (m?.typing && m?.name && (!me || m.user_id !== me.user.id)) names.add(m.name);
    }
  }
  typingNames = names;
  renderTypingBar();
}

async function setMyTyping(on) {
  if (!channel || !me) return;
  if (myTyping === on) return;
  myTyping = on;
  try {
    await channel.track({ user_id: me.user.id, name: me.displayName, typing: !!on, at: Date.now() });
  } catch (_) { /* presence may not be ready yet */ }
}

function bumpMyTyping() {
  setMyTyping(true);
  clearTimeout(typingExpireTimer);
  typingExpireTimer = setTimeout(() => setMyTyping(false), HUMAN_TYPING_MS);
}

function applyBotStatusRows(rows) {
  const next = new Map();
  const now = Date.now();
  for (const r of rows || []) {
    if (!r?.bot_name || !r?.state) continue;
    if (now - new Date(r.updated_at).getTime() > BOT_STATUS_TTL_MS) continue;
    next.set(r.bot_name, { state: r.state, updated_at: r.updated_at });
  }
  botStatuses = next;
  renderTypingBar();
}

async function loadBotStatuses() {
  const { data } = await supabase.from("yps_chat_bot_status").select("bot_name, state, updated_at");
  applyBotStatusRows(data || []);
}

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
  const { data: botRows } = await supabase.from("yps_chat_bots").select("bot_name, status").eq("status", "approved");
  const bots = (botRows || []).map((b) => b.bot_name);
  $("chat-avatars").innerHTML = [...list.map((m) => m.display_name), "Shoppie", ...bots].map((n) => `<span class="avatar" title="${esc(n)}" style="background:${colorFor(n)}">${n === "Shoppie" || bots.includes(n) ? "🤖" : esc(initials(n))}</span>`).join("");
  $("chat-members").innerHTML = list.map((m) => `<li><b>${esc(m.display_name)}</b> <span class="muted">${esc(m.email)} · ${m.role}</span></li>`).join("")
    + `<li><b>Shoppie</b> <span class="muted">bot · replies via webhook</span></li>`
    + bots.map((n) => `<li><b>${esc(n)}</b> <span class="muted">bot · approved</span></li>`).join("");
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
  loadBots();
  loadMode();
  stopChat();
  loadBotStatuses();
  channel = supabase.channel("yps-chat", { config: { presence: { key: user.user.id } } })
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "yps_chat_messages" }, ({ new: m }) => {
      if (!messages.some((x) => x.id === m.id)) { messages.push(m); render(); }
      if (m.is_bot && m.sender_name) {
        botStatuses.delete(m.sender_name);
        renderTypingBar();
      }
    })
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "yps_chat_messages" }, ({ old }) => {
      messages = messages.filter((x) => x.id !== old.id); render();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "yps_chat_bot_status" }, () => {
      loadBotStatuses();
    })
    .on("presence", { event: "sync" }, () => syncPresenceTyping())
    .on("presence", { event: "join" }, () => syncPresenceTyping())
    .on("presence", { event: "leave" }, () => syncPresenceTyping())
    .subscribe(async (status) => {
      const on = status === "SUBSCRIBED";
      $("live-dot").classList.toggle("on", on);
      $("live-text").textContent = on ? "Live" : status === "CHANNEL_ERROR" ? "Reconnecting…" : "Connecting…";
      if (on) {
        try { await channel.track({ user_id: user.user.id, name: user.displayName, typing: false, at: Date.now() }); } catch (_) {}
        syncPresenceTyping();
      }
    });
  clearInterval(botStatusPoll);
  botStatusPoll = setInterval(() => renderTypingBar(), 15000);
}

export function stopChat() {
  clearTimeout(typingExpireTimer);
  clearInterval(botStatusPoll);
  botStatusPoll = null;
  myTyping = false;
  typingNames = new Set();
  botStatuses = new Map();
  renderTypingBar();
  if (channel) { supabase.removeChannel(channel); channel = null; }
}

async function send() {
  const ta = $("chat-input");
  const body = ta.value.trim();
  if (!body || !me) return;
  ta.value = ""; ta.style.height = "";
  clearTimeout(typingExpireTimer);
  await setMyTyping(false);
  const { data, error } = await supabase.from("yps_chat_messages")
    .insert({ user_id: me.user.id, sender_email: me.email, sender_name: me.displayName, body })
    .select().single();
  if (error) { ta.value = body; alert(`Message not sent: ${error.message}`); return; }
  if (!messages.some((x) => x.id === data.id)) { messages.push(data); render.first = true; render(); }
}

$("chat-form").addEventListener("submit", (e) => { e.preventDefault(); send(); });
$("chat-input").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
$("chat-input").addEventListener("input", (e) => {
  const t = e.target;
  t.style.height = "auto";
  t.style.height = Math.min(t.scrollHeight, 140) + "px";
  if (t.value.trim()) bumpMyTyping();
  else { clearTimeout(typingExpireTimer); setMyTyping(false); }
});
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

function genTempPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

function syncTempUi() {
  const on = !!$("admin-use-temp")?.checked;
  const wrap = $("admin-temp-wrap");
  const submit = $("admin-invite-submit");
  const pass = $("admin-temp-password");
  if (wrap) wrap.hidden = !on;
  if (pass) pass.required = on;
  if (submit) submit.textContent = on ? "Create admin with temp password" : "Send admin invite";
  if (on && pass && !pass.value) pass.value = genTempPassword();
}

$("admin-use-temp")?.addEventListener("change", syncTempUi);
$("admin-temp-generate")?.addEventListener("click", () => {
  const pass = $("admin-temp-password");
  if (pass) pass.value = genTempPassword();
});
$("admin-temp-copy")?.addEventListener("click", async () => {
  const pass = $("admin-temp-password");
  const out = $("admin-invite-msg");
  if (!pass?.value) return;
  try {
    await navigator.clipboard.writeText(pass.value);
    if (out) out.textContent = "Temporary password copied.";
  } catch {
    pass.select();
    if (out) out.textContent = "Copy failed — select and copy manually.";
  }
});

$("admin-invite-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const out = $("admin-invite-msg");
  const useTemp = !!fd.get("use_temp");
  const temp = String(fd.get("temp_password") || "");
  out.textContent = useTemp ? "Creating admin…" : "Sending admin invite…";
  try {
    const payload = { action: "invite", email: fd.get("email"), name: fd.get("name"), role: "admin" };
    if (useTemp) {
      if (temp.length < 8) throw new Error("Temporary password must be at least 8 characters.");
      payload.temp_password = temp;
    }
    const body = await callInvite(payload);
    out.textContent = useTemp
      ? `${body.message || "Admin created."} Temporary password: ${temp}`
      : (body.message || "Admin invite sent.");
    // Keep temp password visible; clear only email/name if temp mode
    if (useTemp) {
      e.target.email.value = "";
      e.target.name.value = "";
    } else {
      e.target.reset();
      syncTempUi();
    }
    loadMembers();
    loadAdmins();
  } catch (err) {
    out.textContent = err.message;
  }
});
syncTempUi();

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


async function callBotAdmin(payload) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Sign in required.");
  const res = await fetch(CONFIG.botAdminUrl, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || body.message || res.statusText);
  return body;
}

function webhookHost(u) {
  try { return new URL(u).host; } catch { return ""; }
}

async function loadBots() {
  const pending = $("bot-pending-list");
  const approved = $("bot-approved-list");
  if (!pending || !approved) return;
  try {
    const data = await callBotAdmin({ action: "list" });
    const bots = data.bots || [];
    const pend = bots.filter((b) => b.status === "pending");
    const appr = bots.filter((b) => b.status === "approved");
    pending.innerHTML = pend.length ? pend.map((b) => `
      <li class="admin-row bot-row" data-id="${esc(b.id)}">
        <div>
          <b>${esc(b.bot_name)}</b>
          <span class="muted">${esc(b.owner_contact)} · ${esc(b.webhook_host || webhookHost(b.webhook_url))}</span>
          ${b.note ? `<span class="muted">${esc(b.note)}</span>` : ""}
          <span class="muted">${esc(new Date(b.created_at).toLocaleString())}</span>
        </div>
        <div class="bot-actions">
          <button type="button" class="btn btn-primary btn-sm bot-approve">Approve</button>
          <button type="button" class="btn btn-ghost btn-sm bot-deny">Deny</button>
        </div>
      </li>`).join("") : `<li class="muted">No pending bot requests.</li>`;
    approved.innerHTML = appr.length ? appr.map((b) => `
      <li class="admin-row bot-row" data-id="${esc(b.id)}">
        <div>
          <b>${esc(b.bot_name)}</b>
          <span class="muted">${esc(b.owner_contact)} · ${esc(b.webhook_host || webhookHost(b.webhook_url))}</span>
          <label class="muted">Notify
            <select class="bot-mode">
              <option value="mention" ${b.notify_mode === "mention" ? "selected" : ""}>@mention only</option>
              <option value="all" ${b.notify_mode === "all" ? "selected" : ""}>All messages</option>
            </select>
          </label>
        </div>
        <div class="bot-actions">
          <button type="button" class="btn btn-ghost btn-sm bot-revoke">Revoke</button>
        </div>
      </li>`).join("") : `<li class="muted">No approved bots yet.</li>`;
  } catch (err) {
    pending.innerHTML = `<li class="muted">${esc(err.message)}</li>`;
    approved.innerHTML = "";
  }
}

document.getElementById("owner-tools")?.addEventListener("click", async (e) => {
  const row = e.target.closest(".bot-row");
  if (!row) return;
  const id = row.dataset.id;
  try {
    if (e.target.classList.contains("bot-approve")) {
      if (!confirm("Approve this bot to join the team chat?")) return;
      const body = await callBotAdmin({ action: "approve", id });
      alert(body.message || "Approved.");
      loadBots(); loadMembers();
    } else if (e.target.classList.contains("bot-deny")) {
      if (!confirm("Deny this bot join request?")) return;
      await callBotAdmin({ action: "deny", id });
      loadBots();
    } else if (e.target.classList.contains("bot-revoke")) {
      if (!confirm("Revoke this bot? It will stop receiving messages and cannot post.")) return;
      await callBotAdmin({ action: "revoke", id });
      loadBots(); loadMembers();
    }
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById("owner-tools")?.addEventListener("change", async (e) => {
  if (!e.target.classList.contains("bot-mode")) return;
  const row = e.target.closest(".bot-row");
  if (!row) return;
  try {
    await callBotAdmin({ action: "set_mode", id: row.dataset.id, notify_mode: e.target.value });
    loadBots();
  } catch (err) {
    alert(err.message);
    loadBots();
  }
});
