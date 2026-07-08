import { Injectable, Logger } from '@nestjs/common';
import Groq from 'groq-sdk';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { BotContext } from '../../types/bot-context';

const CONVERSATION_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour

interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface GroupConversation {
  turns: ConversationTurn[];
  lastActivityAt: number;
}

const SYSTEM_PROMPT = `You are the Society Bot — an assistant for a residential housing society group chat.
You have access to the society's official data provided below.

CRITICAL RULES:
1. ONLY answer using the provided data — never guess, infer, or hallucinate.
2. If you cannot answer with 100% certainty from the provided data, respond with EXACTLY: NO_MATCH
3. PRIVACY — NEVER reveal under any circumstances:
   - Any resident's name, flat number, phone number, or Telegram identity
   - Any vehicle plate number, color, model, or owner
   - Who added a worker or service
   - Who reported or claimed a lost/found item
4. Worker phone numbers ARE public (they consented) — include them with +91 prefix.
5. Carpool: share destination, departure time, seats, and route type only — never the offerer's identity.
6. Lost & Found: share item descriptions and collection location only — never the reporter's identity.
7. Keep answers concise, factual, and friendly.`;

@Injectable()
export class GroupAnswerService {
  private readonly logger = new Logger(GroupAnswerService.name);
  private readonly groq = process.env.GROQ_API_KEY?.length
    ? new Groq({ apiKey: process.env.GROQ_API_KEY })
    : null;

  /**
   * In-memory conversation store.
   * Key: `${chatId}:${botMessageId}` — the message ID of the bot's first group reply.
   */
  private readonly conversations = new Map<string, GroupConversation>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {
    // Periodically purge expired conversations (every 15 minutes)
    setInterval(() => this.purgeExpired(), 15 * 60 * 1000);
  }

  // ─── Answer generation ────────────────────────────────────────────────────

  /**
   * Try to answer a question using FAQ + DB data via Groq.
   * Returns the answer string, or null if no confident answer exists.
   * Optionally accepts conversation history for context-aware replies.
   */
  async tryAnswer(
    question: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  ): Promise<string | null> {
    if (!this.groq) return null;

    const faqCtx = await this.buildFaqContext();
    const dbCtx = await this.buildDbContext(question);
    const dataBlock = [faqCtx, dbCtx].filter(Boolean).join('\n\n');

    if (!dataBlock) return null;

    try {
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        {
          role: 'system',
          content: `${SYSTEM_PROMPT}\n\n<society_data>\n${dataBlock}\n</society_data>`,
        },
        // Inject prior conversation turns for context
        ...history.map((t) => ({ role: t.role, content: t.content })),
        { role: 'user', content: question },
      ];

      const response = await this.groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages,
        max_tokens: 350,
      });

      const answer = response.choices[0]?.message?.content?.trim();
      if (!answer || answer === 'NO_MATCH' || answer.includes('NO_MATCH')) {
        return null;
      }

      // Ensure 10-digit numbers get +91 prefix
      return answer.replace(
        /(?<!\+\d{1,3}[\s-]?)(?<!\d)([6-9]\d{9})(?!\d)/g,
        '+91$1',
      );
    } catch (err: any) {
      this.logger.error(`GroupAnswer Groq error: ${err?.message ?? err}`);
      return null;
    }
  }

  // ─── Conversation tracking ─────────────────────────────────────────────────

  /** Start tracking a new thread when the bot first replies in the group. */
  startConversation(key: string, userMessage: string, botReply: string): void {
    this.conversations.set(key, {
      turns: [
        { role: 'user', content: userMessage, timestamp: Date.now() },
        { role: 'assistant', content: botReply, timestamp: Date.now() },
      ],
      lastActivityAt: Date.now(),
    });
    this.logger.debug(`Group conversation started: ${key}`);
  }

  /**
   * Append a new turn to an active conversation.
   * Returns false if the conversation doesn't exist or has expired (> 1 hour idle).
   */
  appendTurn(key: string, role: 'user' | 'assistant', content: string): boolean {
    const conv = this.conversations.get(key);
    if (!conv) return false;

    if (Date.now() - conv.lastActivityAt > CONVERSATION_TIMEOUT_MS) {
      this.conversations.delete(key);
      this.logger.debug(`Group conversation expired: ${key}`);
      return false;
    }

    conv.turns.push({ role, content, timestamp: Date.now() });
    conv.lastActivityAt = Date.now();
    return true;
  }

  /** Get full turn history for a conversation (for Groq context). */
  getHistory(key: string): Array<{ role: 'user' | 'assistant'; content: string }> | null {
    const conv = this.conversations.get(key);
    if (!conv) return null;
    return conv.turns.map((t) => ({ role: t.role, content: t.content }));
  }

  /** Format full conversation history as a human-readable string (for admin escalation). */
  formatHistory(key: string): string {
    const conv = this.conversations.get(key);
    if (!conv || !conv.turns.length) return '(no history)';
    return conv.turns
      .map((t) => `${t.role === 'user' ? '👤 User' : '🤖 Bot'}: ${t.content}`)
      .join('\n');
  }

  /** Check whether a conversation is still within the 1-hour window. */
  isActive(key: string): boolean {
    const conv = this.conversations.get(key);
    if (!conv) return false;
    if (Date.now() - conv.lastActivityAt > CONVERSATION_TIMEOUT_MS) {
      this.conversations.delete(key);
      return false;
    }
    return true;
  }

  /** Remove a conversation (e.g., after escalation). */
  end(key: string): void {
    this.conversations.delete(key);
  }

  // ─── Admin mentions ────────────────────────────────────────────────────────

  /**
   * Fetch all human group administrators via the Telegram API.
   * Falls back to ADMIN_TELEGRAM_IDS env var if the API call fails.
   * Returns a string of @username mentions / inline links.
   */
  async getAdminMentions(ctx: BotContext): Promise<string> {
    const groupId = process.env.TELEGRAM_GROUP_ID;
    if (!groupId) return '';

    const mentions: string[] = [];

    try {
      const admins = await ctx.telegram.getChatAdministrators(groupId);
      for (const admin of admins) {
        if (admin.user.is_bot) continue;
        if (admin.user.username) {
          mentions.push(`@${admin.user.username}`);
        } else {
          mentions.push(
            `[${admin.user.first_name}](tg://user?id=${admin.user.id})`,
          );
        }
      }
    } catch (err: any) {
      this.logger.warn(`getChatAdministrators failed: ${err?.message} — falling back to env`);
      const ids = (process.env.ADMIN_TELEGRAM_IDS ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const id of ids) {
        mentions.push(`[Admin](tg://user?id=${id})`);
      }
    }

    return mentions.join(' ');
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async buildFaqContext(): Promise<string> {
    try {
      const cached = this.cache.get<Array<{ question: string; answer: string }>>('faqs');
      const faqs = cached ?? (await this.prisma.faq.findMany());
      if (!faqs.length) return '';
      return (
        '<faqs>\n' +
        faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n') +
        '\n</faqs>'
      );
    } catch {
      return '';
    }
  }

  /**
   * Builds safe DB context for a question.
   * Privacy rules strictly applied — NO resident PII, NO vehicle data.
   */
  private async buildDbContext(question: string): Promise<string> {
    const parts: string[] = [];
    const lower = question.toLowerCase();

    // ── Workers (phone is public — workers opted in) ───────────────────────
    if (
      /(maid|cook|plumber|electrician|carpenter|driver|repair|clean|worker|helper|labour|painter|ac|geyser|pest|colour|color)/.test(lower)
    ) {
      try {
        const workers = await this.prisma.workerRecommendation.findMany({
          where: { isActive: true, isBanned: false },
          // Do NOT include resident relation — keeps adder identity private
          orderBy: [{ avgRating: 'desc' }, { createdAt: 'desc' }],
          take: 10,
        });
        if (workers.length) {
          parts.push(
            '<workers>\n' +
              workers.map((w) => {
                const phone = w.phone.startsWith('+') ? w.phone : '+91' + w.phone;
                const rating = w.avgRating ? ` | Rating: ${w.avgRating.toFixed(1)}★` : '';
                return `Name: ${w.name} | Category: ${w.category} | Phone: ${phone} | Code: ${w.workerCode}${rating}${w.notes ? ` | Notes: ${w.notes}` : ''}`;
              }).join('\n') +
              '\n</workers>',
          );
        }
      } catch {}
    }

    // ── MicroServices (resident identity NOT exposed) ──────────────────────
    if (
      /(tiffin|tutor|tuition|laundry|tailor|food|meal|service|delivery|class|daycare|pet|yoga|fitness)/.test(lower)
    ) {
      try {
        const services = await this.prisma.microService.findMany({
          where: { isPaused: false, isDisabled: false },
          // Deliberately no resident include — keeps identity private
          take: 10,
        });
        if (services.length) {
          parts.push(
            '<resident_services>\n' +
              services.map((s) =>
                `Name: ${s.name} | Category: ${s.category}${s.description ? ` | Info: ${s.description}` : ''}`,
              ).join('\n') +
              '\n</resident_services>',
          );
        }
      } catch {}
    }

    // ── Carpool routes (destination + timing only; offerer identity hidden) ─
    if (
      /(carpool|ride|pool|lift|drop|pickup|commute|office|whitefield|koramangala|electronic|mg road|indiranagar)/.test(lower)
    ) {
      try {
        const routes = await this.prisma.carpoolRoute.findMany({
          where: { isPaused: false },
          // No resident include — keeps offerer identity private
          orderBy: { createdAt: 'desc' },
          take: 10,
        });
        if (routes.length) {
          parts.push(
            '<carpool_routes>\n' +
              routes.map((r) => {
                const days = r.recurringDays?.length ? ` | Days: ${r.recurringDays.join(', ')}` : '';
                const ret = r.hasReturn && r.returnTime ? ` | Return: ${r.returnTime}` : '';
                return (
                  `Destination: ${r.destinationAddress} | Departs: ${r.departureTime}` +
                  ` | Seats: ${r.seatsAvailable} | Type: ${r.type}${days}${ret}`
                );
              }).join('\n') +
              '\n</carpool_routes>',
          );
        }
      } catch {}
    }

    // ── Lost & Found (descriptions + location only; reporter identity hidden) 
    if (
      /(lost|found|missing|item|belong|wallet|key|phone|bag|purse|jewel)/.test(lower)
    ) {
      try {
        const [foundItems, lostItems] = await Promise.all([
          this.prisma.foundItem.findMany({
            where: { status: 'OPEN' },
            // No reportedBy include — identity stays private
            orderBy: { createdAt: 'desc' },
            take: 5,
          }),
          this.prisma.lostItem.findMany({
            where: { status: 'OPEN' },
            orderBy: { createdAt: 'desc' },
            take: 5,
          }),
        ]);

        if (foundItems.length) {
          parts.push(
            '<found_items>\n' +
              foundItems.map((f) =>
                `Description: ${f.aiDescription || f.originalDescription} | Collection: ${f.collectionLocation}`,
              ).join('\n') +
              '\n</found_items>',
          );
        }
        if (lostItems.length) {
          parts.push(
            '<lost_items>\n' +
              lostItems.map((l) =>
                `Description: ${l.aiDescription || l.originalDescription}`,
              ).join('\n') +
              '\n</lost_items>',
          );
        }
      } catch {}
    }

    // ── Categories (worker + service types available in the society) ─────────
    if (
      /(what|which|any|available|category|categories|type|kind|offer|provide)/.test(lower)
    ) {
      try {
        const categories = await this.prisma.category.findMany({
          orderBy: { name: 'asc' },
        });
        if (categories.length) {
          const workerCats = categories.filter((c) => c.type === 'worker').map((c) => c.name);
          const serviceCats = categories.filter((c) => c.type === 'service').map((c) => c.name);
          const lines: string[] = [];
          if (workerCats.length) lines.push(`Worker categories: ${workerCats.join(', ')}`);
          if (serviceCats.length) lines.push(`Service categories: ${serviceCats.join(', ')}`);
          if (lines.length) parts.push('<categories>\n' + lines.join('\n') + '\n</categories>');
        }
      } catch {}
    }

    return parts.join('\n\n');
  }

  private purgeExpired(): void {
    const now = Date.now();
    let count = 0;
    for (const [key, conv] of this.conversations) {
      if (now - conv.lastActivityAt > CONVERSATION_TIMEOUT_MS) {
        this.conversations.delete(key);
        count++;
      }
    }
    if (count > 0) {
      this.logger.debug(`Purged ${count} expired group conversation(s)`);
    }
  }
}
