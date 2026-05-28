import { Telegraf } from 'telegraf';
import * as dotenv from 'dotenv';
dotenv.config();
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
async function test() {
  try {
    await bot.telegram.sendMessage(
      process.env.TELEGRAM_GROUP_ID || '', 
      'Society Notice\n\nTesting broadcast. This is a test!',
      { parse_mode: 'MarkdownV2' }
    );
    console.log('Success!');
  } catch (e: any) {
    if (e.response && e.response.description.includes("can't parse entities")) {
      await bot.telegram.sendMessage(
        process.env.TELEGRAM_GROUP_ID || '', 
        'Society Notice\n\nTesting broadcast. This is a test!'
      );
      console.log('Success with fallback!');
    } else {
      console.error('Error:', e.response?.description || e.message);
    }
  }
}
test();
