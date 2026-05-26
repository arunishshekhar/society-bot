import { Markup } from 'telegraf';

export function mainMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('My Profile', 'profile:open')],
    [Markup.button.callback('My Vehicles', 'vehicles:open')],
    [Markup.button.callback('Find Something', 'search:open')],
    [Markup.button.callback('Worker Directory', 'workers:open')],
    [Markup.button.callback('Services', 'services:open')],
    [Markup.button.callback('Carpool', 'carpool:open')],
    [Markup.button.callback('Settings', 'settings:open')],
  ]);
}
