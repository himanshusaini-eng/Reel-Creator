import { Module, forwardRef } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthMiddleware } from "./auth.middleware";
import { ProjectsModule } from "../projects/projects.module";

@Module({
  imports: [forwardRef(() => ProjectsModule)],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, AuthMiddleware],
  exports: [AuthService, AuthGuard, AuthMiddleware],
})
export class AuthModule {}
