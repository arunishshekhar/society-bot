import { Prisma } from '@prisma/client';

export type ServiceContactPreference = 'phone' | 'telegram';

export interface ServiceMetadata {
  timing?: string;
  contactPreference: ServiceContactPreference;
}

export function buildServiceMetadata(
  timing: string,
  contactPreference: ServiceContactPreference,
): Prisma.InputJsonValue {
  return {
    timing: timing.trim(),
    contactPreference,
  };
}

export function readServiceMetadata(value: Prisma.JsonValue): ServiceMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { contactPreference: 'telegram' };
  }

  const record = value as Record<string, unknown>;
  const contactPreference =
    record.contactPreference === 'phone' ? 'phone' : 'telegram';

  return {
    timing: typeof record.timing === 'string' ? record.timing : undefined,
    contactPreference,
  };
}
