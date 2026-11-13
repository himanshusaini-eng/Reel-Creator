import {
  BadRequestException,
  Controller,
  HttpCode,
  Inject,
  Post,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  forwardRef,
} from "@nestjs/common";
import { FileFieldsInterceptor, FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { randomUUID } from "crypto";
import { existsSync, mkdirSync, rmSync } from "fs";
import { basename, extname, join } from "path";
import type { Request } from "express";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/user.decorator";
import type { User } from "../auth/auth.types";
import { HTML_UPLOADS, USER_UPLOADS } from "../paths";
import { ProjectsService } from "../projects/projects.service";
import { BillingService } from "../billing/billing.service";

type HtmlUploadRequest = Request & {
  user?: User;
  htmlUploadId?: string;
  htmlUploadDir?: string;
};

@Controller("api")
@UseGuards(AuthGuard)
export class UploadsController {
  constructor(
    private readonly projects: ProjectsService,
    @Inject(forwardRef(() => BillingService))
    private readonly billing: BillingService,
  ) {}

  @Post("upload")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const user = (req as HtmlUploadRequest).user;
          const dir = join(USER_UPLOADS, user!.id);
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const id = randomUUID().slice(0, 8);
          cb(null, `${id}${extname(file.originalname) || ".png"}`);
        },
      }),
      limits: { fileSize: 200 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        const allowed = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".mp4", ".webm", ".mov", ".m4v", ".mp3", ".wav", ".m4a", ".aac"];
        if (!allowed.includes(ext) || file.originalname.includes("..") || file.originalname.includes("\0")) {
          cb(new Error("That file type isn’t supported."), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  upload(@CurrentUser() user: User, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException({ error: "No file" });
    return {
      url: `/uploads/users/${user.id}/${file.filename}`,
      filename: file.filename,
    };
  }

  @Post("upload-html")
  @HttpCode(201)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "html", maxCount: 1 },
        { name: "assets", maxCount: 40 },
      ],
      {
        storage: diskStorage({
          destination: (req, file, cb) => {
            const r = req as HtmlUploadRequest;
            if (!r.htmlUploadId) {
              r.htmlUploadId = randomUUID();
              r.htmlUploadDir = join(HTML_UPLOADS, r.htmlUploadId);
              mkdirSync(join(r.htmlUploadDir, "assets"), { recursive: true });
            }
            const ext = extname(file.originalname).toLowerCase();
            const isHtml = ext === ".html" || ext === ".htm" || file.mimetype === "text/html";
            cb(null, isHtml ? r.htmlUploadDir! : join(r.htmlUploadDir!, "assets"));
          },
          filename: (_req, file, cb) => {
            const ext = extname(file.originalname).toLowerCase();
            const isHtml = ext === ".html" || ext === ".htm" || file.mimetype === "text/html";
            cb(null, isHtml ? "index.html" : basename(file.originalname));
          },
        }),
        limits: { fileSize: 15 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
          const name = file.originalname;
          const ext = extname(name).toLowerCase();
          if (name.includes("..") || name.includes("\0") || name.includes("/") || name.includes("\\")) {
            cb(new Error("That file name isn’t allowed."), false);
            return;
          }
          const blocked = [".exe", ".dll", ".bat", ".cmd", ".ps1", ".sh", ".msi"];
          if (blocked.includes(ext)) {
            cb(new Error("That file type isn’t supported."), false);
            return;
          }
          cb(null, true);
        },
      },
    ),
  )
  uploadHtml(
    @Req() req: HtmlUploadRequest,
    @CurrentUser() user: User,
    @UploadedFiles()
    files: { html?: Express.Multer.File[]; assets?: Express.Multer.File[] },
  ) {
    const htmlFile = files?.html?.[0];
    if (!htmlFile) {
      if (req.htmlUploadDir && existsSync(req.htmlUploadDir)) {
        rmSync(req.htmlUploadDir, { recursive: true, force: true });
      }
      throw new BadRequestException({ error: "Upload an .html file (field name: html)" });
    }
    try {
      this.billing.assertCanCreate(user.id, this.projects.listProjects(user.id).length);
    } catch (error) {
      if (req.htmlUploadDir && existsSync(req.htmlUploadDir)) {
        rmSync(req.htmlUploadDir, { recursive: true, force: true });
      }
      throw error;
    }

    return this.projects.createFromHtmlUpload(user.id, {
      htmlUploadId: req.htmlUploadId!,
      htmlUploadDir: req.htmlUploadDir!,
      originalName: htmlFile.originalname,
      duration: Number((req.body as { duration?: string })?.duration) || undefined,
      name: (req.body as { name?: string })?.name,
    });
  }
}
