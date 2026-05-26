import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Markup } from 'telegraf';
import { TelegrafExecutionContext } from 'nestjs-telegraf';
import { BotContext } from '../types/bot-context';

@Injectable()
export class GroupMemberGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const telegrafContext = TelegrafExecutionContext.create(context);
    const ctx = telegrafContext.getContext<BotContext>();
    const userId = ctx.from?.id;
    const groupId = process.env.TELEGRAM_GROUP_ID;

    // If group ID is not configured, skip the check — allow everyone
    if (!groupId) {
      return true;
    }

    if (!userId) {
      return false;
    }

    try {
      const member = await ctx.telegram.getChatMember(groupId, userId);
      const allowedStatuses = ['member', 'administrator', 'creator'];
      const allowed = allowedStatuses.includes(member.status);

      if (!allowed) {
        await this.replyNotMember(ctx, groupId);
      }

      return allowed;
    } catch {
      // getChatMember can fail if the bot isn't an admin in the group,
      // or if the group ID is misconfigured. Fall back to allowing users
      // rather than silently blocking everyone.
      return true;
    }
  }

  private async replyNotMember(ctx: BotContext, groupId: string) {
    // If groupId looks like a username (@groupname), build a join link
    const isUsername = groupId.startsWith('@');
    const groupLink = isUsername
      ? `https://t.me/${groupId.slice(1)}`
      : process.env.TELEGRAM_GROUP_INVITE_LINK;

    const message = '🔒 This bot is only available to members of the society group.';

    if (groupLink) {
      await ctx.reply(
        message,
        Markup.inlineKeyboard([
          [Markup.button.url('Join the group →', groupLink)],
        ]),
      );
    } else {
      await ctx.reply(message + '\n\nPlease ask an admin for an invite link.');
    }
  }
}
