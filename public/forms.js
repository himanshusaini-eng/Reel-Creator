import { api } from "/site.js";
import { notify } from "/notify.js";

for (const form of document.querySelectorAll("[data-support]")) {
  const params = new URLSearchParams(location.search);
  const topic = form.querySelector("[name=topic]");
  if (topic && params.get("topic")) topic.value = params.get("topic");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const button = form.querySelector("[type=submit]");
    button.disabled = true;
    try {
      await api(`/api/support/${form.dataset.support}`, { method: "POST", body: JSON.stringify(data) });
      form.reset();
      notify({ kind: "success", title: "Message sent", message: "We’ll reply by email." });
    } catch (error) {
      notify({ kind: "error", title: "Message not sent", message: error.message });
    } finally {
      button.disabled = false;
    }
  });
}

fetch("/api/auth/me").then((res) => (res.ok ? res.json() : null)).then((me) => {
  if (!me) return;
  for (const form of document.querySelectorAll("[data-support]")) {
    const email = form.querySelector("[name=email]");
    const name = form.querySelector("[name=name]");
    if (email && !email.value) email.value = me.email;
    if (name && !name.value) name.value = me.name;
  }
}).catch(() => {});

