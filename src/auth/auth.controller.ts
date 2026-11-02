import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
  BadRequestException,
  UseGuards,
  forwardRef,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { AuthGuard } from "./auth.guard";
import { CurrentUser } from "./user.decorator";
import type { User } from "./auth.types";
import { ProjectsService } from "../projects/projects.service";

@Controller("api/auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(forwardRef(() => ProjectsService))
    private readonly projects: ProjectsService,
  ) {}

  @Post("signup")
  signup(
    @Body() body: { name?: string; email?: string; password?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const user = this.auth.signup(body || {});
      if (this.auth.userCount() === 1) this.projects.claimOrphanProjects(user.id);
      this.auth.startSession(res, user.id);
      res.status(201);
      return this.auth.publicUser(user);
    } catch (e) {
      throw new BadRequestException({ error: (e as Error).message });
    }
  }

  @Post("signin")
  signin(
    @Body() body: { email?: string; password?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const user = this.auth.signin(body || {});
      this.auth.startSession(res, user.id);
      return this.auth.publicUser(user);
    } catch (e) {
      throw new UnauthorizedException({ error: (e as Error).message });
    }
  }

  @Post("signout")
  @HttpCode(204)
  signout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.auth.endSession(req, res);
  }

  @Get("me")
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: User) {
    return this.auth.publicUser(user);
  }
}
