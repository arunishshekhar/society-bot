import { Logger } from '@nestjs/common';
import { Action, Command, Ctx, Start, Update } from 'nestjs-telegraf';
import { Markup } from 'telegraf';
import { mainMenuKeyboard } from './keyboards/main-menu.keyboard';
import { PrismaService } from './prisma/prisma.service';
import { SearchService } from './modules/search/search.service';
import { BotContext } from './types/bot-context';

@Update()
export class AppUpdate {
  private readonly logger = new Logger(AppUpdate.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly searchService: SearchService,
  ) {}

  @Start()
  async start(@Ctx() ctx: BotContext) {
    this.logger.log(`[/start] userId=${ctx.from?.id} username=${ctx.from?.username ?? 'n/a'}`);
    const telegramId = BigInt(ctx.from?.id ?? 0);
    const resident = await this.prisma.resident.findUnique({
      where: { telegramId },
    });

    if (resident && !resident.isActive) {
      await ctx.reply('Your account is disabled. Contact the society admin.');
      return;
    }

    if (resident?.onboardingComplete) {
      await this.showMainMenu(ctx);
      return;
    }

    await ctx.scene.enter('onboarding');
  }

  @Command('menu')
  async menu(@Ctx() ctx: BotContext) {
    this.logger.log(`[/menu] userId=${ctx.from?.id}`);
    if (!(await this.ensureActiveOnboardedResident(ctx))) return;
    await this.showMainMenu(ctx);
  }

  @Command('ask')
  async ask(@Ctx() ctx: BotContext) {
    if (!(await this.ensureActiveOnboardedResident(ctx))) return;

    const text = (ctx.message as { text?: string })?.text ?? '';
    const query = text.replace(/^\/ask\s*/i, '').trim();

    if (!query) {
      await ctx.reply(
        '💬 What are you looking for?\n\nExamples:\n• /ask I need a North Indian maid\n• /ask carpool to MG Road on Monday at 8AM\n• /ask plumber for bathroom repair',
      );
      return;
    }

    this.logger.log(`[/ask] userId=${ctx.from?.id} query="${query}"`);
    await ctx.sendChatAction('typing');

    const intent = await this.searchService.classifyIntent(query);
    this.logger.log(`[/ask] intent=${JSON.stringify(intent)}`);

    if (intent.type === 'worker') {
      await this.askWorkers(ctx, intent.category, intent.keywords);
    } else if (intent.type === 'service') {
      await this.askServices(ctx, intent.category, intent.keywords);
    } else if (intent.type === 'carpool') {
      await this.askCarpool(ctx, intent.destination, intent.days, intent.time, intent.keywords);
    } else {
      await ctx.reply(
        "🤔 I couldn't understand what you're looking for. Try being more specific.\n\nExamples:\n• /ask North Indian maid\n• /ask carpool MG Road Monday 8AM\n• /ask electrician",
        Markup.inlineKeyboard([
          [Markup.button.callback('👷 Workers', 'workers:open'), Markup.button.callback('🛎 Services', 'services:open')],
          [Markup.button.callback('🚗 Carpool', 'carpool:open')],
        ]),
      );
    }
  }

  private async askWorkers(ctx: BotContext, category?: string, keywords: string[] = []) {
    const orClauses: object[] = [
      ...(category ? [{ category: { contains: category, mode: 'insensitive' as const } }] : []),
      ...keywords.flatMap((kw) => [
        { notes: { contains: kw, mode: 'insensitive' as const } },
        { tags: { has: kw } },
        { name: { contains: kw, mode: 'insensitive' as const } },
        { category: { contains: kw, mode: 'insensitive' as const } },
      ]),
    ];

    const workers = await this.prisma.workerRecommendation.findMany({
      where: {
        isActive: true,
        isBanned: false,
        ...(orClauses.length ? { OR: orClauses } : {}),
      },
      include: { resident: true },
      orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }],
      take: 5,
    });

    if (!workers.length) {
      await ctx.reply('😕 No workers found matching your request. Try different keywords.');
      return;
    }

    await ctx.reply(`Found ${workers.length} worker(s):`);
    for (const w of workers) {
      const stars = w.rating ? '⭐'.repeat(Math.min(w.rating, 5)) : '';
      const addedBy = w.resident?.flatNumber ? `Flat ${w.resident.flatNumber}` : 'Admin';
      await ctx.reply(
        `👷 *${w.name}* — ${w.category}${stars ? ` ${stars}` : ''}\n📞 ${w.phone}${w.notes ? `\n📝 ${w.notes}` : ''}\nAdded by: ${addedBy}`,
        { parse_mode: 'Markdown' },
      );
    }
  }

  private async askServices(ctx: BotContext, category?: string, keywords: string[] = []) {
    const orClauses: object[] = [
      ...(category ? [{ category: { contains: category, mode: 'insensitive' as const } }] : []),
      ...keywords.flatMap((kw) => [
        { name: { contains: kw, mode: 'insensitive' as const } },
        { description: { contains: kw, mode: 'insensitive' as const } },
        { category: { contains: kw, mode: 'insensitive' as const } },
      ]),
    ];

    const services = await this.prisma.microService.findMany({
      where: {
        isPaused: false,
        isDisabled: false,
        resident: { isActive: true },
        ...(orClauses.length ? { OR: orClauses } : {}),
      },
      include: { resident: true },
      take: 5,
    });

    if (!services.length) {
      await ctx.reply('😕 No services found matching your request.');
      return;
    }

    await ctx.reply(`Found ${services.length} service(s):`);
    for (const s of services) {
      await ctx.reply(
        `🛎 *${s.name}* — ${s.category}\nFlat: ${s.resident?.flatNumber ?? 'Admin'}${s.description ? `\n📝 ${s.description}` : ''}`,
        { parse_mode: 'Markdown' },
      );
    }
  }

  private async askCarpool(
    ctx: BotContext,
    destination?: string,
    days?: string[],
    _time?: string,
    keywords: string[] = [],
  ) {
    // Build where clause — use AI-extracted destination first, fall back to keywords
    const destTerm = destination ?? keywords.find((k) => k.length > 3);

    const where: Record<string, unknown> = {
      isPaused: false,
      resident: { isActive: true },
    };

    if (destTerm) {
      where['destination'] = { contains: destTerm, mode: 'insensitive' };
    }

    if (days && days.length > 0) {
      where['days'] = { hasSome: days };
    }

    const routes = await this.prisma.carpoolRoute.findMany({
      where,
      include: { resident: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    if (!routes.length) {
      await ctx.reply(`😕 No carpool routes found${destTerm ? ` to ${destTerm}` : ''}${days?.length ? ` on ${days.join('/')}` : ''}.`);
      return;
    }

    await ctx.reply(`Found ${routes.length} carpool route(s):`);
    for (const r of routes) {
      const daysStr = Array.isArray(r.days) && r.days.length ? r.days.join(', ') : 'Daily';
      await ctx.reply(
        `🚗 *${r.resident.flatNumber}* → ${r.destination}\n🕐 Departs: ${r.departureTime}${r.returnTime ? ` | Returns: ${r.returnTime}` : ''}\n📅 ${daysStr}\n💺 Seats: ${r.seatsAvailable}`,
        { parse_mode: 'Markdown' },
      );
    }
  }

  @Action('menu:back')
  async backToMenu(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    await ctx.scene.leave();
    await this.showMainMenu(ctx);
  }

  @Action('profile:open')
  async openProfile(@Ctx() ctx: BotContext) {
    await this.enterScene(ctx, 'profile');
  }

  @Action('vehicles:open')
  async openVehicles(@Ctx() ctx: BotContext) {
    await this.enterScene(ctx, 'vehicles');
  }

  @Action('settings:open')
  async openSettings(@Ctx() ctx: BotContext) {
    await this.enterScene(ctx, 'settings');
  }

  @Action('search:open')
  async openSearch(@Ctx() ctx: BotContext) {
    await this.enterScene(ctx, 'search');
  }

  @Action('workers:open')
  async openWorkers(@Ctx() ctx: BotContext) {
    await this.enterScene(ctx, 'workers');
  }

  @Action('services:open')
  async openServices(@Ctx() ctx: BotContext) {
    await this.enterScene(ctx, 'microservices');
  }

  @Action('carpool:open')
  async openCarpool(@Ctx() ctx: BotContext) {
    await this.enterScene(ctx, 'carpool');
  }

  private async showMainMenu(ctx: BotContext) {
    await ctx.reply('Society Bot', mainMenuKeyboard());
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
      await ctx.reply('Please start the bot again.');
      return false;
    }

    const resident = await this.prisma.resident.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!resident) {
      await ctx.scene.enter('onboarding');
      return false;
    }

    if (!resident.isActive) {
      await ctx.reply('Your account is disabled. Contact the society admin.');
      return false;
    }

    if (!resident.onboardingComplete) {
      await ctx.scene.enter('onboarding');
      return false;
    }

    return true;
  }
}
