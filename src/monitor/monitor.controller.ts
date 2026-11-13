import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { MonitorService } from "./monitor.service";

@Controller("api/monitor")
export class MonitorController {
  constructor(private readonly monitor: MonitorService) {}

  @Post("report")
  @HttpCode(204)
  report(@Body() body: { kind?: string; message?: string; stack?: string; path?: string }) {
    this.monitor.capture(body || {});
  }
}
