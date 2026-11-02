import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import type { User } from "./auth.types";

export type AuthedRequest = Request & { user?: User };

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): User => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  return req.user as User;
});
