import { Injectable } from "@nestjs/common";
import { redact } from "../common/redact";

type Report = { kind: string; message: string; path: string; ts: string };

@Injectable()
export class MonitorService {
  private recent: Report[] = [];

  capture(input: { kind?: string; message?: string; stack?: string; path?: string }) {
    const report: Report = {
      kind: String(input.kind || "error").slice(0, 40),
      message: redact(input.message || "Unknown error"),
      path: String(input.path || "").slice(0, 180),
      ts: new Date().toISOString(),
    };
    this.recent.push(report);
    if (this.recent.length > 200) this.recent.splice(0, this.recent.length - 200);
    console.error(`[monitor] ${report.kind} ${report.path} ${report.message}`);
    const webhook = process.env.MONITOR_WEBHOOK_URL;
    if (webhook) {
      void fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report),
      }).catch(() => undefined);
    }
    return { ok: true };
  }
}
