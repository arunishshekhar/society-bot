import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { Context } from "telegraf";
import { BotContext } from "../../types/bot-context";
import { InjectBot } from "nestjs-telegraf";
import { Telegraf } from "telegraf";

@Injectable()
export class CarpoolService {
  private readonly logger = new Logger(CarpoolService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectBot() private readonly bot: Telegraf<BotContext>,
  ) {}

  /**
   * Called when a driver taps Accept on a pickup request.
   *
   * Fix #6: The status flip uses updateMany with a PENDING filter so that two
   * simultaneous accept taps cannot both proceed (TOCTOU).
   *
   * Fix #4: Contact details are NOT shared immediately. The seeker receives a
   * confirmation prompt so they can cancel if no longer interested.
   */
  async acceptRequest(requestId: string, ctx: Context) {
    // Pre-fetch data for notifications
    const request = await this.prisma.carpoolRequest.findUnique({
      where: { id: requestId },
      include: { seeker: true, route: { include: { resident: true } } },
    });
    if (!request || request.status !== "PENDING") return;

    // Fix #6: Atomic status flip — only one concurrent accept wins
    const flip = await this.prisma.carpoolRequest.updateMany({
      where: { id: requestId, status: "PENDING" },
      data: { status: "ACCEPTED", resolvedAt: new Date() },
    });
    if (flip.count === 0) return; // a concurrent accept already handled it

    const offerer = request.route.resident;
    const seeker = request.seeker;

    // Check if the seeker already has another ACCEPTED request in the same direction
    const alreadyAccepted = await this.prisma.carpoolRequest.findFirst({
      where: {
        seekerId: request.seekerId,
        status: "ACCEPTED",
        direction: request.direction,
        id: { not: requestId }, // exclude the one we just accepted
      },
      include: { route: { include: { resident: true } } },
    });

    if (alreadyAccepted) {
      // Multiple drivers accepted — seeker must choose between them
      await this.notifySeeker_multipleAccepts(seeker, [
        alreadyAccepted,
        { ...request, status: "ACCEPTED", resolvedAt: new Date() } as any,
      ]);

      // Notify this driver that we're waiting for the seeker to choose
      try {
        await ctx.reply(
          "✅ Accepted! The rider already has another acceptance — they'll choose between you and the other driver. You'll be notified once they decide.",
        );
      } catch {}
      return;
    }

    // Fix #4: Notify driver that we're waiting for seeker confirmation
    try {
      await ctx.reply(
        `✅ Accepted! Waiting for the rider to confirm. You'll receive their contact once they do.`,
      );
    } catch {}

    // Fix #4: Send seeker a confirmation prompt instead of contacts directly
    try {
      await this.bot.telegram.sendMessage(
        seeker.telegramId.toString(),
        `🎉 *${offerer.name}* (Flat ${offerer.flatNumber}) accepted your carpool request!\n\nDeparts: ${request.route.departureTime}\n\nDo you still want this ride?`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "✅ Yes, confirm ride!",
                  callback_data: `carpool:seeker_confirm:${requestId}`,
                },
                {
                  text: "❌ No, not needed",
                  callback_data: `carpool:seeker_cancel:${requestId}`,
                },
              ],
            ],
          },
        },
      );
    } catch (err) {
      this.logger.error(`Failed to notify seeker ${seeker.telegramId}: ${err}`);
    }
  }

  /**
   * Fix #4: Called when seeker taps "✅ Yes, confirm ride!".
   * Reveals mutual contacts to both parties.
   */
  async confirmBySeeker(requestId: string, ctx: Context) {
    const request = await this.prisma.carpoolRequest.findUnique({
      where: { id: requestId },
      include: { seeker: true, route: { include: { resident: true } } },
    });
    if (!request || request.status !== "ACCEPTED") {
      await ctx.reply("This request is no longer active.");
      return;
    }

    const offerer = request.route.resident;
    const seeker = request.seeker;

    // Send contact to offerer
    try {
      await this.bot.telegram.sendMessage(
        offerer.telegramId.toString(),
        `✅ The rider confirmed! Here's their contact:\n\n*${seeker.name}* · Flat ${seeker.flatNumber}\n${
          seeker.phone ? `📞 ${seeker.phone}` : ""
        }${seeker.telegramUsername ? `\n@${seeker.telegramUsername}` : ""}`,
        { parse_mode: "Markdown" },
      );
    } catch {}

    // Send contact to seeker
    try {
      await ctx.reply(
        `✅ Ride confirmed! Here's your driver's contact:\n\n*${offerer.name}* · Flat ${offerer.flatNumber}\n${
          offerer.phone ? `📞 ${offerer.phone}` : ""
        }${
          offerer.telegramUsername ? `\n@${offerer.telegramUsername}` : ""
        }\n\nCoordinate directly for pickup details.`,
        { parse_mode: "Markdown" },
      );
    } catch {}
  }

  /**
   * Fix #4: Called when seeker taps "❌ No, not needed".
   * Restores the seat and notifies the driver.
   */
  async cancelBySeeker(requestId: string, ctx: Context) {
    const request = await this.prisma.carpoolRequest.findUnique({
      where: { id: requestId },
      include: { seeker: true, route: { include: { resident: true } } },
    });
    if (!request || request.status !== "ACCEPTED") {
      await ctx.reply("This request is no longer active.");
      return;
    }

    await this.prisma.carpoolRequest.update({
      where: { id: requestId },
      data: { status: "CANCELLED", resolvedAt: new Date() },
    });

    // Restore the seat in the correct direction field
    await this.prisma.carpoolRoute.update({
      where: { id: request.routeId },
      data:
        request.direction === "MORNING"
          ? { seatsAvailable: { increment: 1 } }
          : { returnSeatsAvailable: { increment: 1 } },
    });

    // Notify the driver
    try {
      await this.bot.telegram.sendMessage(
        request.route.resident.telegramId.toString(),
        `ℹ️ A rider cancelled their confirmed request for your ${request.direction === "MORNING" ? "morning" : "return"} route. The seat has been restored.`,
      );
    } catch {}

    try {
      await ctx.reply("Okay! Your request has been cancelled. The seat is now available for others.");
    } catch {}
  }

  /**
   * Fix #2: Called when seeker chooses between multiple driver acceptances.
   * Declines all other ACCEPTED requests for the same seeker/direction and
   * restores their seats. Then reveals contacts for the chosen driver.
   */
  async chooseBetweenAccepts(chosenRequestId: string, ctx: Context) {
    const chosen = await this.prisma.carpoolRequest.findUnique({
      where: { id: chosenRequestId },
      include: { seeker: true, route: { include: { resident: true } } },
    });
    if (!chosen || chosen.status !== "ACCEPTED") {
      await ctx.reply("This request is no longer valid.");
      return;
    }

    // Find and cancel all other ACCEPTED requests for this seeker+direction
    const others = await this.prisma.carpoolRequest.findMany({
      where: {
        seekerId: chosen.seekerId,
        direction: chosen.direction,
        status: "ACCEPTED",
        id: { not: chosenRequestId },
      },
      include: { route: { include: { resident: true } } },
    });

    for (const other of others) {
      await this.prisma.carpoolRequest.update({
        where: { id: other.id },
        data: { status: "CANCELLED", resolvedAt: new Date() },
      });

      // Restore seat on the unchosen route
      await this.prisma.carpoolRoute.update({
        where: { id: other.routeId },
        data:
          other.direction === "MORNING"
            ? { seatsAvailable: { increment: 1 } }
            : { returnSeatsAvailable: { increment: 1 } },
      });

      // Notify unchosen driver
      try {
        await this.bot.telegram.sendMessage(
          other.route.resident.telegramId.toString(),
          `ℹ️ The rider chose another driver for this trip. Your seat has been restored.`,
        );
      } catch {}
    }

    // Reveal contacts for the chosen driver to both parties
    const offerer = chosen.route.resident;
    const seeker = chosen.seeker;

    try {
      await this.bot.telegram.sendMessage(
        offerer.telegramId.toString(),
        `✅ A rider chose you! Here's their contact:\n\n*${seeker.name}* · Flat ${seeker.flatNumber}\n${
          seeker.phone ? `📞 ${seeker.phone}` : ""
        }${seeker.telegramUsername ? `\n@${seeker.telegramUsername}` : ""}`,
        { parse_mode: "Markdown" },
      );
    } catch {}

    try {
      await ctx.reply(
        `✅ Great choice! Here's your driver's contact:\n\n*${offerer.name}* · Flat ${offerer.flatNumber}\n${
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

    // Restore the seat in the correct direction field
    await this.prisma.carpoolRoute.update({
      where: { id: request.routeId },
      data:
        request.direction === "MORNING"
          ? { seatsAvailable: { increment: 1 } }
          : { returnSeatsAvailable: { increment: 1 } },
    });

    try {
      await this.bot.telegram.sendMessage(
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
      text: `${req.route.resident.flatNumber} — ${req.route.resident.name}`,
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
