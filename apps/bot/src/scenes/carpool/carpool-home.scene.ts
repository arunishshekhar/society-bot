import { UseGuards } from "@nestjs/common";
import { Action, Command, Ctx, Scene, SceneEnter } from "nestjs-telegraf";
import { Markup } from "telegraf";
import { GroupMemberGuard } from "../../guards/group-member.guard";
import { BotContext } from "../../types/bot-context";
import { mainMenuKeyboard } from "../../keyboards/main-menu.keyboard";
import { PrismaService } from "../../prisma/prisma.service";
import { SearchService } from "../../modules/search/search.service";

@Scene("carpool")
@UseGuards(GroupMemberGuard)
export class CarpoolHomeScene {
  constructor(
    private readonly prisma: PrismaService,
    private readonly searchService: SearchService,
  ) {}

  @SceneEnter()
  async enter(@Ctx() ctx: BotContext) {
    // Clear session for carpool
    ctx.session.carpool = {};

    await ctx.reply("🚗 *Carpool Menu*\n\nWhat would you like to do?", {
      parse_mode: "Markdown",
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback("📝 Post Route", "carpool:post")],
        [Markup.button.callback("🔍 Find Pool", "carpool:search")],
        [Markup.button.callback("⚙️ Manage My Routes", "carpool:manage")],
        [Markup.button.callback("🔙 Back to Menu", "menu:back")],
      ]).reply_markup,
    });
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

  @Action("carpool:post")
  async postRoute(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    await ctx.scene.enter("carpool_post");
  }

  @Action("carpool:search")
  async searchRoute(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    ctx.session.carpool = {};
    await ctx.scene.enter("carpool_search");
  }

  @Action("carpool:manage")
  async manageRoutes(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    await ctx.scene.enter("carpool_manage");
  }

  @Action("menu:back")
  async backToMenu(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    await ctx.scene.leave();
    await ctx.reply("Society Bot", mainMenuKeyboard());
  }
}
