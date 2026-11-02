import { Inject, Injectable, NotFoundException, forwardRef } from "@nestjs/common";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { existsSync, mkdirSync, statSync } from "fs";
import { join } from "path";
import { OUTPUT, ROOT } from "../paths";
import { ProjectsService } from "../projects/projects.service";
import type { Project } from "../projects/projects.types";

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
    const child = spawn(process.execPath, [worker, project.id, outPath], {
      cwd: ROOT,
      env: { ...process.env },
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
        job.outputUrl = `/output/${userId}/${project.id}/${outName}`;
        const latest = this.projects.readProject(project.id);
        if (latest) {
          const entry = {
            url: job.outputUrl,
            size: statSync(outPath).size,
            createdAt: new Date().toISOString(),
          };
          latest.exports = [entry, ...(latest.exports || [])];
          latest.lastOutput = job.outputUrl;
          this.projects.writeProject(latest);
        }
      } else {
        job.status = "error";
        const lastLine = errTail.trim().split("\n").filter(Boolean).pop();
        job.error = `Render failed (exit ${code})${lastLine ? `: ${lastLine.slice(0, 300)}` : ""}`;
      }
    });

    return job;
  }
}
