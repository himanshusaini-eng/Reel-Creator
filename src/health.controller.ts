import { Controller, Get } from "@nestjs/common";
import { ffmpegAvailable } from "./paths";

@Controller("api")
export class HealthController {
  @Get("health")
  health() {
    return { ok: true, ffmpeg: ffmpegAvailable() };
  }
}
