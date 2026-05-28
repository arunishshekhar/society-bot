import { CanActivate, ExecutionContext, Injectable, Logger } from "@nestjs/common";
import { Markup } from "telegraf";
import { TelegrafExecutionContext } from "nestjs-telegraf";
import { BotContext } from "../types/bot-context";

@Injectable()
export class GroupMemberGuard implements CanActivate {
  private readonly logger = new Logger(GroupMemberGuard.name);

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

      this.logger.debug(
        `[GroupMemberGuard] userId=${userId} status=${member.status}`,
      );

      // "restricted" members in supergroups are still valid members when
      // is_member is true. Always include it alongside the standard statuses.
      const allowedStatuses = ["member", "administrator", "creator", "restricted"];
      const allowed =
        allowedStatuses.includes(member.status) &&
        (member.status !== "restricted" || (member as any).is_member !== false);

      if (!allowed) {
        this.logger.warn(
          `[GroupMemberGuard] Blocking userId=${userId} — status="${member.status}"`,
        );
        await this.replyNotMember(ctx, groupId);
      }

      return allowed;
    } catch (error) {
      // Differentiate between two failure modes:
      //
      // 1. Bot lacks admin rights to call getChatMember (Telegram 403/Forbidden).
      //    Fail-open — the DB resident check in ensureActiveOnboardedResident
      //    already provides access control. Don't block legitimate users.
      //    Fix: make the bot an admin in the group to enable real membership checks.
      //
      // 2. User genuinely not found in the group ("Bad Request: user not found").
      //    Fail-closed.
      const errMsg: string =
        (error as any)?.response?.description ??
        (error as any)?.message ??
        String(error);

      const isBotPermissionError =
        errMsg.toLowerCase().includes("forbidden") ||
        errMsg.toLowerCase().includes("not enough rights") ||
        errMsg.toLowerCase().includes("bot is not a member") ||
        errMsg.toLowerCase().includes("chat not found");

      if (isBotPermissionError) {
        this.logger.warn(
          `[GroupMemberGuard] getChatMember failed — bot likely not an admin ` +
          `in the group. Failing open for userId=${userId}. Error: ${errMsg}`,
        );
        return true;
      }

      // User was not found in the group — block them.
      this.logger.warn(
        `[GroupMemberGuard] Blocking userId=${userId} — not in group. Error: ${errMsg}`,
      );
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
