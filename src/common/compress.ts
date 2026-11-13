import { gzip } from "zlib";
import type { NextFunction, Request, Response } from "express";

/** Gzip text responses above 1 KB. Static assets keep Express's own send path unless they use res.send. */
export function compress(req: Request, res: Response, next: NextFunction) {
  const accept = req.headers["accept-encoding"];
  if (typeof accept !== "string" || !/\bgzip\b/.test(accept)) return next();

  const original = res.send.bind(res);
  res.send = ((body?: unknown) => {
    if (res.headersSent || body == null || typeof body === "number") return original(body as never);
    const type = String(res.getHeader("Content-Type") || "");
    const payload = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
    if (payload.length < 1024 || !/text|json|javascript|xml|svg/.test(type)) return original(body as never);
    res.setHeader("Vary", "Accept-Encoding");
    gzip(payload, (error, zipped) => {
      if (error || res.headersSent) return original(body as never);
      res.setHeader("Content-Encoding", "gzip");
      res.removeHeader("Content-Length");
      original(zipped);
    });
    return res;
  }) as Response["send"];
  next();
}
