import { Action, Ctx, Scene, SceneEnter } from 'nestjs-telegraf';
import { BotContext } from '../../types/bot-context';
import { PrismaService } from '../../prisma/prisma.service';

@Scene('lost_found_manage')
export class LostFoundManageScene {
  constructor(private readonly prisma: PrismaService) {}

  @SceneEnter()
  async onEnter(@Ctx() ctx: BotContext) {
    const resident = await this.prisma.resident.findUnique({
      where: { telegramId: ctx.from!.id },
      include: {
        foundReports: { orderBy: { createdAt: 'desc' } },
        lostReports: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!resident) {
      await ctx.reply('Resident not found.');
      return ctx.scene.leave();
    }

    const openFound = resident.foundReports.filter(f => f.status === 'OPEN');
    const openLost = resident.lostReports.filter(l => l.status === 'OPEN');
    const resolvedCount = resident.foundReports.filter(f => f.status === 'RESOLVED').length +
                          resident.lostReports.filter(l => l.status === 'RESOLVED').length;

    let message = '📋 *My Lost & Found Reports*\n\n';

    if (openFound.length > 0) {
      message += '📦 *FOUND (Active)*\n';
      openFound.forEach((f, i) => {
        message += `${i + 1}. ${f.originalDescription} — ${f.collectionLocation}\n`;
      });
      message += '\n';
    }

    if (openLost.length > 0) {
      message += '🔍 *LOST (Active)*\n';
      openLost.forEach((l, i) => {
        message += `${i + 1}. ${l.originalDescription}\n`;
      });
      message += '\n';
    }

    message += `📁 *Resolved:* ${resolvedCount}`;

    const keyboard = [];

    // Add resolve buttons for open items
    for (const f of openFound) {
      keyboard.push([{ text: `📦 Resolve: ${f.originalDescription.substring(0, 20)}...`, callback_data: `lf_mark_resolved_found_${f.id}` }]);
    }
    for (const l of openLost) {
      keyboard.push([{ text: `🔍 Resolve: ${l.originalDescription.substring(0, 20)}...`, callback_data: `lf_mark_resolved_lost_${l.id}` }]);
    }

    keyboard.push([{ text: '🏠 Back to Menu', callback_data: 'menu' }]);

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  @Action(/lf_mark_resolved_found_(.+)/)
  async onResolveFound(@Ctx() ctx: BotContext & { match: RegExpMatchArray }) {
    const id = ctx.match![1];
    await this.prisma.foundItem.update({
      where: { id },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });
    await ctx.answerCbQuery('Marked as resolved!');
    return this.onEnter(ctx);
  }

  @Action(/lf_mark_resolved_lost_(.+)/)
  async onResolveLost(@Ctx() ctx: BotContext & { match: RegExpMatchArray }) {
    const id = ctx.match![1];
    await this.prisma.lostItem.update({
      where: { id },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });
    await ctx.answerCbQuery('Marked as resolved!');
    return this.onEnter(ctx);
  }
}
