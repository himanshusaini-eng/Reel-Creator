import { Inject, Injectable, NotFoundException, forwardRef } from "@nestjs/common";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { existsSync, mkdirSync, statSync } from "fs";
import { join } from "path";
import { OUTPUT, ROOT } from "../paths";
import { ProjectsService } from "../projects/projects.service";
import type { Project } from "../projects/projects.types";
import { BillingService } from "../billing/billing.service";
import { AuthService } from "../auth/auth.service";
import { EmailService } from "../email/email.service";
import { AnalyticsService } from "../analytics/analytics.service";

export type Job = {
  id: string;
  userId: string;
  projectId: string;
  status: string;
  progress: number;
  outputUrl: string | null;
  error: string | null;
  createdAt: string;
};

@Injectable()
export class JobsService {
  private readonly jobs = new Map<string, Job>();

  constructor(
    @Inject(forwardRef(() => ProjectsService))
    private readonly projects: ProjectsService,
    @Inject(forwardRef(() => BillingService))
    private readonly billing: BillingService,
    @Inject(forwardRef(() => AuthService))
    private readonly auth: AuthService,
    private readonly email: EmailService,
    private readonly analytics: AnalyticsService,
  ) {}

  getJob(id: string, userId: string) {
    const job = this.jobs.get(id);
    if (!job || job.userId !== userId) throw new NotFoundException({ error: "Job not found" });
    return job;
  }

  startRender(project: Project, userId: string) {
    const jobId = randomUUID();
    const outDir = join(OUTPUT, userId, project.id);
    mkdirSync(outDir, { recursive: true });
    const outName = `${project.id.slice(0, 8)}-${Date.now()}.mp4`;
    const outPath = join(outDir, outName);
    const job: Job = {
      id: jobId,
      userId,
      projectId: project.id,
      status: "queued",
      progress: 0,
      outputUrl: null,
      error: null,
      createdAt: new Date().toISOString(),
    };
    this.jobs.set(jobId, job);

    const worker = join(ROOT, "worker", "render.mjs");
    const limits = this.billing.limitsFor(userId);
    const child = spawn(process.execPath, [worker, project.id, outPath], {
      cwd: ROOT,
      env: {
        ...process.env,
        REEL_FORCE_720: limits.exportHeight === 720 ? "1" : "0",
        REEL_WATERMARK: limits.watermark ? "1" : "0",
      },
    });

    job.status = "rendering";
    let buf = "";
    child.stdout.on("data", (chunk: Buffer) => {
      buf += chunk.toString();
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const line of lines) {
        const m = line.match(/PROGRESS\s+(\d+(?:\.\d+)?)/);
        if (m) job.progress = Math.min(99, Number(m[1]));
        if (line.startsWith("LOG ")) console.log(`[render ${jobId.slice(0, 6)}]`, line.slice(4));
      }
    });

    let errTail = "";
    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      errTail = (errTail + text).slice(-2000);
      console.error(`[render ${jobId.slice(0, 6)}]`, text);
    });

    child.on("close", (code) => {
      if (code === 0 && existsSync(outPath)) {
        job.status = "done";
        job.progress = 100;
        const outputUrl = `/output/${userId}/${project.id}/${outName}`;
        job.outputUrl = outputUrl;
        const latest = this.projects.readProject(project.id);
        if (latest) {
          const entry = {
            url: outputUrl,
            size: statSync(outPath).size,
            createdAt: new Date().toISOString(),
          };
          latest.exports = [entry, ...(latest.exports || [])];
          latest.lastOutput = outputUrl;
          this.projects.writeProject(latest);
        }
        this.analytics.collect({ event: "export", props: { status: "complete" }, path: "/app" });
        this.notifyExport(userId, project.name, outputUrl);
      } else {
        job.status = "error";
        job.error = "Export failed. Try again, or contact support if it keeps happening.";
        console.error(`[render ${jobId.slice(0, 6)}] exit ${code}`);
      }
    });

    return {
      ...job,
      notice: limits.watermark ? "Free plan exports are 720p and include a small watermark." : null,
    };
  }

  private notifyExport(userId: string, projectName: string, outputUrl: string) {
    const user = this.auth.getById(userId);
    if (!user || user.deletedAt) return;
    if (!this.auth.preferencesOf(user).notifications.exportReady) return;
    const base = (process.env.PUBLIC_APP_URL || "").replace(/\/$/, "");
    this.email.send(
      this.email.templates.exportComplete({
        to: user.email,
        name: user.name,
        project: projectName,
        url: base ? `${base}${outputUrl}` : outputUrl,
      }),
    );
  }
}
