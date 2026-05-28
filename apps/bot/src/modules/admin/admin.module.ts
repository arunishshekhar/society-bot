import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { AdminApiKeyGuard } from "./admin-api-key.guard";
import { LostFoundModule } from "../lost-found/lost-found.module";

@Module({
  imports: [LostFoundModule],
  controllers: [AdminController],
  providers: [AdminService, AdminApiKeyGuard],
})
export class AdminModule {}
