import { UseGuards } from "@nestjs/common";
import { Action, Ctx, On, Scene, SceneEnter } from "nestjs-telegraf";
import { Markup } from "telegraf";
import { GroupMemberGuard } from "../../guards/group-member.guard";
import { BotContext } from "../../types/bot-context";
import { PrismaService } from "../../prisma/prisma.service";
import {
  PhotonService,
  PlaceResult,
} from "../../modules/carpool/photon.service";
import { OrsService, OrsRoute } from "../../modules/carpool/ors.service";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

@Scene("carpool_post")
@UseGuards(GroupMemberGuard)
export class CarpoolPostScene {
  private readonly societyLat = parseFloat(process.env.SOCIETY_LAT ?? "0");
  private readonly societyLng = parseFloat(process.env.SOCIETY_LNG ?? "0");

  constructor(
    private readonly prisma: PrismaService,
    private readonly photonService: PhotonService,
    private readonly orsService: OrsService,
  ) {}

  @SceneEnter()
  async enter(@Ctx() ctx: BotContext) {
    const draft = ctx.session.carpool?.postDraft ?? {};
    ctx.session.carpool = {
      ...ctx.session.carpool,
      postDraft: draft,
      step: "destination",
    };

    if (draft.destinationAddress) {
      await this.confirmDestination(ctx, draft.destinationAddress);
    } else {
      await ctx.reply("Where are you going?\nType the destination name.");
    }
  }

  @On("text")
  async onText(@Ctx() ctx: BotContext) {
    const step = ctx.session.carpool?.step;
    const text = ctx.text?.trim();
    if (!step || !text) return;

    if (step === "destination") {
      const results = await this.photonService.search(text);
      if (!results.length) {
        await ctx.reply("No results found. Please try another name.");
        return;
      }
      ctx.session.carpool!.placeResults = results;

      const buttons = results.map((r, i) => [
        Markup.button.callback(
          `${i + 1}. ${r.name}, ${r.address}`.substring(0, 60),
          `carpool_post:place:${i}`,
        ),
      ]);
      await ctx.reply(
        "Select your destination:",
        Markup.inlineKeyboard([
          ...buttons,
          [
            Markup.button.callback(
              "Not listed, type again",
              "carpool_post:retry_dest",
            ),
          ],
        ]),
      );
    } else if (step === "departureTime") {
      // Basic validation
      if (!text.match(/\d{1,2}:\d{2}\s*(AM|PM)/i)) {
        await ctx.reply("Please use format like 9:00 AM");
        return;
      }
      ctx.session.carpool!.postDraft!.departureTime = text;
      await this.askRouteType(ctx);
    } else if (step === "returnTime") {
      if (!text.match(/\d{1,2}:\d{2}\s*(AM|PM)/i)) {
        await ctx.reply("Please use format like 6:30 PM");
        return;
      }
      ctx.session.carpool!.postDraft!.returnTime = text;

      const draft = ctx.session.carpool!.postDraft!;
      const results = await this.orsService.getRoutes(
        draft.destinationLat!,
        draft.destinationLng!,
        this.societyLat,
        this.societyLng,
      );
      ctx.session.carpool!.routeResults = results;

      if (!results.length) {
        await ctx.reply("Could not find a return route.");
        return this.askReturnSeats(ctx);
      }

      const buttons = results.map((r, i) => [
        Markup.button.callback(
          `🛣 ${r.summary} (${r.distanceKm}km, ~${r.durationMin}m)`,
          `carpool_post:ret_route:${i}`,
        ),
      ]);
      await ctx.reply(
        "Choose your return route:",
        Markup.inlineKeyboard(buttons),
      );
    }
  }

  @Action("carpool_post:retry_dest")
  async retryDest(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    ctx.session.carpool!.step = "destination";
    await ctx.reply("Type the destination name again.");
  }

  @Action(/carpool_post:place:\d+/)
  async selectPlace(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const match =
      ctx.callbackQuery && "data" in ctx.callbackQuery
        ? ctx.callbackQuery.data.match(/carpool_post:place:(\d+)/)
        : null;
    if (!match) return;
    const index = parseInt(match[1]);
    const place = ctx.session.carpool?.placeResults?.[index];
    if (!place) return;

    ctx.session.carpool!.postDraft!.destinationAddress = place.name;
    ctx.session.carpool!.postDraft!.destinationLat = place.lat;
    ctx.session.carpool!.postDraft!.destinationLng = place.lng;

    const results = await this.orsService.getRoutes(
      this.societyLat,
      this.societyLng,
      place.lat,
      place.lng,
    );
    ctx.session.carpool!.routeResults = results;

    if (!results.length) {
      await ctx.reply(
        "Could not find any routes to that destination.",
        Markup.inlineKeyboard([
          [Markup.button.callback("Back", "carpool_post:retry_dest")],
        ]),
      );
      return;
    }

    const buttons = results.map((r, i) => [
      Markup.button.callback(
        `🛣 ${r.summary} (${r.distanceKm}km, ~${r.durationMin}m)`,
        `carpool_post:route:${i}`,
      ),
    ]);
    await ctx.reply(
      "Choose your morning route:",
      Markup.inlineKeyboard(buttons),
    );
  }

  @Action(/carpool_post:route:\d+/)
  async selectRoute(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const match =
      ctx.callbackQuery && "data" in ctx.callbackQuery
        ? ctx.callbackQuery.data.match(/carpool_post:route:(\d+)/)
        : null;
    if (!match) return;
    const index = parseInt(match[1]);
    const route = ctx.session.carpool?.routeResults?.[index];
    if (!route) return;

    ctx.session.carpool!.postDraft!.morningPolyline = route.encodedPolyline;
    ctx.session.carpool!.postDraft!.morningDistanceKm = route.distanceKm;
    ctx.session.carpool!.postDraft!.morningDurationMin = route.durationMin;

    const draft = ctx.session.carpool!.postDraft!;
    if (draft.departureTime) {
      await ctx.reply(
        `Departure time: ${draft.departureTime}\nIs this correct?`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback("Yes", "carpool_post:time_ok"),
            Markup.button.callback("Change", "carpool_post:time_change"),
          ],
        ]),
      );
    } else {
      ctx.session.carpool!.step = "departureTime";
      await ctx.reply("What time do you usually depart?\n(e.g. 8:30 AM)");
    }
  }

  @Action("carpool_post:time_ok")
  async timeOk(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    await this.askRouteType(ctx);
  }

  @Action("carpool_post:time_change")
  async timeChange(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    ctx.session.carpool!.step = "departureTime";
    await ctx.reply("What time do you usually depart?\n(e.g. 8:30 AM)");
  }

  async askRouteType(ctx: BotContext) {
    await ctx.reply(
      "Is this a recurring route or one-time?",
      Markup.inlineKeyboard([
        [Markup.button.callback("Recurring", "carpool_post:type:RECURRING")],
        [Markup.button.callback("One Time", "carpool_post:type:ONE_TIME")],
      ]),
    );
  }

  @Action(/carpool_post:type:(RECURRING|ONE_TIME)/)
  async setRouteType(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const match =
      ctx.callbackQuery && "data" in ctx.callbackQuery
        ? ctx.callbackQuery.data.match(/carpool_post:type:(RECURRING|ONE_TIME)/)
        : null;
    const type = match?.[1];
    ctx.session.carpool!.postDraft!.type = type as "RECURRING" | "ONE_TIME";

    if (type === "RECURRING") {
      await this.promptDays(ctx);
    } else {
      // For simplicity in one-time, just set it to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      ctx.session.carpool!.postDraft!.oneTimeDate = tomorrow;
      await this.askSeats(ctx);
    }
  }

  async promptDays(ctx: BotContext) {
    const draft = ctx.session.carpool!.postDraft!;
    const selected = new Set(draft.recurringDays ?? []);

    await ctx.reply(
      "Which days?",
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "Weekdays (Mon-Fri)",
            "carpool_post:days_set:weekdays",
          ),
        ],
        [
          Markup.button.callback(
            "All Week (Mon-Sun)",
            "carpool_post:days_set:all",
          ),
        ],
        ...days.map((day) => [
          Markup.button.callback(
            `${selected.has(day) ? "✓ " : ""}${day}`,
            `carpool_post:day:${day}`,
          ),
        ]),
        [Markup.button.callback("Done", "carpool_post:days_done")],
      ]),
    );
  }

  @Action(/carpool_post:days_set:(weekdays|all)/)
  async setDaysPreset(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const match =
      ctx.callbackQuery && "data" in ctx.callbackQuery
        ? ctx.callbackQuery.data.match(/carpool_post:days_set:(weekdays|all)/)
        : null;
    const preset = match?.[1];
    if (preset === "weekdays") {
      ctx.session.carpool!.postDraft!.recurringDays = [
        "Mon",
        "Tue",
        "Wed",
        "Thu",
        "Fri",
      ];
    } else {
      ctx.session.carpool!.postDraft!.recurringDays = [...days];
    }
    await this.askSeats(ctx);
  }

  @Action(/carpool_post:day:(.+)/)
  async toggleDay(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const match =
      ctx.callbackQuery && "data" in ctx.callbackQuery
        ? ctx.callbackQuery.data.match(/carpool_post:day:(.+)/)
        : null;
    const day = match?.[1];
    if (!day) return;

    const draft = ctx.session.carpool!.postDraft!;
    const selected = new Set(draft.recurringDays ?? []);
    if (selected.has(day)) selected.delete(day);
    else selected.add(day);

    draft.recurringDays = Array.from(selected);

    try {
      await ctx.editMessageReplyMarkup({
        inline_keyboard: [
          [
            {
              text: "Weekdays (Mon-Fri)",
              callback_data: "carpool_post:days_set:weekdays",
            },
          ],
          [
            {
              text: "All Week (Mon-Sun)",
              callback_data: "carpool_post:days_set:all",
            },
          ],
          ...days.map((d) => [
            {
              text: `${selected.has(d) ? "✓ " : ""}${d}`,
              callback_data: `carpool_post:day:${d}`,
            },
          ]),
          [{ text: "Done", callback_data: "carpool_post:days_done" }],
        ],
      });
    } catch {}
  }

  @Action("carpool_post:days_done")
  async daysDone(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const draft = ctx.session.carpool!.postDraft!;
    if (!draft.recurringDays?.length) {
      await ctx.reply("Please select at least one day.");
      return;
    }
    await this.askSeats(ctx);
  }

  async askSeats(ctx: BotContext) {
    await ctx.reply(
      "How many seats are you offering?",
      Markup.inlineKeyboard([
        [
          Markup.button.callback("1", "carpool_post:seats:1"),
          Markup.button.callback("2", "carpool_post:seats:2"),
        ],
        [
          Markup.button.callback("3", "carpool_post:seats:3"),
          Markup.button.callback("4", "carpool_post:seats:4"),
        ],
      ]),
    );
  }

  @Action(/carpool_post:seats:(\d)/)
  async setSeats(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const match =
      ctx.callbackQuery && "data" in ctx.callbackQuery
        ? ctx.callbackQuery.data.match(/carpool_post:seats:(\d)/)
        : null;
    ctx.session.carpool!.postDraft!.seatsAvailable = parseInt(
      match?.[1] ?? "1",
    );
    await this.askReturn(ctx);
  }

  async askReturn(ctx: BotContext) {
    const dest = ctx.session.carpool!.postDraft!.destinationAddress;
    await ctx.reply(
      `Do you also offer a return trip from ${dest}?`,
      Markup.inlineKeyboard([
        [Markup.button.callback("Yes, add return", "carpool_post:return:yes")],
        [Markup.button.callback("No", "carpool_post:return:no")],
      ]),
    );
  }

  @Action("carpool_post:return:yes")
  async returnYes(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    ctx.session.carpool!.postDraft!.hasReturn = true;
    ctx.session.carpool!.step = "returnTime";
    await ctx.reply("What time do you usually leave for home?\n(e.g. 6:30 PM)");
  }

  @Action("carpool_post:return:no")
  async returnNo(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    ctx.session.carpool!.postDraft!.hasReturn = false;
    await this.showSummary(ctx);
  }

  @Action(/carpool_post:ret_route:\d+/)
  async selectRetRoute(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const match =
      ctx.callbackQuery && "data" in ctx.callbackQuery
        ? ctx.callbackQuery.data.match(/carpool_post:ret_route:(\d+)/)
        : null;
    if (!match) return;
    const index = parseInt(match[1]);
    const route = ctx.session.carpool?.routeResults?.[index];
    if (!route) return;

    ctx.session.carpool!.postDraft!.returnPolyline = route.encodedPolyline;
    await this.askReturnSeats(ctx);
  }

  async askReturnSeats(ctx: BotContext) {
    await ctx.reply(
      "Return seats available?",
      Markup.inlineKeyboard([
        [
          Markup.button.callback("1", "carpool_post:ret_seats:1"),
          Markup.button.callback("2", "carpool_post:ret_seats:2"),
        ],
        [
          Markup.button.callback("3", "carpool_post:ret_seats:3"),
          Markup.button.callback("4", "carpool_post:ret_seats:4"),
        ],
      ]),
    );
  }

  @Action(/carpool_post:ret_seats:(\d)/)
  async setRetSeats(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const match =
      ctx.callbackQuery && "data" in ctx.callbackQuery
        ? ctx.callbackQuery.data.match(/carpool_post:ret_seats:(\d)/)
        : null;
    ctx.session.carpool!.postDraft!.returnSeatsAvailable = parseInt(
      match?.[1] ?? "1",
    );
    await this.showSummary(ctx);
  }

  async showSummary(ctx: BotContext) {
    const draft = ctx.session.carpool!.postDraft!;

    let text = `✅ *Review your carpool:*\n\n`;
    text += `🚗 *Morning: ${draft.destinationAddress}*\n`;
    text += `   ${draft.morningDistanceKm} km\n`;
    text += `   Departs: ${draft.departureTime} · ${draft.type === "RECURRING" ? draft.recurringDays?.join(",") : "One Time"} · ${draft.seatsAvailable} seats\n`;

    if (draft.hasReturn) {
      text += `\n🏠 *Return: ${draft.destinationAddress} → Home*\n`;
      text += `   Departs: ${draft.returnTime} · ${draft.returnSeatsAvailable} seats\n`;
    }

    await ctx.reply(text, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [Markup.button.callback("✅ Confirm & Post", "carpool_post:save")],
          [Markup.button.callback("❌ Cancel", "carpool_post:cancel")],
        ],
      },
    });
  }

  @Action("carpool_post:save")
  async saveRoute(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const draft = ctx.session.carpool!.postDraft!;
    const resident = await this.prisma.resident.findUnique({
      where: { telegramId: BigInt(ctx.from!.id) },
    });
    if (!resident) return;

    await this.prisma.carpoolRoute.create({
      data: {
        residentId: resident.id,
        type: draft.type as any,
        recurringDays: draft.recurringDays ?? [],
        oneTimeDate: draft.oneTimeDate,
        destinationAddress: draft.destinationAddress!,
        destinationLat: draft.destinationLat!,
        destinationLng: draft.destinationLng!,
        departureTime: draft.departureTime!,
        morningPolyline: draft.morningPolyline!,
        morningDistanceKm: draft.morningDistanceKm!,
        morningDurationMin: draft.morningDurationMin!,
        seatsAvailable: draft.seatsAvailable!,
        hasReturn: draft.hasReturn ?? false,
        returnTime: draft.returnTime,
        returnPolyline: draft.returnPolyline,
        returnSeatsAvailable: draft.returnSeatsAvailable,
      },
    });

    await ctx.reply("✅ Carpool route posted successfully!");
    await ctx.scene.enter("carpool");
  }

  @Action("carpool_post:cancel")
  async cancel(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    await ctx.scene.enter("carpool");
  }

  private async confirmDestination(ctx: BotContext, dest: string) {
    ctx.session.carpool!.step = "destination";
    // Emulate sending text by passing a new context proxy
    const fakeCtx = new Proxy(ctx, {
      get(target, prop) {
        if (prop === "text") return dest;
        return (target as any)[prop];
      },
    });
    await this.onText(fakeCtx as any);
  }
}
