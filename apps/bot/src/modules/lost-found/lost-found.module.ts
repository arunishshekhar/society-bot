import { Module } from '@nestjs/common';
import { LostFoundAiService } from './lost-found.ai';
import { LostFoundSearchService } from './lost-found.search';
import { LostFoundService } from './lost-found.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [LostFoundAiService, LostFoundSearchService, LostFoundService],
  exports: [LostFoundService, LostFoundSearchService, LostFoundAiService],
})
export class LostFoundModule {}
