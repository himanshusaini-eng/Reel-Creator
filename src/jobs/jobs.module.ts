import { Module, forwardRef } from "@nestjs/common";
import { JobsService } from "./jobs.service";
import { ProjectsModule } from "../projects/projects.module";

@Module({
  imports: [forwardRef(() => ProjectsModule)],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
