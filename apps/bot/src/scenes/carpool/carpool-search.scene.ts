import { UseGuards } from "@nestjs/common";
import { Action, Command, Ctx, On, Scene, SceneEnter } from "nestjs-telegraf";
import { Markup } from "telegraf";
import { GroupMemberGuard } from "../../guards/group-member.guard";
import { BotContext } from "../../types/bot-context";
import { PrismaService } from "../../prisma/prisma.service";
import { PhotonService } from "../../modules/carpool/photon.service";
import { PolylineService } from "../../modules/carpool/polyline.service";
import { Direction } from "@prisma/client";
import { SearchService } from "../../modules/search/search.service";
import { mainMenuKeyboard } from "../../keyboards/main-menu.keyboard";

@Scene("carpool_search")
@UseGuards(GroupMemberGuard)
export class CarpoolSearchScene {
  constructor(
    private readonly prisma: PrismaService,
    private readonly photonService: PhotonService,
    private readonly polylineService: PolylineService,
    private readonly searchService: SearchService,
  ) {}

  @SceneEnter()
  async enter(@Ctx() ctx: BotContext) {
    // Reset search state but keep any pre-set direction
    ctx.session.carpool = { ...ctx.session.carpool, step: "choose_direction" };

    await ctx.reply(
      "🔍 *Find a Pool*\n\nAre you looking for a morning or return ride?",
      {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard([
          [
            Markup.button.callback("🌅 Morning (Home → Work)", "carpool_search:dir:MORNING"),
          ],
          [
            Markup.button.callback("🏠 Return (Work → Home)", "carpool_search:dir:RETURN"),
          ],
          [Markup.button.callback("🔙 Back", "carpool_search:cancel")],
        ]).reply_markup,
      },
    );
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

  @Action(/carpool_search:dir:(MORNING|RETURN)/)
  async chooseDirection(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const match =
      ctx.callbackQuery && "data" in ctx.callbackQuery
        ? ctx.callbackQuery.data.match(/carpool_search:dir:(MORNING|RETURN)/)
        : null;
    if (!match) return;
    const direction = match[1] as Direction;
    ctx.session.carpool!.searchDirection = direction;
    ctx.session.carpool!.step = "pickup_location";

    if (direction === "MORNING") {
      await ctx.reply("Where should they pick you up?\nType your pickup location.");
    } else {
      await ctx.reply("Where are you returning from?\nType your current location.");
    }
  }

  @On("text")
  async onText(@Ctx() ctx: BotContext) {
    const step = ctx.session.carpool?.step;
    const text = ctx.text?.trim();
    if (!step || !text) return;

    if (step === "pickup_location") {
      const results = await this.photonService.search(text);
      if (!results.length) {
        await ctx.reply("No results found. Please try another name.");
        return;
      }
      ctx.session.carpool!.placeResults = results;

      const buttons = results.map((r, i) => [
        Markup.button.callback(
          `${i + 1}. ${r.name}, ${r.address}`.substring(0, 60),
          `carpool_search:place:${i}`,
        ),
      ]);
      await ctx.reply(
        "Select your location:",
        Markup.inlineKeyboard([
          ...buttons,
          [
            Markup.button.callback(
              "Not listed, type again",
              "carpool_search:retry_loc",
            ),
          ],
        ]),
      );
    } else if (step === "time_filter") {
      if (
        text.toLowerCase() !== "any" &&
        !text.match(/\d{1,2}:\d{2}\s*(AM|PM)/i)
      ) {
        await ctx.reply('Please use format like 9:00 AM or type "any"');
        return;
      }
      const time = text.toLowerCase() === "any" ? null : text;
      await this.findMatches(ctx, time);
    } else if (step === "return_time_filter") {
      if (
        text.toLowerCase() !== "any" &&
        !text.match(/\d{1,2}:\d{2}\s*(AM|PM)/i)
      ) {
        await ctx.reply('Please use format like 6:00 PM or type "any"');
        return;
      }
      const time = text.toLowerCase() === "any" ? null : text;
      await this.findMatches(ctx, time);
    }
  }

  @Action("carpool_search:retry_loc")
  async retryLoc(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    ctx.session.carpool!.step = "pickup_location";
    await ctx.reply("Type the location name again.");
  }

  @Action(/carpool_search:place:\d+/)
  async selectPlace(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const match =
      ctx.callbackQuery && "data" in ctx.callbackQuery
        ? ctx.callbackQuery.data.match(/carpool_search:place:(\d+)/)
        : null;
    if (!match) return;
    const index = parseInt(match[1]);
    const place = ctx.session.carpool?.placeResults?.[index];
    if (!place) return;

    ctx.session.carpool!.searchDraft = {
      pickupLat: place.lat,
      pickupLng: place.lng,
      pickupAddress: place.name,
    };

    const direction = ctx.session.carpool!.searchDirection as Direction;
    if (direction === "MORNING") {
      ctx.session.carpool!.step = "time_filter";
      await ctx.reply(
        '🕐 Around what time should they pick you up?\n(e.g. 8:00 AM or type "any" for any time)',
      );
    } else {
      ctx.session.carpool!.step = "return_time_filter";
      await ctx.reply(
        '🕐 Around what time do you want to return?\n(e.g. 6:00 PM or type "any" for any time)',
      );
    }
  }

  async findMatches(ctx: BotContext, time: string | null) {
    const draft = ctx.session.carpool!.searchDraft!;
    const direction = ctx.session.carpool!.searchDirection as Direction;

    await ctx.reply("🔍 Searching for pools near you...");

    const results = await this.polylineService.findMatchingRoutes(
      draft.pickupLat!,
      draft.pickupLng!,
      time,
      direction,
      draft.destinationText,
    );

    if (!results.length) {
      await ctx.reply(
        "😕 No pools found near your location for that time.",
        Markup.inlineKeyboard([
          [Markup.button.callback("Back to Menu", "carpool_search:cancel")],
        ]),
      );
      return;
    }

    await ctx.reply("🚕 Pools found near your location:");

    for (const res of results.slice(0, 5)) {
      const isMorning = direction === "MORNING";
      const r = res.route;
      const timeStr = isMorning ? r.departureTime : r.returnTime;
      const seatsStr = isMorning ? r.seatsAvailable : r.returnSeatsAvailable;
      const statusIcon = res.onRoute ? "✅" : "⚠️";
      const locStr = res.onRoute
        ? "Your pickup is on route"
        : `~${res.distanceMeters}m from route`;

      let text = `${statusIcon} *${r.resident.flatNumber}* · ${r.startAddress ?? 'Society'} → ${r.destinationAddress}\n`;
      text += `   Departs ${timeStr} · ${r.type === "RECURRING" ? "Recurring" : "One Time"} · ${seatsStr} seats\n`;
      text += `   📍 ${locStr}`;

      await ctx.reply(text, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Request Pickup",
                callback_data: `carpool_search:request:${r.id}`,
              },
            ],
          ],
        },
      });
    }

    await ctx.reply(
      "No more results.",
      Markup.inlineKeyboard([
        [Markup.button.callback("Back", "carpool_search:cancel")],
      ]),
    );
  }

  @Action(/carpool_search:request:(.+)/)
  async requestPickup(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const match =
      ctx.callbackQuery && "data" in ctx.callbackQuery
        ? ctx.callbackQuery.data.match(/carpool_search:request:(.+)/)
        : null;
    const routeId = match?.[1];
    if (!routeId) return;

    const route = await this.prisma.carpoolRoute.findUnique({
      where: { id: routeId },
      include: { resident: true },
    });
    if (!route) return;

    const direction = ctx.session.carpool!.searchDirection as Direction;
    const seats =
      direction === "MORNING"
        ? route.seatsAvailable
        : route.returnSeatsAvailable;

    if (!seats || seats <= 0) {
      await ctx.reply("⚠️ This pool is full. No seats available.");
      return;
    }

    const seeker = await this.prisma.resident.findUnique({
      where: { telegramId: BigInt(ctx.from!.id) },
    });
    if (!seeker) return;

    const draft = ctx.session.carpool!.searchDraft!;

    // Create Request
    const request = await this.prisma.carpoolRequest.create({
      data: {
        routeId,
        seekerId: seeker.id,
        direction,
        pickupAddress: draft.pickupAddress!,
        pickupLat: draft.pickupLat!,
        pickupLng: draft.pickupLng!,
        distanceFromRoute: 0, // Simplified
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min
      },
    });

    // Optimistically decrement seats — guard against going negative
    if (direction === "MORNING") {
      const updated = await this.prisma.carpoolRoute.updateMany({
        where: { id: routeId, seatsAvailable: { gt: 0 } },
        data: { seatsAvailable: { decrement: 1 } },
      });
      if (updated.count === 0) {
        // Race condition: seats exhausted between check and update
        await this.prisma.carpoolRequest.delete({ where: { id: request.id } });
        await ctx.reply("⚠️ No seats available — someone else just took the last one.");
        return;
      }
    } else {
      const updated = await this.prisma.carpoolRoute.updateMany({
        where: { id: routeId, returnSeatsAvailable: { gt: 0 } },
        data: { returnSeatsAvailable: { decrement: 1 } },
      });
      if (updated.count === 0) {
        await this.prisma.carpoolRequest.delete({ where: { id: request.id } });
        await ctx.reply("⚠️ No return seats available — someone else just took the last one.");
        return;
      }
    }

    // Notify Offerer
    try {
      await ctx.telegram.sendMessage(
        route.resident.telegramId.toString(),
        `🙋 *Pickup Request*\n\nFlat ${seeker.flatNumber} is requesting a pickup on your route.\n\n📍 Their location: ${draft.pickupAddress}\n🗓 Direction: ${direction}\n\nDo you have space?`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "✅ Accept",
                  callback_data: `carpool_manage:accept:${request.id}`,
                },
                {
                  text: "❌ Decline",
                  callback_data: `carpool_manage:decline:${request.id}`,
                },
              ],
            ],
          },
        },
      );
    } catch {}

    await ctx.reply(
      `✅ Request sent to ${route.resident.flatNumber}.\n\nWaiting for their response...\nYou'll be notified once they respond.\nRequest expires in 15 minutes.`,
    );
  }

  @Action("carpool_search:cancel")
  async cancel(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    await ctx.scene.enter("carpool");
  }
}
