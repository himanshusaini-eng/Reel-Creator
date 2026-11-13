import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";
import { clientIp } from "./url";
import { rateLimit } from "./rate-limit";

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function contentSecurityPolicy() {
  const extra = process.env.NODE_ENV === "production" ? " upgrade-insecure-requests;" : "";
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob:",
    "font-src 'self' data: https://api.fontshare.com https://cdn.fontshare.com",
    "style-src 'self' 'unsafe-inline' https://api.fontshare.com https://cdn.fontshare.com",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://browser.sentry-cdn.com https://www.googletagmanager.com https://www.google-analytics.com https://plausible.io https://cdn.mxpnl.com https://cdn.logrocket.io",
    "connect-src 'self' https:",
    "frame-src 'self'",
  ].join("; ") + ";" + extra;
}

function limitFor(path: string, method: string) {
  if (method !== "POST") return null;
  if (/^\/api\/auth\/(signin|signup|forgot|reset)$/.test(path)) return { limit: 10, windowMs: 15 * 60 * 1000 };
  if (path.startsWith("/api/support/")) return { limit: 8, windowMs: 60 * 60 * 1000 };
  if (path.startsWith("/api/analytics/")) return { limit: 180, windowMs: 60 * 1000 };
  if (path.startsWith("/api/monitor/")) return { limit: 40, windowMs: 60 * 1000 };
  if (path.startsWith("/api/billing/checkout")) return { limit: 30, windowMs: 60 * 60 * 1000 };
  if (path === "/api/billing/webhook") return { limit: 120, windowMs: 60 * 1000 };
  return null;
}

function csrfBlocked(req: Request) {
  if (!UNSAFE.has(req.method)) return false;
  const path = req.path || "";
  if (!path.startsWith("/api/")) return false;
  if (path === "/api/billing/webhook") return false;
  const cookie = req.headers.cookie || "";
  if (!cookie.includes("rc_session=")) return false;

  const origin = req.headers.origin;
  const host = req.headers.host;
  if (typeof origin === "string" && origin) {
    try {
      return new URL(origin).host !== host;
    } catch {
      return true;
    }
  }
  const site = req.headers["sec-fetch-site"];
  return site === "cross-site";
}

export function securityMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = randomUUID();
  res.setHeader("X-Request-Id", requestId);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Content-Security-Policy", contentSecurityPolicy());
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }

  if (csrfBlocked(req)) {
    res.status(403).json({ error: "Request blocked" });
    return;
  }

  const rule = limitFor(req.path || "", req.method);
  if (rule) {
    const hit = rateLimit(`${req.method}:${req.path}:${clientIp(req)}`, rule.limit, rule.windowMs);
    if (!hit.ok) {
      res.setHeader("Retry-After", String(hit.retryAfter));
      res.status(429).json({ error: "Too many requests. Try again shortly." });
      return;
    }
  }

  next();
}
