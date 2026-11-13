/** Helpers shared by the landing, auth, home and new-project pages. */
import "/boot.js";
import { identify, track } from "/analytics.js";

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
    const message = err.error || res.statusText;
    track("error", { area: "api", status: res.status });
    throw new Error(message);
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
  const who = $("who");
  if (who) who.textContent = me.name;
  const signOut = $("btnSignOut");
  if (signOut) {
    signOut.addEventListener("click", async () => {
      await api("/api/auth/signout", { method: "POST" });
      location.href = "/";
    });
  }
  identify(me.id);
  return me;
}

/** Soft offline banner for product pages. */
export function mountOfflineBanner() {
  const id = "rc-offline-banner";
  const sync = () => {
    let el = document.getElementById(id);
    if (navigator.onLine) {
      el?.remove();
      return;
    }
    if (!el) {
      el = document.createElement("div");
      el.id = id;
      el.setAttribute("role", "status");
      el.style.cssText =
        "position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:9999;padding:10px 16px;border-radius:999px;background:#1a1a1a;border:1px solid rgba(255,255,255,.12);color:#f5f6f8;font:650 13px Satoshi,system-ui,sans-serif;box-shadow:0 12px 32px rgba(0,0,0,.4)";
      el.innerHTML =
        'You’re offline. <button type="button" style="margin-left:10px;color:#c4baff;background:none;border:0;font:inherit;font-weight:700;cursor:pointer">Retry</button>';
      el.querySelector("button")?.addEventListener("click", () => location.reload());
      document.body.appendChild(el);
    }
  };
  window.addEventListener("online", sync);
  window.addEventListener("offline", sync);
  sync();
}
