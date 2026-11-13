import { $, api, escapeHtml, mountAccount } from "/site.js";
import { notify } from "/notify.js";
import { confirmDialog } from "/dialogs.js";

const me = await mountAccount();
const avatar = $("avatar");
const name = $("name");
const email = $("email");
name.value = me.name;
email.value = me.email;
if (me.avatarUrl) avatar.src = me.avatarUrl;
$("planLabel").textContent = me.plan;
$("pending").textContent = me.pendingEmail ? `Confirmation sent to ${me.pendingEmail}.` : me.emailVerified ? "Email confirmed." : "Email not confirmed yet.";
$("theme").value = me.preferences.theme;
$("language").value = me.preferences.language;
for (const key of ["product", "billing", "marketing", "exportReady"]) {
  const box = document.querySelector(`[name="notify-${key}"]`);
  if (box) box.checked = Boolean(me.preferences.notifications[key]);
}
for (const key of ["analytics", "crashReports"]) {
  const box = document.querySelector(`[name="privacy-${key}"]`);
  if (box) box.checked = Boolean(me.preferences.privacy[key]);
}

async function save(path, options, ok) {
  try {
    const result = await api(path, options);
    notify({ kind: "success", title: ok });
    return result === null ? { ok: true } : result;
  } catch (error) {
    notify({ kind: "error", title: "Couldn’t save", message: error.message });
    return null;
  }
}

$("profileForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const updated = await save("/api/account/profile", { method: "PATCH", body: JSON.stringify({ name: name.value }) }, "Profile saved");
  if (updated?.name) $("who").textContent = updated.name;
});

$("avatarInput").addEventListener("change", async () => {
  const file = $("avatarInput").files?.[0];
  if (!file) return;
  const body = new FormData();
  body.append("file", file);
  const updated = await save("/api/account/avatar", { method: "POST", body }, "Photo updated");
  if (updated?.avatarUrl) avatar.src = `${updated.avatarUrl}?t=${Date.now()}`;
});

$("clearAvatar").addEventListener("click", async () => {
  const updated = await save("/api/account/avatar", { method: "DELETE" }, "Photo removed");
  if (updated) avatar.removeAttribute("src");
});

$("passwordForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const next = $("nextPassword").value;
  if (next !== $("confirmPassword").value) {
    notify({ kind: "warning", title: "Passwords don’t match" });
    return;
  }
  const saved = await save("/api/account/password", {
    method: "POST",
    body: JSON.stringify({ current: $("currentPassword").value, next }),
  }, "Password updated. Other sessions were signed out.");
  if (saved) event.target.reset();
});

$("emailForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const updated = await save("/api/account/email", {
    method: "POST",
    body: JSON.stringify({ email: $("nextEmail").value, password: $("emailPassword").value }),
  }, "Check the new inbox to confirm");
  if (updated?.pendingEmail) $("pending").textContent = `Confirmation sent to ${updated.pendingEmail}.`;
});

$("resend").addEventListener("click", async () => {
  await save("/api/auth/resend-verification", { method: "POST", body: "{}" }, "Verification email sent");
});

function prefsBody() {
  return {
    theme: $("theme").value,
    language: "en",
    notifications: {
      product: document.querySelector('[name="notify-product"]').checked,
      billing: document.querySelector('[name="notify-billing"]').checked,
      marketing: document.querySelector('[name="notify-marketing"]').checked,
      exportReady: document.querySelector('[name="notify-exportReady"]').checked,
    },
    privacy: {
      analytics: document.querySelector('[name="privacy-analytics"]').checked,
      crashReports: document.querySelector('[name="privacy-crashReports"]').checked,
    },
  };
}

$("prefsForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = prefsBody();
  localStorage.setItem("rc_theme", body.theme);
  document.documentElement.dataset.theme = body.theme === "system" ? "system" : "dark";
  window.__rcNoAnalytics = body.privacy.analytics === false;
  window.__rcNoCrash = body.privacy.crashReports === false;
  await save("/api/account/preferences", { method: "PATCH", body: JSON.stringify(body) }, "Preferences saved");
});

async function loadSessions() {
  const sessions = await api("/api/account/sessions");
  $("sessions").innerHTML = sessions.map((session) => `
    <div class="session-row">
      <div><strong>${session.current ? "This device" : "Other session"}</strong><span>${escapeHtml(session.userAgent)}</span></div>
      <button class="btn sm ghost" type="button" data-revoke="${session.id}" ${session.current ? "disabled" : ""}>${session.current ? "Current" : "Sign out"}</button>
    </div>`).join("") || "<p>No other sessions.</p>";
}

$("sessions").addEventListener("click", async (event) => {
  const id = event.target?.dataset?.revoke;
  if (!id) return;
  await api(`/api/account/sessions/${id}`, { method: "DELETE" });
  notify({ kind: "success", title: "Session signed out" });
  loadSessions();
});

$("revokeOthers").addEventListener("click", async () => {
  await api("/api/account/sessions/revoke-others", { method: "POST", body: "{}" });
  notify({ kind: "success", title: "Other sessions signed out" });
  loadSessions();
});

$("exportData").addEventListener("click", async () => {
  const data = await api("/api/account/export");
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "reel-creator-data.json";
  link.click();
  URL.revokeObjectURL(url);
  notify({ kind: "success", title: "Download started" });
});

$("deleteForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const ok = await confirmDialog({
    title: "Delete your account?",
    message: "Projects in the studio are removed. Exports you already downloaded stay on your device.",
    confirmLabel: "Delete account",
    danger: true,
  });
  if (!ok) return;
  try {
    await api("/api/account/delete", {
      method: "POST",
      body: JSON.stringify({ password: $("deletePassword").value, confirm: $("deleteConfirm").value }),
    });
    location.href = "/";
  } catch (error) {
    notify({ kind: "error", title: "Account not deleted", message: error.message });
  }
});

const connections = await api("/api/account/connections");
$("connections").innerHTML = connections.map((item) => `
  <div class="session-row">
    <div><strong>${item.name}</strong><span>${item.connected ? "Connected" : "Not connected"}</span></div>
    <button class="btn sm ghost" type="button" disabled>Coming soon</button>
  </div>`).join("");

loadSessions().catch((error) => notify({ kind: "error", title: "Couldn’t load sessions", message: error.message }));
