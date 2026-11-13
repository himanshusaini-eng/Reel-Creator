import { Controller, Get, Header } from "@nestjs/common";
import { publicConfig } from "./public-config";

@Controller("api/config")
export class ConfigController {
  @Get("public")
  @Header("Cache-Control", "no-store")
  config() {
    return publicConfig();
  }
}
