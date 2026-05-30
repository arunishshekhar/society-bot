import { Telegraf } from 'telegraf';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);
bot.telegram.sendMessage(842431611, "Society Notice\n\ntest", { parse_mode: 'MarkdownV2' }).then(() => console.log("Sent")).catch(err => console.error("Error sending:", err.message || err));
