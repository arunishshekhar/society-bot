import type { InputJsonValue } from "@prisma/client/runtime/library";

export type ServiceContactPreference = "phone" | "telegram";

export interface ServiceMetadata {
  timing?: string;
  contactPreference: ServiceContactPreference;
}

export function buildServiceMetadata(
  timing: string,
  contactPreference: ServiceContactPreference,
): InputJsonValue {
  return {
    timing: timing.trim(),
    contactPreference,
  };
}

export function readServiceMetadata(value: unknown): ServiceMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { contactPreference: "telegram" };
  }

  const record = value as Record<string, unknown>;
  const contactPreference =
    record.contactPreference === "phone" ? "phone" : "telegram";

  return {
    timing: typeof record.timing === "string" ? record.timing : undefined,
    contactPreference,
  };
}
