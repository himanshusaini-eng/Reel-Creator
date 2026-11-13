import { Body, Controller, Get, Headers, Param, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/user.decorator";
import type { User } from "../auth/auth.types";
import { BillingService } from "./billing.service";
import type { BillingInterval } from "./billing.types";

@Controller("api/billing")
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get("plans")
  plans() {
    return this.billing.plans();
  }

  @Get("subscription")
  @UseGuards(AuthGuard)
  subscription(@CurrentUser() user: User) {
    return this.billing.current(user.id);
  }

  @Get("invoices")
  @UseGuards(AuthGuard)
  invoices(@CurrentUser() user: User) {
    return this.billing.invoices(user.id);
  }

  @Post("checkout")
  @UseGuards(AuthGuard)
  checkout(@CurrentUser() user: User, @Body() body: { planId?: string; interval?: BillingInterval }) {
    return this.billing.startCheckout(user.id, String(body?.planId || ""), body?.interval === "year" ? "year" : "month");
  }

  @Get("checkout/:id")
  @UseGuards(AuthGuard)
  checkoutStatus(@CurrentUser() user: User, @Param("id") id: string) {
    return this.billing.getCheckout(user.id, id);
  }

  @Post("checkout/:id/complete")
  @UseGuards(AuthGuard)
  complete(@CurrentUser() user: User, @Param("id") id: string) {
    return this.billing.completeCheckout(user.id, id);
  }

  @Post("checkout/:id/fail")
  @UseGuards(AuthGuard)
  fail(@CurrentUser() user: User, @Param("id") id: string) {
    return this.billing.failCheckout(user.id, id);
  }

  @Post("change")
  @UseGuards(AuthGuard)
  change(@CurrentUser() user: User, @Body() body: { planId?: string; interval?: BillingInterval }) {
    return this.billing.change(user.id, String(body?.planId || ""), body?.interval === "year" ? "year" : "month");
  }

  @Post("cancel")
  @UseGuards(AuthGuard)
  cancel(@CurrentUser() user: User) {
    return this.billing.cancel(user.id);
  }

  @Post("resume")
  @UseGuards(AuthGuard)
  resume(@CurrentUser() user: User) {
    return this.billing.resume(user.id);
  }

  @Post("webhook")
  webhook(
    @Headers("x-reel-webhook-secret") secret: string | undefined,
    @Body() body: { type?: string; userId?: string; planId?: string; interval?: BillingInterval; amountCents?: number },
  ) {
    return this.billing.handleWebhook(secret, body || {});
  }
}
