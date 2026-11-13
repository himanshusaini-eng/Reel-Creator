import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { AuthMiddleware } from "./auth/auth.middleware";
import { ProjectsModule } from "./projects/projects.module";
import { TemplatesModule } from "./templates/templates.module";
import { UploadsModule } from "./uploads/uploads.module";
import { JobsModule } from "./jobs/jobs.module";
import { EmailModule } from "./email/email.module";
import { BillingModule } from "./billing/billing.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { MonitorModule } from "./monitor/monitor.module";
import { SupportModule } from "./support/support.module";
import { ConfigModule } from "./config/config.module";
import { PagesController } from "./pages/pages.controller";
import { HealthController } from "./health.controller";

@Module({
  imports: [
    EmailModule,
    AuthModule,
    BillingModule,
    AnalyticsModule,
    MonitorModule,
    SupportModule,
    ConfigModule,
    ProjectsModule,
    TemplatesModule,
    UploadsModule,
    JobsModule,
  ],
  controllers: [PagesController, HealthController],
  providers: [AuthMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes("*");
  }
}
