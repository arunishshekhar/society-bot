import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getBotToken } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { json, urlencoded } from 'express';

// BigInt (telegramId) can't be serialized by JSON.stringify by default.
// Patch it globally so admin API responses don't 500.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

const HOOK_PATH = '/telegram-webhook';
const RETRIES = 5;
const RETRY_DELAY_MS = 8000;

async function bootstrap() {
  const webhookDomain = process.env.WEBHOOK_DOMAIN;

  // In polling mode: clear any stale webhook so getUpdates works.
  if (!webhookDomain) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token) {
      try {
        await fetch(
          `https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`,
        );
      } catch {
        // Non-fatal
      }
    }
  }

  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const app = await NestFactory.create(AppModule);
      app.enableCors();
      app.use(json({ limit: '20mb' }));
      app.use(urlencoded({ extended: true, limit: '20mb' }));

      // In webhook mode, nestjs-telegraf's bot.launch() only registers the
      // webhook URL with Telegram — it does NOT mount a route on the HTTP server.
      // We must do that ourselves by wiring the Telegraf callback into Express.
      if (webhookDomain) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const expressApp = app.getHttpAdapter().getInstance();
        const bot: Telegraf = app.get(getBotToken());
        // Mount at root — Express strips the path prefix when using app.use(path, cb),
        // so webhookCallback would see '/' instead of '/telegram-webhook' and 404.
        expressApp.use(bot.webhookCallback(HOOK_PATH));
        console.log(`[webhook] Mounted Telegraf handler at ${HOOK_PATH}`);
      }

      await app.listen(process.env.PORT ?? 3001);
      console.log(`Bot started on attempt ${attempt} (mode: ${webhookDomain ? 'webhook' : 'polling'})`);
      return;
    } catch (err) {
      const isLast = attempt === RETRIES;
      console.error(
        `[bootstrap] Attempt ${attempt}/${RETRIES} failed: ${(err as Error).message}`,
      );
      if (isLast) {
        console.error('[bootstrap] All retries exhausted. Exiting.');
        process.exit(1);
      }
      console.log(`[bootstrap] Retrying in ${RETRY_DELAY_MS / 1000}s...`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }
}

void bootstrap();

