import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { existsSync } from "fs";
import { join } from "path";
import type { Request, Response } from "express";
import { PUBLIC } from "../paths";
import { redact } from "./redact";

const SAFE_MESSAGES = new Set([
  "That file type isn’t supported.",
  "That file name isn’t allowed.",
  "Use a PNG, JPG, WEBP, or GIF.",
  "That upload is too large.",
]);

function wantsHtml(req: Request) {
  return !String(req.path || "").startsWith("/api") && String(req.headers.accept || "").includes("text/html");
}

function sendHtml(res: Response, status: number, name: string) {
  const file = join(PUBLIC, name);
  if (!existsSync(file)) return false;
  res.status(status);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(file);
  return true;
}

/** API errors stay `{ error: string }`. Internal details never reach the client. */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const upload = exception as { code?: string; type?: string; status?: number; message?: string };

    if (upload?.code === "LIMIT_FILE_SIZE" || upload?.type === "entity.too.large" || upload?.status === 413) {
      return res.status(413).json({ error: "That upload is too large." });
    }
    if (upload?.message && SAFE_MESSAGES.has(upload.message)) {
      return res.status(400).json({ error: upload.message });
    }
    const tagged = exception as { status?: number; message?: string };
    if (tagged?.status === 400 && typeof tagged.message === "string" && tagged.message.length < 180 && !tagged.message.includes("\n")) {
      return res.status(400).json({ error: tagged.message });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus?.() ?? HttpStatus.INTERNAL_SERVER_ERROR;
      if (status === 404 && wantsHtml(req) && sendHtml(res, 404, "404.html")) return;
      if (status >= 500) {
        console.error("[http]", redact(exception));
        if (wantsHtml(req) && sendHtml(res, 500, "500.html")) return;
        return res.status(status).json({ error: "Something went wrong. Please try again." });
      }
      const body = exception.getResponse();
      if (typeof body === "string") return res.status(status).json({ error: body });
      const obj = body as Record<string, unknown>;
      if (typeof obj.error === "string") return res.status(status).json({ error: obj.error });
      if (typeof obj.message === "string") return res.status(status).json({ error: obj.message });
      if (Array.isArray(obj.message)) return res.status(status).json({ error: obj.message.join(", ") });
      return res.status(status).json({ error: "Request failed" });
    }

    console.error("[error]", redact(exception));
    if (process.env.NODE_ENV !== "production" && exception instanceof Error) console.error(exception.stack);
    if (wantsHtml(req) && sendHtml(res, 500, "500.html")) return;
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
