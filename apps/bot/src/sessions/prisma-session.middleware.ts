import type { InputJsonValue } from "@prisma/client/runtime/library";
import { PrismaService } from "../prisma/prisma.service";
import { BotContext, BotSession } from "../types/bot-context";

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

    // Snapshot before the handler runs so we can diff afterward.
    const snapshotBefore = JSON.stringify(ctx.session);

    await next();

    const sessionData = JSON.parse(
      JSON.stringify(ctx.session ?? {}),
    ) as InputJsonValue;

    // Only write to the DB if session actually changed — this eliminates
    // redundant writes on every view-only interaction (menu browsing, etc.)
    // and significantly reduces free-tier DB compute usage.
    const snapshotAfter = JSON.stringify(ctx.session ?? {});
    if (snapshotBefore === snapshotAfter) {
      return;
    }

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

