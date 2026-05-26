import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const RETRIES = 5;
const RETRY_DELAY_MS = 8000;

async function bootstrap() {
  // If not using webhooks, delete any stale webhook so polling works correctly.
  if (!process.env.WEBHOOK_DOMAIN) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token) {
      try {
        await fetch(
          `https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`,
        );
      } catch {
        // Non-fatal — polling will still work; may miss some queued messages
      }
    }
  }

  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const app = await NestFactory.create(AppModule);
      app.enableCors();
      await app.listen(process.env.PORT ?? 3001);
      console.log(`Bot started on attempt ${attempt}`);
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
