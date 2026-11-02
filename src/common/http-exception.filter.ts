import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Response } from "express";

/** Keep API error shape as `{ error: string }` like the original Express app. */
@Catch(HttpException)
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const status = exception.getStatus?.() ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception.getResponse();

    if (typeof body === "string") {
      return res.status(status).json({ error: body });
    }

    const obj = body as Record<string, unknown>;
    if (typeof obj.error === "string") {
      return res.status(status).json({ error: obj.error });
    }
    if (typeof obj.message === "string") {
      return res.status(status).json({ error: obj.message });
    }
    if (Array.isArray(obj.message)) {
      return res.status(status).json({ error: obj.message.join(", ") });
    }
    if (obj.message && typeof obj.message === "object" && "error" in (obj.message as object)) {
      return res.status(status).json(obj.message);
    }
    return res.status(status).json({ error: exception.message || "Error" });
  }
}
