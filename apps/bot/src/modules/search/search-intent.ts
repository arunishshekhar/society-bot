export type SearchIntentType = 'worker' | 'service' | 'carpool' | 'unknown';

export interface SearchIntent {
  type: SearchIntentType;
  category?: string;
  keywords: string[];
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

  return { type, category, keywords };
}

function isIntentType(value: unknown): value is SearchIntentType {
  return value === 'worker' || value === 'service' || value === 'carpool' || value === 'unknown';
}
