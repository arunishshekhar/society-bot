import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BotContext, BotSession } from '../types/bot-context';

export function createPrismaSessionMiddleware(prisma: PrismaService) {
  return async (ctx: BotContext, next: () => Promise<void>) => {
    const telegramId = ctx.from?.id;

    if (!telegramId) {
      await next();
      return;
    }

    const savedSession = await prisma.botSession.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    ctx.session = (savedSession?.sessionData as BotSession | null) ?? {};
    await next();

    const sessionData = JSON.parse(
      JSON.stringify(ctx.session ?? {}),
    ) as Prisma.InputJsonValue;

    await prisma.botSession.upsert({
      where: { telegramId: BigInt(telegramId) },
      create: {
        telegramId: BigInt(telegramId),
        sessionData,
      },
      update: {
        sessionData,
      },
    });
  };
}
