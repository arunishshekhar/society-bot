import { Logger } from '@nestjs/common';
import { BotContext } from '../types/bot-context';
import { PrismaService } from '../prisma/prisma.service';

const logger = new Logger('PrivateChatOnly');

/**
 * Regex to detect question-like messages by opening word.
 * Combined with a `?` check to catch most natural questions.
 */
const QUESTION_WORD_RE =
  /^(what|who|when|where|how|is|can|does|are|which|why|will|was|were|has|have|should|would|could|do|did|any|anyone|does)\b/i;

function isQuestionLike(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.includes('?') || QUESTION_WORD_RE.test(trimmed);
}

/**
 * Global middleware that intercepts group messages.
 *
 * The following group events are passed through to handlers:
 *  - new_chat_members          — welcome message
 *  - Reply to the bot's msg    — group conversation reply
 *  - Question-like text        — proactive FAQ/DB answer attempt
 *
 * Commands sent in the group get a "please DM me" redirect.
 * Everything else is silently dropped.
 */
export function createPrivateChatOnlyMiddleware(prisma: PrismaService) {
  return async (ctx: BotContext, next: () => Promise<void>) => {
    const chatType = ctx.chat?.type;

    if (chatType && chatType !== 'private') {
      logger.log(
        `Received group update: keys=${Object.keys(ctx.update).join(',')} message_keys=${ctx.message ? Object.keys(ctx.message).join(',') : 'none'}`,
      );

      // ── 1. Always allow new_chat_members ─────────────────────────
      if (ctx.message && 'new_chat_members' in ctx.message) {
        logger.log('Allowing new_chat_members event');
        return await next();
      }

      const msg = ctx.message as any;
      const text: string | undefined = msg?.text;

      if (text) {
        // ── 2. Allow reply to the bot's own message ───────────────
        const replyTo = msg?.reply_to_message;
        const botId = ctx.botInfo?.id;
        const isReplyToBot =
          replyTo && botId && replyTo.from?.id === botId;

        if (isReplyToBot && !text.startsWith('/')) {
          logger.log(`Allowing bot-reply from user ${ctx.from?.id}`);
          return await next();
        }

        // ── 3. Allow question-like messages (not commands) ────────
        if (!text.startsWith('/') && isQuestionLike(text)) {
          logger.log(`Allowing question-like group message from user ${ctx.from?.id}`);
          return await next();
        }

        // ── 4. Redirect commands to DM ────────────────────────────
        if (text.startsWith('/')) {
          const telegramId = ctx.from?.id;
          let isRegistered = false;

          if (telegramId) {
            const resident = await prisma.resident.findUnique({
              where: { telegramId: BigInt(telegramId) },
            });
            isRegistered = resident?.onboardingComplete ?? false;
          }

          const instruction = isRegistered
            ? 'use the /menu command to access society services'
            : 'use the /start command to complete your registration';

          await ctx
            .reply(
              `Hi! Please message me privately (@${ctx.botInfo.username}) and ${instruction}.`,
              { disable_notification: true },
            )
            .catch(() => {});
        }
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
