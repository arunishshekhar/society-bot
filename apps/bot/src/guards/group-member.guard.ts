import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { TelegrafExecutionContext } from 'nestjs-telegraf';
import { BotContext } from '../types/bot-context';

@Injectable()
export class GroupMemberGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const telegrafContext = TelegrafExecutionContext.create(context);
    const ctx = telegrafContext.getContext<BotContext>();
    const userId = ctx.from?.id;
    const groupId = process.env.TELEGRAM_GROUP_ID;

    if (!userId || !groupId) {
      await ctx.reply('You need to be a member of the society group to use this bot.');
      return false;
    }

    try {
      const member = await ctx.telegram.getChatMember(groupId, userId);
      const allowedStatuses = ['member', 'administrator', 'creator'];
      const allowed = allowedStatuses.includes(member.status);

      if (!allowed) {
        await ctx.reply('You need to be a member of the society group to use this bot.');
      }

      return allowed;
    } catch {
      await ctx.reply('You need to be a member of the society group to use this bot.');
      return false;
    }
  }
}
