function escapeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function region() {
  let root = document.querySelector(".toast-region");
  if (root) return root;
  root = document.createElement("div");
  root.className = "toast-region";
  root.setAttribute("aria-live", "polite");
  root.setAttribute("aria-relevant", "additions");
  document.body.appendChild(root);
  return root;
}

export function dismiss(id) {
  document.querySelector(`.toast[data-id="${CSS.escape(id)}"]`)?.remove();
}

/** Non-blocking notice. Pass `id` and `progress` to update a long-running task. */
export function notify({ kind = "info", title, message = "", timeout = 4200, id, progress }) {
  const root = region();
  let el = id ? root.querySelector(`[data-id="${CSS.escape(id)}"]`) : null;
  if (!el) {
    el = document.createElement("div");
    if (id) el.dataset.id = id;
    root.appendChild(el);
  }
  el.className = `toast toast-${kind}`;
  el.setAttribute("role", kind === "error" ? "alert" : "status");
  const bar = typeof progress === "number"
    ? `<div class="toast-bar" aria-hidden="true"><i style="width:${Math.max(0, Math.min(100, progress))}%"></i></div>`
    : "";
  el.innerHTML = `<div><strong>${escapeText(title || "")}</strong>${message ? `<span>${escapeText(message)}</span>` : ""}</div>${bar}<button type="button" class="toast-x" aria-label="Dismiss notification">×</button>`;
  el.querySelector(".toast-x")?.addEventListener("click", () => el.remove());
  clearTimeout(el._timer);
  if (timeout && typeof progress !== "number") el._timer = setTimeout(() => el.remove(), timeout);
  else if (timeout && progress >= 100) el._timer = setTimeout(() => el.remove(), timeout);
}
