import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { RatingService } from "./rating.service";

@Module({
  imports: [PrismaModule],
  providers: [RatingService],
  exports: [RatingService],
})
export class WorkersModule {}
