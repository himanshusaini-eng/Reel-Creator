import { randomUUID } from "crypto";
import { extname, join } from "path";
import { existsSync, mkdirSync, unlinkSync } from "fs";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  forwardRef,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { AuthGuard } from "../auth/auth.guard";
import { AuthService } from "../auth/auth.service";
import { CurrentUser, type AuthedRequest } from "../auth/user.decorator";
import type { User, UserPreferences } from "../auth/auth.types";
import { ProjectsService } from "../projects/projects.service";
import { BillingService } from "../billing/billing.service";
import { EmailService } from "../email/email.service";
import { USER_UPLOADS } from "../paths";
import { appBaseUrl } from "../common/url";

const AVATAR_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

@Controller("api/account")
@UseGuards(AuthGuard)
export class AccountController {
  constructor(
    private readonly auth: AuthService,
    private readonly email: EmailService,
    @Inject(forwardRef(() => ProjectsService)) private readonly projects: ProjectsService,
    @Inject(forwardRef(() => BillingService)) private readonly billing: BillingService,
  ) {}

  private bad(error: unknown): never {
    throw new BadRequestException({ error: error instanceof Error ? error.message : "Could not update your account" });
  }

  @Patch("profile")
  profile(@CurrentUser() user: User, @Body() body: { name?: string }) {
    try {
      return this.auth.publicUser(this.auth.updateProfile(user, body?.name));
    } catch (error) {
      this.bad(error);
    }
  }

  @Post("password")
  @HttpCode(204)
  password(@CurrentUser() user: User, @Req() req: AuthedRequest, @Body() body: { current?: string; next?: string }) {
    try {
      this.auth.changePassword(user, body?.current, body?.next, req.sessionId || "");
    } catch (error) {
      this.bad(error);
    }
  }

  @Post("email")
  emailChange(@CurrentUser() user: User, @Req() req: AuthedRequest, @Body() body: { email?: string; password?: string }) {
    try {
      const token = this.auth.requestEmailChange(user, body?.email, body?.password);
      const next = user.pendingEmail || "";
      this.email.send(
        this.email.templates.verifyEmail({
          to: next,
          name: user.name,
          verifyUrl: `${appBaseUrl(req)}/verify-email?token=${token}`,
        }),
      );
      return this.auth.publicUser(user);
    } catch (error) {
      this.bad(error);
    }
  }

  @Patch("preferences")
  preferences(@CurrentUser() user: User, @Body() body: Partial<UserPreferences>) {
    return { preferences: this.auth.updatePreferences(user, body || {}) };
  }

  @Get("sessions")
  sessions(@CurrentUser() user: User, @Req() req: AuthedRequest) {
    return this.auth.listSessions(user.id, req.sessionId || "");
  }

  @Delete("sessions/:id")
  @HttpCode(204)
  revoke(@CurrentUser() user: User, @Param("id") id: string) {
    this.auth.revokeSession(user.id, id);
  }

  @Post("sessions/revoke-others")
  @HttpCode(204)
  revokeOthers(@CurrentUser() user: User, @Req() req: AuthedRequest) {
    this.auth.revokeAll(user.id, req.sessionId);
  }

  @Get("export")
  exportData(@CurrentUser() user: User, @Req() req: AuthedRequest) {
    return {
      exportedAt: new Date().toISOString(),
      profile: this.auth.publicUser(user),
      sessions: this.auth.listSessions(user.id, req.sessionId || ""),
      projects: this.projects.listProjects(user.id).map((project) => ({
        id: project.id,
        name: project.name,
        templateId: project.templateId,
        sourceType: project.sourceType,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      })),
      billing: this.billing.exportFor(user.id),
    };
  }

  @Post("delete")
  @HttpCode(204)
  remove(@CurrentUser() user: User, @Body() body: { password?: string; confirm?: string }) {
    try {
      this.auth.assertDelete(user, body?.password, body?.confirm);
    } catch (error) {
      this.bad(error);
    }
    this.billing.release(user.id);
    this.projects.deleteAllForUser(user.id);
    this.removeAvatarFile(user.avatarUrl, user.id);
    this.auth.finalizeDelete(user.id);
  }

  @Get("connections")
  connections() {
    return [
      { provider: "google", name: "Google", connected: false, status: "coming_soon" },
      { provider: "github", name: "GitHub", connected: false, status: "coming_soon" },
    ];
  }

  @Post("avatar")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const user = (req as AuthedRequest).user;
          const dir = join(USER_UPLOADS, user!.id);
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `avatar-${randomUUID().slice(0, 8)}${ext || ".png"}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const ok = AVATAR_EXT.has(extname(file.originalname).toLowerCase());
        cb(ok ? null : new Error("Use a PNG, JPG, WEBP, or GIF."), ok);
      },
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  avatar(@CurrentUser() user: User, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException({ error: "Choose an image" });
    const previous = this.auth.setAvatar(user, `/uploads/users/${user.id}/${file.filename}`);
    this.removeAvatarFile(previous, user.id);
    return this.auth.publicUser(user);
  }

  @Delete("avatar")
  clearAvatar(@CurrentUser() user: User) {
    const previous = this.auth.clearAvatar(user);
    this.removeAvatarFile(previous, user.id);
    return this.auth.publicUser(user);
  }

  private removeAvatarFile(url: string | null | undefined, userId: string) {
    if (!url || !url.startsWith(`/uploads/users/${userId}/`) || url.includes("..")) return;
    const file = join(USER_UPLOADS, userId, url.split("/").pop() || "");
    if (existsSync(file)) {
      try {
        unlinkSync(file);
      } catch {
        /* the account update still stands */
      }
    }
  }
}
