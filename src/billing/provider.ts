export type BillingProviderName = "manual" | "stripe" | "none";

/**
 * manual — local and staging. Plan changes are recorded and no card is charged.
 * stripe — reserved for the processor. Checkout stays pending until the Stripe call is implemented.
 * none — production default when no provider is configured.
 */
export function providerMode(): BillingProviderName {
  const raw = (process.env.BILLING_PROVIDER || "").toLowerCase();
  if (raw === "manual" || raw === "stripe" || raw === "none") return raw;
  if (process.env.STRIPE_SECRET_KEY) return "stripe";
  if (process.env.NODE_ENV === "production") return "none";
  return "manual";
}

export type ProviderStart = {
  status: "open" | "awaiting_provider";
  completeOnServer: boolean;
};

/**
 * Extension point for Stripe Checkout.
 * Create a Checkout Session here and return its URL when STRIPE_SECRET_KEY is live.
 * Until that call exists, upgrades are stored as awaiting_provider and no charge is made.
 */
export function startProviderCheckout(): ProviderStart {
  const mode = providerMode();
  if (mode === "manual") return { status: "open", completeOnServer: true };
  return { status: "awaiting_provider", completeOnServer: false };
}
