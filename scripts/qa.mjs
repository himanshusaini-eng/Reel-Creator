const base = process.env.QA_BASE || "http://127.0.0.1:3847";
const email = `qa+${Date.now()}@example.com`;
let cookie = "";
let failed = 0;

function fail(message) {
  failed += 1;
  console.error("FAIL", message);
}

function ok(message) {
  console.log("ok", message);
}

async function send(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (cookie) headers.cookie = cookie;
  const res = await fetch(base + path, { ...options, headers, redirect: "manual" });
  const set = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [res.headers.get("set-cookie") || ""];
  const match = set.join(";").match(/rc_session=([^;]+)/);
  if (match && match[1]) cookie = `rc_session=${match[1]}`;
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* html */ }
  return { status: res.status, text, json, headers: res.headers };
}

try {
  const home = await send("/");
  if (home.status !== 200 || /lorem ipsum/i.test(home.text)) fail("landing");
  else ok("landing");
  if (!home.headers.get("x-content-type-options")) fail("security header");
  else ok("security header");

  const privacy = await send("/privacy");
  if (privacy.status !== 200 || !privacy.text.includes("Privacy Policy") || /will grow into a full policy/i.test(privacy.text)) fail("privacy");
  else ok("privacy");

  for (const path of ["/terms", "/cookies", "/refunds", "/help", "/faq", "/contact", "/guidelines", "/changelog", "/shortcuts", "/support"]) {
    const page = await send(path);
    if (page.status !== 200) fail(path);
    else ok(path);
  }

  const robots = await send("/robots.txt");
  if (robots.status !== 200 || !robots.text.includes("Sitemap:")) fail("robots");
  else ok("robots");

  const missing = await send("/this-page-is-not-real");
  if (missing.status !== 404) fail("404");
  else ok("404");

  const crash = await send("/500");
  if (crash.status !== 500) fail("500");
  else ok("500");

  const plans = await send("/api/billing/plans");
  const ids = (plans.json || []).map((plan) => plan.id).join(",");
  if (plans.status !== 200 || ids !== "free,pro,team,enterprise") fail("plans " + ids);
  else ok("plans");

  const signup = await send("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "QA User", email, password: "correct-horse" }),
  });
  if (signup.status !== 201 || !cookie) fail("signup");
  else ok("signup");

  const me = await send("/api/auth/me");
  if (me.status !== 200 || me.json?.email !== email) fail("me");
  else ok("me");

  const prefs = await send("/api/account/preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ theme: "dark", notifications: { product: true } }),
  });
  if (prefs.status !== 200) fail("preferences");
  else ok("preferences");

  const templates = await send("/api/templates");
  const templateId = templates.json?.[0]?.id;
  if (!templateId) fail("templates");
  const existing = await send("/api/projects");
  const before = Array.isArray(existing.json) ? existing.json.length : 0;
  const created = await send("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ templateId, name: "QA reel" }),
  });
  if (before === 0 && created.status !== 201) fail("create project " + created.text);
  else if (before > 0 && created.status !== 400 && created.status !== 201) fail("create project " + created.text);
  else ok("create project");

  const limited = await send("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ templateId, name: "Second reel" }),
  });
  if (limited.status !== 400) fail("free limit");
  else ok("free limit");

  const checkout = await send("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planId: "pro", interval: "month" }),
  });
  const session = checkout.json?.checkout?.id;
  if (!session) fail("checkout " + checkout.text);
  else ok("checkout");

  const done = await send(`/api/billing/checkout/${session}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  if (done.status !== 201 && done.status !== 200) fail("complete " + done.text);
  else if (done.json?.subscription?.planId !== "pro") fail("plan not pro");
  else ok("upgrade");

  const invoices = await send("/api/billing/invoices");
  if (!Array.isArray(invoices.json) || !invoices.json.length) fail("invoices");
  else ok("invoices");

  const canceled = await send("/api/billing/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  if (!canceled.json?.cancelAtPeriodEnd) fail("cancel");
  else ok("cancel");

  const resumed = await send("/api/billing/resume", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  if (resumed.json?.cancelAtPeriodEnd) fail("resume");
  else ok("resume");

  const forgot = await send("/api/auth/forgot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (forgot.status !== 200 || !forgot.json?.ok) fail("forgot");
  else ok("forgot");

  const support = await send("/api/support/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "QA", email, topic: "general", message: "Checking the contact form." }),
  });
  if (support.status !== 200) fail("support");
  else ok("support");

  const analytics = await send("/api/analytics/collect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: "signup", props: { method: "qa" }, path: "/qa" }),
  });
  if (analytics.status !== 204) fail("analytics");
  else ok("analytics");

  const removed = await send("/api/account/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "correct-horse", confirm: "DELETE" }),
  });
  if (removed.status !== 204) fail("delete " + removed.text);
  else ok("delete account");
} catch (error) {
  fail(error.message);
}

if (failed) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
console.log("QA passed");
