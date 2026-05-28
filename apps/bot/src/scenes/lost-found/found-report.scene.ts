import { Action, Ctx, Message, On, Scene, SceneEnter } from 'nestjs-telegraf';
import { BotContext } from '../../types/bot-context';
import { PrismaService } from '../../prisma/prisma.service';
import { LostFoundService } from '../../modules/lost-found/lost-found.service';
import { LostFoundAiService } from '../../modules/lost-found/lost-found.ai';

@Scene('found_report')
export class FoundReportScene {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lostFoundService: LostFoundService,
    private readonly aiService: LostFoundAiService,
  ) {}

  @SceneEnter()
  async onEnter(@Ctx() ctx: BotContext) {
    ctx.session.foundItem = { fileId: '' };
    ctx.session.foundItemStep = 'photo';
    await ctx.reply(
      '📦 *Report Found Item*\n\nPlease upload a photo of the item.\n(Photo helps the owner identify it)',
      { parse_mode: 'MarkdownV2', reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'lf_cancel' }]] } }
    );
  }

  @On('photo')
  async onPhoto(@Ctx() ctx: BotContext) {
    if (ctx.session.foundItemStep !== 'photo') return;

    const photo = (ctx.message as any).photo?.at(-1);
    if (!photo) return;

    ctx.session.foundItem!.fileId = photo.file_id;
    ctx.session.foundItemStep = 'description';
    
    await ctx.reply(
      '✅ Photo received!\n\nNow describe the item briefly.\ne.g. "Blue umbrella with wooden handle"',
      { reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'lf_cancel' }]] } }
    );
  }

  @On('text')
  async onText(@Ctx() ctx: BotContext, @Message('text') text: string) {
    if (!ctx.session.foundItem) return;

    if (ctx.session.foundItemStep === 'description') {
      ctx.session.foundItem.originalDescription = text;
      ctx.session.foundItemStep = 'location';
      await ctx.reply(
        'Where can it be collected from?\ne.g. "Flat A-101" or "Society reception"',
        { reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'lf_cancel' }]] } }
      );
      return;
    }

    if (ctx.session.foundItemStep === 'location') {
      ctx.session.foundItem.collectionLocation = text;
      
      const waitMsg = await ctx.reply('⏳ Processing image and saving report...');
      
      try {
        // AI processing
        const aiDescription = await this.aiService.generateFoundDescription(
          ctx.session.foundItem.fileId,
          ctx.session.foundItem.originalDescription!,
          ctx
        );
        ctx.session.foundItem.aiDescription = aiDescription;

        // DB save
        const resident = await this.prisma.resident.findUnique({
          where: { telegramId: ctx.from!.id },
        });

        if (resident) {
          await this.lostFoundService.saveFoundItem(ctx.session.foundItem, resident.id);
        }

        await ctx.telegram.deleteMessage(ctx.chat!.id, waitMsg.message_id);

        await ctx.reply(
          '✅ Found item reported successfully!\n\n' +
          'Your item has been listed.\n' +
          'If anyone reports a matching lost item,\nyou\'ll be notified.\n\n' +
          `📍 Collection point: ${ctx.session.foundItem.collectionLocation}`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '📋 View My Reports', callback_data: 'lf_manage' }],
                [{ text: '🏠 Back to Menu', callback_data: 'menu' }],
              ],
            },
          }
        );
        
        ctx.session.foundItemStep = undefined;
        ctx.session.foundItem = undefined;
        await ctx.scene.leave();
      } catch (err) {
        await ctx.reply('Error saving report. Please try again.');
        await ctx.scene.leave();
      }
    }
  }

  @Action('lf_cancel')
  async onCancel(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    ctx.session.foundItemStep = undefined;
    ctx.session.foundItem = undefined;
    await ctx.reply('❌ Report cancelled.');
    await ctx.scene.leave();
  }
}
