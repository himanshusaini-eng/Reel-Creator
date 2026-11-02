import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Response } from "express";
import { AuthService } from "./auth.service";
import type { AuthedRequest } from "./user.decorator";

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly auth: AuthService) {}

  use(req: AuthedRequest, _res: Response, next: NextFunction) {
    const user = this.auth.resolveUser(req);
    if (user) req.user = user;
    next();
  }
}
