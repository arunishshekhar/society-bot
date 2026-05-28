import { UseGuards } from "@nestjs/common";
import { Action, Command, Ctx, On, Scene, SceneEnter } from "nestjs-telegraf";
import { Markup } from "telegraf";
import { GroupMemberGuard } from "../guards/group-member.guard";
import { mainMenuKeyboard } from "../keyboards/main-menu.keyboard";
import { SearchService } from "../modules/search/search.service";
import { PrismaService } from "../prisma/prisma.service";
import { BotContext } from "../types/bot-context";

@Scene("search")
@UseGuards(GroupMemberGuard)
export class SearchScene {
  constructor(
    private readonly prisma: PrismaService,
    private readonly searchService: SearchService,
  ) {}

  @SceneEnter()
  async enter(@Ctx() ctx: BotContext) {
    ctx.session.search = { awaitingQuery: true };
    await ctx.reply("What are you looking for? Type naturally.");
  }

  @Action("menu:back")
  async backToMenu(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    await ctx.scene.leave();
    await ctx.reply("Society Bot", mainMenuKeyboard());
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

  @On("text")
  async onText(@Ctx() ctx: BotContext) {
    const query = ctx.text?.trim();
    if (!query) return;
    const intent = await this.searchService.classifyIntent(query);

    if (intent.type === "worker")
      return this.searchWorkers(ctx, intent.category, intent.keywords);
    if (intent.type === "service")
      return this.searchServices(ctx, intent.category, intent.keywords);

    // For carpool, inform, and rate_worker, defer to the global handler
    if (
      intent.type === "post_carpool" ||
      intent.type === "find_carpool" ||
      intent.type === "find_return" ||
      intent.type === "inform" ||
      intent.type === "rate_worker"
    ) {
      await ctx.scene.leave();
      return this.searchService.handleAsk(ctx, query);
    }

    await this.fallback(ctx);
  }

  private async searchWorkers(
    ctx: BotContext,
    category: string | undefined,
    keywords: string[],
  ) {
    const workers = await this.prisma.workerRecommendation.findMany({
      where: {
        isActive: true,
        isBanned: false,
        OR: [
          ...(category
            ? [
                {
                  category: {
                    contains: category,
                    mode: "insensitive" as const,
                  },
                },
              ]
            : []),
          ...keywords.flatMap((keyword) => [
            { notes: { contains: keyword, mode: "insensitive" as const } },
            { tags: { has: keyword } },
          ]),
        ],
      },
      include: { resident: true },
      orderBy: [{ avgRating: "desc" }, { createdAt: "desc" }],
      take: 5,
    });
    if (!workers.length) return this.empty(ctx);
    for (const worker of workers) {
      const ratingDisplay = worker.avgRating ? `⭐ ${worker.avgRating}` : "Not rated yet";
      await ctx.reply(
        `👷 *${worker.name}* [${worker.workerCode}] — ${worker.category}\n${ratingDisplay}\nAdded by: ${worker.resident?.flatNumber ?? "Admin"}${worker.notes ? `\n📝 ${worker.notes}` : ""}`,
        { parse_mode: "Markdown" },
      );
    }
  }

  private async searchServices(
    ctx: BotContext,
    category: string | undefined,
    keywords: string[],
  ) {
    const services = await this.prisma.microService.findMany({
      where: {
        isPaused: false,
        isDisabled: false,
        resident: { isActive: true },
        OR: [
          ...(category
            ? [
                {
                  category: {
                    contains: category,
                    mode: "insensitive" as const,
                  },
                },
              ]
            : []),
          ...keywords.map((keyword) => ({
            description: { contains: keyword, mode: "insensitive" as const },
          })),
        ],
      },
      include: { resident: true },
      take: 5,
    });
    if (!services.length) return this.empty(ctx);
    for (const service of services) {
      await ctx.reply(
        `${service.name} - ${service.category}\nFlat: ${service.resident?.flatNumber ?? "Admin"}\n${service.description ?? ""}`,
      );
    }
  }

  private empty(ctx: BotContext) {
    return ctx.reply(
      "No results found for that. Try browsing by category.",
      this.fallbackKeyboard(),
    );
  }

  private fallback(ctx: BotContext) {
    return ctx.reply(
      "Not sure what you need. Pick a category:",
      this.fallbackKeyboard(),
    );
  }

  private fallbackKeyboard() {
    return Markup.inlineKeyboard([
      [Markup.button.callback("Worker Directory", "workers:open")],
      [Markup.button.callback("Services", "services:open")],
      [Markup.button.callback("Carpool", "carpool:open")],
      [Markup.button.callback("Back", "menu:back")],
    ]);
  }
}
