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

/** Max pickup requests a seeker may send per hour (#11) */
const RATE_LIMIT_PER_HOUR = 5;

@Scene("carpool_search")
@UseGuards(GroupMemberGuard)
export class CarpoolSearchScene {
  private readonly societyLat = parseFloat(process.env.SOCIETY_LAT ?? "0");
  private readonly societyLng = parseFloat(process.env.SOCIETY_LNG ?? "0");

  constructor(
    private readonly prisma: PrismaService,
    private readonly photonService: PhotonService,
    private readonly polylineService: PolylineService,
    private readonly searchService: SearchService,
  ) {}

  @SceneEnter()
  async enter(@Ctx() ctx: BotContext) {
    ctx.session.carpool = {
      ...ctx.session.carpool,
      step: "start",
      searchDraft: {},
    };

    await ctx.reply(
      "🔍 *Find a Pool*\n\nWhere are you starting from?\nType the location name or select below.",
      {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback("🏢 The Society Location", "carpool_search:start_society")],
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

  // ─── Society shortcut buttons ────────────────────────────────────────────────

  @Action("carpool_search:start_society")
  async setStartSociety(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    ctx.session.carpool!.searchDraft = {
      ...ctx.session.carpool!.searchDraft,
      startAddress: "The Society Location",
      startLat: this.societyLat,
      startLng: this.societyLng,
    };
    ctx.session.carpool!.step = "pickup_location";
    await ctx.reply(
      "Where are you going?\nType the destination name or select below.",
      Markup.inlineKeyboard([
        [Markup.button.callback("🏢 The Society Location", "carpool_search:dest_society")],
      ]),
    );
  }

  @Action("carpool_search:dest_society")
  async setDestSociety(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    ctx.session.carpool!.searchDraft = {
      ...ctx.session.carpool!.searchDraft,
      pickupAddress: "The Society Location",
      pickupLat: this.societyLat,
      pickupLng: this.societyLng,
    };
    await this.askTime(ctx);
  }

  // ─── Text handler ─────────────────────────────────────────────────────────────

  @On("text")
  async onText(@Ctx() ctx: BotContext) {
    const step = ctx.session.carpool?.step;
    const text = ctx.text?.trim();
    if (!step || !text) return;

    if (step === "start") {
      const results = await this.photonService.search(text);
      if (!results.length) {
        await ctx.reply("No results found. Please try another name.");
        return;
      }
      ctx.session.carpool!.placeResults = results;

      const buttons = results.map((r, i) => [
        Markup.button.callback(
          `${i + 1}. ${r.name}, ${r.address}`.substring(0, 60),
          `carpool_search:place_start:${i}`,
        ),
      ]);
      await ctx.reply(
        "Select your starting location:",
        Markup.inlineKeyboard([
          ...buttons,
          [Markup.button.callback("Not listed, type again", "carpool_search:retry_start")],
        ]),
      );
    } else if (step === "pickup_location") {
      const results = await this.photonService.search(text);
      if (!results.length) {
        await ctx.reply("No results found. Please try another name.");
        return;
      }
      ctx.session.carpool!.placeResults = results;

      const buttons = results.map((r, i) => [
        Markup.button.callback(
          `${i + 1}. ${r.name}, ${r.address}`.substring(0, 60),
          `carpool_search:place_dest:${i}`,
        ),
      ]);
      await ctx.reply(
        "Select your destination:",
        Markup.inlineKeyboard([
          ...buttons,
          [Markup.button.callback("Not listed, type again", "carpool_search:retry_dest")],
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
    }
  }

  // ─── Retry buttons ────────────────────────────────────────────────────────────

  @Action("carpool_search:retry_start")
  async retryStart(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    ctx.session.carpool!.step = "start";
    await ctx.reply(
      "Type your starting location again.",
      Markup.inlineKeyboard([
        [Markup.button.callback("🏢 The Society Location", "carpool_search:start_society")],
      ]),
    );
  }

  @Action("carpool_search:retry_dest")
  async retryDest(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    ctx.session.carpool!.step = "pickup_location";
    await ctx.reply(
      "Type your destination again.",
      Markup.inlineKeyboard([
        [Markup.button.callback("🏢 The Society Location", "carpool_search:dest_society")],
      ]),
    );
  }

  // ─── Place selection ─────────────────────────────────────────────────────────

  @Action(/carpool_search:place_start:\d+/)
  async selectStart(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const match =
      ctx.callbackQuery && "data" in ctx.callbackQuery
        ? ctx.callbackQuery.data.match(/carpool_search:place_start:(\d+)/)
        : null;
    if (!match) return;
    const index = parseInt(match[1]);
    const place = ctx.session.carpool?.placeResults?.[index];
    if (!place) return;

    ctx.session.carpool!.searchDraft = {
      ...ctx.session.carpool!.searchDraft,
      startAddress: place.name,
      startLat: place.lat,
      startLng: place.lng,
    };
    ctx.session.carpool!.step = "pickup_location";
    await ctx.reply(
      "Where are you going?\nType the destination name or select below.",
      Markup.inlineKeyboard([
        [Markup.button.callback("🏢 The Society Location", "carpool_search:dest_society")],
      ]),
    );
  }

  @Action(/carpool_search:place_dest:\d+/)
  async selectDest(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const match =
      ctx.callbackQuery && "data" in ctx.callbackQuery
        ? ctx.callbackQuery.data.match(/carpool_search:place_dest:(\d+)/)
        : null;
    if (!match) return;
    const index = parseInt(match[1]);
    const place = ctx.session.carpool?.placeResults?.[index];
    if (!place) return;

    ctx.session.carpool!.searchDraft = {
      ...ctx.session.carpool!.searchDraft,
      pickupAddress: place.name,
      pickupLat: place.lat,
      pickupLng: place.lng,
    };
    await this.askTime(ctx);
  }

  // ─── Time prompt ──────────────────────────────────────────────────────────────

  private async askTime(ctx: BotContext) {
    ctx.session.carpool!.step = "time_filter";
    await ctx.reply(
      '🕐 Around what time?\n(e.g. 8:00 AM or type "any" for any time)',
    );
  }

  // ─── Route matching ───────────────────────────────────────────────────────────

  async findMatches(ctx: BotContext, time: string | null) {
    const draft = ctx.session.carpool!.searchDraft!;

    const direction = this.inferDirection(
      draft.startLat,
      draft.startLng,
      draft.pickupLat,
      draft.pickupLng,
    );

    const seekerLat = direction === "MORNING" ? draft.startLat! : draft.pickupLat!;
    const seekerLng = direction === "MORNING" ? draft.startLng! : draft.pickupLng!;

    await ctx.reply("🔍 Searching for pools near you...");

    // Fix #12: resolve seeker's residentId so we can exclude their own routes
    const seeker = await this.prisma.resident.findUnique({
      where: { telegramId: BigInt(ctx.from!.id) },
    });

    const results = await this.polylineService.findMatchingRoutes(
      seekerLat,
      seekerLng,
      time,
      direction,
      null,
      seeker?.id, // Fix #12: exclude own routes
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

      let text = `${statusIcon} *${r.resident.flatNumber}* · ${r.startAddress ?? "Society"} → ${r.destinationAddress}\n`;
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

  /**
   * Infer MORNING vs RETURN from the start/end coordinates.
   */
  private inferDirection(
    startLat?: number,
    startLng?: number,
    destLat?: number,
    destLng?: number,
  ): Direction {
    const threshold = 500; // metres
    if (startLat && startLng) {
      const d = this.haversine(startLat, startLng, this.societyLat, this.societyLng);
      if (d <= threshold) return "MORNING";
    }
    if (destLat && destLng) {
      const d = this.haversine(destLat, destLng, this.societyLat, this.societyLng);
      if (d <= threshold) return "RETURN";
    }
    return "MORNING";
  }

  private haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // ─── Request Pickup ───────────────────────────────────────────────────────────

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

    // Fix #5: re-check isPaused — route may have been paused after search results were shown
    if (route.isPaused) {
      await ctx.reply("⚠️ This pool is no longer active. Please search again.");
      return;
    }

    const draft = ctx.session.carpool?.searchDraft;
    if (!draft) {
      await ctx.reply("Session expired. Please start again.");
      return ctx.scene.enter("carpool_search");
    }

    const direction = this.inferDirection(
      draft.startLat,
      draft.startLng,
      draft.pickupLat,
      draft.pickupLng,
    );

    const seeker = await this.prisma.resident.findUnique({
      where: { telegramId: BigInt(ctx.from!.id) },
    });
    if (!seeker) return;

    // Fix #12: don't allow requesting your own route
    if (route.residentId === seeker.id) {
      await ctx.reply("⚠️ You cannot request a pickup on your own route.");
      return;
    }

    // Fix #11: rate limiting — max RATE_LIMIT_PER_HOUR requests per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await this.prisma.carpoolRequest.count({
      where: {
        seekerId: seeker.id,
        createdAt: { gte: oneHourAgo },
      },
    });
    if (recentCount >= RATE_LIMIT_PER_HOUR) {
      await ctx.reply(
        `⚠️ You've sent ${RATE_LIMIT_PER_HOUR} requests in the last hour. Please wait before sending more.`,
      );
      return;
    }

    // Fix #9: prevent duplicate pending/accepted requests for the same route+direction
    const existing = await this.prisma.carpoolRequest.findFirst({
      where: {
        routeId,
        seekerId: seeker.id,
        direction,
        status: { in: ["PENDING", "ACCEPTED"] },
      },
    });
    if (existing) {
      await ctx.reply(
        "⚠️ You already have a pending or accepted request for this route. Please wait for a response.",
      );
      return;
    }

    const seats =
      direction === "MORNING" ? route.seatsAvailable : route.returnSeatsAvailable;

    if (!seats || seats <= 0) {
      await ctx.reply("⚠️ This pool is full. No seats available.");
      return;
    }

    const pickupAddress = direction === "MORNING" ? draft.startAddress : draft.pickupAddress;
    const pickupLat = direction === "MORNING" ? draft.startLat : draft.pickupLat;
    const pickupLng = direction === "MORNING" ? draft.startLng : draft.pickupLng;

    // Fix #1: atomic transaction — create request and decrement seat atomically
    let request: { id: string };
    try {
      request = await this.prisma.$transaction(async (tx) => {
        // Decrement first — if no seat is available the transaction rolls back
        const updated = await tx.carpoolRoute.updateMany({
          where: {
            id: routeId,
            ...(direction === "MORNING"
              ? { seatsAvailable: { gt: 0 } }
              : { returnSeatsAvailable: { gt: 0 } }),
          },
          data:
            direction === "MORNING"
              ? { seatsAvailable: { decrement: 1 } }
              : { returnSeatsAvailable: { decrement: 1 } },
        });

        if (updated.count === 0) {
          throw new Error("FULL");
        }

        return tx.carpoolRequest.create({
          data: {
            routeId,
            seekerId: seeker.id,
            direction,
            pickupAddress: pickupAddress!,
            pickupLat: pickupLat!,
            pickupLng: pickupLng!,
            distanceFromRoute: 0,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min
          },
        });
      });
    } catch (err: any) {
      if (err?.message === "FULL") {
        await ctx.reply("⚠️ No seats available — someone else just took the last one.");
      } else {
        await ctx.reply("⚠️ Failed to send request. Please try again.");
      }
      return;
    }

    // Notify the driver
    try {
      await ctx.telegram.sendMessage(
        route.resident.telegramId.toString(),
        `🙋 *Pickup Request*\n\nFlat ${seeker.flatNumber} is requesting a pickup on your route.\n\n📍 Their pickup: ${pickupAddress}\n🗓 Direction: ${direction}\n\nDo you have space?`,
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
