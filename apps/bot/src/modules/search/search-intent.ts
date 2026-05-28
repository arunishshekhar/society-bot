export type SearchIntentType =
  | "worker"
  | "service"
  | "post_carpool"
  | "find_carpool"
  | "find_return"
  | "inform"
  | "rate_worker"
  | "unknown";

export interface SearchIntent {
  type: SearchIntentType;
  category?: string;
  keywords: string[];
  // Carpool-specific extras extracted by AI
  destination?: string;
  days?: string[];
  time?: string;
  isRecurring?: boolean;
  recurringType?: "weekday" | "weekend" | "both";
  date?: string;
  // Inform-specific extras
  target_type?: "vehicle" | "flat";
  target_id?: string;
  message?: string;
  // Rate-specific extras
  worker_code?: string;
  stars?: number;
}

export function normalizeSearchIntent(value: unknown): SearchIntent {
  if (!value || typeof value !== "object") {
    return { type: "unknown", keywords: [] };
  }

  const record = value as Record<string, unknown>;
  const type = isIntentType(record.type) ? record.type : "unknown";
  const category =
    typeof record.category === "string"
      ? record.category.toLowerCase()
      : undefined;
  const keywords = Array.isArray(record.keywords)
    ? record.keywords
        .filter((keyword): keyword is string => typeof keyword === "string")
        .map((keyword) => keyword.toLowerCase().trim())
        .filter(Boolean)
        .slice(0, 8)
    : [];

  const destination =
    typeof record.destination === "string" && record.destination
      ? record.destination
      : undefined;
  const days = Array.isArray(record.days)
    ? record.days.filter((d): d is string => typeof d === "string")
    : undefined;
  const time =
    typeof record.time === "string" && record.time ? record.time : undefined;
  const isRecurring =
    typeof record.isRecurring === "boolean" ? record.isRecurring : undefined;
  const recurringType =
    typeof record.recurringType === "string" &&
    ["weekday", "weekend", "both"].includes(record.recurringType)
      ? (record.recurringType as any)
      : undefined;
  const date =
    typeof record.date === "string" && record.date ? record.date : undefined;

  const target_type =
    record.target_type === "vehicle" || record.target_type === "flat"
      ? record.target_type
      : undefined;
  const target_id =
    typeof record.target_id === "string" ? record.target_id : undefined;
  const message =
    typeof record.message === "string" ? record.message : undefined;

  const worker_code =
    typeof record.worker_code === "string" && record.worker_code
      ? record.worker_code.toUpperCase().trim()
      : undefined;
  const stars =
    typeof record.stars === "number" &&
    record.stars >= 1 &&
    record.stars <= 5
      ? Math.round(record.stars)
      : undefined;

  return {
    type,
    category,
    keywords,
    destination,
    days,
    time,
    isRecurring,
    recurringType,
    date,
    target_type,
    target_id,
    message,
    worker_code,
    stars,
  };
}

function isIntentType(value: unknown): value is SearchIntentType {
  return (
    value === "worker" ||
    value === "service" ||
    value === "post_carpool" ||
    value === "find_carpool" ||
    value === "find_return" ||
    value === "inform" ||
    value === "rate_worker" ||
    value === "unknown"
  );
}
