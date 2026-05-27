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

  async search(query: string): Promise<PlaceResult[]> {
    try {
      const response = await axios.get("https://photon.komoot.io/api/", {
        params: {
          q: `${query} Bangalore`,
          limit: 5,
          lang: "en",
        },
      });

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
