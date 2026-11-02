import { Controller, Get, Param, Req, Res } from "@nestjs/common";
import type { Response } from "express";
import { join } from "path";
import { PUBLIC } from "../paths";
import { ProjectsService } from "../projects/projects.service";
import type { AuthedRequest } from "../auth/user.decorator";



@Controller()
export class PagesController {
  constructor(private readonly projects: ProjectsService) {}

  private send(res: Response, name: string) {
    return res.sendFile(join(PUBLIC, name));
  }

  @Get()
  landing(@Req() req: AuthedRequest, @Res() res: Response) {
    if (req.user) return res.redirect("/app");
    return this.send(res, "landing.html");
  }

  @Get(["signin", "signup"])
  auth(@Req() req: AuthedRequest, @Res() res: Response) {
    if (req.user) return res.redirect("/app");
    return this.send(res, "auth.html");
  }

  @Get("app")
  home(@Req() req: AuthedRequest, @Res() res: Response) {
    if (!req.user) return res.redirect(`/signin?next=${encodeURIComponent(req.originalUrl)}`);
    return this.send(res, "home.html");
  }

  @Get("app/new")
  newProject(@Req() req: AuthedRequest, @Res() res: Response) {
    if (!req.user) return res.redirect(`/signin?next=${encodeURIComponent(req.originalUrl)}`);
    return this.send(res, "new.html");
  }

  @Get(["app/projects/:id", "app/projects/:id/exports"])
  editor(@Param("id") id: string, @Req() req: AuthedRequest, @Res() res: Response) {
    if (!req.user) return res.redirect(`/signin?next=${encodeURIComponent(req.originalUrl)}`);
    if (!this.projects.readOwnedProject(id, req.user.id)) return res.redirect("/app");
    return this.send(res, "editor.html");
  }
}
