import { UseGuards } from '@nestjs/common';
import { Action, Command, Ctx, On, Scene, SceneEnter } from 'nestjs-telegraf';
import { Markup } from 'telegraf';
import { GroupMemberGuard } from '../guards/group-member.guard';
import { mainMenuKeyboard } from '../keyboards/main-menu.keyboard';
import { deriveWorkerTags } from '../modules/workers/worker-tags';
import { SearchService } from '../modules/search/search.service';
import { PrismaService } from '../prisma/prisma.service';
import { BotContext } from '../types/bot-context';
import { getCallbackData } from '../utils/callback-data';
import { isValidPhone } from '../utils/validation';

const categories = [
  'plumber',
  'electrician',
  'maid',
  'carpenter',
  'ac repair',
  'painter',
  'driver',
  'cook',
  'other',
];

@Scene('workers')
@UseGuards(GroupMemberGuard)
export class WorkerScene {
  constructor(
    private readonly prisma: PrismaService,
    private readonly searchService: SearchService,
  ) {}

  @SceneEnter()
  async enter(@Ctx() ctx: BotContext) {
    ctx.session.workers = {};
    await this.showHome(ctx);
  }

  @Action('workers:add')
  async add(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    ctx.session.workers = { mode: 'adding', step: 'name', draft: {} };
    await ctx.reply("Enter the worker's name.");
  }

  @Action('workers:browse')
  async browse(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    await this.showCategoryFilter(ctx);
  }

  @Action(/workers:category:.+/)
  async browseCategory(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const category = getCallbackData(ctx)?.split(':').slice(2).join(':') ?? 'all';
    ctx.session.workers = {
      browseCategory: category,
      page: 0,
    };
    await this.showBrowseResults(ctx);
  }

  @Action(/workers:page:.+/)
  async changePage(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const page = Number(getCallbackData(ctx)?.split(':').at(-1) ?? 0);
    ctx.session.workers = { ...ctx.session.workers, page };
    await this.showBrowseResults(ctx);
  }

  @Action('workers:mine')
  async mine(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    await this.showMyRecommendations(ctx);
  }

  @Action(/workers:select:.+/)
  async select(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const id = getCallbackData(ctx)?.split(':').at(-1);
    if (!id) return;
    ctx.session.workers = { selectedId: id };
    await this.showRecommendationDetail(ctx, id, true);
  }

  @Action(/workers:contact:.+/)
  async contact(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const id = getCallbackData(ctx)?.split(':').at(-1);
    if (!id) return;

    const worker = await this.prisma.workerRecommendation.findUnique({
      where: { id },
      include: { resident: true },
    });
    if (!worker || worker.isBanned || !worker.isActive) return;

    await ctx.reply(
      [`${worker.name}`, `Phone: ${worker.phone}`, `Added by: ${worker.resident?.flatNumber ?? 'Admin'}`].join('\n'),
    );
  }

  @Action(/workers:report:.+/)
  async report(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    await ctx.reply('Report noted. Admin review will be added in the dashboard phase.');
  }

  @Action(/workers:edit:.+/)
  async edit(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const field = getCallbackData(ctx)?.split(':').at(-1);
    const selectedId = ctx.session.workers?.selectedId;

    if (!selectedId || !this.isEditField(field)) {
      await this.showMyRecommendations(ctx);
      return;
    }

    ctx.session.workers = {
      mode: 'editing',
      step: field === 'category' || field === 'rating' ? field : 'field',
      selectedId,
      editField: field,
    };

    if (field === 'category') {
      await this.promptCategories(ctx, 'workers:set_category');
      return;
    }

    if (field === 'rating') {
      await this.promptRating(ctx, 'workers:set_rating');
      return;
    }

    await ctx.reply(`Enter updated ${field}.`);
  }

  @Action(/workers:set_category:.+/)
  async setCategory(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const category = getCallbackData(ctx)?.split(':').slice(2).join(':');
    const state = ctx.session.workers;
    if (!category || !state?.mode) return;

    if (state.mode === 'editing' && state.selectedId) {
      const worker = await this.prisma.workerRecommendation.findUnique({
        where: { id: state.selectedId },
      });
      await this.prisma.workerRecommendation.update({
        where: { id: state.selectedId },
        data: {
          category,
          tags: deriveWorkerTags(category, worker?.notes),
        },
      });
      await ctx.reply('Recommendation updated.');
      await this.showRecommendationDetail(ctx, state.selectedId, true);
      return;
    }

    ctx.session.workers = {
      ...state,
      step: 'rating',
      draft: { ...state.draft, category },
    };
    await this.promptRating(ctx, 'workers:set_rating');
  }

  @Action(/workers:set_rating:.+/)
  async setRating(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const value = getCallbackData(ctx)?.split(':').at(-1);
    const rating = value === 'skip' ? null : Number(value);
    const state = ctx.session.workers;
    if (!state?.mode) return;

    if (state.mode === 'editing' && state.selectedId) {
      await this.prisma.workerRecommendation.update({
        where: { id: state.selectedId },
        data: { rating },
      });
      await ctx.reply('Recommendation updated.');
      await this.showRecommendationDetail(ctx, state.selectedId, true);
      return;
    }

    ctx.session.workers = {
      ...state,
      step: 'notes',
      draft: { ...state.draft, rating },
    };
    await ctx.reply(
      'Add notes, or skip.',
      Markup.inlineKeyboard([[Markup.button.callback('Skip', 'workers:skip_notes')]]),
    );
  }

  @Action('workers:skip_notes')
  async skipNotes(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    await this.saveDraft(ctx, null);
  }

  @Action(/workers:delete:.+/)
  async confirmDelete(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const id = getCallbackData(ctx)?.split(':').at(-1);
    if (!id) return;

    await ctx.reply(
      'Delete this recommendation?',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('Delete', `workers:delete_confirm:${id}`),
          Markup.button.callback('Cancel', `workers:select:${id}`),
        ],
      ]),
    );
  }

  @Action(/workers:delete_confirm:.+/)
  async delete(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const id = getCallbackData(ctx)?.split(':').at(-1);
    if (!id) return;

    await this.prisma.workerRecommendation.delete({ where: { id } });
    ctx.session.workers = {};
    await ctx.reply('Recommendation deleted.');
    await this.showMyRecommendations(ctx);
  }

  @Action('workers:home')
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
    const state = ctx.session.workers;
    const text = ctx.text?.trim();
    if (!state?.mode || !state.step || !text) {
      await this.showHome(ctx);
      return;
    }

    if (state.mode === 'editing' && state.selectedId && state.editField) {
      if (state.editField === 'phone' && !isValidPhone(text)) {
        await ctx.reply('Please enter a valid phone number.');
        return;
      }

      const data =
        state.editField === 'notes'
          ? { notes: text, tags: deriveWorkerTags((await this.getWorkerCategory(state.selectedId)) ?? '', text) }
          : { [state.editField]: text };

      await this.prisma.workerRecommendation.update({
        where: { id: state.selectedId },
        data,
      });
      await ctx.reply('Recommendation updated.');
      await this.showRecommendationDetail(ctx, state.selectedId, true);
      return;
    }

    if (state.step === 'name') {
      ctx.session.workers = { ...state, step: 'phone', draft: { ...state.draft, name: text } };
      await ctx.reply("Enter the worker's phone number.");
      return;
    }

    if (state.step === 'phone') {
      if (!isValidPhone(text)) {
        await ctx.reply('Please enter a valid phone number.');
        return;
      }
      ctx.session.workers = { ...state, step: 'category', draft: { ...state.draft, phone: text } };
      await this.promptCategories(ctx, 'workers:set_category');
      return;
    }

    if (state.step === 'notes') {
      await this.saveDraft(ctx, text);
    }
  }

  private async showHome(ctx: BotContext) {
    ctx.session.workers = {};
    await ctx.reply(
      'Worker Directory',
      Markup.inlineKeyboard([
        [Markup.button.callback('Add Worker', 'workers:add')],
        [Markup.button.callback('Browse Workers', 'workers:browse')],
        [Markup.button.callback('My Recommendations', 'workers:mine')],
        [Markup.button.callback('Back', 'menu:back')],
      ]),
    );
  }

  private async showCategoryFilter(ctx: BotContext) {
    await ctx.reply(
      'Choose a category.',
      Markup.inlineKeyboard([
        [Markup.button.callback('All', 'workers:category:all')],
        ...categories.map((category) => [
          Markup.button.callback(this.title(category), `workers:category:${category}`),
        ]),
        [Markup.button.callback('Back', 'workers:home')],
      ]),
    );
  }

  private async showBrowseResults(ctx: BotContext) {
    const category = ctx.session.workers?.browseCategory ?? 'all';
    const page = ctx.session.workers?.page ?? 0;
    const take = 5;
    const where = {
      isActive: true,
      isBanned: false,
      ...(category === 'all' ? {} : { category }),
    };

    const [workers, total] = await Promise.all([
      this.prisma.workerRecommendation.findMany({
        where,
        include: { resident: true },
        orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }],
        skip: page * take,
        take,
      }),
      this.prisma.workerRecommendation.count({ where }),
    ]);

    if (!workers.length) {
      await ctx.reply('No workers found for that category.', this.backToWorkersKeyboard());
      return;
    }

    for (const worker of workers) {
      await this.showWorkerCard(ctx, worker);
    }

    const buttons = [];
    if (page > 0) buttons.push(Markup.button.callback('Previous', `workers:page:${page - 1}`));
    if ((page + 1) * take < total) buttons.push(Markup.button.callback('Next', `workers:page:${page + 1}`));

    await ctx.reply(
      `Showing ${page * take + 1}-${page * take + workers.length} of ${total}.`,
      Markup.inlineKeyboard([
        ...(buttons.length ? [buttons] : []),
        [Markup.button.callback('Categories', 'workers:browse'), Markup.button.callback('Back', 'workers:home')],
      ]),
    );
  }

  private async showWorkerCard(ctx: BotContext, worker: { id: string; name: string; phone: string; category: string; rating: number | null; notes: string | null; resident: { flatNumber: string } | null }) {
    await ctx.reply(
      [
        `${worker.name} - ${this.title(worker.category)}`,
        `Rating: ${worker.rating ?? 'Not rated'} | Added by: ${worker.resident?.flatNumber ?? 'Admin'}`,
        worker.notes ? `Notes: ${worker.notes}` : undefined,
      ]
        .filter(Boolean)
        .join('\n'),
      Markup.inlineKeyboard([
        [
          Markup.button.callback('Contact', `workers:contact:${worker.id}`),
          Markup.button.callback('Report', `workers:report:${worker.id}`),
        ],
      ]),
    );
  }

  private async showMyRecommendations(ctx: BotContext) {
    const resident = await this.getResident(ctx);
    if (!resident) {
      await ctx.scene.enter('onboarding');
      return;
    }

    const workers = await this.prisma.workerRecommendation.findMany({
      where: { residentId: resident.id },
      orderBy: { createdAt: 'desc' },
    });

    const workerLines = workers.map((w, i) => `${i + 1}. ${w.name} - ${this.title(w.category)}`);
    const workerButtons = workers.map((w) => [Markup.button.callback(w.name, `workers:select:${w.id}`)]);
    const text = workers.length
      ? ['My Recommendations', '', ...workerLines].join('\n')
      : 'You have not added any worker recommendations yet.';
    await ctx.reply(
      text,
      Markup.inlineKeyboard([
        ...workerButtons,
        [Markup.button.callback('Add Worker', 'workers:add')],
        [Markup.button.callback('Back', 'workers:home')],
      ]),
    );
  }

  private async showRecommendationDetail(ctx: BotContext, id: string, editable: boolean) {
    const worker = await this.prisma.workerRecommendation.findUnique({ where: { id } });
    if (!worker) {
      await this.showMyRecommendations(ctx);
      return;
    }

    const keyboard = editable
      ? Markup.inlineKeyboard([
          [
            Markup.button.callback('Edit Name', 'workers:edit:name'),
            Markup.button.callback('Edit Phone', 'workers:edit:phone'),
          ],
          [
            Markup.button.callback('Edit Category', 'workers:edit:category'),
            Markup.button.callback('Edit Rating', 'workers:edit:rating'),
          ],
          [Markup.button.callback('Edit Notes', 'workers:edit:notes')],
          [Markup.button.callback('Delete', `workers:delete:${worker.id}`)],
          [Markup.button.callback('Back', 'workers:mine')],
        ])
      : this.backToWorkersKeyboard();

    await ctx.reply(
      [
        `${worker.name} - ${this.title(worker.category)}`,
        `Phone: ${worker.phone}`,
        `Rating: ${worker.rating ?? 'Not rated'}`,
        `Notes: ${worker.notes ?? 'None'}`,
      ].join('\n'),
      keyboard,
    );
  }

  private async saveDraft(ctx: BotContext, notes: string | null) {
    const resident = await this.getResident(ctx);
    const draft = ctx.session.workers?.draft;

    if (!resident || !draft?.name || !draft.phone || !draft.category) {
      await ctx.reply('Worker details are incomplete. Please start again.');
      await this.showHome(ctx);
      return;
    }

    await this.prisma.workerRecommendation.create({
      data: {
        residentId: resident.id,
        name: draft.name,
        phone: draft.phone,
        category: draft.category,
        rating: draft.rating,
        notes,
        tags: deriveWorkerTags(draft.category, notes),
      },
    });

    ctx.session.workers = {};
    await ctx.reply('Worker recommendation saved.');
    await this.showHome(ctx);
  }

  private async getResident(ctx: BotContext) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return null;
    return this.prisma.resident.findUnique({ where: { telegramId: BigInt(telegramId) } });
  }

  private async getWorkerCategory(id: string) {
    const worker = await this.prisma.workerRecommendation.findUnique({ where: { id } });
    return worker?.category;
  }

  private promptCategories(ctx: BotContext, prefix: string) {
    return ctx.reply(
      'Choose a category.',
      Markup.inlineKeyboard(categories.map((category) => [Markup.button.callback(this.title(category), `${prefix}:${category}`)])),
    );
  }

  private promptRating(ctx: BotContext, prefix: string) {
    return ctx.reply(
      'Choose a rating.',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('1', `${prefix}:1`),
          Markup.button.callback('2', `${prefix}:2`),
          Markup.button.callback('3', `${prefix}:3`),
        ],
        [
          Markup.button.callback('4', `${prefix}:4`),
          Markup.button.callback('5', `${prefix}:5`),
          Markup.button.callback('Skip', `${prefix}:skip`),
        ],
      ]),
    );
  }

  private backToWorkersKeyboard() {
    return Markup.inlineKeyboard([[Markup.button.callback('Back', 'workers:home')]]);
  }

  private isEditField(field: string | undefined): field is 'name' | 'phone' | 'category' | 'rating' | 'notes' {
    return ['name', 'phone', 'category', 'rating', 'notes'].includes(field ?? '');
  }

  private title(value: string) {
    return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}
