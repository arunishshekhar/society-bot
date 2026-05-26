import { Context, Scenes } from 'telegraf';

export interface BotSceneSessionData extends Scenes.SceneSessionData {}

export interface BotSession extends Scenes.SceneSession<BotSceneSessionData> {
  onboarding?: {
    step?: 'name' | 'flat' | 'phone' | 'vehicle_choice' | 'vehicle_number' | 'vehicle_type' | 'vehicle_color' | 'vehicle_model' | 'vehicle_parking';
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
    editing?: 'name' | 'flatNumber' | 'phone';
  };
  vehicles?: {
    mode?: 'adding' | 'editing';
    step?: 'number' | 'type' | 'color' | 'model' | 'parkingSlot';
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
    mode?: 'adding' | 'editing';
    step?: 'name' | 'phone' | 'category' | 'rating' | 'notes' | 'field';
    selectedId?: string;
    editField?: 'name' | 'phone' | 'category' | 'rating' | 'notes';
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
    mode?: 'creating' | 'editing' | 'browsing';
    step?: 'name' | 'category' | 'description' | 'timing' | 'contactPreference' | 'field';
    editField?: 'name' | 'category' | 'description' | 'timing' | 'contactPreference';
    browseCategory?: string;
    draft?: {
      name?: string;
      category?: string;
      description?: string | null;
      timing?: string;
      contactPreference?: 'phone' | 'telegram';
    };
  };
  carpool?: {
    mode?: 'creating' | 'editing' | 'browsing';
    step?: 'destination' | 'startPoint' | 'departureTime' | 'returnTimeChoice' | 'returnTime' | 'seatsAvailable' | 'days' | 'field';
    selectedId?: string;
    editField?: 'destination' | 'startPoint' | 'departureTime' | 'returnTime' | 'seatsAvailable' | 'days';
    query?: string;
    draft?: {
      destination?: string;
      startPoint?: string | null;
      departureTime?: string;
      returnTime?: string | null;
      seatsAvailable?: number;
      days?: string[];
    };
  };
  search?: {
    awaitingQuery?: boolean;
  };
}

export type BotContext = Context &
  Omit<Scenes.SceneContext<BotSceneSessionData>, 'session'> & {
    session: BotSession;
  };
