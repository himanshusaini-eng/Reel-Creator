export type PlanId = "free" | "pro" | "team" | "enterprise";
export type CheckoutMode = "included" | "self_serve" | "contact";

export type PlanLimits = {
  projects: number | null;
  exportHeight: 720 | 1080;
  watermark: boolean;
  seats: number | null;
};

export type Plan = {
  id: PlanId;
  name: string;
  tagline: string;
  /** Monthly price in cents. Null when the plan is sales-led. */
  monthlyCents: number | null;
  /** Per-month price when billed yearly, in cents. */
  yearlyMonthlyCents: number | null;
  /** What a yearly subscriber is invoiced up front, in cents. */
  yearlyChargeCents: number | null;
  fromSeatCents: number | null;
  checkout: CheckoutMode;
  /** Enterprise stays contact-led until a contract flow exists. */
  status: "active" | "ready" | "future";
  limits: PlanLimits;
  features: string[];
};

const teamMonthly = Number(process.env.BILLING_TEAM_MONTHLY_CENTS || "");
const teamYearly = Number(process.env.BILLING_TEAM_YEARLY_MONTHLY_CENTS || "");

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Core editing, starter templates, and watermarked 720p exports.",
    monthlyCents: 0,
    yearlyMonthlyCents: 0,
    yearlyChargeCents: 0,
    fromSeatCents: null,
    checkout: "included",
    status: "active",
    limits: { projects: 1, exportHeight: 720, watermark: true, seats: 1 },
    features: ["Basic editing tools", "Core templates", "720p export", "1 project at a time", "Community support"],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "1080p exports, the full template library, and unlimited projects.",
    monthlyCents: 1400,
    yearlyMonthlyCents: 1100,
    yearlyChargeCents: 1100 * 12,
    fromSeatCents: null,
    checkout: "self_serve",
    status: "active",
    limits: { projects: null, exportHeight: 1080, watermark: false, seats: 1 },
    features: [
      "AI editing & enhancements",
      "Full template library",
      "1080p export, no watermark",
      "Unlimited projects",
      "Brand kit",
      "Commercial license",
      "Email support",
    ],
  },
  {
    id: "team",
    name: "Team",
    tagline: "A shared workspace for a small crew. Self-serve pricing turns on when seat rates are set.",
    monthlyCents: Number.isFinite(teamMonthly) && teamMonthly > 0 ? teamMonthly : null,
    yearlyMonthlyCents: Number.isFinite(teamYearly) && teamYearly > 0 ? teamYearly : null,
    yearlyChargeCents: Number.isFinite(teamYearly) && teamYearly > 0 ? teamYearly * 12 : null,
    fromSeatCents: null,
    checkout: Number.isFinite(teamMonthly) && teamMonthly > 0 ? "self_serve" : "contact",
    status: "ready",
    limits: { projects: null, exportHeight: 1080, watermark: false, seats: 5 },
    features: ["Everything in Pro", "Shared projects", "Up to 5 seats", "Priority export queue"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "Custom limits, priority support, and a partner for launch weeks.",
    monthlyCents: null,
    yearlyMonthlyCents: null,
    yearlyChargeCents: null,
    fromSeatCents: 4900,
    checkout: "contact",
    status: "future",
    limits: { projects: null, exportHeight: 1080, watermark: false, seats: null },
    features: ["Multi-seat workspaces", "Shared brand kits", "Priority support and onboarding", "Custom volume limits"],
  },
];

const RANK: Record<PlanId, number> = { free: 0, pro: 1, team: 2, enterprise: 3 };

export function getPlan(id: string | null | undefined): Plan {
  return PLANS.find((plan) => plan.id === id) || PLANS[0];
}

export function planRank(id: string) {
  return RANK[id as PlanId] ?? 0;
}

export function chargeCents(plan: Plan, interval: "month" | "year") {
  if (interval === "year") return plan.yearlyChargeCents;
  return plan.monthlyCents;
}
