import { UseGuards } from '@nestjs/common';
import { Action, Command, Ctx, Start, Update } from 'nestjs-telegraf';
import { GroupMemberGuard } from './guards/group-member.guard';
import { mainMenuKeyboard } from './keyboards/main-menu.keyboard';
import { PrismaService } from './prisma/prisma.service';
import { BotContext } from './types/bot-context';

@Update()
@UseGuards(GroupMemberGuard)
export class AppUpdate {
  constructor(private readonly prisma: PrismaService) {}

  @Start()
  async start(@Ctx() ctx: BotContext) {
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
    if (!(await this.ensureActiveOnboardedResident(ctx))) return;
    await this.showMainMenu(ctx);
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
