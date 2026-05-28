import { Telegraf } from 'telegraf';
import * as dotenv from 'dotenv';
dotenv.config();
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
async function test() {
  try {
    // Markdown
    await bot.telegram.sendMessage(
      process.env.TELEGRAM_GROUP_ID || '', 
      'Test link: [9876543210](tel:9876543210)\nOr HTML: <a href="tel:9876543210">9876543210</a>',
      { parse_mode: 'HTML' }
    );
    console.log('Success HTML');

    await bot.telegram.sendMessage(
      process.env.TELEGRAM_GROUP_ID || '', 
      'Test link Markdown: [9876543210](tel:9876543210)',
      { parse_mode: 'Markdown' }
    );
    console.log('Success Markdown');
  } catch (e: any) {
    console.error('Error:', e.response?.description || e.message);
  }
}
test();
