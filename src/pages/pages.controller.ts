import { Controller, Get, Header, Param, Req, Res } from "@nestjs/common";
import type { Response } from "express";
import { join } from "path";
import { PUBLIC } from "../paths";
import { ProjectsService } from "../projects/projects.service";
import type { AuthedRequest } from "../auth/user.decorator";
import { renderDocument } from "./documents";

const DOCS = ["privacy", "terms", "cookies", "refunds", "guidelines", "faq", "changelog", "shortcuts", "support"];

@Controller()
export class PagesController {
  constructor(private readonly projects: ProjectsService) {}

  private send(res: Response, name: string) {
    res.setHeader("Cache-Control", "no-cache");
    return res.sendFile(join(PUBLIC, name));
  }

  private requireUser(req: AuthedRequest, res: Response) {
    if (req.user) return true;
    res.redirect(`/signin?next=${encodeURIComponent(req.originalUrl)}`);
    return false;
  }

  @Get()
  landing(@Req() req: AuthedRequest, @Res() res: Response) {
    if (req.user) return res.redirect("/app");
    return this.send(res, "landing.html");
  }

  @Get("features")
  features(@Res() res: Response) {
    return this.send(res, "features.html");
  }

  @Get("about")
  about(@Res() res: Response) {
    return this.send(res, "about.html");
  }

  @Get("templates")
  templates(@Res() res: Response) {
    return this.send(res, "templates.html");
  }

  @Get("pricing")
  pricing(@Res() res: Response) {
    return this.send(res, "pricing.html");
  }

  @Get(["signin", "signup"])
  auth(@Req() req: AuthedRequest, @Res() res: Response) {
    if (req.user) return res.redirect("/app");
    return this.send(res, "auth.html");
  }

  @Get("forgot-password")
  forgotPassword(@Req() req: AuthedRequest, @Res() res: Response) {
    if (req.user) return res.redirect("/app");
    return this.send(res, "forgot.html");
  }

  @Get("reset-password")
  resetPassword(@Req() req: AuthedRequest, @Res() res: Response) {
    if (req.user) return res.redirect("/app");
    return this.send(res, "reset.html");
  }

  @Get("verify-email")
  verifyEmail(@Res() res: Response) {
    return this.send(res, "verify.html");
  }

  @Get(DOCS)
  document(@Req() req: AuthedRequest, @Res() res: Response) {
    const slug = String(req.path || "").replace(/^\//, "");
    const html = renderDocument(slug);
    if (!html) {
      res.status(404);
      return this.send(res, "404.html");
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.send(html);
  }

  @Get("contact")
  contact(@Res() res: Response) {
    return this.send(res, "contact.html");
  }

  @Get("help")
  help(@Res() res: Response) {
    return this.send(res, "help.html");
  }

  @Get("support/bug")
  bug(@Res() res: Response) {
    return this.send(res, "bug.html");
  }

  @Get("support/feature")
  feature(@Res() res: Response) {
    return this.send(res, "feature.html");
  }

  @Get("offline")
  offline(@Res() res: Response) {
    res.status(200);
    return this.send(res, "offline.html");
  }

  @Get("500")
  @Header("Cache-Control", "no-store")
  serverError(@Res() res: Response) {
    res.status(500);
    return this.send(res, "500.html");
  }

  @Get("app")
  home(@Req() req: AuthedRequest, @Res() res: Response) {
    if (!this.requireUser(req, res)) return;
    return this.send(res, "home.html");
  }

  @Get("app/new")
  newProject(@Req() req: AuthedRequest, @Res() res: Response) {
    if (!this.requireUser(req, res)) return;
    return this.send(res, "new.html");
  }

  @Get("app/settings")
  settings(@Req() req: AuthedRequest, @Res() res: Response) {
    if (!this.requireUser(req, res)) return;
    return this.send(res, "settings.html");
  }

  @Get("app/billing")
  billing(@Req() req: AuthedRequest, @Res() res: Response) {
    if (!this.requireUser(req, res)) return;
    return this.send(res, "billing.html");
  }

  @Get("app/billing/result")
  billingResult(@Req() req: AuthedRequest, @Res() res: Response) {
    if (!this.requireUser(req, res)) return;
    return this.send(res, "billing-result.html");
  }

  @Get(["app/projects/:id", "app/projects/:id/exports"])
  editor(@Param("id") id: string, @Req() req: AuthedRequest, @Res() res: Response) {
    if (!this.requireUser(req, res)) return;
    if (!this.projects.readOwnedProject(id, req.user!.id)) return res.redirect("/app");
    return this.send(res, "editor.html");
  }
}
