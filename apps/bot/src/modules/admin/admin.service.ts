import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

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

  vehicleLookup(plate: string) {
    return this.prisma.vehicle.findFirst({
      where: { number: { equals: plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() } },
      include: { resident: true },
    });
  }

  workers(category?: string) {
    return this.prisma.workerRecommendation.findMany({
      where: category ? { category } : undefined,
      include: { resident: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  deleteWorker(id: string) {
    return this.prisma.workerRecommendation.delete({ where: { id } });
  }

  banWorker(id: string) {
    return this.prisma.workerRecommendation.update({ where: { id }, data: { isBanned: true, isActive: false } });
  }

  services() {
    return this.prisma.microService.findMany({ include: { resident: true }, orderBy: { createdAt: 'desc' } });
  }

  disableService(id: string, isDisabled = true) {
    return this.prisma.microService.update({ where: { id }, data: { isDisabled } });
  }

  carpool() {
    return this.prisma.carpoolRoute.findMany({ include: { resident: true }, orderBy: { createdAt: 'desc' } });
  }

  deleteCarpool(id: string) {
    return this.prisma.carpoolRoute.delete({ where: { id } });
  }

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
