import { Controller, Get, Param } from "@nestjs/common";
import { TemplatesService } from "./templates.service";

@Controller("api/templates")
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get()
  list() {
    return this.templates.list();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.templates.get(id);
  }

  @Get(":id/source")
  source(@Param("id") id: string) {
    return this.templates.source(id);
  }
}
