import { Module, forwardRef } from "@nestjs/common";
import { JobsService } from "./jobs.service";
import { ProjectsModule } from "../projects/projects.module";
import { BillingModule } from "../billing/billing.module";
import { AuthModule } from "../auth/auth.module";
import { EmailModule } from "../email/email.module";
import { AnalyticsModule } from "../analytics/analytics.module";

@Module({
  imports: [
    forwardRef(() => ProjectsModule),
    forwardRef(() => BillingModule),
    forwardRef(() => AuthModule),
    EmailModule,
    AnalyticsModule,
  ],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
