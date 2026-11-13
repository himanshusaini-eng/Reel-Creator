import { $, api, mountAccount, escapeHtml } from "/site.js";
import { notify } from "/notify.js";
import { track } from "/analytics.js";

await mountAccount();

const money = (cents) => cents == null ? "" : (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 ? 2 : 0 });

let interval = "month";
let plans = [];
let current = null;

function render() {
  $("currentPlan").textContent = current.planId;
  $("currentMeta").textContent = current.planId === "free"
    ? "Free includes one project and watermarked 720p exports."
    : `${current.status} · ${current.interval} · ${current.renewal === "cancels" ? "Cancels" : "Renews"} ${current.currentPeriodEnd ? new Date(current.currentPeriodEnd).toLocaleDateString() : ""}`;
  $("resume").hidden = !current.cancelAtPeriodEnd;
  $("cancel").hidden = current.planId === "free";
  $("plans").innerHTML = plans.map((plan) => {
    const price = interval === "year" ? plan.yearlyMonthlyCents : plan.monthlyCents;
    const note = plan.checkout === "contact"
      ? (plan.fromSeatCents ? `From ${money(plan.fromSeatCents)} / seat` : "Talk to us")
      : plan.id === "free"
        ? "Included"
        : `${money(price)}/mo${interval === "year" && plan.yearlyChargeCents ? ` · ${money(plan.yearlyChargeCents)} yearly` : ""}`;
    const label = plan.id === current.planId ? "Current plan" : plan.checkout === "contact" ? "Contact sales" : plan.id === "free" ? "Downgrade" : "Choose";
    return `<article class="plan-row">
      <div><strong>${escapeHtml(plan.name)}</strong><span>${escapeHtml(plan.tagline)}</span><span>${escapeHtml(note)}</span></div>
      <button class="btn sm ${plan.id === "pro" ? "primary" : ""}" type="button" data-plan="${plan.id}" ${plan.id === current.planId && !current.cancelAtPeriodEnd ? "disabled" : ""}>${label}</button>
    </article>`;
  }).join("");
}

async function load() {
  [plans, current] = await Promise.all([api("/api/billing/plans"), api("/api/billing/subscription")]);
  const invoices = await api("/api/billing/invoices");
  $("invoices").innerHTML = invoices.length
    ? invoices.map((invoice) => `<div class="invoice-row"><div><strong>${escapeHtml(invoice.number)}</strong><span>${escapeHtml(invoice.description)}</span></div><span>${money(invoice.amountCents)} · ${escapeHtml(invoice.status)}</span></div>`).join("")
    : "<p>No invoices yet.</p>";
  render();
}

$("interval").addEventListener("change", () => {
  interval = $("interval").value;
  render();
});

$("plans").addEventListener("click", async (event) => {
  const planId = event.target?.dataset?.plan;
  if (!planId) return;
  track("subscription_click", { plan: planId, interval });
  try {
    const result = await api("/api/billing/change", { method: "POST", body: JSON.stringify({ planId, interval }) });
    if (result.kind === "scheduled") {
      notify({ kind: "success", title: "Plan change scheduled", message: "It applies at the end of this period." });
      await load();
      return;
    }
    const checkout = result.checkout || result;
    if (checkout.status === "contact" && (result.url || checkout.url)) {
      location.href = result.url || `/contact?topic=${planId}`;
      return;
    }
    if (checkout.id) location.href = `/app/billing/result?session=${checkout.id}`;
  } catch (error) {
    notify({ kind: "error", title: "Couldn’t change plan", message: error.message });
  }
});

$("cancel").addEventListener("click", async () => {
  try {
    await api("/api/billing/cancel", { method: "POST", body: "{}" });
    notify({ kind: "success", title: "Cancellation scheduled" });
    await load();
  } catch (error) {
    notify({ kind: "error", title: "Couldn’t cancel", message: error.message });
  }
});

$("resume").addEventListener("click", async () => {
  try {
    await api("/api/billing/resume", { method: "POST", body: "{}" });
    notify({ kind: "success", title: "Subscription resumed" });
    await load();
  } catch (error) {
    notify({ kind: "error", title: "Couldn’t resume", message: error.message });
  }
});

load().catch((error) => notify({ kind: "error", title: "Billing unavailable", message: error.message }));
