import { Logger } from "@nestjs/common";
import { Action, Command, Ctx, Start, Update, On } from "nestjs-telegraf";
import { mainMenuKeyboard } from "./keyboards/main-menu.keyboard";
import { PrismaService } from "./prisma/prisma.service";
import { SearchService } from "./modules/search/search.service";
import { BotContext } from "./types/bot-context";
import { CarpoolService } from "./modules/carpool/carpool.service";

@Update()
export class AppUpdate {
  private readonly logger = new Logger(AppUpdate.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly searchService: SearchService,
    private readonly carpoolService: CarpoolService,
  ) {}

  @Start()
  async start(@Ctx() ctx: BotContext) {
    this.logger.log(
      `[/start] userId=${ctx.from?.id} username=${ctx.from?.username ?? "n/a"}`,
    );
    const telegramId = BigInt(ctx.from?.id ?? 0);
    const resident = await this.prisma.resident.findUnique({
      where: { telegramId },
    });

    if (resident && !resident.isActive) {
      await ctx.reply("Your account is disabled. Contact the society admin.");
      return;
    }

    if (resident?.onboardingComplete) {
      await this.showMainMenu(ctx);
      return;
    }

    await ctx.scene.enter("onboarding");
  }

  @Command("menu")
  async menu(@Ctx() ctx: BotContext) {
    this.logger.log(`[/menu] userId=${ctx.from?.id}`);
    if (!(await this.ensureActiveOnboardedResident(ctx))) return;
    await this.showMainMenu(ctx);
  }

  @Command("exit")
  async exit(@Ctx() ctx: BotContext) {
    this.logger.log(`[/exit] userId=${ctx.from?.id}`);
    if (!(await this.ensureActiveOnboardedResident(ctx))) return;
    await this.showMainMenu(ctx);
  }

  @Command("ask")
  async ask(@Ctx() ctx: BotContext) {
    if (!(await this.ensureActiveOnboardedResident(ctx))) return;
    const text = (ctx.message as { text?: string })?.text ?? "";
    const query = text.replace(/^\/ask\s*/i, "").trim();
    this.logger.log(`[/ask] userId=${ctx.from?.id} query="${query}"`);
    await this.searchService.handleAsk(ctx, query);
  }

  @Command("found")
  async foundCommand(@Ctx() ctx: BotContext) {
    await this.enterScene(ctx, "found_report");
  }

  @Command("lost")
  async lostCommand(@Ctx() ctx: BotContext) {
    await this.enterScene(ctx, "lost_report");
  }


  @Action("menu:back")
  async backToMenu(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    if (!(await this.ensureActiveOnboardedResident(ctx))) return;
    await ctx.scene.leave();
    await this.showMainMenu(ctx);
  }

  @Action("profile:open")
  async openProfile(@Ctx() ctx: BotContext) {
    await this.enterScene(ctx, "profile");
  }

  @Action("vehicles:open")
  async openVehicles(@Ctx() ctx: BotContext) {
    await this.enterScene(ctx, "vehicles");
  }

  @Action("settings:open")
  async openSettings(@Ctx() ctx: BotContext) {
    await this.enterScene(ctx, "settings");
  }

  @Action("search:open")
  async openSearch(@Ctx() ctx: BotContext) {
    await this.enterScene(ctx, "search");
  }

  @Action("workers:open")
  async openWorkers(@Ctx() ctx: BotContext) {
    await this.enterScene(ctx, "workers");
  }

  @Action("services:open")
  async openServices(@Ctx() ctx: BotContext) {
    await this.enterScene(ctx, "microservices");
  }

  @Action("carpool:open")
  async openCarpool(@Ctx() ctx: BotContext) {
    await this.enterScene(ctx, "carpool");
  }

  @Action("lost_found:open")
  async openLostFoundMenu(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    if (!(await this.ensureActiveOnboardedResident(ctx))) return;
    await ctx.reply("📦 Lost & Found", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📷 I Found Something", callback_data: "lf_found" }],
          [{ text: "🔍 I Lost Something", callback_data: "lf_lost" }],
          [{ text: "📋 My Reports", callback_data: "lf_manage" }],
          [{ text: "🏠 Back to Menu", callback_data: "menu:back" }],
        ],
      },
    });
  }

  @Action("lf_found")
  async lfFound(@Ctx() ctx: BotContext) {
    await this.enterScene(ctx, "found_report");
  }

  @Action("lf_lost")
  async lfLost(@Ctx() ctx: BotContext) {
    await this.enterScene(ctx, "lost_report");
  }

  @Action("lf_manage")
  async lfManage(@Ctx() ctx: BotContext) {
    await this.enterScene(ctx, "lost_found_manage");
  }

  @Action(/lf_confirm_(.+)_(.+)/)
  async lfConfirm(@Ctx() ctx: BotContext & { match: RegExpMatchArray }) {
    await ctx.answerCbQuery();
    if (!(await this.ensureActiveOnboardedResident(ctx))) return;
    const match = ctx.match as RegExpMatchArray;
    const foundItemId = match[1];
    const lostItemId = match[2];
    
    // Lost person claims found item -> enter manage scene to show collection details
    await this.enterScene(ctx, "lost_found_manage");
  }

  @Action(/lf_reject_(.+)_(.+)/)
  async lfReject(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery("Okay, we will keep looking!");
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
  }

  @Action(/lf_claim_(.+)_(.+)/)
  async lfClaim(@Ctx() ctx: BotContext & { match: RegExpMatchArray }) {
    await ctx.answerCbQuery();
    if (!(await this.ensureActiveOnboardedResident(ctx))) return;
    const match = ctx.match as RegExpMatchArray;
    const foundItemId = match[1];
    const lostItemId = match[2];
    
    // Lost person claims found item -> enter manage scene to show collection details
    await this.enterScene(ctx, "lost_found_manage");
  }


  @Action(/carpool_manage:accept:(.+)/)
  async acceptRequest(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    if (!(await this.ensureActiveOnboardedResident(ctx))) return;
    const match =
      ctx.callbackQuery && "data" in ctx.callbackQuery
        ? ctx.callbackQuery.data.match(/carpool_manage:accept:(.+)/)
        : null;
    const reqId = match?.[1];
    if (reqId) {
      await this.carpoolService.acceptRequest(reqId, ctx);
    }
  }

  @Action(/carpool_manage:decline:(.+)/)
  async declineRequest(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    if (!(await this.ensureActiveOnboardedResident(ctx))) return;
    const match =
      ctx.callbackQuery && "data" in ctx.callbackQuery
        ? ctx.callbackQuery.data.match(/carpool_manage:decline:(.+)/)
        : null;
    const reqId = match?.[1];
    if (reqId) {
      await this.carpoolService.declineRequest(reqId, ctx);
    }
  }

  @Action(/carpool_ride:choose:(.+)/)
  async chooseMultipleAccepts(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    if (!(await this.ensureActiveOnboardedResident(ctx))) return;
    const match =
      ctx.callbackQuery && "data" in ctx.callbackQuery
        ? ctx.callbackQuery.data.match(/carpool_ride:choose:(.+)/)
        : null;
    const reqId = match?.[1];
    if (reqId) {
      await this.carpoolService.acceptRequest(reqId, ctx);
      await ctx
        .editMessageText(
          "✅ You chose this driver! We have shared your contacts.",
          { parse_mode: "Markdown" },
        )
        .catch(() => {});
    }
  }

  @On("message")
  async onMessage(@Ctx() ctx: BotContext) {
    if (!(await this.ensureActiveOnboardedResident(ctx))) return;
    const message = ctx.message as any;
    if (message?.location) {
      const { latitude, longitude, live_period } = message.location;
      if (!live_period) return;

      const telegramId = ctx.from?.id;
      if (!telegramId) return;

      const session = await this.prisma.rideSession.findFirst({
        where: {
          offererTelegramId: BigInt(telegramId),
          status: "ACTIVE",
        },
        include: { members: true },
      });

      if (!session) return;

      await this.prisma.rideSession.update({
        where: { id: session.id },
        data: { lastLat: latitude, lastLng: longitude },
      });

      for (const member of session.members) {
        try {
          await ctx.telegram.editMessageLiveLocation(
            member.riderTelegramId.toString(),
            member.locationMessageId,
            undefined,
            latitude,
            longitude,
          );
        } catch {}
      }
    }
  }

  private async showMainMenu(ctx: BotContext) {
    await ctx.reply("Society Bot", mainMenuKeyboard());
  }

  private async enterScene(ctx: BotContext, sceneId: string) {
    this.logger.log(`[scene:enter] scene=${sceneId} userId=${ctx.from?.id}`);
    await ctx.answerCbQuery();
    if (!(await this.ensureActiveOnboardedResident(ctx))) return;
    await ctx.scene.enter(sceneId);
  }

  private async ensureActiveOnboardedResident(ctx: BotContext) {
    const telegramId = ctx.from?.id;

    if (!telegramId) {
      await ctx.reply("Please start the bot again.");
      return false;
    }

    const resident = await this.prisma.resident.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!resident) {
      await ctx.scene.enter("onboarding");
      return false;
    }

    if (!resident.isActive) {
      await ctx.reply("Your account is disabled. Contact the society admin.");
      return false;
    }

    if (!resident.onboardingComplete) {
      await ctx.scene.enter("onboarding");
      return false;
    }

    return true;
  }
}
