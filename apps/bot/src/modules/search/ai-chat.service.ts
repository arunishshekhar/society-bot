import { Injectable, Logger } from "@nestjs/common";
import Groq from "groq-sdk";
import { PrismaService } from "../../prisma/prisma.service";
import { CacheService } from "../../cache/cache.service";
import { BotContext } from "../../types/bot-context";

const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const MAX_HISTORY = 20; // keep conversation bounded

const SYSTEM_PROMPT = `You are the Society Bot — a helpful assistant for a residential housing society.
You help residents with:
- Finding domestic workers (maids, cooks, plumbers, electricians, carpenters, etc.)
- Finding micro-services offered by other residents (tiffin, tutoring, laundry, etc.)
- Carpool coordination
- Lost & found items
- General society queries, rules, timings, and FAQs

Guidelines:
- Keep replies concise and friendly. Use simple formatting.
- If asked about a specific worker, service, carpool, or FAQ, tell the user to use the menu or /ask command for structured results.
- If you don't know something specific (like a resident's contact number), say so honestly and suggest contacting the society admin.
- Do not make up contact numbers, flat numbers, or other personal details.
- For action-oriented requests (post carpool, add worker, etc.), guide the user to use the bot menu.`;

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);
  private readonly groq = process.env.GROQ_API_KEY?.length
    ? new Groq({ apiKey: process.env.GROQ_API_KEY })
    : null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async handleMessage(ctx: BotContext, userText: string): Promise<void> {
    if (!this.groq) {
      // Groq not configured — give a helpful fallback
      await ctx.reply(
        "🤖 AI assistant isn't configured yet. Use /ask to search for workers, services, or carpool.",
      );
      return;
    }

    const now = Date.now();
    let session = ctx.session.aiChat;

    // Reset history if idle for more than 10 minutes
    if (!session || now - session.lastMessageAt > IDLE_TIMEOUT_MS) {
      if (session && now - session.lastMessageAt > IDLE_TIMEOUT_MS) {
        this.logger.debug(`AI session reset for user ${ctx.from?.id} (idle timeout)`);
      }
      session = { messages: [], lastMessageAt: now };
    }

    // Append user message and cap history
    session.messages.push({ role: "user", content: userText });
    if (session.messages.length > MAX_HISTORY) {
      session.messages = session.messages.slice(session.messages.length - MAX_HISTORY);
    }

    // Build FAQ context to enrich the system prompt
    let faqContext = "";
    try {
      const cached = this.cache.get<Array<{ question: string; answer: string }>>("faqs");
      const faqs = cached ?? await this.prisma.faq.findMany();
      if (faqs.length) {
        faqContext =
          "\n\n<faq_data>\n" +
          faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n") +
          "\n</faq_data>";
      }
    } catch {
      // Non-fatal — continue without FAQ context
    }

    await ctx.sendChatAction("typing");

    try {
      const response = await this.groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: SYSTEM_PROMPT + faqContext },
          ...session.messages,
        ],
        max_tokens: 400,
      });

      const reply = response.choices[0]?.message?.content?.trim();
      if (!reply) {
        await ctx.reply("🤖 Sorry, I couldn't generate a response. Please try again.");
        return;
      }

      // Append assistant reply to history
      session.messages.push({ role: "assistant", content: reply });
      session.lastMessageAt = Date.now();
      ctx.session.aiChat = session;

      await ctx.reply(reply);
    } catch (err: any) {
      this.logger.error(`Groq AI chat error: ${err?.message ?? err}`);
      // Fallback: don't update session, just notify user
      await ctx.reply(
        "🤖 I'm having trouble connecting to the AI right now. Try again in a moment, or use /ask for structured search.",
      );
    }
  }
}
