import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

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

  updateResident(
    id: string,
    data: {
      name?: string;
      flatNumber?: string;
      phone?: string | null;
      isActive?: boolean;
    },
  ) {
    return this.prisma.resident.update({ where: { id }, data });
  }

  deleteResident(id: string) {
    return this.prisma.resident.delete({ where: { id } });
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
  workers(category?: string) {
    return this.prisma.workerRecommendation.findMany({
      where: category ? { category } : undefined,
      include: { resident: { select: { flatNumber: true } } },
      orderBy: { createdAt: "desc" },
    });
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
        return await this.prisma.workerRecommendation.create({
          data: {
            workerCode,
            name: data.name,
            phone: data.phone,
            category: data.category,
            tags: [data.category],
            notes: data.notes ?? null,
          },
        });
      } catch (err: any) {
        // P2002 = Unique constraint violation — try a different code
        if (err?.code !== "P2002") throw err;
      }
    }
    throw new Error("Could not generate a unique worker code after 10 attempts.");
  }

  updateWorker(
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
    return this.prisma.workerRecommendation.update({
      where: { id },
      data: { name, phone, category, notes, isActive },
    });
  }

  deleteWorker(id: string) {
    return this.prisma.workerRecommendation.delete({ where: { id } });
  }

  banWorker(id: string) {
    return this.prisma.workerRecommendation.update({
      where: { id },
      data: { isBanned: true, isActive: false },
    });
  }

  unbanWorker(id: string) {
    return this.prisma.workerRecommendation.update({
      where: { id },
      data: { isBanned: false, isActive: true },
    });
  }

  // ── Services ───────────────────────────────────────────────
  services() {
    return this.prisma.microService.findMany({
      include: { resident: { select: { flatNumber: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  createService(data: {
    name: string;
    category: string;
    description?: string | null;
    timing?: string;
    contactPreference?: string;
  }) {
    return this.prisma.microService.create({
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
  }

  updateService(
    id: string,
    data: {
      name?: string;
      category?: string;
      description?: string | null;
      isDisabled?: boolean;
      isPaused?: boolean;
    },
  ) {
    return this.prisma.microService.update({ where: { id }, data });
  }

  disableService(id: string, isDisabled = true) {
    return this.prisma.microService.update({
      where: { id },
      data: { isDisabled },
    });
  }

  deleteService(id: string) {
    return this.prisma.microService.delete({ where: { id } });
  }

  // ── Carpool ────────────────────────────────────────────────
  carpool() {
    return this.prisma.carpoolRoute.findMany({
      include: { resident: { select: { flatNumber: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  updateCarpool(
    id: string,
    data: {
      destinationAddress?: string;
      departureTime?: string;
      returnTime?: string | null;
      seatsAvailable?: number;
      isPaused?: boolean;
    },
  ) {
    return this.prisma.carpoolRoute.update({ where: { id }, data });
  }

  deleteCarpool(id: string) {
    return this.prisma.carpoolRoute.delete({ where: { id } });
  }

  // ── Categories ─────────────────────────────────────────────
  categories(type?: string) {
    return this.prisma.category.findMany({
      where: type ? { type } : undefined,
      orderBy: { name: "asc" },
    });
  }

  createCategory(name: string, type: string) {
    return this.prisma.category.create({
      data: { name: name.trim().toLowerCase(), type },
    });
  }

  deleteCategory(id: string) {
    return this.prisma.category.delete({ where: { id } });
  }

  // ── FAQs ───────────────────────────────────────────────────
  faqs() {
    return this.prisma.faq.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  createFaq(data: { question: string; answer: string }) {
    return this.prisma.faq.create({
      data: {
        question: data.question,
        answer: data.answer,
      },
    });
  }

  updateFaq(id: string, data: { question?: string; answer?: string }) {
    return this.prisma.faq.update({ where: { id }, data });
  }

  deleteFaq(id: string) {
    return this.prisma.faq.delete({ where: { id } });
  }

  // ── Analytics + Broadcast ──────────────────────────────────
  async analytics() {
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

    return {
      totalResidents,
      activeServices,
      activeCarpools,
      workerEntries,
      recentResidents,
      workerGroups,
    };
  }

  activeResidents() {
    return this.prisma.resident.findMany({
      where: { isActive: true, onboardingComplete: true },
    });
  }

  logBroadcast(message: string, sentBy: string, recipientCount: number) {
    return this.prisma.broadcast.create({
      data: { message, sentBy, recipientCount },
    });
  }

  // ── Lost & Found ───────────────────────────────────────────
  foundItems(status?: string) {
    return this.prisma.foundItem.findMany({
      where: status ? { status: status as any } : undefined,
      include: { reportedBy: { select: { name: true, flatNumber: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  foundItem(id: string) {
    return this.prisma.foundItem.findUnique({
      where: { id },
      include: { reportedBy: true, matches: true },
    });
  }

  resolveFoundItem(id: string) {
    return this.prisma.foundItem.update({
      where: { id },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });
  }

  deleteFoundItem(id: string) {
    return this.prisma.foundItem.delete({ where: { id } });
  }

  lostItems(status?: string) {
    return this.prisma.lostItem.findMany({
      where: status ? { status: status as any } : undefined,
      include: { reportedBy: { select: { name: true, flatNumber: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  lostItem(id: string) {
    return this.prisma.lostItem.findUnique({
      where: { id },
      include: { reportedBy: true, matches: true },
    });
  }

  resolveLostItem(id: string) {
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
