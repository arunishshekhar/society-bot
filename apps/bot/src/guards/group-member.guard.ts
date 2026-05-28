import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Markup } from "telegraf";
import { TelegrafExecutionContext } from "nestjs-telegraf";
import { BotContext } from "../types/bot-context";

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
      // Parse numeric group IDs (e.g. "-1003996463895") so getChatMember
      // receives a number, which is required for supergroups.
      const chatId = /^-?\d+$/.test(groupId) ? Number(groupId) : groupId;
      const member = await ctx.telegram.getChatMember(chatId, userId);

      // "restricted" members in supergroups are still valid members when
      // is_member is true. Always include it alongside the standard statuses.
      const allowedStatuses = ["member", "administrator", "creator", "restricted"];
      const allowed =
        allowedStatuses.includes(member.status) &&
        (member.status !== "restricted" || (member as any).is_member !== false);

      if (!allowed) {
        await this.replyNotMember(ctx, groupId);
      }

      return allowed;
    } catch (error) {
      // getChatMember fails with "Bad Request: user not found" if the user has never 
      // interacted with the group and is not a member.
      // We must block them instead of falling back to true.
      await this.replyNotMember(ctx, groupId);
      return false;
    }
  }

  private async replyNotMember(ctx: BotContext, groupId: string) {
    // If groupId looks like a username (@groupname), build a join link
    const isUsername = groupId.startsWith("@");
    const groupLink = isUsername
      ? `https://t.me/${groupId.slice(1)}`
      : process.env.TELEGRAM_GROUP_INVITE_LINK;

    const message =
      "🔒 This bot is only available to members of the society group.";

    if (groupLink) {
      await ctx.reply(
        message,
        Markup.inlineKeyboard([
          [Markup.button.url("Join the group →", groupLink)],
        ]),
      );
    } else {
      await ctx.reply(message + "\n\nPlease ask an admin for an invite link.");
    }
  }
}
