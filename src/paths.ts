import { existsSync, mkdirSync } from "fs";
import { join } from "path";

export const ROOT = join(__dirname, "..");
export const PUBLIC = join(ROOT, "public");
export const TEMPLATES = join(ROOT, "templates");
export const PROJECTS = join(ROOT, "projects");
export const OUTPUT = join(ROOT, "output");
export const UPLOADS = join(ROOT, "uploads");
export const HTML_UPLOADS = join(UPLOADS, "html");
export const USER_UPLOADS = join(UPLOADS, "users");
export const DATA = join(ROOT, "data");
export const PORT = Number(process.env.PORT) || 3847;

export function ensureDirs() {
  for (const dir of [PROJECTS, OUTPUT, UPLOADS, HTML_UPLOADS, USER_UPLOADS, DATA]) {
    mkdirSync(dir, { recursive: true });
  }
}

export function ffmpegAvailable() {
  return existsSync("/opt/homebrew/bin/ffmpeg") || !!process.env.FFMPEG_PATH;
}
