import { Injectable, Logger } from "@nestjs/common";
import axios from "axios";
import polyline from "@mapbox/polyline";

export interface OrsRoute {
  index: number;
  summary: string;
  distanceKm: number;
  durationMin: number;
  encodedPolyline: string;
}

@Injectable()
export class OrsService {
  private readonly logger = new Logger(OrsService.name);

  async getRoutes(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
  ): Promise<OrsRoute[]> {
    const apiKey = process.env.ORS_API_KEY;
    if (!apiKey) {
      this.logger.warn("ORS_API_KEY not set. Cannot fetch routes.");
      return [];
    }

    try {
      const response = await axios.get(
        "https://api.openrouteservice.org/v2/directions/driving-car",
        {
          params: {
            start: `${originLng},${originLat}`,
            end: `${destLng},${destLat}`,
          },
          headers: { 
            Authorization: apiKey,
            Accept: "application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8"
          },
        },
      );

      return response.data.features.map((f: any, i: number) => {
        const stepName = f.properties.segments?.[0]?.steps?.find(
          (s: any) => s.type === 11,
        )?.name;
        let encodedStr = "";
        if (typeof f.geometry === "string") {
          encodedStr = f.geometry;
        } else if (f.geometry && Array.isArray(f.geometry.coordinates)) {
          const coords = f.geometry.coordinates.map((c: number[]) => [c[1], c[0]]);
          encodedStr = polyline.encode(coords);
        } else if (Array.isArray(f.geometry)) {
          const coords = f.geometry.map((c: number[]) => [c[1], c[0]]);
          encodedStr = polyline.encode(coords);
        }

        return {
          index: i + 1,
          summary: stepName || `Route ${i + 1}`,
          distanceKm: parseFloat(
            (f.properties.summary.distance / 1000).toFixed(1),
          ),
          durationMin: Math.round(f.properties.summary.duration / 60),
          encodedPolyline: encodedStr,
        };
      });
    } catch (error) {
      this.logger.error(`Error fetching routes from ORS: ${error}`);
      return [];
    }
  }
}
