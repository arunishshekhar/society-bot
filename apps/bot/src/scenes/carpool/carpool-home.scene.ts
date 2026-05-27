import { UseGuards } from "@nestjs/common";
import { Action, Ctx, Scene, SceneEnter } from "nestjs-telegraf";
import { Markup } from "telegraf";
import { GroupMemberGuard } from "../../guards/group-member.guard";
import { BotContext } from "../../types/bot-context";
import { mainMenuKeyboard } from "../../keyboards/main-menu.keyboard";
import { PrismaService } from "../../prisma/prisma.service";

@Scene("carpool")
@UseGuards(GroupMemberGuard)
export class CarpoolHomeScene {
  constructor(private readonly prisma: PrismaService) {}

  @SceneEnter()
  async enter(@Ctx() ctx: BotContext) {
    // Clear session for carpool
    ctx.session.carpool = {};

    await ctx.reply("🚗 *Carpool Menu*\n\nWhat would you like to do?", {
      parse_mode: "Markdown",
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback("📝 Post Route", "carpool:post")],
        [
          Markup.button.callback(
            "🌅 Find Morning Pool",
            "carpool:search:MORNING",
          ),
        ],
        [
          Markup.button.callback(
            "🏠 Find Return Pool",
            "carpool:search:RETURN",
          ),
        ],
        [Markup.button.callback("⚙️ Manage My Routes", "carpool:manage")],
        [Markup.button.callback("🔙 Back to Menu", "menu:back")],
      ]).reply_markup,
    });
  }

  @Action("carpool:post")
  async postRoute(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    await ctx.scene.enter("carpool_post");
  }

  @Action(/carpool:search:(MORNING|RETURN)/)
  async searchRoute(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const match =
      ctx.callbackQuery && "data" in ctx.callbackQuery
        ? ctx.callbackQuery.data.match(/carpool:search:(MORNING|RETURN)/)
        : null;
    const direction = match ? match[1] : "MORNING";
    ctx.session.carpool = { searchDirection: direction };
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
