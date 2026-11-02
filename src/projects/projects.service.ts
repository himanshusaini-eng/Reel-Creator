import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  rmSync,
  statSync,
  cpSync,
  renameSync,
} from "fs";
import { basename, extname, join } from "path";
import { ensureReelBridge } from "../common/reel-bridge";
import { HTML_UPLOADS, OUTPUT, PROJECTS, ROOT, TEMPLATES } from "../paths";
import type { Project } from "./projects.types";

@Injectable()
export class ProjectsService {
  readProject(id: string): Project | null {
    if (!/^[\w-]+$/.test(String(id))) return null;
    const path = join(PROJECTS, `${id}.json`);
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf8")) as Project;
  }

  readOwnedProject(id: string, userId: string): Project | null {
    const p = this.readProject(id);
    return p && p.userId === userId ? p : null;
  }

  requireOwned(id: string, userId: string): Project {
    const p = this.readOwnedProject(id, userId);
    if (!p) throw new NotFoundException({ error: "Project not found" });
    return p;
  }

  writeProject(project: Project) {
    writeFileSync(join(PROJECTS, `${project.id}.json`), JSON.stringify(project, null, 2));
  }

  listProjects(userId: string): Project[] {
    return readdirSync(PROJECTS)
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(readFileSync(join(PROJECTS, f), "utf8")) as Project)
      .filter((p) => p.userId === userId);
  }

  claimOrphanProjects(userId: string) {
    const loose = readdirSync(OUTPUT).filter((f) => f.endsWith(".mp4"));
    for (const f of readdirSync(PROJECTS).filter((name) => name.endsWith(".json"))) {
      const p = JSON.parse(readFileSync(join(PROJECTS, f), "utf8")) as Project;
      if (p.userId) continue;
      p.userId = userId;
      p.exports = [];
      const dir = join(OUTPUT, userId, p.id);
      for (const name of loose.filter((n) => n.startsWith(`${p.id.slice(0, 8)}-`))) {
        mkdirSync(dir, { recursive: true });
        const { mtime, size } = statSync(join(OUTPUT, name));
        renameSync(join(OUTPUT, name), join(dir, name));
        p.exports.push({
          url: `/output/${userId}/${p.id}/${name}`,
          size,
          createdAt: mtime.toISOString(),
        });
      }
      p.exports.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      p.lastOutput = p.exports[0]?.url || null;
      this.writeProject(p);
    }
  }

  createFromTemplate(
    userId: string,
    body: { templateId?: string; name?: string; data?: Record<string, unknown>; video?: unknown },
  ) {
    const { templateId, name, data, video } = body || {};
    if (!templateId) throw Object.assign(new Error("templateId required"), { status: 400 });
    const metaPath = join(TEMPLATES, templateId, "meta.json");
    if (!existsSync(metaPath)) throw Object.assign(new Error("Unknown template"), { status: 400 });
    const meta = JSON.parse(readFileSync(metaPath, "utf8")) as {
      name: string;
      defaults?: Record<string, unknown>;
    };
    const now = new Date().toISOString();
    const project: Project = {
      id: randomUUID(),
      userId,
      name: (name && String(name).trim()) || `${meta.name} project`,
      sourceType: "template",
      templateId,
      data: data || structuredClone(meta.defaults || {}),
      video: video || null,
      overlays: [],
      createdAt: now,
      updatedAt: now,
      lastOutput: null,
      exports: [],
    };
    this.writeProject(project);
    return project;
  }

  update(id: string, userId: string, body: Partial<Project>) {
    const existing = this.requireOwned(id, userId);
    const next: Project = {
      ...existing,
      name: body.name ?? existing.name,
      data: body.data ?? existing.data,
      video: body.video ?? existing.video ?? null,
      overlays: Array.isArray(body.overlays) ? body.overlays : existing.overlays || [],
      updatedAt: new Date().toISOString(),
    };
    this.writeProject(next);
    return next;
  }

  createHtmlUploadDir() {
    const id = randomUUID();
    const dir = join(HTML_UPLOADS, id);
    mkdirSync(join(dir, "assets"), { recursive: true });
    return { id, dir };
  }

  copyWorkspaceAssets(htmlDir: string) {
    const parentAssets = join(ROOT, "..", "assets");
    const dest = join(htmlDir, "assets");
    if (existsSync(parentAssets)) {
      try {
        cpSync(parentAssets, dest, { recursive: true });
      } catch {
        /* ignore */
      }
    }
  }

  duplicate(id: string, userId: string, name?: string) {
    const src = this.requireOwned(id, userId);
    const now = new Date().toISOString();
    const copy: Project = {
      ...structuredClone(src),
      id: randomUUID(),
      name: (name && String(name).trim()) || `${src.name} copy`,
      createdAt: now,
      updatedAt: now,
      lastOutput: null,
      exports: [],
    };
    if (src.htmlUploadId) {
      const created = this.createHtmlUploadDir();
      cpSync(join(HTML_UPLOADS, src.htmlUploadId), created.dir, { recursive: true });
      copy.htmlUploadId = created.id;
      copy.htmlPath = `uploads/html/${created.id}/index.html`;
      copy.previewUrl = `/uploads/html/${created.id}/index.html`;
    }
    this.writeProject(copy);
    return copy;
  }

  delete(id: string, userId: string) {
    const project = this.requireOwned(id, userId);
    if (project.htmlUploadId) {
      const htmlDir = join(HTML_UPLOADS, project.htmlUploadId);
      if (existsSync(htmlDir)) {
        try {
          rmSync(htmlDir, { recursive: true, force: true });
        } catch {
          /* ignore */
        }
      }
    }
    const file = join(PROJECTS, `${project.id}.json`);
    try {
      unlinkSync(file);
    } catch {
      throw Object.assign(new Error("Could not delete project"), { status: 500 });
    }
  }

  guessDuration(html: string) {
    const m =
      html.match(/const\s+DUR\s*=\s*([0-9.]+)/) ||
      html.match(/(?<![-\w])duration\s*:\s*([0-9.]+)/) ||
      html.match(/\bDUR\s*=\s*([0-9.]+)/);
    return m ? Number(m[1]) || null : null;
  }

  prepareHtmlSource(html: string) {
    let out = ensureReelBridge(html || "");
    if (!/<base\s/i.test(out)) {
      const base = `<base href="./">`;
      out = out.includes("<head>") ? out.replace("<head>", `<head>${base}`) : `${base}${out}`;
    }
    return out;
  }

  resolveProjectHtmlPath(project: Project) {
    if (project.sourceType === "html" && project.htmlUploadId) {
      return join(HTML_UPLOADS, project.htmlUploadId, "index.html");
    }
    if (project.templateId && project.templateId !== "custom-html") {
      return join(TEMPLATES, project.templateId, "index.html");
    }
    return null;
  }

  getSource(id: string, userId: string) {
    const project = this.requireOwned(id, userId);
    const path = this.resolveProjectHtmlPath(project);
    if (!path || !existsSync(path)) throw new NotFoundException({ error: "HTML source not found" });
    const html = readFileSync(path, "utf8");
    return {
      html,
      editable: true,
      sourceType: project.sourceType || "template",
      path: project.htmlPath || `templates/${project.templateId}/index.html`,
    };
  }

  saveSource(id: string, userId: string, rawHtml: string) {
    const project = this.requireOwned(id, userId);
    const html = this.prepareHtmlSource(String(rawHtml ?? ""));
    if (!html.trim()) throw Object.assign(new Error("HTML is empty"), { status: 400 });

    let htmlUploadId = project.htmlUploadId;
    if (project.sourceType !== "html" || !htmlUploadId) {
      const created = this.createHtmlUploadDir();
      htmlUploadId = created.id;
      this.copyWorkspaceAssets(created.dir);
      if (project.templateId && project.templateId !== "custom-html") {
        const tplAssets = join(TEMPLATES, project.templateId);
        try {
          if (existsSync(tplAssets)) {
            for (const name of readdirSync(tplAssets)) {
              if (name === "index.html" || name === "meta.json") continue;
              cpSync(join(tplAssets, name), join(created.dir, name), { recursive: true });
            }
          }
        } catch {
          /* ignore */
        }
      }
      project.sourceType = "html";
      project.templateId = project.templateId || "custom-html";
      project.htmlUploadId = htmlUploadId;
      project.htmlPath = `uploads/html/${htmlUploadId}/index.html`;
      project.previewUrl = `/uploads/html/${htmlUploadId}/index.html`;
    }

    const htmlPath = join(HTML_UPLOADS, htmlUploadId!, "index.html");
    writeFileSync(htmlPath, html);
    const duration = this.guessDuration(html) || project.duration || 18;
    project.duration = duration;
    project.data = { ...(project.data || {}), duration };
    project.updatedAt = new Date().toISOString();
    this.writeProject(project);
    return { ok: true, project, previewUrl: project.previewUrl, duration };
  }

  createFromHtmlUpload(
    userId: string,
    opts: {
      htmlUploadId: string;
      htmlUploadDir: string;
      originalName: string;
      duration?: number;
      name?: string;
    },
  ) {
    const htmlPath = join(opts.htmlUploadDir, "index.html");
    writeFileSync(htmlPath, this.prepareHtmlSource(readFileSync(htmlPath, "utf8")));
    this.copyWorkspaceAssets(opts.htmlUploadDir);
    const html = readFileSync(htmlPath, "utf8");
    const duration = Number(opts.duration) || this.guessDuration(html) || 18;
    const name =
      (opts.name && String(opts.name).trim()) ||
      basename(opts.originalName, extname(opts.originalName)) ||
      "Uploaded HTML reel";
    const now = new Date().toISOString();
    const project: Project = {
      id: randomUUID(),
      userId,
      name,
      sourceType: "html",
      templateId: "custom-html",
      htmlUploadId: opts.htmlUploadId,
      htmlPath: `uploads/html/${opts.htmlUploadId}/index.html`,
      previewUrl: `/uploads/html/${opts.htmlUploadId}/index.html`,
      data: { duration },
      duration,
      overlays: [],
      createdAt: now,
      updatedAt: now,
      lastOutput: null,
      exports: [],
    };
    this.writeProject(project);
    return project;
  }

  listOutputs(userId: string) {
    const files: Array<{
      name: string;
      url: string;
      size: number;
      mtime: string;
      projectId: string;
      projectName: string;
    }> = [];
    for (const p of this.listProjects(userId)) {
      for (const e of p.exports || []) {
        files.push({
          name: basename(e.url),
          url: e.url,
          size: e.size,
          mtime: e.createdAt,
          projectId: p.id,
          projectName: p.name,
        });
      }
    }
    files.sort((a, b) => b.mtime.localeCompare(a.mtime));
    return files;
  }
}
