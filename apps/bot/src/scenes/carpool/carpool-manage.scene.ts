import { UseGuards } from "@nestjs/common";
import { Action, Command, Ctx, Scene, SceneEnter } from "nestjs-telegraf";
import { Markup } from "telegraf";
import { GroupMemberGuard } from "../../guards/group-member.guard";
import { BotContext } from "../../types/bot-context";
import { PrismaService } from "../../prisma/prisma.service";
import { SearchService } from "../../modules/search/search.service";
import { mainMenuKeyboard } from "../../keyboards/main-menu.keyboard";

@Scene("carpool_manage")
@UseGuards(GroupMemberGuard)
export class CarpoolManageScene {
  constructor(
    private readonly prisma: PrismaService,
    private readonly searchService: SearchService,
  ) {}

  @SceneEnter()
  async enter(@Ctx() ctx: BotContext) {
    await this.showMine(ctx);
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

  private async showMine(ctx: BotContext) {
    const resident = await this.prisma.resident.findUnique({
      where: { telegramId: BigInt(ctx.from!.id) },
    });
    if (!resident) return;

    const routes = await this.prisma.carpoolRoute.findMany({
      where: { residentId: resident.id },
      orderBy: { createdAt: "desc" },
    });
    const routeLines = routes.map(
      (r, i) =>
        `${i + 1}. ${r.startAddress ?? 'Society'} → ${r.destinationAddress} - ${r.departureTime} (${r.isPaused ? "Paused" : "Active"})`,
    );
    const routeButtons = routes.map((r) => [
      Markup.button.callback(
        `${r.startAddress ?? 'Society'} → ${r.destinationAddress} - ${r.departureTime}`,
        `carpool_manage:select:${r.id}`,
      ),
    ]);

    const text = routes.length
      ? ["Your routes:", ...routeLines].join("\n")
      : "You have not posted any carpool routes.";

    await ctx.reply(
      text,
      Markup.inlineKeyboard([
        ...routeButtons,
        [Markup.button.callback("Back", "carpool_manage:cancel")],
      ]),
    );
  }

  @Action(/carpool_manage:select:(.+)/)
  async select(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const match =
      ctx.callbackQuery && "data" in ctx.callbackQuery
        ? ctx.callbackQuery.data.match(/carpool_manage:select:(.+)/)
        : null;
    const id = match?.[1];
    if (!id) return;

    if (!ctx.session.carpool) ctx.session.carpool = {};
    ctx.session.carpool.selectedRouteId = id;
    await this.showRouteDetail(ctx, id);
  }

  private async showRouteDetail(ctx: BotContext, id: string) {
    const route = await this.prisma.carpoolRoute.findUnique({
      where: { id },
      include: { resident: true },
    });
    if (!route) return this.showMine(ctx);

    const text = `🚗 *Morning:* ${route.startAddress ?? 'Society'} → ${route.destinationAddress}\nDeparts: ${route.departureTime} · Seats: ${route.seatsAvailable}\n🏠 *Return:* ${route.hasReturn ? `Yes (${route.returnTime})` : "No"}`;

    await ctx.reply(text, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            Markup.button.callback(
              route.isPaused ? "Resume" : "Pause",
              "carpool_manage:toggle_pause",
            ),
          ],
          [
            Markup.button.callback(
              "🚀 Start Ride",
              "carpool_manage:start_ride",
            ),
          ],
          [Markup.button.callback("Delete", "carpool_manage:delete")],
          [Markup.button.callback("Back", "carpool_manage:home")],
        ],
      },
    });
  }

  @Action("carpool_manage:toggle_pause")
  async togglePause(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const id = ctx.session.carpool?.selectedRouteId;
    if (!id) return;
    const route = await this.prisma.carpoolRoute.findUnique({ where: { id } });
    if (!route) return;

    // Ownership check
    const resident = await this.prisma.resident.findUnique({
      where: { telegramId: BigInt(ctx.from!.id) },
    });
    if (!resident || route.residentId !== resident.id) {
      await ctx.reply("You can only pause/resume your own carpool routes.");
      return;
    }

    await this.prisma.carpoolRoute.update({
      where: { id },
      data: { isPaused: !route.isPaused },
    });
    await ctx.reply(route.isPaused ? "Route resumed." : "Route paused.");
    await this.showRouteDetail(ctx, id);
  }

  @Action("carpool_manage:delete")
  async confirmDelete(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    await ctx.reply(
      "Delete this route?",
      Markup.inlineKeyboard([
        [
          Markup.button.callback("Delete", "carpool_manage:delete_confirm"),
          Markup.button.callback("Cancel", "carpool_manage:home"),
        ],
      ]),
    );
  }

  @Action("carpool_manage:delete_confirm")
  async delete(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const id = ctx.session.carpool?.selectedRouteId;
    if (!id) return;

    // Ownership check: only the route owner may delete it
    const resident = await this.prisma.resident.findUnique({
      where: { telegramId: BigInt(ctx.from!.id) },
    });
    if (!resident) return;

    const route = await this.prisma.carpoolRoute.findUnique({ where: { id } });
    if (!route || route.residentId !== resident.id) {
      await ctx.reply("You can only delete your own carpool routes.");
      return;
    }

    await this.prisma.carpoolRoute.delete({ where: { id } });
    await ctx.reply("Route deleted.");
    await this.showMine(ctx);
  }

  @Action("carpool_manage:start_ride")
  async startRide(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const id = ctx.session.carpool?.selectedRouteId;
    if (!id) return;

    // Ownership check: only the route owner may start a ride on it
    const resident = await this.prisma.resident.findUnique({
      where: { telegramId: BigInt(ctx.from!.id) },
    });
    const route = resident
      ? await this.prisma.carpoolRoute.findUnique({ where: { id } })
      : null;

    if (!route || route.residentId !== resident?.id) {
      await ctx.reply("You can only start a ride for your own carpool routes.");
      return;
    }

    await ctx.scene.enter("carpool_ride");
  }

  @Action("carpool_manage:home")
  async home(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    await this.showMine(ctx);
  }

  @Action("carpool_manage:cancel")
  async cancel(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    await ctx.scene.enter("carpool");
  }
}
