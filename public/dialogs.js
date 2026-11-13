/**
 * Premium modal dialogs — replaces alert / confirm / prompt.
 * Usage:
 *   await confirmDialog({ title, message, confirmLabel, danger? })
 *   await promptDialog({ title, message, value, placeholder, confirmLabel })
 *   await noticeDialog({ title, message, kind: "success"|"error"|"info", confirmLabel })
 */

function ensureRoot() {
  let root = document.getElementById("rc-dialog-root");
  if (root) return root;
  root = document.createElement("div");
  root.id = "rc-dialog-root";
  document.body.appendChild(root);
  return root;
}

function trapFocus(dialog) {
  const focusable = [...dialog.querySelectorAll("button, [href], input, textarea, select, [tabindex]:not([tabindex='-1'])")].filter(
    (el) => !el.disabled && el.offsetParent !== null,
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  first?.focus();
  const onKey = (e) => {
    if (e.key !== "Tab" || !focusable.length) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  dialog.addEventListener("keydown", onKey);
  return () => dialog.removeEventListener("keydown", onKey);
}

function openDialog({
  title,
  message = "",
  kind = "info",
  confirmLabel = "Continue",
  cancelLabel = "Cancel",
  showCancel = true,
  danger = false,
  input = null,
}) {
  return new Promise((resolve) => {
    const root = ensureRoot();
    const overlay = document.createElement("div");
    overlay.className = "rc-modal-overlay";
    overlay.setAttribute("role", "presentation");

    const inputHtml = input
      ? `<label class="rc-modal-field"><span class="rc-modal-field-label">${input.label || "Name"}</span>
          <input class="input rc-modal-input" id="rcModalInput" type="text" value="${escapeAttr(input.value || "")}" placeholder="${escapeAttr(input.placeholder || "")}" autocomplete="off">
        </label>`
      : "";

    overlay.innerHTML = `
      <div class="rc-modal rc-modal-${kind}" role="dialog" aria-modal="true" aria-labelledby="rcModalTitle" aria-describedby="rcModalDesc">
        <div class="rc-modal-icon" aria-hidden="true">${iconFor(kind, danger)}</div>
        <h2 id="rcModalTitle">${escapeHtml(title)}</h2>
        <p id="rcModalDesc" class="rc-modal-message">${escapeHtml(message)}</p>
        ${inputHtml}
        <div class="rc-modal-actions">
          ${showCancel ? `<button type="button" class="btn ghost" data-rc="cancel">${escapeHtml(cancelLabel)}</button>` : ""}
          <button type="button" class="btn ${danger ? "danger-fill" : "primary"}" data-rc="confirm">${escapeHtml(confirmLabel)}</button>
        </div>
      </div>`;

    root.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("is-open"));

    const dialog = overlay.querySelector(".rc-modal");
    const inputEl = overlay.querySelector("#rcModalInput");
    const releaseTrap = trapFocus(dialog);

    const close = (value) => {
      releaseTrap();
      overlay.classList.remove("is-open");
      window.setTimeout(() => overlay.remove(), 180);
      document.removeEventListener("keydown", onEsc);
      resolve(value);
    };

    const onEsc = (e) => {
      if (e.key === "Escape") close(input ? null : false);
    };
    document.addEventListener("keydown", onEsc);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close(input ? null : false);
    });
    overlay.querySelector('[data-rc="cancel"]')?.addEventListener("click", () => close(input ? null : false));
    overlay.querySelector('[data-rc="confirm"]')?.addEventListener("click", () => {
      if (input) {
        const v = inputEl?.value?.trim() || "";
        if (!v) {
          inputEl?.focus();
          inputEl?.classList.add("is-invalid");
          return;
        }
        close(v);
      } else {
        close(true);
      }
    });

    if (inputEl) {
      inputEl.focus();
      inputEl.select();
      inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") overlay.querySelector('[data-rc="confirm"]')?.click();
      });
    }
  });
}

function iconFor(kind, danger) {
  if (danger || kind === "error") {
    return `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.6"/><path d="M12 7v6M12 16.5v.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  }
  if (kind === "success") {
    return `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.6"/><path d="m8 12.5 2.5 2.5L16 9.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.6"/><path d="M12 8v.5M12 11v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/`/g, "&#96;");
}

export function confirmDialog(opts) {
  return openDialog({
    title: opts.title || "Are you sure?",
    message: opts.message || "",
    confirmLabel: opts.confirmLabel || "Confirm",
    cancelLabel: opts.cancelLabel || "Cancel",
    showCancel: true,
    danger: !!opts.danger,
    kind: opts.danger ? "error" : "info",
  });
}

export function promptDialog(opts) {
  return openDialog({
    title: opts.title || "Rename",
    message: opts.message || "",
    confirmLabel: opts.confirmLabel || "Save",
    cancelLabel: opts.cancelLabel || "Cancel",
    showCancel: true,
    kind: "info",
    input: {
      label: opts.label || "Name",
      value: opts.value || "",
      placeholder: opts.placeholder || "",
    },
  });
}

export function noticeDialog(opts) {
  return openDialog({
    title: opts.title || "Notice",
    message: opts.message || "",
    confirmLabel: opts.confirmLabel || "Got it",
    showCancel: false,
    kind: opts.kind || "info",
    danger: opts.kind === "error",
  });
}

export function friendlyError(err) {
  const raw = typeof err === "string" ? err : err?.message || "Something went wrong";
  if (/network|fetch|failed to fetch/i.test(raw)) {
    return "We couldn’t reach the server. Check your connection and try again.";
  }
  if (/sign in|unauthorized|401/i.test(raw)) {
    return "Your session expired. Please sign in again.";
  }
  if (/render failed|timeout/i.test(raw)) {
    return "We couldn’t finish exporting your reel this time. Please try again.";
  }
  return raw;
}
