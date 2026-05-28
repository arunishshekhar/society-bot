import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { getBotToken } from "nestjs-telegraf";
import { Telegraf } from "telegraf";

// BigInt (telegramId) can't be serialized by JSON.stringify by default.
// Patch it globally so admin API responses don't 500.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

const HOOK_PATH = "/telegram-webhook";
const RETRIES = 5;
const RETRY_DELAY_MS = 8000;

/** Validate critical environment variables before the app starts */
function validateEnv() {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error(
      "[bootstrap] FATAL: TELEGRAM_BOT_TOKEN is not set. Exiting.",
    );
    process.exit(1);
  }
  if (!process.env.ADMIN_API_KEY) {
    console.warn("[bootstrap] WARNING: ADMIN_API_KEY is not set. Admin routes will reject all requests.");
  }
  const lat = parseFloat(process.env.SOCIETY_LAT ?? "0");
  const lng = parseFloat(process.env.SOCIETY_LNG ?? "0");
  if (lat === 0 || lng === 0) {
    console.warn(
      "[bootstrap] WARNING: SOCIETY_LAT/SOCIETY_LNG are not set (or are 0). " +
      "Carpool routes will be calculated from 0,0 (Gulf of Guinea). " +
      "Set these env vars to your society's coordinates.",
    );
  }
}

async function bootstrap() {
  validateEnv();

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

      // Restrict CORS to the dashboard origin only.
      // Falls back to open CORS only in local development (no DASHBOARD_URL set).
      const dashboardOrigin = process.env.DASHBOARD_URL;
      app.enableCors(
        dashboardOrigin
          ? {
              origin: dashboardOrigin,
              methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
              allowedHeaders: ["content-type", "x-admin-api-key"],
              credentials: false,
            }
          : { origin: true }, // open in dev
      );

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
      console.log(
        `Bot started on attempt ${attempt} (mode: ${webhookDomain ? "webhook" : "polling"})`,
      );
      return;
    } catch (err) {
      const isLast = attempt === RETRIES;
      console.error(
        `[bootstrap] Attempt ${attempt}/${RETRIES} failed: ${(err as Error).message}`,
      );
      if (isLast) {
        console.error("[bootstrap] All retries exhausted. Exiting.");
        process.exit(1);
      }
      console.log(`[bootstrap] Retrying in ${RETRY_DELAY_MS / 1000}s...`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }
}

void bootstrap();

