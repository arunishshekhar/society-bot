import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../../prisma/prisma.service";
import { CarpoolService } from "./carpool.service";
import { InjectBot } from "nestjs-telegraf";
import { Telegraf } from "telegraf";
import { BotContext } from "../../types/bot-context";

@Injectable()
export class CarpoolScheduler {
  private readonly logger = new Logger(CarpoolScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly carpoolService: CarpoolService,
    @InjectBot() private readonly bot: Telegraf<BotContext>,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async expireRideSessions() {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const expired = await this.prisma.rideSession.findMany({
      where: {
        status: "ACTIVE",
        startedAt: { lte: twoHoursAgo },
      },
    });

    for (const session of expired) {
      await this.carpoolService.endRideSession(session.id);
      await this.prisma.rideSession.update({
        where: { id: session.id },
        data: { status: "EXPIRED" },
      });
      this.logger.log(`Expired ride session ${session.id}`);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async expirePendingRequests() {
    const expired = await this.prisma.carpoolRequest.findMany({
      where: {
        status: "PENDING",
        expiresAt: { lte: new Date() },
      },
      include: {
        seeker: true,
        route: { include: { resident: true } },
      },
    });

    for (const req of expired) {
      await this.prisma.carpoolRequest.update({
        where: { id: req.id },
        data: { status: "EXPIRED" },
      });

      // restore seat
      await this.prisma.carpoolRoute.update({
        where: { id: req.routeId },
        data: { seatsAvailable: { increment: 1 } },
      });

      try {
        await this.bot.telegram.sendMessage(
          req.seeker.telegramId.toString(),
          `⏱ *${req.route.resident.name}* didn't respond in time.\nYour other requests are still pending.`,
          { parse_mode: "Markdown" },
        );
      } catch {}
    }
  }

  // @Cron(CronExpression.EVERY_5_MINUTES)
  // async detectStaleLiveLocation() {
  //   const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  //   // Stale logic omitted as updatedAt is not in schema
  // }
}
