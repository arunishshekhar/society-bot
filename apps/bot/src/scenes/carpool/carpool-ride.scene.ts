import { UseGuards } from "@nestjs/common";
import { Action, Command, Ctx, Scene, SceneEnter } from "nestjs-telegraf";
import { Markup } from "telegraf";
import { GroupMemberGuard } from "../../guards/group-member.guard";
import { BotContext } from "../../types/bot-context";
import { PrismaService } from "../../prisma/prisma.service";
import { Direction } from "@prisma/client";
import { CarpoolService } from "../../modules/carpool/carpool.service";
import { SearchService } from "../../modules/search/search.service";
import { mainMenuKeyboard } from "../../keyboards/main-menu.keyboard";

@Scene("carpool_ride")
@UseGuards(GroupMemberGuard)
export class CarpoolRideScene {
  constructor(
    private readonly prisma: PrismaService,
    private readonly carpoolService: CarpoolService,
    private readonly searchService: SearchService,
  ) {}

  @SceneEnter()
  async enter(@Ctx() ctx: BotContext) {
    const routeId = ctx.session.carpool?.selectedRouteId;
    if (!routeId) return ctx.scene.enter("carpool_manage");

    const route = await this.prisma.carpoolRoute.findUnique({
      where: { id: routeId },
    });
    if (!route) return ctx.scene.enter("carpool_manage");

    if (route.hasReturn) {
      await ctx.reply(
        "Which direction?",
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "🌅 Morning (To Destination)",
              "carpool_ride:dir:MORNING",
            ),
          ],
          [
            Markup.button.callback(
              "🏠 Return (To Home)",
              "carpool_ride:dir:RETURN",
            ),
          ],
        ]),
      );
    } else {
      await this.startRideFlow(ctx, routeId, "MORNING");
    }
  }

  @Command(["ask", "menu", "exit"])
  async onAskCommand(@Ctx() ctx: BotContext) {
    const text = (ctx.message as { text?: string })?.text ?? "";

    if (text.startsWith("/menu") || text.startsWith("/exit")) {
      await ctx.scene.leave();
      await ctx.reply("Society Bot", mainMenuKeyboard());
      return;
    }

    const query = text.replace(/^\/ask\s*/i, "").trim();
    await ctx.scene.leave();
    await this.searchService.handleAsk(ctx, query);
  }

  @Action(/carpool_ride:dir:(MORNING|RETURN)/)
  async setDirection(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const match =
      ctx.callbackQuery && "data" in ctx.callbackQuery
        ? ctx.callbackQuery.data.match(/carpool_ride:dir:(MORNING|RETURN)/)
        : null;
    const dir = match?.[1] as Direction;
    const routeId = ctx.session.carpool?.selectedRouteId;
    if (routeId && dir) {
      await this.startRideFlow(ctx, routeId, dir);
    }
  }

  private async startRideFlow(
    ctx: BotContext,
    routeId: string,
    direction: Direction,
  ) {
    const acceptedRequests = await this.prisma.carpoolRequest.findMany({
      where: { routeId, direction, status: "ACCEPTED" },
      include: { seeker: true },
    });

    ctx.session.carpool!.rideDirection = direction;
    ctx.session.carpool!.rideRequests = acceptedRequests;

    let text = `🚗 *Starting ride*\n\n`;
    text += `Riders who will be notified:\n`;
    if (acceptedRequests.length) {
      acceptedRequests.forEach((req) => {
        text += `• ${req.seeker.flatNumber} · ${req.seeker.name}\n`;
      });
    } else {
      text += `_No riders_`;
    }

    await ctx.reply(text, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [Markup.button.callback("Confirm Start", "carpool_ride:start")],
          [Markup.button.callback("Cancel", "carpool_ride:cancel")],
        ],
      },
    });
  }

  @Action("carpool_ride:start")
  async start(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const routeId = ctx.session.carpool?.selectedRouteId;
    const direction = ctx.session.carpool?.rideDirection as Direction;
    if (!routeId) return;

    const route = await this.prisma.carpoolRoute.findUnique({
      where: { id: routeId },
      include: { resident: true },
    });
    if (!route) return;

    // Ownership check: only the route owner can start a ride
    if (route.resident.telegramId !== BigInt(ctx.from!.id)) {
      await ctx.reply("You can only start a ride for your own carpool routes.");
      return;
    }

    // Create session
    const session = await this.prisma.rideSession.create({
      data: {
        routeId,
        offererTelegramId: BigInt(ctx.from!.id),
        direction,
        status: "ACTIVE",
      },
    });

    // Re-query accepted requests fresh from the DB — session data may be stale
    const freshRequests = await this.prisma.carpoolRequest.findMany({
      where: { routeId, direction, status: "ACCEPTED" },
      include: { seeker: true },
    });

    /**
     * Fix #13: The previous implementation tried to send a bot-initiated live
     * location, which is not possible via the Bot API — only real users can
     * send live locations. Instead we:
     *   1. Tell riders the ride has started and give them the driver's contact
     *      so they can request a live location share directly via Telegram DMs.
     *   2. Still record the session so the driver's own location updates (sent
     *      manually to the bot) are forwarded via app.update.ts @On('location').
     */
    for (const req of freshRequests) {
      try {
        let text = `🚗 *Your ride has started!*\n\n*${route.resident.name}* · Flat ${route.resident.flatNumber} has begun the trip.\n\n`;
        text += `*Also in this ride:*\n`;
        freshRequests.forEach((r) => {
          if (r.id !== req.id) {
            text += `• ${r.seeker.flatNumber} · ${r.seeker.name}\n`;
          }
        });
        text += `\n📱 *Driver contact:*\n`;
        text += `${route.resident.phone ? `📞 ${route.resident.phone}\n` : ""}`;
        text += `${route.resident.telegramUsername ? `@${route.resident.telegramUsername}\n` : ""}`;
        text += `\n💡 Ask your driver to share their Live Location with you directly in Telegram for real-time tracking.`;

        await ctx.telegram.sendMessage(req.seeker.telegramId.toString(), text, {
          parse_mode: "Markdown",
        });

        await this.prisma.rideSessionMember.create({
          data: {
            sessionId: session.id,
            riderTelegramId: req.seeker.telegramId,
            riderName: req.seeker.name,
            riderFlat: req.seeker.flatNumber,
            // Fix #13: No bot-sent live location message to track — use 0 as placeholder
            locationMessageId: 0,
          },
        });
      } catch {}
    }

    await ctx.reply(
      `✅ Ride started! ${freshRequests.length} rider(s) notified.\n\n` +
        `📍 *Share your live location with riders:*\n` +
        `In Telegram: 📎 → Location → Share Live Location → choose duration\n\n` +
        `The bot will automatically forward your location updates to all riders.`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              Markup.button.callback(
                "🏁 End Ride",
                `carpool_ride:end:${session.id}`,
              ),
            ],
          ],
        },
      },
    );
  }

  @Action(/carpool_ride:end:(.+)/)
  async endRide(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const match =
      ctx.callbackQuery && "data" in ctx.callbackQuery
        ? ctx.callbackQuery.data.match(/carpool_ride:end:(.+)/)
        : null;
    const sessionId = match?.[1];
    if (sessionId) {
      await this.carpoolService.endRideSession(sessionId);
      await ctx.reply("✅ Ride ended.");
    }
    await ctx.scene.enter("carpool_manage");
  }

  @Action("carpool_ride:cancel")
  async cancel(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    await ctx.scene.enter("carpool_manage");
  }
}
