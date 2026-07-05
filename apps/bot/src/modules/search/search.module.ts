import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { WorkersModule } from "../workers/workers.module";
import { SearchService } from "./search.service";
import { AiChatService } from "./ai-chat.service";

@Module({
  imports: [PrismaModule, WorkersModule],
  providers: [SearchService, AiChatService],
  exports: [SearchService, AiChatService],
})
export class SearchModule {}

