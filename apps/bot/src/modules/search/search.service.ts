import { Injectable } from "@nestjs/common";
import { Markup } from "telegraf";
import Groq from "groq-sdk";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { normalizeSearchIntent, SearchIntent } from "./search-intent";
import { BotContext } from "../../types/bot-context";

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
        "💬 What are you looking for?\n\nExamples:\n• /ask I need a North Indian maid\n• /ask carpool to MG Road on Monday at 8AM\n• /ask plumber for bathroom repair",
      );
      return;
    }

    await ctx.sendChatAction("typing");
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
          pickupAddress: intent.destination,
        },
        step: intent.time
          ? "time_filter"
          : intent.destination
            ? "pickup_location"
            : undefined,
      };
      await ctx.scene.enter("carpool_search");
      // If we already had everything, we'd trigger the next step. For simplicity, just enter the scene.
      // We will emulate text to jump steps if needed, but scene enter will just prompt for the missing parts.
    } else if (intent.type === "inform") {
      await this.replyInform(ctx, intent);
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
Classify each query and extract the following JSON fields:
- type: "worker" | "service" | "post_carpool" | "find_carpool" | "find_return" | "inform" | "unknown"
- category: specific type of worker or service (e.g. "maid", "cook", "plumber", "tutor", "laundry")
- keywords: array of key descriptors (e.g. ["north indian", "experienced", "full time"])
- destination: for carpool queries, the destination location (e.g. "MG Road", "Whitefield")
- time: for carpool queries, departure time mentioned (e.g. "8:00 AM")
- isRecurring: true | false (for carpool)
- recurringType: "weekday" | "weekend" | "both" | null (for carpool)
- date: "YYYY-MM-DD" if specific date mentioned or null (for carpool)
- target_type: for inform queries, "vehicle" or "flat"
- target_id: for inform queries, the flat or vehicle number (e.g. "KA12AS2322", "03-12-03")
- message: for inform queries, the message to relay

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
      ]),
    ];

    const workers = await this.prisma.workerRecommendation.findMany({
      where: {
        isActive: true,
        isBanned: false,
        ...(orClauses.length ? { OR: orClauses } : {}),
      },
      include: { resident: true },
      orderBy: [{ rating: "desc" }, { createdAt: "desc" }],
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
      const stars = w.rating ? "⭐".repeat(Math.min(w.rating, 5)) : "";
      const addedBy = w.resident?.flatNumber
        ? `Flat ${w.resident.flatNumber}`
        : "Admin";
      await ctx.reply(
        `👷 *${w.name}* — ${w.category}${stars ? ` ${stars}` : ""}\n📞 ${w.phone}${w.notes ? `\n📝 ${w.notes}` : ""}\nAdded by: ${addedBy}`,
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
      const number = target_id.trim().replace(/\s+/g, " ").toUpperCase();
      const vehicle = await this.prisma.vehicle.findFirst({
        where: { number: { contains: number } },
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

  // ─── Fallback ────────────────────────────────────────────────────────────────

  private fallbackIntent(query: string): SearchIntent {
    const lower = query.toLowerCase();
    const keywords = lower
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
      .slice(0, 8);

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

    return { type: "unknown", keywords };
  }
}
