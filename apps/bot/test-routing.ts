import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';

async function main() {
  const bot = new Telegraf('dummy');
  // @ts-ignore
  bot.botInfo = { id: 1, is_bot: true, first_name: 'dummy', username: 'dummybot' };
  let stringHandled = false;
  let filterHandled = false;

  bot.on('new_chat_members', () => { stringHandled = true; });
  bot.on(message('new_chat_members'), () => { filterHandled = true; });

  const fakeUpdate = {
    update_id: 1,
    message: {
      message_id: 1,
      date: 1,
      chat: { id: 1, type: 'group' },
      new_chat_members: [{ id: 2, is_bot: false, first_name: 'Test' }]
    }
  };

  await bot.handleUpdate(fakeUpdate as any);
  console.log('stringHandled:', stringHandled);
  console.log('filterHandled:', filterHandled);
}
main();
