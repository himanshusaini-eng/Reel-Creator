import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  forwardRef,
} from "@nestjs/common";
import type { Response } from "express";
import { AuthService } from "./auth.service";
import { AuthGuard } from "./auth.guard";
import { CurrentUser, type AuthedRequest } from "./user.decorator";
import type { User } from "./auth.types";
import { ProjectsService } from "../projects/projects.service";
import { EmailService } from "../email/email.service";
import { appBaseUrl } from "../common/url";

@Controller("api/auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly email: EmailService,
    @Inject(forwardRef(() => ProjectsService))
    private readonly projects: ProjectsService,
  ) {}

  @Post("signup")
  signup(
    @Body() body: { name?: string; email?: string; password?: string },
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const user = this.auth.signup(body || {});
      if (this.auth.createdCount() === 1) this.projects.claimOrphanProjects(user.id);
      this.auth.startSession(req, res, user.id);
      const token = this.auth.issueToken(user.id, "verify");
      this.email.send(
        this.email.templates.welcome({
          to: user.email,
          name: user.name,
          verifyUrl: `${appBaseUrl(req)}/verify-email?token=${token}`,
        }),
      );
      res.status(201);
      return this.auth.publicUser(user);
    } catch (error) {
      throw new BadRequestException({ error: (error as Error).message });
    }
  }

  @Post("signin")
  signin(
    @Body() body: { email?: string; password?: string },
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const user = this.auth.signin(body || {});
      this.auth.startSession(req, res, user.id);
      return this.auth.publicUser(user);
    } catch (error) {
      const message = (error as Error).message;
      if (message.startsWith("Too many")) throw new UnauthorizedException({ error: message });
      throw new UnauthorizedException({ error: "Wrong email or password" });
    }
  }

  @Post("signout")
  @HttpCode(204)
  signout(@Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    this.auth.endSession(req, res);
  }

  @Get("me")
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: User) {
    return this.auth.publicUser(user);
  }

  @Post("forgot")
  @HttpCode(200)
  forgot(@Body() body: { email?: string }, @Req() req: AuthedRequest) {
    const user = this.auth.lookupForReset(body?.email || "");
    if (user) {
      const token = this.auth.issueToken(user.id, "reset", undefined, 60 * 60 * 1000);
      this.email.send(
        this.email.templates.resetPassword({
          to: user.email,
          name: user.name,
          resetUrl: `${appBaseUrl(req)}/reset-password?token=${token}`,
        }),
      );
    }
    return { ok: true };
  }

  @Post("reset")
  reset(
    @Body() body: { token?: string; password?: string },
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const user = this.auth.resetPassword(String(body?.token || ""), String(body?.password || ""), req, res);
      return this.auth.publicUser(user);
    } catch (error) {
      throw new BadRequestException({ error: (error as Error).message });
    }
  }

  @Post("verify-email")
  verify(@Body() body: { token?: string }) {
    try {
      return this.auth.publicUser(this.auth.verifyToken(String(body?.token || "")));
    } catch (error) {
      throw new BadRequestException({ error: (error as Error).message });
    }
  }

  @Post("resend-verification")
  @UseGuards(AuthGuard)
  @HttpCode(200)
  resend(@CurrentUser() user: User, @Req() req: AuthedRequest) {
    if (!user.emailVerifiedAt) {
      const token = this.auth.issueToken(user.id, "verify");
      this.email.send(
        this.email.templates.verifyEmail({
          to: user.email,
          name: user.name,
          verifyUrl: `${appBaseUrl(req)}/verify-email?token=${token}`,
        }),
      );
    }
    return { ok: true };
  }
}
