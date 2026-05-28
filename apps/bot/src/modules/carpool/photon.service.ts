import { Injectable, Logger } from "@nestjs/common";
import axios from "axios";

export interface PlaceResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

@Injectable()
export class PhotonService {
  private readonly logger = new Logger(PhotonService.name);
  // Bias geocoding results toward the society's location
  private readonly societyLat = parseFloat(process.env.SOCIETY_LAT ?? "0");
  private readonly societyLng = parseFloat(process.env.SOCIETY_LNG ?? "0");

  async search(query: string): Promise<PlaceResult[]> {
    try {
      const params: Record<string, unknown> = {
        q: query,
        limit: 5,
        lang: "en",
      };
      // Only apply location bias when coordinates are configured
      if (this.societyLat !== 0 && this.societyLng !== 0) {
        params.lat = this.societyLat;
        params.lon = this.societyLng;
      }

      const response = await axios.get("https://photon.komoot.io/api/", { params });

      return response.data.features.map((f: any) => ({
        name: f.properties.name,
        address: [f.properties.street, f.properties.city]
          .filter(Boolean)
          .join(", "),
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
      }));
    } catch (error) {
      this.logger.error(`Error searching photon: ${error}`);
      return [];
    }
  }
}
