import { Module, forwardRef } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { AccountController } from "./account.controller";
import { AuthGuard } from "./auth.guard";
import { AuthMiddleware } from "./auth.middleware";
import { ProjectsModule } from "../projects/projects.module";
import { EmailModule } from "../email/email.module";
import { BillingModule } from "../billing/billing.module";

@Module({
  imports: [forwardRef(() => ProjectsModule), forwardRef(() => BillingModule), EmailModule],
  controllers: [AuthController, AccountController],
  providers: [AuthService, AuthGuard, AuthMiddleware],
  exports: [AuthService, AuthGuard, AuthMiddleware],
})
export class AuthModule {}
