import { UseGuards } from '@nestjs/common';
import { Action, Ctx, Scene, SceneEnter } from 'nestjs-telegraf';
import { Markup } from 'telegraf';
import { GroupMemberGuard } from '../guards/group-member.guard';
import { mainMenuKeyboard } from '../keyboards/main-menu.keyboard';
import { PrismaService } from '../prisma/prisma.service';
import { BotContext } from '../types/bot-context';

@Scene('settings')
@UseGuards(GroupMemberGuard)
export class SettingsScene {
  constructor(private readonly prisma: PrismaService) {}

  @SceneEnter()
  async enter(@Ctx() ctx: BotContext) {
    await this.showSettings(ctx);
  }

  @Action('settings:delete_account')
  async confirmDelete(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    await ctx.reply(
      'Delete your account? This will disable your profile and hide your listings.',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('Delete My Account', 'settings:delete_confirm'),
          Markup.button.callback('Cancel', 'settings:open'),
        ],
      ]),
    );
  }

  @Action('settings:delete_confirm')
  async deleteAccount(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const telegramId = ctx.from?.id;

    if (telegramId) {
      await this.prisma.resident.update({
        where: { telegramId: BigInt(telegramId) },
        data: { isActive: false },
      });
    }

    await ctx.reply('Your account has been disabled.');
    await ctx.scene.leave();
  }

  @Action('settings:open')
  async reopen(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    await this.showSettings(ctx);
  }

  @Action('menu:back')
  async backToMenu(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    await ctx.scene.leave();
    await ctx.reply('Society Bot', mainMenuKeyboard());
  }

  private async showSettings(ctx: BotContext) {
    await ctx.reply(
      'Settings',
      Markup.inlineKeyboard([
        [Markup.button.callback('Delete My Account', 'settings:delete_account')],
        [Markup.button.callback('Back', 'menu:back')],
      ]),
    );
  }
}
