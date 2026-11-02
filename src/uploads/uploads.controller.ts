import {
  BadRequestException,
  Controller,
  HttpCode,
  Post,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
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

type HtmlUploadRequest = Request & {
  user?: User;
  htmlUploadId?: string;
  htmlUploadDir?: string;
};

@Controller("api")
@UseGuards(AuthGuard)
export class UploadsController {
  constructor(private readonly projects: ProjectsService) {}

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

    return this.projects.createFromHtmlUpload(user.id, {
      htmlUploadId: req.htmlUploadId!,
      htmlUploadDir: req.htmlUploadDir!,
      originalName: htmlFile.originalname,
      duration: Number((req.body as { duration?: string })?.duration) || undefined,
      name: (req.body as { name?: string })?.name,
    });
  }
}
