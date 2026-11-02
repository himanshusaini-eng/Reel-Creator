/** Helpers shared by the landing, auth, home and new-project pages. */

export const $ = (id) => document.getElementById(id);

export async function api(path, opts = {}) {
  const isForm = opts.body instanceof FormData;
  const res = await fetch(path, {
    ...opts,
    headers: isForm ? opts.headers : { "Content-Type": "application/json", ...opts.headers },
  });
  if (res.status === 401 && !path.startsWith("/api/auth/")) {
    location.href = `/signin?next=${encodeURIComponent(location.pathname)}`;
    throw new Error("Sign in required");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }
  if (res.status === 204) return null;
  return res.json();
}

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function timeAgo(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (!Number.isFinite(s)) return "";
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** Header greeting + sign-out for signed-in pages. */
export async function mountAccount() {
  const me = await api("/api/auth/me");
  $("who").textContent = me.name;
  $("btnSignOut").addEventListener("click", async () => {
    await api("/api/auth/signout", { method: "POST" });
    location.href = "/";
  });
  return me;
}
