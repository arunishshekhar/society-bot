import { Action, Ctx, Message, On, Scene, SceneEnter } from 'nestjs-telegraf';
import { BotContext } from '../../types/bot-context';
import { PrismaService } from '../../prisma/prisma.service';
import { LostFoundService } from '../../modules/lost-found/lost-found.service';
import { LostFoundAiService } from '../../modules/lost-found/lost-found.ai';
import { LostFoundSearchService } from '../../modules/lost-found/lost-found.search';

@Scene('lost_report')
export class LostReportScene {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lostFoundService: LostFoundService,
    private readonly aiService: LostFoundAiService,
    private readonly searchService: LostFoundSearchService,
  ) {}

  @SceneEnter()
  async onEnter(@Ctx() ctx: BotContext) {
    ctx.session.lostItem = {};
    ctx.session.lostItemStep = 'description';
    await ctx.reply(
      '🔍 *Report Lost Item*\n\nDescribe what you lost in detail.\nInclude: color, type, brand, size, any distinctive features.\n\ne.g. "Black leather wallet with silver clip, contains Axis bank card"',
      { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'lf_cancel' }]] } }
    );
  }

  @On('text')
  async onText(@Ctx() ctx: BotContext, @Message('text') text: string) {
    if (!ctx.session.lostItem || ctx.session.lostItemStep !== 'description') return;

    ctx.session.lostItem.originalDescription = text;
    
    const waitMsg = await ctx.reply('⏳ Saving report and searching for matches...');

    try {
      // AI enrichment
      const aiDescription = await this.aiService.enrichLostDescription(text);
      ctx.session.lostItem.aiDescription = aiDescription;

      // Save report
      const resident = await this.prisma.resident.findUnique({
        where: { telegramId: BigInt(ctx.from!.id) },
      });

      if (!resident) {
        throw new Error('Resident not found');
      }

      const lostItem = await this.lostFoundService.saveLostItem(ctx.session.lostItem, resident.id);

      await ctx.telegram.deleteMessage(ctx.chat!.id, waitMsg.message_id);

      // Instant search
      const matches = await this.searchService.findMatchingFoundItems(aiDescription);

      if (matches.length > 0) {
        await ctx.reply('🔍 *We found some possible matches!*\n\nHere are found items that might be yours:', { parse_mode: 'Markdown' });

        for (const item of matches) {
          await ctx.telegram.sendPhoto(
            ctx.from!.id.toString(),
            item.imageFileId,
            {
              caption:
                `📦 *${item.originalDescription}*\n` +
                `📍 Collect from: ${item.collectionLocation}\n` +
                `🏠 Reported by: Flat ${item.flatNumber}`,
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [[
                  { text: '✅ This is mine', callback_data: `lf_claim_${item.id}_${lostItem.id}` },
                ]],
              },
            }
          );
        }

        await ctx.reply(
          '⚠️ Your lost report is also saved.\nYou\'ll be notified if more matching items are found.',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '📋 View My Reports', callback_data: 'lf_manage' }],
                [{ text: '🏠 Back to Menu', callback_data: 'menu' }],
              ],
            },
          }
        );
      } else {
        await ctx.reply(
          '😕 No matching found items right now.\n\n' +
          'Your report has been saved.\n' +
          'You\'ll be automatically notified if someone finds a matching item.',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '📋 View My Reports', callback_data: 'lf_manage' }],
                [{ text: '🏠 Back to Menu', callback_data: 'menu' }],
              ],
            },
          }
        );
      }

      ctx.session.lostItemStep = undefined;
      ctx.session.lostItem = undefined;
      await ctx.scene.leave();
    } catch (err) {
      await ctx.reply('Error saving report. Please try again.');
      await ctx.scene.leave();
    }
  }

  @Action('lf_cancel')
  async onCancel(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    ctx.session.lostItemStep = undefined;
    ctx.session.lostItem = undefined;
    await ctx.reply('❌ Report cancelled.');
    await ctx.scene.leave();
  }
}
