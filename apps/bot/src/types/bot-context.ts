import { Context, Scenes } from "telegraf";
import type { PlaceResult } from "../modules/carpool/photon.service";
import type { OrsRoute } from "../modules/carpool/ors.service";

export interface BotSceneSessionData extends Scenes.SceneSessionData {}

export interface BotSession extends Scenes.SceneSession<BotSceneSessionData> {
  onboarding?: {
    step?:
      | "name"
      | "flat"
      | "phone"
      | "vehicle_choice"
      | "vehicle_number"
      | "vehicle_type"
      | "vehicle_color"
      | "vehicle_model"
      | "vehicle_parking";
    name?: string;
    flatNumber?: string;
    phone?: string;
    vehicle?: {
      number?: string;
      type?: string;
      color?: string;
      model?: string;
      parkingSlot?: string;
    };
  };
  profile?: {
    editing?: "name" | "flatNumber" | "phone";
  };
  vehicles?: {
    mode?: "adding" | "editing";
    step?: "number" | "type" | "color" | "model" | "parkingSlot";
    selectedId?: string;
    draft?: {
      number?: string;
      type?: string;
      color?: string;
      model?: string;
      parkingSlot?: string;
    };
  };
  workers?: {
    mode?: "adding" | "editing";
    step?: "name" | "phone" | "category" | "notes" | "field";
    selectedId?: string;
    editField?: "name" | "phone" | "category" | "notes";
    browseCategory?: string;
    page?: number;
    draft?: {
      name?: string;
      phone?: string;
      category?: string;
      notes?: string | null;
    };
  };
  microServices?: {
    mode?: "creating" | "editing" | "browsing";
    step?:
      | "name"
      | "category"
      | "description"
      | "timing"
      | "contactPreference"
      | "field";
    editField?:
      | "name"
      | "category"
      | "description"
      | "timing"
      | "contactPreference";
    browseCategory?: string;
    draft?: {
      name?: string;
      category?: string;
      description?: string | null;
      timing?: string;
      contactPreference?: "phone" | "telegram";
    };
  };
  carpool?: {
    step?:
      | "start"
      | "destination"
      | "departureTime"
      | "returnTime"
      | "oneTimeDate"
      | "pickup_location"
      | "time_filter";
    searchDirection?: string;
    postDraft?: {
      startAddress?: string;
      startLat?: number;
      startLng?: number;
      destinationAddress?: string;
      destinationLat?: number;
      destinationLng?: number;
      morningPolyline?: string;
      morningDistanceKm?: number;
      morningDurationMin?: number;
      departureTime?: string;
      type?: "RECURRING" | "ONE_TIME";
      recurringDays?: string[];
      oneTimeDate?: Date;
      seatsAvailable?: number;
      hasReturn?: boolean;
      returnTime?: string | null;
      returnPolyline?: string | null;
      returnSeatsAvailable?: number | null;
    };
    searchDraft?: {
      destinationText?: string;
      startAddress?: string;
      startLat?: number;
      startLng?: number;
      pickupAddress?: string;
      pickupLat?: number;
      pickupLng?: number;
    };
    placeResults?: PlaceResult[];
    /** Morning-direction route options from ORS */
    morningRouteResults?: OrsRoute[];
    /** Return-direction route options from ORS */
    returnRouteResults?: OrsRoute[];
    selectedRouteId?: string;
    rideDirection?: string;
    rideRequests?: any[];
  };
  search?: {
    awaitingQuery?: boolean;
  };
  foundItem?: {
    fileId: string;
    originalDescription?: string;
    collectionLocation?: string;
    aiDescription?: string;
  };
  foundItemStep?: "photo" | "description" | "location";
  lostItem?: {
    originalDescription?: string;
    aiDescription?: string;
  };
  lostItemStep?: "description";

  /**
   * Persistent AI conversation session.
   * History is reset automatically when idle for > 10 minutes.
   * Stored in the existing BotSession table — no schema migration needed.
   */
  aiChat?: {
    /** Conversation turns (user + assistant), capped at 20 entries. */
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    /** Timestamp of the last message — used to detect 10-min idle. */
    lastMessageAt: number;
  };

  __lastActivity?: number;
}

export type BotContext = Context &
  Omit<Scenes.SceneContext<BotSceneSessionData>, "session"> & {
    session: BotSession;
  };
