import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { json, static as expressStatic } from "express";
import { existsSync, readFileSync } from "fs";
import { join, posix } from "path";
import { AppModule } from "./app.module";
import { ApiExceptionFilter } from "./common/http-exception.filter";
import { ensureReelBridge } from "./common/reel-bridge";
import { AuthService } from "./auth/auth.service";
import { ProjectsService } from "./projects/projects.service";
import {
  HTML_UPLOADS,
  OUTPUT,
  PORT,
  PUBLIC,
  TEMPLATES,
  UPLOADS,
  ensureDirs,
} from "./paths";
import type { AuthedRequest } from "./auth/user.decorator";

async function bootstrap() {
  ensureDirs();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  // Match original Express limits / static layout
  app.use(json({ limit: "20mb" }));
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useStaticAssets(PUBLIC, { index: false });
  app.useStaticAssets(TEMPLATES, { prefix: "/templates" });

  const auth = app.get(AuthService);
  const projects = app.get(ProjectsService);
  const http = app.getHttpAdapter().getInstance();

  http.use(["/uploads", "/output"], (req: AuthedRequest, res: any, next: any) => {
    const user = auth.resolveUser(req) || req.user;
    if (!user) return res.status(401).send("Sign in required");
    req.user = user;

    let path: string;
    try {
      path = posix.normalize(decodeURIComponent(req.path));
    } catch {
      return res.status(400).send("Bad path");
    }
    if (path.includes("..")) return res.status(404).send("Not found");

    const [, scope, owner] = path.split("/");
    const uid = user.id;
    if (req.baseUrl === "/output") {
      if (scope !== uid) return res.status(404).send("Not found");
    } else if (scope === "html") {
      if (!projects.listProjects(uid).some((p) => p.htmlUploadId === owner)) {
        return res.status(404).send("Not found");
      }
    } else if (scope === "users") {
      if (owner !== uid) return res.status(404).send("Not found");
    }
    next();
  });

  http.get("/uploads/html/:id/index.html", (req: AuthedRequest, res: any) => {
    const user = auth.resolveUser(req) || req.user;
    if (!user) return res.status(401).send("Sign in required");
    const id = String(req.params.id);
    const file = join(HTML_UPLOADS, id, "index.html");
    if (!existsSync(file)) return res.status(404).send("Not found");
    if (!projects.listProjects(user.id).some((p) => p.htmlUploadId === id)) {
      return res.status(404).send("Not found");
    }
    const html = ensureReelBridge(readFileSync(file, "utf8"));
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.send(html);
  });

  http.use("/uploads", expressStatic(UPLOADS));
  http.use("/output", expressStatic(OUTPUT));

  await app.listen(PORT);
  console.log(`Reel Creator (NestJS) → http://localhost:${PORT}`);
}

bootstrap();
