import { Injectable } from "@nestjs/common";
import polyline from "@mapbox/polyline";
import { PrismaService } from "../../prisma/prisma.service";
import { CarpoolRoute, Resident, Direction } from "@prisma/client";

export interface MatchResult {
  route: CarpoolRoute & { resident: Resident };
  distanceMeters: number;
  onRoute: boolean;
}

@Injectable()
export class PolylineService {
  constructor(private readonly prisma: PrismaService) {}

  async findMatchingRoutes(
    seekerLat: number,
    seekerLng: number,
    requestedTime: string | null,
    direction: Direction,
    destinationQuery?: string | null,
    /** Exclude the seeker's own routes (#12) */
    seekerResidentId?: string,
  ): Promise<MatchResult[]> {
    const routes = await this.prisma.carpoolRoute.findMany({
      where: {
        isPaused: false,
        // Fix #3: filter by the correct seat column per direction
        ...(direction === "RETURN"
          ? { hasReturn: true, returnSeatsAvailable: { gt: 0 } }
          : { seatsAvailable: { gt: 0 } }),
        // Fix #12: exclude the seeker's own routes
        ...(seekerResidentId ? { residentId: { not: seekerResidentId } } : {}),
        ...(destinationQuery
          ? {
              destinationAddress: {
                contains: destinationQuery,
                mode: "insensitive",
              },
            }
          : {}),
      },
      include: { resident: true },
    });

    const results: MatchResult[] = [];

    for (const route of routes) {
      let routePolyline =
        direction === "MORNING" ? route.morningPolyline : route.returnPolyline;
      if (!routePolyline) continue;

      let points: [number, number][] = [];
      try {
        points = polyline.decode(routePolyline);
      } catch {
        continue;
      }

      const minDist = this.minDistanceToPolyline(seekerLat, seekerLng, points);

      if (minDist <= 1000) {
        const routeTime =
          direction === "MORNING" ? route.departureTime : route.returnTime;

        if (
          requestedTime &&
          routeTime &&
          !this.isWithin30Min(routeTime, requestedTime)
        ) {
          continue;
        }

        results.push({
          route,
          distanceMeters: Math.round(minDist),
          onRoute: minDist <= 300,
        });
      }
    }

    return results.sort((a, b) => a.distanceMeters - b.distanceMeters);
  }

  private minDistanceToPolyline(
    lat: number,
    lng: number,
    points: [number, number][],
  ): number {
    let min = Infinity;
    for (const [pLat, pLng] of points) {
      const d = this.haversine(lat, lng, pLat, pLng);
      if (d < min) min = d;
    }
    return min;
  }

  private haversine(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private isWithin30Min(time1: string, time2: string): boolean {
    const parse = (t: string) => {
      const match = t.trim().match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (!match) return 0;

      let h = parseInt(match[1]);
      const m = parseInt(match[2]);
      const period = match[3].toUpperCase();

      if (period === "PM" && h !== 12) h += 12;
      if (period === "AM" && h === 12) h = 0;
      return h * 60 + m;
    };
    return Math.abs(parse(time1) - parse(time2)) <= 30;
  }
}
