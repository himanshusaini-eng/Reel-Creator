import { identify, track } from "/analytics.js";

const CONSENT = "rc_consent";

function loadScript(src) {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

async function loadProviders(cfg) {
  if (!cfg || localStorage.getItem(CONSENT) !== "all") return;
  const analytics = cfg.analytics || {};
  if (analytics.ga) {
    await loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(analytics.ga)}`);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", analytics.ga, { anonymize_ip: true });
  }
  if (analytics.posthogKey) {
    window.posthog = window.posthog || { _i: [], capture() {}, init() {} };
    await loadScript(`${analytics.posthogHost || "https://us.i.posthog.com"}/static/array.js`);
    window.posthog?.init?.(analytics.posthogKey, { api_host: analytics.posthogHost || "https://us.i.posthog.com", persistence: "memory" });
  }
  if (analytics.plausibleDomain) {
    const script = document.createElement("script");
    script.defer = true;
    script.dataset.domain = analytics.plausibleDomain;
    script.src = "https://plausible.io/js/script.js";
    document.head.appendChild(script);
  }
  if (analytics.mixpanelToken) {
    await loadScript("https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js");
    window.mixpanel?.init?.(analytics.mixpanelToken, { ip: false });
  }
  if (analytics.clarityId) {
    await loadScript(`https://www.clarity.ms/tag/${encodeURIComponent(analytics.clarityId)}`);
  }
  const monitor = cfg.monitor || {};
  if (monitor.sentryDsn && !window.__rcNoCrash) {
    await loadScript("https://browser.sentry-cdn.com/8.47.0/bundle.min.js");
    window.Sentry?.init?.({ dsn: monitor.sentryDsn, sendDefaultPii: false });
  }
  if (monitor.logrocketId && !window.__rcNoCrash) {
    await loadScript("https://cdn.logrocket.io/LogRocket.min.js");
    window.LogRocket?.init?.(monitor.logrocketId);
  }
}

function report(kind, message) {
  if (window.__rcNoCrash) return;
  const text = String(message || "").slice(0, 500);
  if (!text) return;
  fetch("/api/monitor/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, message: text, path: location.pathname }),
    keepalive: true,
  }).catch(() => {});
}

function mountCookieBanner() {
  if (localStorage.getItem(CONSENT) || document.querySelector(".cookie-bar")) return;
  const bar = document.createElement("div");
  bar.className = "cookie-bar";
  bar.setAttribute("role", "dialog");
  bar.setAttribute("aria-label", "Cookie choices");
  bar.innerHTML = `<p>We use a sign-in cookie to run the studio. Optional analytics stay off unless you allow them. <a href="/cookies">Cookie policy</a></p>
    <div class="cookie-actions">
      <button class="btn sm" type="button" data-consent="essential">Essential only</button>
      <button class="btn sm primary" type="button" data-consent="all">Accept analytics</button>
    </div>`;
  bar.addEventListener("click", (event) => {
    const choice = event.target?.closest?.("[data-consent]")?.dataset.consent;
    if (!choice) return;
    localStorage.setItem(CONSENT, choice);
    bar.remove();
    if (choice === "all" && window.__rcConfig) loadProviders(window.__rcConfig);
  });
  document.body.appendChild(bar);
}

function wireClicks() {
  document.addEventListener("click", (event) => {
    const el = event.target instanceof Element ? event.target.closest("a, button") : null;
    if (!el) return;
    const href = el.getAttribute("href") || "";
    const label = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80);
    const named = el.getAttribute("data-track");
    if (named) {
      track(named, { label, href });
      return;
    }
    if (el.matches(".nav-cta, .footer-cta, .final-cta a, .hero-ctas a")) {
      track("cta_click", { label, href });
    }
    if (location.pathname === "/pricing" && el.closest(".price-card, .price-enterprise") && el.tagName === "A") {
      track("subscription_click", { label, href });
      track("pricing_conversion", { label, href });
    }
  });
}

function registerWorker(env) {
  if (env !== "production" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

export async function initProduct() {
  if (window.__rcBoot) return;
  window.__rcBoot = true;
  document.querySelectorAll("#year").forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });
  window.addEventListener("error", (event) => report("error", event.message));
  window.addEventListener("unhandledrejection", (event) => report("unhandledrejection", event.reason?.message || event.reason));
  wireClicks();
  track("page_view", { path: location.pathname });
  mountCookieBanner();
  try {
    const cfg = await fetch("/api/config/public").then((res) => (res.ok ? res.json() : null));
    window.__rcConfig = cfg;
    const me = await fetch("/api/auth/me").then((res) => (res.ok ? res.json() : null));
    if (me?.preferences?.privacy?.analytics === false) window.__rcNoAnalytics = true;
    if (me?.preferences?.privacy?.crashReports === false) window.__rcNoCrash = true;
    if (me?.id) identify(me.id);
    const theme = me?.preferences?.theme || localStorage.getItem("rc_theme") || "dark";
    document.documentElement.dataset.theme = theme === "system" ? "system" : "dark";
    if (localStorage.getItem(CONSENT) === "all") await loadProviders(cfg);
    registerWorker(cfg?.env);
  } catch {
    /* public pages still work offline of the config call */
  }
}

initProduct();
