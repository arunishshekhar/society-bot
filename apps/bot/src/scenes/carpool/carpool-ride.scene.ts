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
  private readonly societyLat = parseFloat(process.env.SOCIETY_LAT ?? "0");
  private readonly societyLng = parseFloat(process.env.SOCIETY_LNG ?? "0");

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
    const requests = ctx.session.carpool?.rideRequests ?? [];
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
    // if the user waited before pressing Confirm Start.
    const freshRequests = await this.prisma.carpoolRequest.findMany({
      where: { routeId, direction, status: "ACCEPTED" },
      include: { seeker: true },
    });

    for (const req of freshRequests) {
      try {
        let text = `🚗 *Your ride has started!*\n\n*${route.resident.name}* · Flat ${route.resident.flatNumber} has begun the trip.\n\n`;
        text += `*Also in this ride:*\n`;
        requests.forEach((r) => {
          text += `• ${r.seeker.flatNumber} · ${r.seeker.name}\n`;
        });
        text += `\n📍 Live location will appear below. Track in real time as they approach.`;

        await ctx.telegram.sendMessage(req.seeker.telegramId.toString(), text, {
          parse_mode: "Markdown",
        });

        const msg = await ctx.telegram.sendLocation(
          req.seeker.telegramId.toString(),
          direction === "MORNING" ? this.societyLat : route.destinationLat,
          direction === "MORNING" ? this.societyLng : route.destinationLng,
          { live_period: 7200 },
        );

        await this.prisma.rideSessionMember.create({
          data: {
            sessionId: session.id,
            riderTelegramId: req.seeker.telegramId,
            riderName: req.seeker.name,
            riderFlat: req.seeker.flatNumber,
            locationMessageId: msg.message_id,
          },
        });
      } catch {}
    }

    await ctx.reply(
      "✅ Ride started! Riders notified.\n\n📍 Please share your Live Location with me so your riders can track you in real time.\n\nIn Telegram:\n📎 → Location → Share Live Location → 1 hour",
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "🏁 End Ride",
            `carpool_ride:end:${session.id}`,
          ),
        ],
      ]),
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
      await ctx.reply("✅ Ride ended. Locations stopped.");
    }
    await ctx.scene.enter("carpool_manage");
  }

  @Action("carpool_ride:cancel")
  async cancel(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    await ctx.scene.enter("carpool_manage");
  }
}
