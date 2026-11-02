import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  InternalServerErrorException,
  Param,
  Post,
  Put,
  UseGuards,
  forwardRef,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/user.decorator";
import type { User } from "../auth/auth.types";
import { ProjectsService } from "./projects.service";
import type { Project } from "./projects.types";
import { JobsService } from "../jobs/jobs.service";

@Controller("api")
@UseGuards(AuthGuard)
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    @Inject(forwardRef(() => JobsService))
    private readonly jobs: JobsService,
  ) {}

  @Get("projects")
  list(@CurrentUser() user: User) {
    return this.projects
      .listProjects(user.id)
      .map((p) => ({
        id: p.id,
        name: p.name,
        templateId: p.templateId,
        sourceType: p.sourceType || "template",
        updatedAt: p.updatedAt,
        lastOutput: p.lastOutput || null,
        exportCount: p.exports?.length || 0,
      }))
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  }

  @Get("projects/:id")
  get(@Param("id") id: string, @CurrentUser() user: User) {
    return this.projects.requireOwned(id, user.id);
  }

  @Post("projects")
  @HttpCode(201)
  create(
    @CurrentUser() user: User,
    @Body() body: { templateId?: string; name?: string; data?: Record<string, unknown>; video?: unknown },
  ) {
    try {
      return this.projects.createFromTemplate(user.id, body || {});
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 400) throw new BadRequestException({ error: err.message });
      throw e;
    }
  }

  @Put("projects/:id")
  update(@Param("id") id: string, @CurrentUser() user: User, @Body() body: Partial<Project>) {
    return this.projects.update(id, user.id, body || {});
  }

  @Post("projects/:id/duplicate")
  @HttpCode(201)
  duplicate(
    @Param("id") id: string,
    @CurrentUser() user: User,
    @Body() body: { name?: string },
  ) {
    return this.projects.duplicate(id, user.id, body?.name);
  }

  @Delete("projects/:id")
  @HttpCode(204)
  remove(@Param("id") id: string, @CurrentUser() user: User) {
    try {
      this.projects.delete(id, user.id);
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 500) throw new InternalServerErrorException({ error: err.message });
      throw e;
    }
  }

  @Get("projects/:id/exports")
  exports(@Param("id") id: string, @CurrentUser() user: User) {
    return this.projects.requireOwned(id, user.id).exports || [];
  }

  @Get("projects/:id/source")
  source(@Param("id") id: string, @CurrentUser() user: User) {
    return this.projects.getSource(id, user.id);
  }

  @Put("projects/:id/source")
  saveSource(
    @Param("id") id: string,
    @CurrentUser() user: User,
    @Body() body: { html?: string },
  ) {
    try {
      return this.projects.saveSource(id, user.id, String(body?.html ?? ""));
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 400) throw new BadRequestException({ error: err.message });
      throw e;
    }
  }

  @Post("projects/:id/render")
  @HttpCode(202)
  render(@Param("id") id: string, @CurrentUser() user: User) {
    const project = this.projects.requireOwned(id, user.id);
    return this.jobs.startRender(project, user.id);
  }

  @Get("jobs/:id")
  job(@Param("id") id: string, @CurrentUser() user: User) {
    return this.jobs.getJob(id, user.id);
  }

  @Get("outputs")
  outputs(@CurrentUser() user: User) {
    return this.projects.listOutputs(user.id);
  }
}
