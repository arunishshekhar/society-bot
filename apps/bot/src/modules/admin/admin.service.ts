import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CacheService } from "../../cache/cache.service";

// Cache key constants
const K = {
  faqs: "faqs",
  analytics: "analytics",
  workers: "workers",
  workersCat: (c: string) => `workers:category:${c}`,
  categories: "categories",
  categoriesType: (t: string) => `categories:type:${t}`,
  activeResidents: "activeResidents",
  services: "services",
  broadcasts: "broadcasts",
} as const;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // ── Residents ─────────────────────────────────────────────
  residents(search?: string) {
    return this.prisma.resident.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { flatNumber: { contains: search, mode: "insensitive" } },
            ],
          }
        : undefined,
      include: { vehicles: { select: { id: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  resident(id: string) {
    return this.prisma.resident.findUnique({
      where: { id },
      include: {
        vehicles: { select: { id: true } },
      },
    });
  }

  async updateResident(
    id: string,
    data: {
      name?: string;
      flatNumber?: string;
      phone?: string | null;
      isActive?: boolean;
    },
  ) {
    const result = await this.prisma.resident.update({ where: { id }, data });
    this.cache.delAll(K.activeResidents, K.analytics);
    return result;
  }

  async deleteResident(id: string) {
    const result = await this.prisma.resident.delete({ where: { id } });
    this.cache.delAll(K.activeResidents, K.analytics);
    return result;
  }

  // ── Vehicles ───────────────────────────────────────────────
  vehicleLookup(plate: string) {
    const cleanPlate = plate.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    return this.prisma.vehicle.findMany({
      where: { number: { contains: cleanPlate, mode: "insensitive" } },
      include: { resident: { select: { name: true, flatNumber: true, phone: true } } },
    });
  }

  // ── Workers ────────────────────────────────────────────────
  async workers(category?: string) {
    const key = category ? K.workersCat(category) : K.workers;
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    const result = await this.prisma.workerRecommendation.findMany({
      where: category ? { category } : undefined,
      include: { resident: { select: { flatNumber: true } } },
      orderBy: { createdAt: "desc" },
    });
    this.cache.set(key, result);
    return result;
  }

  async createWorker(data: {
    name: string;
    phone: string;
    category: string;
    notes?: string | null;
  }) {
    // Retry until we find a unique 4-char alphanumeric code.
    // 36^4 = 1,679,616 possibilities — essentially never exhausts for typical use.
    const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    for (let attempt = 0; attempt < 10; attempt++) {
      const workerCode = Array.from(
        { length: 4 },
        () => charset[Math.floor(Math.random() * charset.length)],
      ).join("");
      try {
        const result = await this.prisma.workerRecommendation.create({
          data: {
            workerCode,
            name: data.name,
            phone: data.phone,
            category: data.category,
            tags: [data.category],
            notes: data.notes ?? null,
          },
        });
        this.cache.delAll(K.workers, K.analytics);
        this.cache.delByPrefix("workers:category");
        return result;
      } catch (err: any) {
        // P2002 = Unique constraint violation — try a different code
        if (err?.code !== "P2002") throw err;
      }
    }
    throw new Error("Could not generate a unique worker code after 10 attempts.");
  }

  async updateWorker(
    id: string,
    data: {
      name?: string;
      phone?: string;
      category?: string;
      notes?: string | null;
      isActive?: boolean;
    },
  ) {
    // Explicitly pick known fields — never forward unknown keys to Prisma
    const { name, phone, category, notes, isActive } = data;
    const result = await this.prisma.workerRecommendation.update({
      where: { id },
      data: { name, phone, category, notes, isActive },
    });
    this.cache.delAll(K.workers, K.analytics);
    this.cache.delByPrefix("workers:category");
    return result;
  }

  async deleteWorker(id: string) {
    const result = await this.prisma.workerRecommendation.delete({ where: { id } });
    this.cache.delAll(K.workers, K.analytics);
    this.cache.delByPrefix("workers:category");
    return result;
  }

  async banWorker(id: string) {
    const result = await this.prisma.workerRecommendation.update({
      where: { id },
      data: { isBanned: true, isActive: false },
    });
    this.cache.delAll(K.workers, K.analytics);
    this.cache.delByPrefix("workers:category");
    return result;
  }

  async unbanWorker(id: string) {
    const result = await this.prisma.workerRecommendation.update({
      where: { id },
      data: { isBanned: false, isActive: true },
    });
    this.cache.delAll(K.workers, K.analytics);
    this.cache.delByPrefix("workers:category");
    return result;
  }

  // ── Services ───────────────────────────────────────────────
  async services() {
    const cached = this.cache.get(K.services);
    if (cached !== undefined) return cached;
    const result = await this.prisma.microService.findMany({
      include: { resident: { select: { flatNumber: true } } },
      orderBy: { createdAt: "desc" },
    });
    this.cache.set(K.services, result);
    return result;
  }

  async createService(data: {
    name: string;
    category: string;
    description?: string | null;
    timing?: string;
    contactPreference?: string;
  }) {
    const result = await this.prisma.microService.create({
      data: {
        name: data.name,
        category: data.category,
        description: data.description ?? null,
        metadata: {
          timing: data.timing ?? "",
          contactPreference: data.contactPreference ?? "telegram",
        },
      },
    });
    this.cache.delAll(K.services, K.analytics);
    return result;
  }

  async updateService(
    id: string,
    data: {
      name?: string;
      category?: string;
      description?: string | null;
      isDisabled?: boolean;
      isPaused?: boolean;
    },
  ) {
    const result = await this.prisma.microService.update({ where: { id }, data });
    this.cache.delAll(K.services, K.analytics);
    return result;
  }

  async disableService(id: string, isDisabled = true) {
    const result = await this.prisma.microService.update({
      where: { id },
      data: { isDisabled },
    });
    this.cache.delAll(K.services, K.analytics);
    return result;
  }

  async deleteService(id: string) {
    const result = await this.prisma.microService.delete({ where: { id } });
    this.cache.delAll(K.services, K.analytics);
    return result;
  }

  // ── Carpool ────────────────────────────────────────────────
  carpool() {
    return this.prisma.carpoolRoute.findMany({
      include: { resident: { select: { flatNumber: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async updateCarpool(
    id: string,
    data: {
      destinationAddress?: string;
      departureTime?: string;
      returnTime?: string | null;
      seatsAvailable?: number;
      isPaused?: boolean;
    },
  ) {
    const result = await this.prisma.carpoolRoute.update({ where: { id }, data });
    this.cache.del(K.analytics);
    return result;
  }

  async deleteCarpool(id: string) {
    const result = await this.prisma.carpoolRoute.delete({ where: { id } });
    this.cache.del(K.analytics);
    return result;
  }

  // ── Categories ─────────────────────────────────────────────
  async categories(type?: string) {
    const key = type ? K.categoriesType(type) : K.categories;
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    const result = await this.prisma.category.findMany({
      where: type ? { type } : undefined,
      orderBy: { name: "asc" },
    });
    this.cache.set(key, result);
    return result;
  }

  async createCategory(name: string, type: string) {
    const result = await this.prisma.category.create({
      data: { name: name.trim().toLowerCase(), type },
    });
    this.cache.delAll(K.categories);
    this.cache.delByPrefix("categories:type");
    return result;
  }

  async deleteCategory(id: string) {
    const result = await this.prisma.category.delete({ where: { id } });
    this.cache.delAll(K.categories);
    this.cache.delByPrefix("categories:type");
    return result;
  }

  // ── FAQs ───────────────────────────────────────────────────
  async faqs() {
    const cached = this.cache.get<unknown[]>(K.faqs);
    if (cached !== undefined) return cached;
    const result = await this.prisma.faq.findMany({
      orderBy: { createdAt: "desc" },
    });
    this.cache.set(K.faqs, result);
    return result;
  }

  async createFaq(data: { question: string; answer: string }) {
    const result = await this.prisma.faq.create({
      data: { question: data.question, answer: data.answer },
    });
    this.cache.del(K.faqs);
    return result;
  }

  async updateFaq(id: string, data: { question?: string; answer?: string }) {
    const result = await this.prisma.faq.update({ where: { id }, data });
    this.cache.del(K.faqs);
    return result;
  }

  async deleteFaq(id: string) {
    const result = await this.prisma.faq.delete({ where: { id } });
    this.cache.del(K.faqs);
    return result;
  }

  // ── Analytics + Broadcast ──────────────────────────────────
  async analytics() {
    const cached = this.cache.get(K.analytics);
    if (cached !== undefined) return cached;

    const [
      totalResidents,
      activeServices,
      activeCarpools,
      workerEntries,
      recentResidents,
      workerGroups,
    ] = await Promise.all([
      this.prisma.resident.count(),
      this.prisma.microService.count({
        where: { isPaused: false, isDisabled: false },
      }),
      this.prisma.carpoolRoute.count({ where: { isPaused: false } }),
      this.prisma.workerRecommendation.count({
        where: { isActive: true, isBanned: false },
      }),
      this.prisma.resident.findMany({
        select: { id: true, name: true, flatNumber: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      this.prisma.workerRecommendation.groupBy({
        by: ["category"],
        _count: { category: true },
        orderBy: { _count: { category: "desc" } },
        take: 10,
      }),
    ]);

    const result = {
      totalResidents,
      activeServices,
      activeCarpools,
      workerEntries,
      recentResidents,
      workerGroups,
    };
    this.cache.set(K.analytics, result);
    return result;
  }

  async activeResidents() {
    const cached = this.cache.get<unknown[]>(K.activeResidents);
    if (cached !== undefined) return cached as any[];
    const result = await this.prisma.resident.findMany({
      where: { isActive: true, onboardingComplete: true },
    });
    this.cache.set(K.activeResidents, result);
    return result;
  }

  unregisteredResidents() {
    return this.prisma.resident.findMany({
      where: { isActive: true, onboardingComplete: false },
    });
  }

  async logBroadcast(
    message: string,
    sentBy: string,
    recipients: Array<{ telegramId: bigint; messageId: number }>,
  ) {
    const broadcast = await this.prisma.broadcast.create({
      data: {
        message,
        sentBy,
        recipientCount: recipients.length,
        recipients: {
          create: recipients.map((r) => ({
            id: require("crypto").randomUUID(),
            telegramId: r.telegramId,
            messageId: r.messageId,
          })),
        },
      },
    });
    this.cache.del(K.broadcasts);
    return broadcast;
  }

  async broadcasts() {
    const cached = this.cache.get(K.broadcasts);
    if (cached !== undefined) return cached;
    const result = await this.prisma.broadcast.findMany({
      orderBy: { sentAt: "desc" },
    });
    this.cache.set(K.broadcasts, result);
    return result;
  }

  async deleteBroadcast(id: string, bot: import("telegraf").Telegraf<any>) {
    // Load all recipient records for this broadcast
    const recipients = await this.prisma.broadcastRecipient.findMany({
      where: { broadcastId: id },
    });

    // Attempt to delete each Telegram message — silently ignore failures
    // (user may have blocked the bot, deleted the chat, or the message may be too old)
    for (const r of recipients) {
      try {
        await bot.telegram.deleteMessage(Number(r.telegramId), r.messageId);
      } catch {
        // Non-fatal — Telegram messages older than 48h cannot be deleted by bots
      }
    }

    // Delete the broadcast log (cascade deletes BroadcastRecipient rows)
    const result = await this.prisma.broadcast.delete({ where: { id } });
    this.cache.del(K.broadcasts);
    return result;
  }

  // ── Lost & Found ───────────────────────────────────────────
  foundItems(status?: string) {
    const VALID_STATUSES = ['OPEN', 'RESOLVED'] as const;
    type LFStatus = typeof VALID_STATUSES[number];
    const validStatus = VALID_STATUSES.includes(status as LFStatus) ? (status as LFStatus) : undefined;
    return this.prisma.foundItem.findMany({
      where: validStatus ? { status: validStatus } : undefined,
      include: { reportedBy: { select: { name: true, flatNumber: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  foundItem(id: string) {
    return this.prisma.foundItem.findUnique({
      where: { id },
      include: { reportedBy: true, matches: true },
    });
  }

  async resolveFoundItem(id: string) {
    const foundItem = await this.prisma.foundItem.findUnique({
      where: { id },
      include: { matches: true },
    });
    
    if (foundItem?.matches?.length) {
      for (const match of foundItem.matches) {
        await this.prisma.lostItem.update({
          where: { id: match.lostItemId },
          data: { status: "RESOLVED", resolvedAt: new Date() },
        }).catch(() => {});
      }
    }

    return this.prisma.foundItem.update({
      where: { id },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });
  }

  deleteFoundItem(id: string) {
    return this.prisma.foundItem.delete({ where: { id } });
  }

  lostItems(status?: string) {
    const VALID_STATUSES = ['OPEN', 'RESOLVED'] as const;
    type LFStatus = typeof VALID_STATUSES[number];
    const validStatus = VALID_STATUSES.includes(status as LFStatus) ? (status as LFStatus) : undefined;
    return this.prisma.lostItem.findMany({
      where: validStatus ? { status: validStatus } : undefined,
      include: { reportedBy: { select: { name: true, flatNumber: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  lostItem(id: string) {
    return this.prisma.lostItem.findUnique({
      where: { id },
      include: { reportedBy: true, matches: true },
    });
  }

  async resolveLostItem(id: string) {
    const lostItem = await this.prisma.lostItem.findUnique({
      where: { id },
      include: { matches: true },
    });
    
    if (lostItem?.matches?.length) {
      for (const match of lostItem.matches) {
        await this.prisma.foundItem.update({
          where: { id: match.foundItemId },
          data: { status: "RESOLVED", resolvedAt: new Date() },
        }).catch(() => {});
      }
    }

    return this.prisma.lostItem.update({
      where: { id },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });
  }

  deleteLostItem(id: string) {
    return this.prisma.lostItem.delete({ where: { id } });
  }

  lostFoundMatches() {
    return this.prisma.lostFoundMatch.findMany({
      include: {
        foundItem: { select: { originalDescription: true } },
        lostItem: { select: { originalDescription: true } },
      },
      orderBy: { notifiedAt: "desc" },
    });
  }
}
