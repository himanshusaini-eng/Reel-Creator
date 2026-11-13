import { providerMode } from "../billing/provider";

/** Values a browser is allowed to see. Never put secrets here. */
export function publicConfig() {
  return {
    env: process.env.NODE_ENV || "development",
    billing: {
      provider: providerMode(),
      canComplete: providerMode() === "manual",
    },
    analytics: {
      ga: process.env.GA_MEASUREMENT_ID || "",
      posthogKey: process.env.POSTHOG_KEY || "",
      posthogHost: process.env.POSTHOG_HOST || "https://us.i.posthog.com",
      plausibleDomain: process.env.PLAUSIBLE_DOMAIN || "",
      mixpanelToken: process.env.MIXPANEL_TOKEN || "",
      clarityId: process.env.CLARITY_PROJECT_ID || "",
    },
    monitor: {
      sentryDsn: process.env.SENTRY_DSN || "",
      logrocketId: process.env.LOGROCKET_APP_ID || "",
    },
  };
}
