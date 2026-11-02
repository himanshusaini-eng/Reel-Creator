import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { AuthMiddleware } from "./auth/auth.middleware";
import { ProjectsModule } from "./projects/projects.module";
import { TemplatesModule } from "./templates/templates.module";
import { UploadsModule } from "./uploads/uploads.module";
import { JobsModule } from "./jobs/jobs.module";
import { PagesController } from "./pages/pages.controller";
import { HealthController } from "./health.controller";

@Module({
  imports: [AuthModule, ProjectsModule, TemplatesModule, UploadsModule, JobsModule],
  controllers: [PagesController, HealthController],
  providers: [AuthMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes("*");
  }
}
