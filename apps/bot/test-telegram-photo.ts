import { Telegraf } from 'telegraf';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);
bot.telegram.sendPhoto(
  842431611,
  { source: Buffer.from("test") },
  { caption: "Society Notice\n\ntest", parse_mode: 'MarkdownV2' }
).then(() => console.log("Sent photo")).catch(err => console.error("Error sending photo:", err.message || err));
