import { BotContext } from '../types/bot-context';

export function getCallbackData(ctx: BotContext): string | undefined {
  const query = ctx.callbackQuery;

  if (query && 'data' in query) {
    return query.data;
  }

  return undefined;
}
