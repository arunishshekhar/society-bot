import { Injectable } from "@nestjs/common";
import { Markup } from "telegraf";
import Groq from "groq-sdk";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { RatingService } from "../workers/rating.service";
import { normalizeSearchIntent, SearchIntent } from "./search-intent";
import { BotContext } from "../../types/bot-context";

@Injectable()
export class SearchService {
  private readonly groq =
    process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.length > 0
      ? new Groq({ apiKey: process.env.GROQ_API_KEY })
      : null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ratingService: RatingService,
  ) {}

  // ─── Public entry point for /ask command ────────────────────────────────────

  async handleAsk(ctx: BotContext, query: string): Promise<void> {
    if (!query) {
      await ctx.reply(
        "💬 What are you looking for?\n\nExamples:\n• /ask I need a North Indian maid\n• /ask carpool to MG Road on Monday at 8AM\n• /ask plumber for bathroom repair",
      );
      return;
    }

    await ctx.sendChatAction("typing");

    const answeredByFaq = await this.tryAnswerFromFaq(ctx, query);
    if (answeredByFaq) {
      return;
    }

    const intent = await this.classifyIntent(query);

    if (intent.type === "worker") {
      await this.replyWorkers(ctx, intent.category, intent.keywords);
    } else if (intent.type === "service") {
      await this.replyServices(ctx, intent.category, intent.keywords);
    } else if (intent.type === "post_carpool") {
      ctx.session.carpool = {
        postDraft: {
          destinationAddress: intent.destination,
          departureTime: intent.time,
          type: intent.isRecurring
            ? "RECURRING"
            : intent.date
              ? "ONE_TIME"
              : undefined,
          recurringDays:
            intent.recurringType === "weekday"
              ? ["Mon", "Tue", "Wed", "Thu", "Fri"]
              : intent.recurringType === "weekend"
                ? ["Sat", "Sun"]
                : undefined,
          oneTimeDate: intent.date ? new Date(intent.date) : undefined,
        },
      };
      await ctx.scene.enter("carpool_post");
    } else if (
      intent.type === "find_carpool" ||
      intent.type === "find_return"
    ) {
      const direction = intent.type === "find_return" ? "RETURN" : "MORNING";
      ctx.session.carpool = {
        searchDirection: direction,
        searchDraft: {
          destinationText: intent.destination,
        },
        step: "pickup_location", // Always start by asking for pickup location
      };
      await ctx.scene.enter("carpool_search");
      // If we already had everything, we'd trigger the next step. For simplicity, just enter the scene.
      // We will emulate text to jump steps if needed, but scene enter will just prompt for the missing parts.
    } else if (intent.type === "inform") {
      await this.replyInform(ctx, intent);
    } else if (intent.type === "rate_worker") {
      await this.replyRateWorker(ctx, intent.worker_code, intent.stars);
    } else {
      await ctx.reply(
        "🤔 I couldn't understand what you're looking for. Try being more specific.\n\nExamples:\n• /ask North Indian maid\n• /ask carpool MG Road Monday 8AM\n• /ask electrician",
        Markup.inlineKeyboard([
          [
            Markup.button.callback("👷 Workers", "workers:open"),
            Markup.button.callback("🛎 Services", "services:open"),
          ],
          [Markup.button.callback("🚗 Carpool", "carpool:open")],
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
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: `You are a housing society assistant that extracts structured search intent from resident queries.
Classify each query into exactly one intent type:
- "worker": looking for a maid, cook, plumber, electrician, etc.
- "service": looking for a tiffin service, tutor, laundry, etc.
- "post_carpool": offering a ride or carpool.
- "find_carpool": looking for a ride or carpool.
- "find_return": looking for a return ride.
- "inform": ONLY for sending a direct message/notification to a specific flat owner or vehicle owner (e.g., "tell flat 203 to move their car").
- "rate_worker": rating a worker by their 3-char code (e.g., "rate AB3 4 star", "give 5 stars to X7K").
- "unknown": if the query doesn't fit any of the above.

Extract the following JSON fields based on the chosen type:
- type: the chosen intent string
- category: specific type of worker or service (e.g. "maid", "cook", "plumber", "tutor", "laundry")
- keywords: array of key descriptors (e.g. ["north indian", "experienced", "full time"])
- destination: for carpool queries, the destination location (e.g. "MG Road", "Whitefield")
- time: for carpool queries, departure time mentioned (e.g. "8:00 AM")
- isRecurring: true | false (for carpool)
- recurringType: "weekday" | "weekend" | "both" | null (for carpool)
- date: "YYYY-MM-DD" if specific date mentioned or null (for carpool)
- target_type: for inform queries ONLY, "vehicle" or "flat"
- target_id: for inform queries ONLY, the flat or vehicle number (e.g. "KA12AS2322", "03-12-03")
- message: for inform queries ONLY, the message to relay
- worker_code: for rate_worker queries ONLY, the 3-char worker code (e.g. "AB3", "X7K")
- stars: for rate_worker queries ONLY, integer 1-5

Respond ONLY with valid JSON.`,
          },
          {
            role: "user",
            content: query,
          },
        ],
        max_tokens: 200,
        response_format: { type: "json_object" },
      });

      return normalizeSearchIntent(
        JSON.parse(response.choices[0]?.message?.content ?? "{}"),
      );
    } catch {
      return this.fallbackIntent(query);
    }
  }

  // ─── DB Query Helpers ────────────────────────────────────────────────────────

  // ─── Rate Worker Reply ──────────────────────────────────────────────────────

  async replyRateWorker(
    ctx: BotContext,
    workerCode?: string,
    stars?: number,
  ): Promise<void> {
    if (!workerCode || !stars) {
      await ctx.reply(
        "Please specify the worker code and star count.\n\nExample: `/ask rate AB3 4 star`",
        { parse_mode: "Markdown" },
      );
      return;
    }

    const worker = await this.ratingService.lookupByCode(workerCode);
    if (!worker || !worker.isActive || worker.isBanned) {
      await ctx.reply(
        `😕 No active worker found with code *${workerCode}*.\nCheck the code and try again.`,
        { parse_mode: "Markdown" },
      );
      return;
    }

    const resident = await this.prisma.resident.findUnique({
      where: { telegramId: BigInt(ctx.from?.id ?? 0) },
    });
    if (!resident) {
      await ctx.scene.enter("onboarding");
      return;
    }

    try {
      const { isUpdate, newAvg, count } = await this.ratingService.rateWorker(
        worker.id,
        resident.id,
        stars,
      );
      const verb = isUpdate ? "updated to" : "recorded:";
      await ctx.reply(
        `✅ Rating ${verb} ${"⭐".repeat(stars)} for *${worker.name}* [${worker.workerCode}]\n` +
          `New average: ⭐ ${newAvg} (${count} ${count === 1 ? "rating" : "ratings"})`,
        { parse_mode: "Markdown" },
      );
    } catch (err: any) {
      if (err?.message === "SELF_RATE") {
        await ctx.reply("❌ You cannot rate a worker you added yourself.");
      } else {
        await ctx.reply("❌ Could not save rating. Please try again.");
      }
    }
  }

  async replyWorkers(
    ctx: BotContext,
    category?: string,
    keywords: string[] = [],
  ): Promise<void> {
    const orClauses: object[] = [
      ...(category
        ? [{ category: { contains: category, mode: "insensitive" as const } }]
        : []),
      ...keywords.flatMap((kw) => [
        { notes: { contains: kw, mode: "insensitive" as const } },
        { tags: { has: kw } },
        { name: { contains: kw, mode: "insensitive" as const } },
        { category: { contains: kw, mode: "insensitive" as const } },
        { phone: { contains: kw } },
        { resident: { name: { contains: kw, mode: "insensitive" as const } } },
        { resident: { flatNumber: { contains: kw, mode: "insensitive" as const } } },
      ]),
    ];

    const workers = await this.prisma.workerRecommendation.findMany({
      where: {
        isActive: true,
        isBanned: false,
        ...(orClauses.length ? { OR: orClauses } : {}),
      },
      include: { resident: true },
      orderBy: [{ avgRating: "desc" }, { createdAt: "desc" }],
      take: 5,
    });

    if (!workers.length) {
      await ctx.reply(
        "😕 No workers found matching your request. Try different keywords.",
      );
      return;
    }

    await ctx.reply(`Found ${workers.length} worker(s):`);
    for (const w of workers) {
      const ratingCount = await this.prisma.workerRating.count({ where: { workerId: w.id } });
      const ratingStr = this.ratingService.formatRating(w.avgRating, ratingCount);
      const addedBy = w.resident?.flatNumber
        ? `Flat ${w.resident.flatNumber}`
        : "Admin";
      await ctx.reply(
        `👷 *${w.name}* [${w.workerCode}] — ${w.category}\n${ratingStr}\n📞 [${w.phone}](tel:${w.phone.replace(/[^0-9+]/g, '')})${w.notes ? `\n📝 ${w.notes}` : ""}\nAdded by: ${addedBy}`,
        { parse_mode: "Markdown" },
      );
    }
  }

  async replyServices(
    ctx: BotContext,
    category?: string,
    keywords: string[] = [],
  ): Promise<void> {
    const orClauses: object[] = [
      ...(category
        ? [{ category: { contains: category, mode: "insensitive" as const } }]
        : []),
      ...keywords.flatMap((kw) => [
        { name: { contains: kw, mode: "insensitive" as const } },
        { description: { contains: kw, mode: "insensitive" as const } },
        { category: { contains: kw, mode: "insensitive" as const } },
        { resident: { name: { contains: kw, mode: "insensitive" as const } } },
        { resident: { flatNumber: { contains: kw, mode: "insensitive" as const } } },
      ]),
    ];

    const where: Prisma.MicroServiceWhereInput = {
      isPaused: false,
      isDisabled: false,
      OR: [{ resident: { isActive: true } }, { residentId: null }],
    };
    if (orClauses.length > 0) {
      where.AND = [{ OR: orClauses }];
    }

    const services = await this.prisma.microService.findMany({
      where,
      include: { resident: true },
      take: 5,
    });

    if (!services.length) {
      await ctx.reply("😕 No services found matching your request.");
      return;
    }

    await ctx.reply(`Found ${services.length} service(s):`);
    for (const s of services) {
      await ctx.reply(
        `🛎 *${s.name}* — ${s.category}\nFlat: ${s.resident?.flatNumber ?? "Admin"}${s.description ? `\n📝 ${s.description}` : ""}`,
        { parse_mode: "Markdown" },
      );
    }
  }

  async replyInform(ctx: BotContext, intent: SearchIntent): Promise<void> {
    const { target_type, target_id, message } = intent;
    if (!target_type || !target_id || !message) {
      await ctx.reply(
        "Please specify whether to inform a flat or vehicle owner, the number, and the message.",
      );
      return;
    }

    let residentId: string | undefined;

    if (target_type === "vehicle") {
      // Use exact match — partial plate lookup would allow probing for owner identities
      const number = target_id.trim().replace(/\s+/g, "").toUpperCase();
      const vehicle = await this.prisma.vehicle.findFirst({
        where: { number },
        include: { resident: true },
      });
      if (vehicle?.resident) residentId = vehicle.resident.id;
    } else if (target_type === "flat") {
      const flatNumber = target_id.trim();
      const resident = await this.prisma.resident.findFirst({
        where: {
          flatNumber: { contains: flatNumber, mode: "insensitive" },
          isActive: true,
        },
      });
      if (resident) residentId = resident.id;
    }

    if (!residentId) {
      await ctx.reply(
        `😕 Could not find an active owner for ${target_type} ${target_id}.`,
      );
      return;
    }

    const resident = await this.prisma.resident.findUnique({
      where: { id: residentId },
    });
    if (!resident || !resident.telegramId) return;

    const sender = await this.prisma.resident.findUnique({
      where: { telegramId: BigInt(ctx.from?.id ?? 0) },
    });
    const senderFlat = sender?.flatNumber ?? "A Resident";

    try {
      await ctx.telegram.sendMessage(
        Number(resident.telegramId),
        `🔔 *Anonymous Message from ${senderFlat}*\n\nRegarding your ${target_type} ${target_id}:\n${message}`,
        { parse_mode: "Markdown" },
      );
      await ctx.reply(
        `✅ Message sent to the owner of ${target_type} ${target_id}.`,
      );
    } catch (err) {
      await ctx.reply(
        "❌ Failed to send the message. They might have blocked the bot.",
      );
    }
  }

  async tryAnswerFromFaq(ctx: BotContext, query: string): Promise<boolean> {
    const faqs = await this.prisma.faq.findMany();
    if (!faqs.length || !this.groq) {
      return false;
    }

    try {
      const faqContext = faqs
        .map((faq) => `Q: ${faq.question}\nA: ${faq.answer}`)
        .join("\n\n");

      const response = await this.groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: `You are a helpful assistant for our housing society.
Check if the user's query can be answered using ONLY the provided FAQ data.
If it CAN be answered, provide the answer politely and concisely.
If it CANNOT be answered by the FAQ data, respond with EXACTLY: NO_MATCH

IMPORTANT formatting rules:
- If the answer contains any phone numbers, ALWAYS write them with +91 prefix and no spaces or dashes, e.g. +918105045029
- This is critical — Telegram only makes numbers clickable when they include the +91 country code
- Do not use markdown links like [text](tel:...) — just write the +91 number directly
- Do not make up answers.

<faq_data>
${faqContext}
</faq_data>`,
          },
          {
            role: "user",
            content: query,
          },
        ],
        max_tokens: 300,
      });

      const answer = response.choices[0]?.message?.content?.trim();
      if (answer && answer !== "NO_MATCH" && !answer.includes("NO_MATCH")) {
        // Also normalise any 10-digit numbers the model forgot to prefix
        const withPrefix = answer.replace(
          /(?<!\+\d{1,3}[\s-]?)(?<!\d)([6-9]\d{9})(?!\d)/g,
          "+91$1",
        );

        await ctx.reply(withPrefix, { parse_mode: "Markdown" });
        return true;
      }
    } catch {
      // silently fallback on error
    }
    return false;
  }


  // ─── Fallback ────────────────────────────────────────────────────────────────

  private fallbackIntent(query: string): SearchIntent {
    const lower = query.toLowerCase();
    const keywords = lower
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
      .slice(0, 8);

    // Rate worker: "rate AB3 4 star" / "rate X7K 5 stars"
    const rateMatch = query.match(/rate\s+([A-Za-z0-9]{3,4})\s+(\d)\s*stars?/i);
    if (rateMatch) {
      return {
        type: "rate_worker",
        keywords: [],
        worker_code: rateMatch[1].toUpperCase(),
        stars: Math.min(5, Math.max(1, Number(rateMatch[2]))),
      };
    }

    if (/(inform|tell|message|notify)/.test(lower)) {
      const match = query.match(
        /(?:inform|tell|message|notify)\s+(?:owner of|the owner of)?\s*(?:flat|vehicle|car|bike)?\s*([a-zA-Z0-9-]+)\s+(?:that)?\s*(.*)/i,
      );
      if (match) {
        const isFlat = /^\d{1,2}-\d{1,2}-\d{1,2}$/.test(match[1]);
        return {
          type: "inform",
          keywords: [],
          target_type: isFlat ? "flat" : "vehicle",
          target_id: match[1],
          message: match[2],
        };
      }
    }

    if (
      /(carpool|ride|cab|whitefield|koramangala|electronic|mg road)/.test(lower)
    ) {
      if (/(post|offer|going|will go)/.test(lower)) {
        return { type: "post_carpool", keywords };
      } else if (/(return|back home)/.test(lower)) {
        return { type: "find_return", keywords };
      }
      return { type: "find_carpool", keywords };
    }

    if (/(food|meal|tutor|tuition|laundry|tailor|service)/.test(lower)) {
      return { type: "service", keywords };
    }

    if (
      /(plumber|electrician|maid|cook|driver|carpenter|repair|ac|geyser|paint)/.test(
        lower,
      )
    ) {
      return { type: "worker", keywords };
    }

    if (/(what|when|how|is there|rules|timings|group|society|faq)/.test(lower)) {
      // handled by tryAnswerFromFaq, if it reaches here it's unknown
      return { type: "unknown", keywords };
    }

    return { type: "unknown", keywords };
  }
}
