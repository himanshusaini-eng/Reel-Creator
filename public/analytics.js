const ALLOWED = new Set([
  "page_view",
  "cta_click",
  "signup",
  "login",
  "project_create",
  "video_upload",
  "ai_generation",
  "template_use",
  "export",
  "subscription_click",
  "pricing_conversion",
  "error",
]);

const BLOCKED = /email|password|token|secret|cookie|name/i;

function cleanProps(props) {
  const out = {};
  if (!props || typeof props !== "object") return out;
  for (const [key, value] of Object.entries(props).slice(0, 12)) {
    if (BLOCKED.test(key)) continue;
    if (typeof value === "string") {
      if (value.includes("@")) continue;
      out[key.slice(0, 40)] = value.slice(0, 120);
    } else if (typeof value === "number" && Number.isFinite(value)) out[key.slice(0, 40)] = value;
    else if (typeof value === "boolean") out[key.slice(0, 40)] = value;
  }
  return out;
}

/** First-party product events. Third-party tools receive them only after analytics consent. */
export function track(event, props) {
  if (!ALLOWED.has(event) || window.__rcNoAnalytics) return Promise.resolve();
  const body = JSON.stringify({
    event,
    props: cleanProps(props),
    path: location.pathname,
  });
  const sent = fetch("/api/analytics/collect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
  if (localStorage.getItem("rc_consent") === "all") forward(event, cleanProps(props));
  return sent;
}

export function identify(id) {
  if (!id || window.__rcNoAnalytics) return;
  window.__rcUser = String(id).slice(0, 80);
}

function forward(event, props) {
  const cfg = window.__rcConfig?.analytics;
  if (!cfg) return;
  if (cfg.ga && window.gtag) window.gtag("event", event, props);
  if (cfg.posthogKey && window.posthog?.capture) window.posthog.capture(event, props);
  if (cfg.mixpanelToken && window.mixpanel?.track) window.mixpanel.track(event, props);
  if (cfg.plausibleDomain && window.plausible) window.plausible(event, { props });
}
