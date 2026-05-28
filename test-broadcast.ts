import { Telegraf } from 'telegraf';
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
async function test() {
  try {
    await bot.telegram.sendMessage(
      process.env.TELEGRAM_GROUP_ID || '', // send to group or myself
      'Society Notice\n\nTesting broadcast. This is a test!',
      { parse_mode: 'MarkdownV2' }
    );
    console.log('Success');
  } catch (e) {
    console.error(e.message);
  }
}
test();
