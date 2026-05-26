import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  // If not using webhooks, delete any stale webhook so polling works correctly.
  // A leftover webhook silently swallows all updates and prevents polling.
  if (!process.env.WEBHOOK_DOMAIN) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token) {
      try {
        await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`);
      } catch {
        // Non-fatal — polling will still work; just may miss some queued messages
      }
    }
  }

  await app.listen(process.env.PORT ?? 3001);
}

void bootstrap();
