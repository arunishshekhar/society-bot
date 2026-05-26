import { UseGuards } from '@nestjs/common';
import { Action, Command, Ctx, On, Scene, SceneEnter } from 'nestjs-telegraf';
import { Markup } from 'telegraf';
import { GroupMemberGuard } from '../guards/group-member.guard';
import { mainMenuKeyboard } from '../keyboards/main-menu.keyboard';
import { SearchService } from '../modules/search/search.service';
import { PrismaService } from '../prisma/prisma.service';
import { BotContext } from '../types/bot-context';

@Scene('search')
@UseGuards(GroupMemberGuard)
export class SearchScene {
  constructor(
    private readonly prisma: PrismaService,
    private readonly searchService: SearchService,
  ) {}

  @SceneEnter()
  async enter(@Ctx() ctx: BotContext) {
    ctx.session.search = { awaitingQuery: true };
    await ctx.reply('What are you looking for? Type naturally.');
  }

  @Action('menu:back')
  async backToMenu(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    await ctx.scene.leave();
    await ctx.reply('Society Bot', mainMenuKeyboard());
  }

  @Command('ask')
  async onAskCommand(@Ctx() ctx: BotContext) {
    const text = (ctx.message as { text?: string })?.text ?? '';
    const query = text.replace(/^\/ask\s*/i, '').trim();
    await ctx.scene.leave();
    await this.searchService.handleAsk(ctx, query);
  }

  @On('text')
  async onText(@Ctx() ctx: BotContext) {
    const query = ctx.text?.trim();
    if (!query) return;
    const intent = await this.searchService.classifyIntent(query);

    if (intent.type === 'worker') return this.searchWorkers(ctx, intent.category, intent.keywords);
    if (intent.type === 'service') return this.searchServices(ctx, intent.category, intent.keywords);
    if (intent.type === 'carpool') return this.searchCarpool(ctx, intent.keywords.length ? intent.keywords.join(' ') : query);

    await this.fallback(ctx);
  }

  private async searchWorkers(ctx: BotContext, category: string | undefined, keywords: string[]) {
    const workers = await this.prisma.workerRecommendation.findMany({
      where: {
        isActive: true,
        isBanned: false,
        OR: [
          ...(category ? [{ category: { contains: category, mode: 'insensitive' as const } }] : []),
          ...keywords.flatMap((keyword) => [
            { notes: { contains: keyword, mode: 'insensitive' as const } },
            { tags: { has: keyword } },
          ]),
        ],
      },
      include: { resident: true },
      orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }],
      take: 5,
    });
    if (!workers.length) return this.empty(ctx);
    for (const worker of workers) {
      await ctx.reply(`${worker.name} - ${worker.category}\nAdded by: ${worker.resident?.flatNumber ?? 'Admin'}\n${worker.notes ?? ''}`);
    }
  }

  private async searchServices(ctx: BotContext, category: string | undefined, keywords: string[]) {
    const services = await this.prisma.microService.findMany({
      where: {
        isPaused: false,
        isDisabled: false,
        resident: { isActive: true },
        OR: [
          ...(category ? [{ category: { contains: category, mode: 'insensitive' as const } }] : []),
          ...keywords.map((keyword) => ({ description: { contains: keyword, mode: 'insensitive' as const } })),
        ],
      },
      include: { resident: true },
      take: 5,
    });
    if (!services.length) return this.empty(ctx);
    for (const service of services) {
      await ctx.reply(`${service.name} - ${service.category}\nFlat: ${service.resident?.flatNumber ?? 'Admin'}\n${service.description ?? ''}`);
    }
  }

  private async searchCarpool(ctx: BotContext, query: string) {
    const routes = await this.prisma.carpoolRoute.findMany({
      where: { isPaused: false, destination: { contains: query, mode: 'insensitive' }, resident: { isActive: true } },
      include: { resident: true },
      take: 5,
    });
    if (!routes.length) return this.empty(ctx);
    for (const route of routes) {
      await ctx.reply(`${route.resident.flatNumber} -> ${route.destination}\nDeparts: ${route.departureTime}\nSeats: ${route.seatsAvailable}`);
    }
  }

  private empty(ctx: BotContext) {
    return ctx.reply('No results found for that. Try browsing by category.', this.fallbackKeyboard());
  }

  private fallback(ctx: BotContext) {
    return ctx.reply('Not sure what you need. Pick a category:', this.fallbackKeyboard());
  }

  private fallbackKeyboard() {
    return Markup.inlineKeyboard([
      [Markup.button.callback('Worker Directory', 'workers:open')],
      [Markup.button.callback('Services', 'services:open')],
      [Markup.button.callback('Carpool', 'carpool:open')],
      [Markup.button.callback('Back', 'menu:back')],
    ]);
  }
}
