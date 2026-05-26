import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { AppUpdate } from './app.update';
import { GroupMemberGuard } from './guards/group-member.guard';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaService } from './prisma/prisma.service';
import { createPrismaSessionMiddleware } from './sessions/prisma-session.middleware';
import { createIdleTimeoutMiddleware } from './sessions/idle-timeout.middleware';
import { scenes } from './scenes';
import { SearchModule } from './modules/search/search.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    PrismaModule,
    SearchModule,
    AdminModule,
    TelegrafModule.forRootAsync({
      imports: [PrismaModule],
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => ({
        token: process.env.TELEGRAM_BOT_TOKEN ?? '',
        middlewares: [createIdleTimeoutMiddleware(), createPrismaSessionMiddleware(prisma)],
        include: [AppModule],
        launchOptions: process.env.WEBHOOK_DOMAIN
          ? {
              webhook: {
                domain: process.env.WEBHOOK_DOMAIN,
                hookPath: '/telegram-webhook',
              },
            }
          : undefined,
      }),
    }),
  ],
  controllers: [HealthController],
  providers: [AppUpdate, GroupMemberGuard, ...scenes],
})
export class AppModule {}
