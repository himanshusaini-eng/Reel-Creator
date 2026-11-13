import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
  forwardRef,
} from "@nestjs/common";
import { join } from "path";
import { DATA } from "../paths";
import { readJson, writeJson } from "../common/json-file";
import { AuthService } from "../auth/auth.service";
import { EmailService } from "../email/email.service";
import { PLANS, chargeCents, getPlan, planRank, type PlanId } from "./plans";
import { providerMode, startProviderCheckout } from "./provider";
import type { BillingFile, BillingInterval, Checkout, Invoice, Subscription } from "./billing.types";

const EMPTY: BillingFile = { subscriptions: [], invoices: [], checkouts: [], invoiceSeq: 1000 };
const GRACE_MS = 3 * 864e5;

function addInterval(from: Date, interval: BillingInterval) {
  const next = new Date(from.getTime());
  next.setUTCDate(next.getUTCDate() + (interval === "year" ? 365 : 30));
  return next;
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

@Injectable()
export class BillingService implements OnModuleInit, OnModuleDestroy {
  private readonly file = join(DATA, "billing.json");
  private data: BillingFile = EMPTY;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly email: EmailService,
    @Inject(forwardRef(() => AuthService)) private readonly auth: AuthService,
  ) {
    this.data = readJson(this.file, EMPTY);
    this.data.subscriptions ||= [];
    this.data.invoices ||= [];
    this.data.checkouts ||= [];
    this.data.invoiceSeq ||= 1000;
  }

  onModuleInit() {
    this.sweep();
    this.timer = setInterval(() => this.sweep(), 15 * 60 * 1000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private save() {
    writeJson(this.file, this.data);
  }

  plans() {
    return PLANS;
  }

  limitsFor(userId: string) {
    return getPlan(this.current(userId).planId).limits;
  }

  assertCanCreate(userId: string, count: number) {
    const limit = this.limitsFor(userId).projects;
    if (limit != null && count >= limit) {
      throw new BadRequestException({
        error: `The Free plan includes ${limit} project at a time. Delete one or upgrade to Pro to add another.`,
      });
    }
  }

  current(userId: string) {
    const sub = this.activeRecord(userId);
    if (!sub) {
      return {
        planId: "free" as PlanId,
        status: "active" as const,
        interval: "month" as BillingInterval,
        cancelAtPeriodEnd: false,
        pendingPlanId: null,
        provider: "included",
        currentPeriodEnd: null,
        renewal: "included",
      };
    }
    return {
      planId: sub.planId,
      status: sub.status,
      interval: sub.interval,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      pendingPlanId: sub.pendingPlanId,
      provider: sub.provider,
      currentPeriodEnd: sub.currentPeriodEnd,
      renewal: sub.cancelAtPeriodEnd ? "cancels" : "renews",
    };
  }

  invoices(userId: string) {
    return this.data.invoices
      .filter((invoice) => invoice.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  private activeRecord(userId: string) {
    return (
      this.data.subscriptions
        .filter((sub) => sub.userId === userId && sub.status !== "canceled")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] || null
    );
  }

  startCheckout(userId: string, planId: string, interval: BillingInterval) {
    const plan = PLANS.find((item) => item.id === planId);
    if (!plan) throw new BadRequestException({ error: "Unknown plan" });
    if (interval !== "month" && interval !== "year") throw new BadRequestException({ error: "Choose monthly or yearly billing" });
    if (plan.checkout === "included") throw new BadRequestException({ error: "The Free plan is already available on every account" });

    const now = new Date().toISOString();
    if (plan.checkout === "contact") {
      const checkout = this.storeCheckout({
        id: randomUUID(),
        userId,
        planId: plan.id,
        interval,
        amountCents: 0,
        status: "contact",
        provider: providerMode(),
        createdAt: now,
        updatedAt: now,
      });
      const topic = plan.id === "team" ? "team" : "enterprise";
      return { checkout, url: `/contact?topic=${topic}` };
    }

    const amount = chargeCents(plan, interval);
    if (amount == null) throw new BadRequestException({ error: "That plan isn’t available for self-serve checkout yet" });
    const started = startProviderCheckout();
    const checkout = this.storeCheckout({
      id: randomUUID(),
      userId,
      planId: plan.id,
      interval,
      amountCents: amount,
      status: started.status,
      provider: providerMode(),
      createdAt: now,
      updatedAt: now,
    });
    return { checkout, url: `/app/billing/result?session=${checkout.id}` };
  }

  getCheckout(userId: string, id: string) {
    const checkout = this.data.checkouts.find((item) => item.id === id && item.userId === userId);
    if (!checkout) throw new NotFoundException({ error: "Checkout not found" });
    return checkout;
  }

  completeCheckout(userId: string, id: string) {
    if (providerMode() !== "manual") {
      throw new BadRequestException({ error: "Payments aren’t connected yet. Your upgrade is saved and will finish when billing goes live." });
    }
    const checkout = this.getCheckout(userId, id);
    if (checkout.status === "completed") return { checkout, subscription: this.current(userId) };
    if (checkout.status !== "open") throw new BadRequestException({ error: "This checkout can no longer be confirmed" });
    checkout.status = "completed";
    checkout.updatedAt = new Date().toISOString();
    const subscription = this.activate(userId, checkout.planId, checkout.interval, checkout.amountCents, "Plan change confirmed in manual billing. No card was charged.");
    this.save();
    return { checkout, subscription };
  }

  failCheckout(userId: string, id: string) {
    if (providerMode() !== "manual") throw new BadRequestException({ error: "Nothing to update" });
    const checkout = this.getCheckout(userId, id);
    if (checkout.status === "open" || checkout.status === "awaiting_provider") {
      checkout.status = "failed";
      checkout.updatedAt = new Date().toISOString();
      this.save();
    }
    return checkout;
  }

  cancel(userId: string) {
    const sub = this.activeRecord(userId);
    if (!sub || sub.planId === "free") throw new BadRequestException({ error: "There’s no paid plan to cancel" });
    sub.cancelAtPeriodEnd = true;
    sub.pendingPlanId = "free";
    sub.updatedAt = new Date().toISOString();
    this.save();
    this.mail(userId, "cancel", sub);
    return this.current(userId);
  }

  resume(userId: string) {
    const sub = this.activeRecord(userId);
    if (!sub || !sub.cancelAtPeriodEnd) throw new BadRequestException({ error: "This subscription isn’t set to cancel" });
    sub.cancelAtPeriodEnd = false;
    sub.pendingPlanId = null;
    sub.updatedAt = new Date().toISOString();
    this.save();
    return this.current(userId);
  }

  change(userId: string, planId: string, interval: BillingInterval) {
    const plan = PLANS.find((item) => item.id === planId);
    if (!plan) throw new BadRequestException({ error: "Unknown plan" });
    if (plan.checkout === "contact") return this.startCheckout(userId, planId, interval);
    const current = this.activeRecord(userId);
    const currentId = current?.planId || "free";
    if (plan.id === currentId && current && current.interval === interval && !current.cancelAtPeriodEnd) {
      throw new BadRequestException({ error: "You’re already on that plan" });
    }
    if (plan.id === "free") return { kind: "scheduled" as const, subscription: this.cancel(userId) };
    if (planRank(plan.id) < planRank(currentId) && current) {
      current.pendingPlanId = plan.id;
      current.interval = interval;
      current.cancelAtPeriodEnd = false;
      current.updatedAt = new Date().toISOString();
      this.save();
      return { kind: "scheduled" as const, subscription: this.current(userId) };
    }
    const started = this.startCheckout(userId, plan.id, interval);
    return { kind: "checkout" as const, ...started };
  }

  handleWebhook(secret: string | undefined, body: { type?: string; userId?: string; planId?: string; interval?: BillingInterval; amountCents?: number }) {
    const expected = process.env.BILLING_WEBHOOK_SECRET || "";
    if (!expected || !secret || !safeEqual(secret, expected)) {
      throw new UnauthorizedException({ error: "Invalid webhook" });
    }
    const userId = String(body?.userId || "");
    const user = this.auth.getById(userId);
    if (!user || user.deletedAt) throw new BadRequestException({ error: "Unknown account" });
    const type = String(body?.type || "");
    if (type === "checkout.completed" || type === "invoice.paid" || type === "subscription.renewed") {
      const plan = getPlan(body.planId);
      const interval = body.interval === "year" ? "year" : "month";
      const amount = Number(body.amountCents ?? chargeCents(plan, interval) ?? 0);
      this.activate(userId, plan.id, interval, amount, "Subscription updated from billing provider.");
      return { ok: true };
    }
    if (type === "invoice.payment_failed") {
      const sub = this.activeRecord(userId);
      if (sub) {
        sub.status = "past_due";
        sub.graceEnds = sub.graceEnds || new Date(Date.now() + GRACE_MS).toISOString();
        sub.updatedAt = new Date().toISOString();
        this.save();
      }
      return { ok: true };
    }
    if (type === "subscription.canceled") {
      this.finishCancel(userId);
      return { ok: true };
    }
    throw new BadRequestException({ error: "Unknown billing event" });
  }

  exportFor(userId: string) {
    return { subscription: this.current(userId), invoices: this.invoices(userId) };
  }

  release(userId: string) {
    let dirty = false;
    for (const sub of this.data.subscriptions) {
      if (sub.userId === userId && sub.status !== "canceled") {
        sub.status = "canceled";
        sub.updatedAt = new Date().toISOString();
        dirty = true;
      }
    }
    if (dirty) this.save();
  }

  private storeCheckout(checkout: Checkout) {
    this.data.checkouts.push(checkout);
    this.save();
    return checkout;
  }

  private activate(userId: string, planId: PlanId, interval: BillingInterval, amountCents: number, description: string) {
    const now = new Date();
    const end = addInterval(now, interval);
    let sub = this.activeRecord(userId);
    if (!sub) {
      sub = {
        id: randomUUID(),
        userId,
        planId,
        interval,
        status: "active",
        cancelAtPeriodEnd: false,
        pendingPlanId: null,
        provider: providerMode(),
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: end.toISOString(),
        graceEnds: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      this.data.subscriptions.push(sub);
    } else {
      sub.planId = planId;
      sub.interval = interval;
      sub.status = "active";
      sub.cancelAtPeriodEnd = false;
      sub.pendingPlanId = null;
      sub.provider = providerMode();
      sub.currentPeriodStart = now.toISOString();
      sub.currentPeriodEnd = end.toISOString();
      sub.graceEnds = null;
      sub.updatedAt = now.toISOString();
    }
    this.auth.setPlan(userId, planId);
    const invoice = this.addInvoice(sub, amountCents, description, providerMode() === "manual" ? "paid" : "open");
    this.save();
    this.mail(userId, "upgraded", sub, invoice);
    return sub;
  }

  private addInvoice(sub: Subscription, amountCents: number, description: string, status: Invoice["status"]) {
    this.data.invoiceSeq += 1;
    const invoice: Invoice = {
      id: randomUUID(),
      number: `RC-${this.data.invoiceSeq}`,
      userId: sub.userId,
      subscriptionId: sub.id,
      planId: sub.planId,
      interval: sub.interval,
      amountCents,
      currency: "usd",
      status,
      description,
      provider: sub.provider,
      periodStart: sub.currentPeriodStart,
      periodEnd: sub.currentPeriodEnd,
      createdAt: new Date().toISOString(),
    };
    this.data.invoices.push(invoice);
    return invoice;
  }

  private finishCancel(userId: string) {
    const sub = this.activeRecord(userId);
    if (!sub) return;
    sub.status = "canceled";
    sub.updatedAt = new Date().toISOString();
    this.auth.setPlan(userId, "free");
    this.save();
  }

  private sweep() {
    const now = Date.now();
    let dirty = false;
    for (const sub of this.data.subscriptions) {
      if (sub.status === "canceled") continue;
      const owner = this.auth.getById(sub.userId);
      if (!owner || owner.deletedAt) {
        sub.status = "canceled";
        sub.updatedAt = new Date().toISOString();
        dirty = true;
        continue;
      }
      if (new Date(sub.currentPeriodEnd).getTime() > now) continue;
      dirty = true;
      if (sub.cancelAtPeriodEnd || sub.pendingPlanId === "free") {
        this.finishCancel(sub.userId);
        continue;
      }
      if (sub.pendingPlanId) {
        sub.planId = sub.pendingPlanId;
        sub.pendingPlanId = null;
        this.auth.setPlan(sub.userId, sub.planId);
      }
      if (providerMode() === "manual") {
        const start = new Date();
        sub.currentPeriodStart = start.toISOString();
        sub.currentPeriodEnd = addInterval(start, sub.interval).toISOString();
        sub.status = "active";
        sub.updatedAt = start.toISOString();
        const amount = chargeCents(getPlan(sub.planId), sub.interval) || 0;
        const invoice = this.addInvoice(sub, amount, "Renewal recorded in manual billing. No card was charged.", "paid");
        this.mail(sub.userId, "renewed", sub, invoice);
      } else {
        sub.status = "past_due";
        sub.graceEnds = sub.graceEnds || new Date(now + GRACE_MS).toISOString();
        sub.updatedAt = new Date().toISOString();
        if (sub.graceEnds && new Date(sub.graceEnds).getTime() <= now) this.finishCancel(sub.userId);
      }
    }
    if (dirty) this.save();
  }

  private mail(userId: string, kind: "upgraded" | "cancel" | "renewed", sub: Subscription, invoice?: Invoice) {
    const user = this.auth.getById(userId);
    if (!user || user.deletedAt) return;
    const prefs = this.auth.preferencesOf(user);
    if (!prefs.notifications.billing) return;
    const plan = getPlan(sub.planId).name;
    if (kind === "cancel") {
      this.email.send(this.email.templates.subscriptionCanceled({ to: user.email, name: user.name, plan, until: sub.currentPeriodEnd }));
      return;
    }
    this.email.send(this.email.templates.subscriptionConfirmed({ to: user.email, name: user.name, plan, interval: sub.interval }));
    if (invoice) {
      this.email.send(
        this.email.templates.invoice({
          to: user.email,
          name: user.name,
          number: invoice.number,
          amountCents: invoice.amountCents,
          description: invoice.description,
        }),
      );
    }
  }
}

/** Signature helper for a future worker that forwards provider events. */
export function signBillingBody(body: string, secret: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}
