import type { Request } from "express";

export function appBaseUrl(req: Request) {
  const configured = process.env.PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const forwarded = req.headers["x-forwarded-proto"];
  const proto =
    process.env.TRUST_PROXY === "1" && typeof forwarded === "string"
      ? forwarded.split(",")[0].trim()
      : req.protocol || "http";
  return `${proto}://${req.get("host")}`;
}

export function clientIp(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  if (process.env.TRUST_PROXY === "1" && typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim().slice(0, 64);
  }
  return (req.ip || req.socket.remoteAddress || "unknown").slice(0, 64);
}
