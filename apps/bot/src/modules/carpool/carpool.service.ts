import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { Context } from "telegraf";
import { BotContext } from "../../types/bot-context";
import { InjectBot } from "nestjs-telegraf";
import { Telegraf } from "telegraf";

@Injectable()
export class CarpoolService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectBot() private readonly bot: Telegraf<BotContext>,
  ) {}

  async acceptRequest(requestId: string, ctx: Context) {
    const request = await this.prisma.carpoolRequest.findUnique({
      where: { id: requestId },
      include: { seeker: true, route: { include: { resident: true } } },
    });
    if (!request || request.status !== "PENDING") return;

    // Check if seeker already has an accepted request
    const alreadyAccepted = await this.prisma.carpoolRequest.findFirst({
      where: {
        seekerId: request.seekerId,
        status: "ACCEPTED",
        direction: request.direction,
      },
      include: { route: { include: { resident: true } } },
    });

    if (alreadyAccepted) {
      // Hold this acceptance, seeker must choose
      await this.prisma.carpoolRequest.update({
        where: { id: requestId },
        data: { status: "ACCEPTED", resolvedAt: new Date() },
      });
      await this.notifySeeker_multipleAccepts(request.seeker, [
        alreadyAccepted,
        { ...request, status: "ACCEPTED", resolvedAt: new Date() } as any,
      ]);
      return;
    }

    const updated = await this.prisma.carpoolRequest.update({
      where: { id: requestId },
      data: { status: "ACCEPTED", resolvedAt: new Date() },
      include: { seeker: true, route: { include: { resident: true } } },
    });

    const offerer = updated.route.resident;
    const seeker = updated.seeker;

    try {
      await ctx.telegram.sendMessage(
        offerer.telegramId.toString(),
        `✅ Accepted! Here's their contact:\n\n*${seeker.name}* · Flat ${seeker.flatNumber}\n${
          seeker.phone ? `📞 ${seeker.phone}` : ""
        }${seeker.telegramUsername ? `\n@${seeker.telegramUsername}` : ""}`,
        { parse_mode: "Markdown" },
      );
    } catch {}

    try {
      await ctx.telegram.sendMessage(
        seeker.telegramId.toString(),
        `✅ *${offerer.name}* accepted your request!\n\nFlat ${offerer.flatNumber}\n${
          offerer.phone ? `📞 ${offerer.phone}` : ""
        }${
          offerer.telegramUsername ? `\n@${offerer.telegramUsername}` : ""
        }\n\nCoordinate directly for pickup details.`,
        { parse_mode: "Markdown" },
      );
    } catch {}
  }

  async declineRequest(requestId: string, ctx: Context) {
    const request = await this.prisma.carpoolRequest.findUnique({
      where: { id: requestId },
      include: { route: { include: { resident: true } }, seeker: true },
    });
    if (!request || request.status !== "PENDING") return;

    await this.prisma.carpoolRequest.update({
      where: { id: requestId },
      data: { status: "DECLINED", resolvedAt: new Date() },
    });

    // Restore seat
    await this.prisma.carpoolRoute.update({
      where: { id: request.routeId },
      data: { seatsAvailable: { increment: 1 } },
    });

    try {
      await ctx.telegram.sendMessage(
        request.seeker.telegramId.toString(),
        `❌ Flat ${request.route.resident.flatNumber} couldn't accommodate this time.\nYour other requests are still pending.`,
      );
    } catch {}

    await ctx.reply("Request declined. Seat restored.");
  }

  private async notifySeeker_multipleAccepts(seeker: any, allAccepted: any[]) {
    const msg =
      `🎉 Multiple drivers accepted!\n\nWho will you ride with?\n` +
      allAccepted
        .map(
          (req, i) =>
            `${i + 1}. *${req.route.resident.flatNumber}* · ${req.route.resident.name} · ${req.route.departureTime}`,
        )
        .join("\n");

    const buttons = allAccepted.map((req) => ({
      text: req.route.resident.flatNumber,
      callback_data: `carpool_ride:choose:${req.id}`,
    }));

    try {
      await this.bot.telegram.sendMessage(seeker.telegramId.toString(), msg, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [buttons],
        },
      });
    } catch {}
  }

  async endRideSession(sessionId: string) {
    const session = await this.prisma.rideSession.findUnique({
      where: { id: sessionId },
      include: { members: true },
    });
    if (!session) return;

    for (const member of session.members) {
      try {
        await this.bot.telegram.stopMessageLiveLocation(
          member.riderTelegramId.toString(),
          member.locationMessageId,
          undefined,
        );
      } catch {}
      try {
        await this.bot.telegram.sendMessage(
          member.riderTelegramId.toString(),
          "🏁 Ride ended. Have a great day!",
        );
      } catch {}
    }

    await this.prisma.rideSession.update({
      where: { id: sessionId },
      data: { status: "COMPLETED", endedAt: new Date() },
    });
  }
}
