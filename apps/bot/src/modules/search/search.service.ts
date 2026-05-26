import { Injectable } from '@nestjs/common';
import { Markup } from 'telegraf';
import Groq from 'groq-sdk';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeSearchIntent, SearchIntent } from './search-intent';
import { BotContext } from '../../types/bot-context';

@Injectable()
export class SearchService {
  private readonly groq =
    process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.length > 0
      ? new Groq({ apiKey: process.env.GROQ_API_KEY })
      : null;

  constructor(private readonly prisma: PrismaService) {}

  // ─── Public entry point for /ask command ────────────────────────────────────

  async handleAsk(ctx: BotContext, query: string): Promise<void> {
    if (!query) {
      await ctx.reply(
        '💬 What are you looking for?\n\nExamples:\n• /ask I need a North Indian maid\n• /ask carpool to MG Road on Monday at 8AM\n• /ask plumber for bathroom repair',
      );
      return;
    }

    await ctx.sendChatAction('typing');
    const intent = await this.classifyIntent(query);

    if (intent.type === 'worker') {
      await this.replyWorkers(ctx, intent.category, intent.keywords);
    } else if (intent.type === 'service') {
      await this.replyServices(ctx, intent.category, intent.keywords);
    } else if (intent.type === 'carpool') {
      await this.replyCarpool(ctx, intent.destination, intent.days, intent.keywords);
    } else {
      await ctx.reply(
        "🤔 I couldn't understand what you're looking for. Try being more specific.\n\nExamples:\n• /ask North Indian maid\n• /ask carpool MG Road Monday 8AM\n• /ask electrician",
        Markup.inlineKeyboard([
          [Markup.button.callback('👷 Workers', 'workers:open'), Markup.button.callback('🛎 Services', 'services:open')],
          [Markup.button.callback('🚗 Carpool', 'carpool:open')],
        ]),
      );
    }
  }

  // ─── AI Intent Classification ────────────────────────────────────────────────

  async classifyIntent(query: string): Promise<SearchIntent> {
    if (!this.groq) {
      return this.fallbackIntent(query);
    }

    try {
      const response = await this.groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: `You are a housing society assistant that extracts structured search intent from resident queries.
Classify each query and extract the following JSON fields:
- type: "worker" | "service" | "carpool" | "unknown"
- category: specific type of worker or service (e.g. "maid", "cook", "plumber", "tutor", "laundry")
- keywords: array of key descriptors (e.g. ["north indian", "experienced", "full time"])
- destination: for carpool queries, the destination location (e.g. "MG Road", "Whitefield")
- days: for carpool queries, array of abbreviated days (e.g. ["Mon","Wed","Fri"])
- time: for carpool queries, departure time mentioned (e.g. "8AM", "8:30AM")

Respond ONLY with valid JSON.`,
          },
          {
            role: 'user',
            content: query,
          },
        ],
        max_tokens: 200,
        response_format: { type: 'json_object' },
      });

      return normalizeSearchIntent(JSON.parse(response.choices[0]?.message?.content ?? '{}'));
    } catch {
      return this.fallbackIntent(query);
    }
  }

  // ─── DB Query Helpers ────────────────────────────────────────────────────────

  async replyWorkers(ctx: BotContext, category?: string, keywords: string[] = []): Promise<void> {
    const orClauses: object[] = [
      ...(category ? [{ category: { contains: category, mode: 'insensitive' as const } }] : []),
      ...keywords.flatMap((kw) => [
        { notes: { contains: kw, mode: 'insensitive' as const } },
        { tags: { has: kw } },
        { name: { contains: kw, mode: 'insensitive' as const } },
        { category: { contains: kw, mode: 'insensitive' as const } },
      ]),
    ];

    const workers = await this.prisma.workerRecommendation.findMany({
      where: {
        isActive: true,
        isBanned: false,
        ...(orClauses.length ? { OR: orClauses } : {}),
      },
      include: { resident: true },
      orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }],
      take: 5,
    });

    if (!workers.length) {
      await ctx.reply('😕 No workers found matching your request. Try different keywords.');
      return;
    }

    await ctx.reply(`Found ${workers.length} worker(s):`);
    for (const w of workers) {
      const stars = w.rating ? '⭐'.repeat(Math.min(w.rating, 5)) : '';
      const addedBy = w.resident?.flatNumber ? `Flat ${w.resident.flatNumber}` : 'Admin';
      await ctx.reply(
        `👷 *${w.name}* — ${w.category}${stars ? ` ${stars}` : ''}\n📞 ${w.phone}${w.notes ? `\n📝 ${w.notes}` : ''}\nAdded by: ${addedBy}`,
        { parse_mode: 'Markdown' },
      );
    }
  }

  async replyServices(ctx: BotContext, category?: string, keywords: string[] = []): Promise<void> {
    const orClauses: object[] = [
      ...(category ? [{ category: { contains: category, mode: 'insensitive' as const } }] : []),
      ...keywords.flatMap((kw) => [
        { name: { contains: kw, mode: 'insensitive' as const } },
        { description: { contains: kw, mode: 'insensitive' as const } },
        { category: { contains: kw, mode: 'insensitive' as const } },
      ]),
    ];

    const services = await this.prisma.microService.findMany({
      where: {
        isPaused: false,
        isDisabled: false,
        resident: { isActive: true },
        ...(orClauses.length ? { OR: orClauses } : {}),
      },
      include: { resident: true },
      take: 5,
    });

    if (!services.length) {
      await ctx.reply('😕 No services found matching your request.');
      return;
    }

    await ctx.reply(`Found ${services.length} service(s):`);
    for (const s of services) {
      await ctx.reply(
        `🛎 *${s.name}* — ${s.category}\nFlat: ${s.resident?.flatNumber ?? 'Admin'}${s.description ? `\n📝 ${s.description}` : ''}`,
        { parse_mode: 'Markdown' },
      );
    }
  }

  async replyCarpool(ctx: BotContext, destination?: string, days?: string[], keywords: string[] = []): Promise<void> {
    const destTerm = destination ?? keywords.find((k) => k.length > 3);

    const where: Record<string, unknown> = {
      isPaused: false,
      resident: { isActive: true },
    };

    if (destTerm) {
      where['destination'] = { contains: destTerm, mode: 'insensitive' };
    }

    if (days && days.length > 0) {
      where['days'] = { hasSome: days };
    }

    const routes = await this.prisma.carpoolRoute.findMany({
      where,
      include: { resident: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    if (!routes.length) {
      await ctx.reply(`😕 No carpool routes found${destTerm ? ` to ${destTerm}` : ''}${days?.length ? ` on ${days.join('/')}` : ''}.`);
      return;
    }

    await ctx.reply(`Found ${routes.length} carpool route(s):`);
    for (const r of routes) {
      const daysStr = Array.isArray(r.days) && r.days.length ? r.days.join(', ') : 'Daily';
      await ctx.reply(
        `🚗 *${r.resident.flatNumber}* → ${r.destination}\n🕐 Departs: ${r.departureTime}${r.returnTime ? ` | Returns: ${r.returnTime}` : ''}\n📅 ${daysStr}\n💺 Seats: ${r.seatsAvailable}`,
        { parse_mode: 'Markdown' },
      );
    }
  }

  // ─── Fallback ────────────────────────────────────────────────────────────────

  private fallbackIntent(query: string): SearchIntent {
    const lower = query.toLowerCase();
    const keywords = lower.split(/[^a-z0-9]+/).filter(Boolean).slice(0, 8);

    if (/(carpool|ride|cab|whitefield|koramangala|electronic|mg road)/.test(lower)) {
      return { type: 'carpool', keywords };
    }

    if (/(food|meal|tutor|tuition|laundry|tailor|service)/.test(lower)) {
      return { type: 'service', keywords };
    }

    if (/(plumber|electrician|maid|cook|driver|carpenter|repair|ac|geyser|paint)/.test(lower)) {
      return { type: 'worker', keywords };
    }

    return { type: 'unknown', keywords };
  }
}
