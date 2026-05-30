import { Logger } from "@nestjs/common";
import { BotContext } from "../types/bot-context";
import { PrismaService } from "../prisma/prisma.service";

const logger = new Logger("PrivateChatOnly");

/**
 * Global middleware that intercepts group messages.
 * It drops regular messages but replies to commands with an instruction to use DMs.
 */
export function createPrivateChatOnlyMiddleware(prisma: PrismaService) {
  return async (ctx: BotContext, next: () => Promise<void>) => {
    const chatType = ctx.chat?.type;

    if (chatType && chatType !== "private") {
      logger.log(`Received group update: keys=${Object.keys(ctx.update).join(',')} message_keys=${ctx.message ? Object.keys(ctx.message).join(',') : 'none'}`);
      
      // Allow new_chat_members events so we can send a welcome message in the group
      if (ctx.message && "new_chat_members" in ctx.message) {
        logger.log("Allowing new_chat_members event");
        return await next();
      }

      // Intercept commands sent in the group
      const text = (ctx.message as any)?.text;
      if (text && text.startsWith('/')) {
        const telegramId = ctx.from?.id;
        let isRegistered = false;
        
        if (telegramId) {
          const resident = await prisma.resident.findUnique({
            where: { telegramId: BigInt(telegramId) },
          });
          isRegistered = resident?.onboardingComplete ?? false;
        }

        const instruction = isRegistered 
          ? "use the /menu command to access society services" 
          : "use the /start command to complete your registration";
          
        await ctx.reply(
          `Hi! Please message me privately (@${ctx.botInfo.username}) and ${instruction}.`,
          { disable_notification: true }
        ).catch(() => {});
      }

      logger.debug(
        `Ignoring update from chat type="${chatType}" chatId=${ctx.chat?.id}`,
      );
      // Drop — don't process further
      return;
    }

    await next();
  };
}
