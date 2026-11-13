import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { json, static as expressStatic } from "express";
import { existsSync, readFileSync } from "fs";
import { join, posix } from "path";
import { AppModule } from "./app.module";
import { ApiExceptionFilter } from "./common/http-exception.filter";
import { securityMiddleware } from "./common/security.middleware";
import { compress } from "./common/compress";
import { redact } from "./common/redact";
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

process.on("unhandledRejection", (error) => {
  console.error("[unhandled]", redact(error));
});
process.on("uncaughtException", (error) => {
  console.error("[uncaught]", redact(error));
  process.exit(1);
});

async function bootstrap() {
  ensureDirs();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);

  app.use(securityMiddleware);
  app.use(compress);
  app.use(json({ limit: "20mb" }));
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useStaticAssets(PUBLIC, {
    index: false,
    maxAge: process.env.NODE_ENV === "production" ? "10m" : 0,
    setHeaders(res, filePath) {
      if (filePath.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");
    },
  });
  app.useStaticAssets(TEMPLATES, { prefix: "/templates", maxAge: process.env.NODE_ENV === "production" ? "1h" : 0 });

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
      if (/\.(html?|js|svg|xml)$/i.test(path)) return res.status(404).send("Not found");
    }
    res.setHeader("X-Content-Type-Options", "nosniff");
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
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(html);
  });

  http.use("/uploads", expressStatic(UPLOADS, { maxAge: 0 }));
  http.use("/output", expressStatic(OUTPUT, { maxAge: process.env.NODE_ENV === "production" ? "1d" : 0 }));

  await app.init();
  http.use((req: AuthedRequest, res: any) => {
    if (String(req.path || "").startsWith("/api")) {
      return res.status(404).json({ error: "Not found" });
    }
    res.status(404);
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(join(PUBLIC, "404.html"));
  });

  await app.listen(PORT);
  console.log(`Reel Creator (NestJS) → http://localhost:${PORT}`);
}

bootstrap();
