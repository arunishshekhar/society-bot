import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Residents ─────────────────────────────────────────────
  residents(search?: string) {
    return this.prisma.resident.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { flatNumber: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: { vehicles: true, microService: true, carpoolRoutes: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  resident(id: string) {
    return this.prisma.resident.findUnique({
      where: { id },
      include: { vehicles: true, microService: true, carpoolRoutes: true, workerRecs: true },
    });
  }

  updateResident(id: string, data: { name?: string; flatNumber?: string; phone?: string | null; isActive?: boolean }) {
    return this.prisma.resident.update({ where: { id }, data });
  }

  deleteResident(id: string) {
    return this.prisma.resident.delete({ where: { id } });
  }

  // ── Vehicles ───────────────────────────────────────────────
  vehicleLookup(plate: string) {
    return this.prisma.vehicle.findFirst({
      where: { number: { equals: plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() } },
      include: { resident: true },
    });
  }

  // ── Workers ────────────────────────────────────────────────
  workers(category?: string) {
    return this.prisma.workerRecommendation.findMany({
      where: category ? { category } : undefined,
      include: { resident: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  createWorker(data: { name: string; phone: string; category: string; rating?: number | null; notes?: string | null }) {
    return this.prisma.workerRecommendation.create({
      data: {
        name: data.name,
        phone: data.phone,
        category: data.category,
        tags: [data.category],
        rating: data.rating ?? null,
        notes: data.notes ?? null,
      },
    });
  }

  updateWorker(id: string, data: { name?: string; phone?: string; category?: string; rating?: number | null; notes?: string | null; isActive?: boolean }) {
    return this.prisma.workerRecommendation.update({ where: { id }, data });
  }

  deleteWorker(id: string) {
    return this.prisma.workerRecommendation.delete({ where: { id } });
  }

  banWorker(id: string) {
    return this.prisma.workerRecommendation.update({ where: { id }, data: { isBanned: true, isActive: false } });
  }

  unbanWorker(id: string) {
    return this.prisma.workerRecommendation.update({ where: { id }, data: { isBanned: false, isActive: true } });
  }

  // ── Services ───────────────────────────────────────────────
  services() {
    return this.prisma.microService.findMany({ include: { resident: true }, orderBy: { createdAt: 'desc' } });
  }

  createService(data: { name: string; category: string; description?: string | null; timing?: string; contactPreference?: string }) {
    return this.prisma.microService.create({
      data: {
        name: data.name,
        category: data.category,
        description: data.description ?? null,
        metadata: {
          timing: data.timing ?? '',
          contactPreference: data.contactPreference ?? 'telegram',
        },
      },
    });
  }

  updateService(id: string, data: { name?: string; category?: string; description?: string | null; isDisabled?: boolean; isPaused?: boolean }) {
    return this.prisma.microService.update({ where: { id }, data });
  }

  disableService(id: string, isDisabled = true) {
    return this.prisma.microService.update({ where: { id }, data: { isDisabled } });
  }

  deleteService(id: string) {
    return this.prisma.microService.delete({ where: { id } });
  }

  // ── Carpool ────────────────────────────────────────────────
  carpool() {
    return this.prisma.carpoolRoute.findMany({ include: { resident: true }, orderBy: { createdAt: 'desc' } });
  }

  updateCarpool(id: string, data: { destination?: string; departureTime?: string; returnTime?: string | null; seatsAvailable?: number; isPaused?: boolean }) {
    return this.prisma.carpoolRoute.update({ where: { id }, data });
  }

  deleteCarpool(id: string) {
    return this.prisma.carpoolRoute.delete({ where: { id } });
  }

  // ── Categories ─────────────────────────────────────────────
  categories(type?: string) {
    return this.prisma.category.findMany({
      where: type ? { type } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  createCategory(name: string, type: string) {
    return this.prisma.category.create({ data: { name: name.trim().toLowerCase(), type } });
  }

  deleteCategory(id: string) {
    return this.prisma.category.delete({ where: { id } });
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
      this.prisma.microService.count({ where: { isPaused: false, isDisabled: false } }),
      this.prisma.carpoolRoute.count({ where: { isPaused: false } }),
      this.prisma.workerRecommendation.count({ where: { isActive: true, isBanned: false } }),
      this.prisma.resident.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
      this.prisma.workerRecommendation.groupBy({
        by: ['category'],
        _count: { category: true },
        orderBy: { _count: { category: 'desc' } },
        take: 10,
      }),
    ]);

    return { totalResidents, activeServices, activeCarpools, workerEntries, recentResidents, workerGroups };
  }

  activeResidents() {
    return this.prisma.resident.findMany({ where: { isActive: true, onboardingComplete: true } });
  }

  logBroadcast(message: string, sentBy: string, recipientCount: number) {
    return this.prisma.broadcast.create({ data: { message, sentBy, recipientCount } });
  }
}
