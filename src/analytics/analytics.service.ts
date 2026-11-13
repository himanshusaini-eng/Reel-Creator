import { Injectable } from "@nestjs/common";
import { appendFileSync, mkdirSync, statSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { DATA } from "../paths";

export const ANALYTICS_EVENTS = [
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
] as const;

type EventName = (typeof ANALYTICS_EVENTS)[number];

const BLOCKED_KEY = /email|password|token|secret|cookie|authorization|name/i;

@Injectable()
export class AnalyticsService {
  private recent: { event: string; path: string; ts: number }[] = [];
  private readonly file = join(DATA, "analytics.jsonl");

  collect(body: { event?: string; props?: Record<string, unknown>; path?: string }) {
    const event = String(body.event || "");
    if (!ANALYTICS_EVENTS.includes(event as EventName)) return;
    const props = this.scrub(body.props);
    const path = String(body.path || "").slice(0, 180);
    this.recent.push({ event, path, ts: Date.now() });
    if (this.recent.length > 500) this.recent.splice(0, this.recent.length - 500);
    try {
      mkdirSync(DATA, { recursive: true });
      if (existsSync(this.file) && statSync(this.file).size > 1_000_000) writeFileSync(this.file, "");
      appendFileSync(this.file, JSON.stringify({ event, path, props, ts: new Date().toISOString() }) + "\n");
    } catch {
      /* analytics must never break a request */
    }
  }

  private scrub(props: Record<string, unknown> | undefined) {
    const clean: Record<string, string | number | boolean> = {};
    if (!props || typeof props !== "object") return clean;
    for (const [key, value] of Object.entries(props).slice(0, 12)) {
      if (BLOCKED_KEY.test(key)) continue;
      if (typeof value === "string") {
        if (value.includes("@")) continue;
        clean[key.slice(0, 40)] = value.slice(0, 120);
      } else if (typeof value === "number" && Number.isFinite(value)) clean[key.slice(0, 40)] = value;
      else if (typeof value === "boolean") clean[key.slice(0, 40)] = value;
    }
    return clean;
  }
}
