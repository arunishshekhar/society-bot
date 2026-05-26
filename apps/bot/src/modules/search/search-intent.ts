export type SearchIntentType = 'worker' | 'service' | 'carpool' | 'unknown';

export interface SearchIntent {
  type: SearchIntentType;
  category?: string;
  keywords: string[];
  // Carpool-specific extras extracted by AI
  destination?: string;
  days?: string[];   // e.g. ['Mon', 'Wed']
  time?: string;     // e.g. '8AM', '8:10AM'
}

export function normalizeSearchIntent(value: unknown): SearchIntent {
  if (!value || typeof value !== 'object') {
    return { type: 'unknown', keywords: [] };
  }

  const record = value as Record<string, unknown>;
  const type = isIntentType(record.type) ? record.type : 'unknown';
  const category = typeof record.category === 'string' ? record.category.toLowerCase() : undefined;
  const keywords = Array.isArray(record.keywords)
    ? record.keywords
        .filter((keyword): keyword is string => typeof keyword === 'string')
        .map((keyword) => keyword.toLowerCase().trim())
        .filter(Boolean)
        .slice(0, 8)
    : [];

  const destination = typeof record.destination === 'string' && record.destination ? record.destination : undefined;
  const days = Array.isArray(record.days)
    ? record.days.filter((d): d is string => typeof d === 'string')
    : undefined;
  const time = typeof record.time === 'string' && record.time ? record.time : undefined;

  return { type, category, keywords, destination, days, time };
}

function isIntentType(value: unknown): value is SearchIntentType {
  return value === 'worker' || value === 'service' || value === 'carpool' || value === 'unknown';
}
