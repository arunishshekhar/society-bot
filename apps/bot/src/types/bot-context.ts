import { Context, Scenes } from "telegraf";

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
    step?: "name" | "phone" | "category" | "rating" | "notes" | "field";
    selectedId?: string;
    editField?: "name" | "phone" | "category" | "rating" | "notes";
    browseCategory?: string;
    page?: number;
    draft?: {
      name?: string;
      phone?: string;
      category?: string;
      rating?: number | null;
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
      | "destination"
      | "departureTime"
      | "returnTime"
      | "pickup_location"
      | "time_filter";
    searchDirection?: string;
    postDraft?: {
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
      pickupAddress?: string;
      pickupLat?: number;
      pickupLng?: number;
    };
    placeResults?: any[];
    routeResults?: any[];
    selectedRouteId?: string;
    rideDirection?: string;
    rideRequests?: any[];
  };
  search?: {
    awaitingQuery?: boolean;
  };
  __lastActivity?: number;
}

export type BotContext = Context &
  Omit<Scenes.SceneContext<BotSceneSessionData>, "session"> & {
    session: BotSession;
  };
