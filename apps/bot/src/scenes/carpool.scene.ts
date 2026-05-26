import { UseGuards } from '@nestjs/common';
import { Action, Command, Ctx, On, Scene, SceneEnter } from 'nestjs-telegraf';
import { Markup } from 'telegraf';
import { GroupMemberGuard } from '../guards/group-member.guard';
import { mainMenuKeyboard } from '../keyboards/main-menu.keyboard';
import { SearchService } from '../modules/search/search.service';
import { PrismaService } from '../prisma/prisma.service';
import { BotContext } from '../types/bot-context';
import { getCallbackData } from '../utils/callback-data';

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

@Scene('carpool')
@UseGuards(GroupMemberGuard)
export class CarpoolScene {
  constructor(
    private readonly prisma: PrismaService,
    private readonly searchService: SearchService,
  ) {}

  @SceneEnter()
  async enter(@Ctx() ctx: BotContext) {
    ctx.session.carpool = {};
    await this.showHome(ctx);
  }

  @Action('carpool:create')
  async create(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    ctx.session.carpool = { mode: 'creating', step: 'destination', draft: { days: [] } };
    await ctx.reply('Where are you going? Example: Whitefield, Prestige Tech Park');
  }

  @Action('carpool:browse')
  async browse(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    ctx.session.carpool = { mode: 'browsing' };
    await ctx.reply(
      'Where are you going?',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('Whitefield', 'carpool:query:Whitefield'),
          Markup.button.callback('Koramangala', 'carpool:query:Koramangala'),
        ],
        [
          Markup.button.callback('MG Road', 'carpool:query:MG Road'),
          Markup.button.callback('Electronic City', 'carpool:query:Electronic City'),
        ],
      ]),
    );
  }

  @Action(/carpool:query:.+/)
  async queryPreset(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const query = getCallbackData(ctx)?.split(':').slice(2).join(':') ?? '';
    await this.showBrowseResults(ctx, query);
  }

  @Action('carpool:mine')
  async mine(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    await this.showMine(ctx);
  }

  @Action(/carpool:select:.+/)
  async select(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const id = getCallbackData(ctx)?.split(':').at(-1);
    if (!id) return;
    ctx.session.carpool = { selectedId: id };
    await this.showRouteDetail(ctx, id);
  }

  @Action(/carpool:edit:.+/)
  async edit(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const field = getCallbackData(ctx)?.split(':').at(-1);
    const selectedId = ctx.session.carpool?.selectedId;
    if (!selectedId || !this.isEditField(field)) {
      await this.showMine(ctx);
      return;
    }

    ctx.session.carpool = { mode: 'editing', selectedId, editField: field, step: field };
    if (field === 'days') {
      const route = await this.prisma.carpoolRoute.findUnique({ where: { id: selectedId } });
      ctx.session.carpool.draft = { days: route?.days ?? [] };
      await this.promptDays(ctx);
      return;
    }
    if (field === 'seatsAvailable') {
      await this.promptSeats(ctx);
      return;
    }
    await ctx.reply(`Enter updated ${this.fieldLabel(field)}.`);
  }

  @Action(/carpool:return:.+/)
  async setReturnChoice(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const choice = getCallbackData(ctx)?.split(':').at(-1);
    const state = ctx.session.carpool;
    if (!state) return;
    if (choice === 'yes') {
      ctx.session.carpool = { ...state, step: 'returnTime' };
      await ctx.reply('Enter return time. Example: 6:30 PM');
      return;
    }
    ctx.session.carpool = { ...state, step: 'seatsAvailable', draft: { ...state.draft, returnTime: null } };
    await this.promptSeats(ctx);
  }

  @Action(/carpool:seats:\d+/)
  async setSeats(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const seats = Number(getCallbackData(ctx)?.split(':').at(-1));
    const state = ctx.session.carpool;
    if (!state) return;

    if (state.mode === 'editing' && state.selectedId) {
      await this.prisma.carpoolRoute.update({ where: { id: state.selectedId }, data: { seatsAvailable: seats } });
      await ctx.reply('Route updated.');
      await this.showRouteDetail(ctx, state.selectedId);
      return;
    }

    ctx.session.carpool = { ...state, step: 'days', draft: { ...state.draft, seatsAvailable: seats, days: [] } };
    await this.promptDays(ctx);
  }

  @Action(/carpool:day:.+/)
  async toggleDay(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const day = getCallbackData(ctx)?.split(':').at(-1);
    const state = ctx.session.carpool;
    if (!day || !state) return;
    const selected = new Set(state.draft?.days ?? []);
    if (selected.has(day)) selected.delete(day);
    else selected.add(day);
    ctx.session.carpool = { ...state, draft: { ...state.draft, days: [...selected] } };
    await this.promptDays(ctx);
  }

  @Action('carpool:days_done')
  async daysDone(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const state = ctx.session.carpool;
    if (!state?.draft?.days?.length) {
      await ctx.reply('Select at least one day.');
      return;
    }
    if (state.mode === 'editing' && state.selectedId) {
      await this.prisma.carpoolRoute.update({ where: { id: state.selectedId }, data: { days: state.draft.days } });
      await ctx.reply('Route updated.');
      await this.showRouteDetail(ctx, state.selectedId);
      return;
    }
    await this.saveDraft(ctx);
  }

  @Action('carpool:toggle_pause')
  async togglePause(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const id = ctx.session.carpool?.selectedId;
    if (!id) return;
    const route = await this.prisma.carpoolRoute.findUnique({ where: { id } });
    if (!route) return;
    await this.prisma.carpoolRoute.update({ where: { id }, data: { isPaused: !route.isPaused } });
    await ctx.reply(route.isPaused ? 'Route resumed.' : 'Route paused.');
    await this.showRouteDetail(ctx, id);
  }

  @Action('carpool:delete')
  async confirmDelete(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    await ctx.reply(
      'Delete this route?',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('Delete', 'carpool:delete_confirm'),
          Markup.button.callback('Cancel', 'carpool:mine'),
        ],
      ]),
    );
  }

  @Action('carpool:delete_confirm')
  async delete(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const id = ctx.session.carpool?.selectedId;
    if (id) await this.prisma.carpoolRoute.delete({ where: { id } });
    await ctx.reply('Route deleted.');
    await this.showMine(ctx);
  }

  @Action(/carpool:contact:.+/)
  async contact(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const id = getCallbackData(ctx)?.split(':').at(-1);
    if (!id) return;
    const route = await this.prisma.carpoolRoute.findFirst({
      where: { id, isPaused: false, resident: { isActive: true } },
      include: { resident: true },
    });
    if (!route) return;
    const contact = route.resident.telegramUsername
      ? `@${route.resident.telegramUsername}`
      : route.resident.phone ?? `Telegram ID: ${route.resident.telegramId.toString()}`;
    await ctx.reply([`Driver flat: ${route.resident.flatNumber}`, `Contact: ${contact}`].join('\n'));
  }

  @Action('carpool:home')
  async home(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    await this.showHome(ctx);
  }

  @Action('menu:back')
  async backToMenu(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    await ctx.scene.leave();
    await ctx.reply('Society Bot', mainMenuKeyboard());
  }

  @Command(['ask', 'menu', 'exit'])
  async onAskCommand(@Ctx() ctx: BotContext) {
    const text = (ctx.message as { text?: string })?.text ?? '';
    
    if (text.startsWith('/menu') || text.startsWith('/exit')) {
      await ctx.scene.leave();
      await ctx.reply('Society Bot', mainMenuKeyboard());
      return;
    }
    
    const query = text.replace(/^\/ask\s*/i, '').trim();
    await ctx.scene.leave();
    await this.searchService.handleAsk(ctx, query);
  }

  @On('text')
  async onText(@Ctx() ctx: BotContext) {
    const state = ctx.session.carpool;
    const text = ctx.text?.trim();
    if (!state?.mode || !text) {
      await this.showHome(ctx);
      return;
    }

    if (state.mode === 'browsing') {
      await this.showBrowseResults(ctx, text);
      return;
    }

    if (state.mode === 'editing' && state.selectedId && state.editField) {
      const value = state.editField === 'seatsAvailable' ? Number(text) : text;
      await this.prisma.carpoolRoute.update({ where: { id: state.selectedId }, data: { [state.editField]: value } });
      await ctx.reply('Route updated.');
      await this.showRouteDetail(ctx, state.selectedId);
      return;
    }

    if (state.step === 'destination') {
      ctx.session.carpool = { ...state, step: 'startPoint', draft: { ...state.draft, destination: text } };
      await ctx.reply('Enter starting point, or type skip.');
      return;
    }
    if (state.step === 'startPoint') {
      ctx.session.carpool = { ...state, step: 'departureTime', draft: { ...state.draft, startPoint: text.toLowerCase() === 'skip' ? null : text } };
      await ctx.reply('Enter departure time. Example: 9:00 AM');
      return;
    }
    if (state.step === 'departureTime') {
      ctx.session.carpool = { ...state, step: 'returnTimeChoice', draft: { ...state.draft, departureTime: text } };
      await ctx.reply(
        'Do you have a return time?',
        Markup.inlineKeyboard([
          [
            Markup.button.callback('Yes', 'carpool:return:yes'),
            Markup.button.callback('No', 'carpool:return:no'),
          ],
        ]),
      );
      return;
    }
    if (state.step === 'returnTime') {
      ctx.session.carpool = { ...state, step: 'seatsAvailable', draft: { ...state.draft, returnTime: text } };
      await this.promptSeats(ctx);
    }
  }

  private async showHome(ctx: BotContext) {
    ctx.session.carpool = {};
    await ctx.reply(
      'Carpool',
      Markup.inlineKeyboard([
        [Markup.button.callback('Post Route', 'carpool:create')],
        [Markup.button.callback('Browse Carpool', 'carpool:browse')],
        [Markup.button.callback('Manage My Routes', 'carpool:mine')],
        [Markup.button.callback('Back', 'menu:back')],
      ]),
    );
  }

  async showBrowseResults(ctx: BotContext, query: string) {
    const routes = await this.prisma.carpoolRoute.findMany({
      where: {
        isPaused: false,
        destination: { contains: query, mode: 'insensitive' },
        resident: { isActive: true },
      },
      include: { resident: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    if (!routes.length) {
      await ctx.reply('No carpool routes found. Try another destination.', Markup.inlineKeyboard([[Markup.button.callback('Back', 'carpool:home')]]));
      return;
    }
    for (const route of routes) {
      await ctx.reply(this.formatRoute(route), Markup.inlineKeyboard([[Markup.button.callback('Contact Driver', `carpool:contact:${route.id}`)]]));
    }
    await ctx.reply('End of results.', Markup.inlineKeyboard([[Markup.button.callback('Back', 'carpool:home')]]));
  }

  private async showMine(ctx: BotContext) {
    const resident = await this.getResident(ctx);
    if (!resident) return;
    const routes = await this.prisma.carpoolRoute.findMany({ where: { residentId: resident.id }, orderBy: { createdAt: 'desc' } });
    const routeLines = routes.map((r, i) => `${i + 1}. ${r.destination} - ${r.departureTime} (${r.isPaused ? 'Paused' : 'Active'})`);
    const routeButtons = routes.map((r) => [Markup.button.callback(`${r.destination} - ${r.departureTime}`, `carpool:select:${r.id}`)]);
    const text = routes.length ? ['Your routes:', ...routeLines].join('\n') : 'You have not posted any carpool routes.';
    await ctx.reply(
      text,
      Markup.inlineKeyboard([
        ...routeButtons,
        [Markup.button.callback('Post Route', 'carpool:create')],
        [Markup.button.callback('Back', 'carpool:home')],
      ]),
    );
  }

  private async showRouteDetail(ctx: BotContext, id: string) {
    const route = await this.prisma.carpoolRoute.findUnique({ where: { id }, include: { resident: true } });
    if (!route) return this.showMine(ctx);
    await ctx.reply(
      this.formatRoute(route),
      Markup.inlineKeyboard([
        [
          Markup.button.callback('Edit Destination', 'carpool:edit:destination'),
          Markup.button.callback('Edit Time', 'carpool:edit:departureTime'),
        ],
        [
          Markup.button.callback('Edit Seats', 'carpool:edit:seatsAvailable'),
          Markup.button.callback('Edit Days', 'carpool:edit:days'),
        ],
        [Markup.button.callback(route.isPaused ? 'Resume' : 'Pause', 'carpool:toggle_pause')],
        [Markup.button.callback('Delete', 'carpool:delete')],
        [Markup.button.callback('Back', 'carpool:mine')],
      ]),
    );
  }

  private async saveDraft(ctx: BotContext) {
    const resident = await this.getResident(ctx);
    const draft = ctx.session.carpool?.draft;
    if (!resident || !draft?.destination || !draft.departureTime || !draft.seatsAvailable || !draft.days?.length) {
      await ctx.reply('Route details are incomplete. Please start again.');
      await this.showHome(ctx);
      return;
    }
    await this.prisma.carpoolRoute.create({
      data: {
        residentId: resident.id,
        destination: draft.destination,
        startPoint: draft.startPoint,
        departureTime: draft.departureTime,
        returnTime: draft.returnTime,
        seatsAvailable: draft.seatsAvailable,
        days: draft.days,
      },
    });
    await ctx.reply('Carpool route saved.');
    await this.showHome(ctx);
  }

  private promptSeats(ctx: BotContext) {
    return ctx.reply('Available seats?', Markup.inlineKeyboard([[1, 2, 3, 4].map((seat) => Markup.button.callback(String(seat), `carpool:seats:${seat}`))]));
  }

  private promptDays(ctx: BotContext) {
    const selected = new Set(ctx.session.carpool?.draft?.days ?? []);
    return ctx.reply(
      'Select days, then tap Done.',
      Markup.inlineKeyboard([
        ...days.map((day) => [Markup.button.callback(`${selected.has(day) ? '✓ ' : ''}${day}`, `carpool:day:${day}`)]),
        [Markup.button.callback('Done', 'carpool:days_done')],
      ]),
    );
  }

  private async getResident(ctx: BotContext) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return null;
    return this.prisma.resident.findUnique({ where: { telegramId: BigInt(telegramId) } });
  }

  private formatRoute(route: { destination: string; startPoint: string | null; departureTime: string; returnTime: string | null; seatsAvailable: number; days: string[]; resident: { flatNumber: string } }) {
    return [
      `${route.resident.flatNumber} -> ${route.destination}`,
      route.startPoint ? `From: ${route.startPoint}` : undefined,
      `Departs: ${route.departureTime}${route.returnTime ? ` | Returns: ${route.returnTime}` : ''}`,
      `Seats: ${route.seatsAvailable} | ${route.days.join(', ')}`,
    ].filter(Boolean).join('\n');
  }

  private isEditField(field: string | undefined): field is 'destination' | 'startPoint' | 'departureTime' | 'returnTime' | 'seatsAvailable' | 'days' {
    return ['destination', 'startPoint', 'departureTime', 'returnTime', 'seatsAvailable', 'days'].includes(field ?? '');
  }

  private fieldLabel(field: string) {
    if (field === 'departureTime') return 'departure time';
    if (field === 'returnTime') return 'return time';
    if (field === 'seatsAvailable') return 'available seats';
    return field;
  }
}
