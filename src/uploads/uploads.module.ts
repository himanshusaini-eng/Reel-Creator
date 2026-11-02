import { Module } from "@nestjs/common";
import { UploadsController } from "./uploads.controller";
import { ProjectsModule } from "../projects/projects.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule, ProjectsModule],
  controllers: [UploadsController],
})
export class UploadsModule {}
