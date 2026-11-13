import { Module, forwardRef } from "@nestjs/common";
import { UploadsController } from "./uploads.controller";
import { ProjectsModule } from "../projects/projects.module";
import { AuthModule } from "../auth/auth.module";
import { BillingModule } from "../billing/billing.module";

@Module({
  imports: [AuthModule, ProjectsModule, forwardRef(() => BillingModule)],
  controllers: [UploadsController],
})
export class UploadsModule {}
