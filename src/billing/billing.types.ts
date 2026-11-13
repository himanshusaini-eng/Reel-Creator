import type { PlanId } from "./plans";

export type BillingInterval = "month" | "year";

export type SubscriptionStatus = "active" | "past_due" | "canceled" | "incomplete";

export type Subscription = {
  id: string;
  userId: string;
  planId: PlanId;
  interval: BillingInterval;
  status: SubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  pendingPlanId: PlanId | null;
  provider: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  graceEnds: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InvoiceStatus = "paid" | "open" | "void" | "uncollectible";

export type Invoice = {
  id: string;
  number: string;
  userId: string;
  subscriptionId: string | null;
  planId: PlanId;
  interval: BillingInterval;
  amountCents: number;
  currency: "usd";
  status: InvoiceStatus;
  description: string;
  provider: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
};

export type CheckoutStatus = "open" | "awaiting_provider" | "contact" | "completed" | "failed" | "canceled";

export type Checkout = {
  id: string;
  userId: string;
  planId: PlanId;
  interval: BillingInterval;
  amountCents: number;
  status: CheckoutStatus;
  provider: string;
  createdAt: string;
  updatedAt: string;
};

export type BillingFile = {
  subscriptions: Subscription[];
  invoices: Invoice[];
  checkouts: Checkout[];
  invoiceSeq: number;
};
