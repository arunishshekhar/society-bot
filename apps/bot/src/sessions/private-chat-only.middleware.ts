import { Logger } from "@nestjs/common";
import { BotContext } from "../types/bot-context";

const logger = new Logger("PrivateChatOnly");

/**
 * Global middleware that silently drops any update that did not originate
 * from a private chat (i.e. group/supergroup/channel messages).
 *
 * This ensures users can only interact with the bot via DMs, not by
 * typing commands in the group itself.
 */
export function createPrivateChatOnlyMiddleware() {
  return async (ctx: BotContext, next: () => Promise<void>) => {
    const chatType = ctx.chat?.type;

    if (chatType && chatType !== "private") {
      logger.debug(
        `Ignoring update from chat type="${chatType}" chatId=${ctx.chat?.id}`,
      );
      // Silently drop — don't reply so the bot doesn't spam group chats
      return;
    }

    await next();
  };
}
