import { Module, forwardRef } from "@nestjs/common";
import { ProjectsService } from "./projects.service";
import { ProjectsController } from "./projects.controller";
import { JobsModule } from "../jobs/jobs.module";
import { AuthModule } from "../auth/auth.module";
import { BillingModule } from "../billing/billing.module";

@Module({
  imports: [forwardRef(() => AuthModule), forwardRef(() => JobsModule), forwardRef(() => BillingModule)],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
