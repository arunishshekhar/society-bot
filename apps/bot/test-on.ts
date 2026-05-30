import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
const bot = new Telegraf('dummy');
try {
  bot.on('new_chat_members', () => {});
  console.log('string works');
} catch (err: any) {
  console.log('string error:', err.message);
}
try {
  bot.on(message('new_chat_members'), () => {});
  console.log('filter works');
} catch (err: any) {
  console.log('filter error:', err.message);
}
