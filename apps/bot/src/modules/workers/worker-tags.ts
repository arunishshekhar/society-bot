export function deriveWorkerTags(category: string, notes?: string | null) {
  const tokens = new Set<string>();

  category
    .split(/\s+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
    .forEach((token) => tokens.add(token));

  notes
    ?.split(/[^a-zA-Z0-9]+/)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length >= 3)
    .slice(0, 12)
    .forEach((token) => tokens.add(token));

  return [...tokens];
}
