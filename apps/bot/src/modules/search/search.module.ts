import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { WorkersModule } from "../workers/workers.module";
import { SearchService } from "./search.service";

@Module({
  imports: [PrismaModule, WorkersModule],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
