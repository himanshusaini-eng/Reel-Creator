import { api } from "/site.js";
import { notify } from "/notify.js";

const params = new URLSearchParams(location.search);
const sessionId = params.get("session");
const title = document.getElementById("title");
const copy = document.getElementById("copy");
const actions = document.getElementById("actions");

function show(heading, message, buttons) {
  title.textContent = heading;
  copy.textContent = message;
  actions.innerHTML = buttons;
}

if (!sessionId) {
  show("Billing", "Choose a plan from the billing page.", `<a class="btn primary" href="/app/billing">Back to billing</a>`);
} else {
  const session = await api(`/api/billing/checkout/${sessionId}`).catch((error) => {
    show("Checkout unavailable", error.message, `<a class="btn primary" href="/app/billing">Back to billing</a>`);
    return null;
  });
  if (session?.status === "completed") {
    show("Plan updated", "Your plan is active. No card was charged in manual billing.", `<a class="btn primary" href="/app/billing">View billing</a>`);
  } else if (session?.status === "failed") {
    show("Payment didn’t go through", "Nothing was charged. You can try the upgrade again.", `<a class="btn primary" href="/app/billing">Try again</a>`);
  } else if (session?.status === "awaiting_provider") {
    show("Payments aren’t connected yet", "Your upgrade is saved. It will finish when a payment processor is connected. No card was charged.", `<a class="btn primary" href="/app/billing">Back to billing</a>`);
  } else if (session?.status === "open") {
    show("Confirm this plan change", "Manual billing records the change and does not charge a card.", `
      <button class="btn primary" id="confirm" type="button">Confirm plan</button>
      <button class="btn ghost" id="fail" type="button">Mark as failed</button>`);
    document.getElementById("confirm")?.addEventListener("click", async () => {
      try {
        await api(`/api/billing/checkout/${sessionId}/complete`, { method: "POST", body: "{}" });
        notify({ kind: "success", title: "Plan updated" });
        show("Plan updated", "Your plan is active. No card was charged.", `<a class="btn primary" href="/app/billing">View billing</a>`);
      } catch (error) {
        notify({ kind: "error", title: "Couldn’t confirm", message: error.message });
      }
    });
    document.getElementById("fail")?.addEventListener("click", async () => {
      await api(`/api/billing/checkout/${sessionId}/fail`, { method: "POST", body: "{}" });
      show("Payment didn’t go through", "Nothing was charged. You can try the upgrade again.", `<a class="btn primary" href="/app/billing">Try again</a>`);
    });
  } else if (session) {
    show("Checkout closed", "This checkout can no longer be changed.", `<a class="btn primary" href="/app/billing">Back to billing</a>`);
  }
}
