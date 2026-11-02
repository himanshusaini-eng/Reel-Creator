import { Injectable, NotFoundException } from "@nestjs/common";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { TEMPLATES } from "../paths";

@Injectable()
export class TemplatesService {
  list() {
    return readdirSync(TEMPLATES)
      .filter((name) => existsSync(join(TEMPLATES, name, "meta.json")))
      .map((id) => {
        const meta = JSON.parse(readFileSync(join(TEMPLATES, id, "meta.json"), "utf8"));
        return { id, ...meta };
      })
      .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  }

  get(id: string) {
    const metaPath = join(TEMPLATES, id, "meta.json");
    if (!existsSync(metaPath)) throw new NotFoundException({ error: "Template not found" });
    const meta = JSON.parse(readFileSync(metaPath, "utf8"));
    return { id, ...meta };
  }

  source(id: string) {
    const path = join(TEMPLATES, id, "index.html");
    if (!existsSync(path)) throw new NotFoundException({ error: "Template HTML not found" });
    return {
      html: readFileSync(path, "utf8"),
      editable: true,
      sourceType: "template",
      path: `templates/${id}/index.html`,
    };
  }
}
