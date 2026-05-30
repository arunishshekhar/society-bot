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

  // Run at :00 of every minute
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
      // endRideSession notifies riders and marks the session COMPLETED.
      // We then explicitly override to EXPIRED so the status reflects
      // it was auto-expired rather than driver-ended.
      await this.carpoolService.endRideSession(session.id);
      await this.prisma.rideSession.update({
        where: { id: session.id },
        data: { status: "EXPIRED" },
      });
      this.logger.log(`Expired ride session ${session.id}`);
    }
  }

  // Run at :30 of every minute — staggered from expireRideSessions to avoid overlap
  @Cron("30 * * * * *")
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

      // restore seat in the correct direction field
      await this.prisma.carpoolRoute.update({
        where: { id: req.routeId },
        data:
          req.direction === "MORNING"
            ? { seatsAvailable: { increment: 1 } }
            : { returnSeatsAvailable: { increment: 1 } },
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

  /**
   * Fix #8: Expire past ONE_TIME routes daily at midnight.
   * Routes whose oneTimeDate has passed are paused so they no longer
   * appear in search results but the data is preserved.
   */
  @Cron("0 0 * * *")
  async expireOneTimeRoutes() {
    const now = new Date();
    // A ONE_TIME route is stale if its date is before today (start of today)
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const stale = await this.prisma.carpoolRoute.findMany({
      where: {
        type: "ONE_TIME",
        isPaused: false,
        oneTimeDate: { lt: startOfToday },
      },
      include: { resident: true },
    });

    for (const route of stale) {
      await this.prisma.carpoolRoute.update({
        where: { id: route.id },
        data: { isPaused: true },
      });

      try {
        await this.bot.telegram.sendMessage(
          route.resident.telegramId.toString(),
          `📅 Your one-time carpool route (${route.startAddress ?? "Society"} → ${route.destinationAddress}) has been automatically paused because its date has passed.`,
        );
      } catch {}

      this.logger.log(`Paused expired ONE_TIME route ${route.id}`);
    }
  }
}
