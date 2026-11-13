import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";

@Controller("api/analytics")
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post("collect")
  @HttpCode(204)
  collect(@Body() body: { event?: string; props?: Record<string, unknown>; path?: string }) {
    this.analytics.collect(body || {});
  }
}
