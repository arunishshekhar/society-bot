export type AdminRecord = Record<string, unknown>;

const apiBase = process.env.ADMIN_API_URL ?? 'http://localhost:3001';

export async function adminFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  if (!process.env.ADMIN_API_KEY) return null;

  try {
    const response = await fetch(`${apiBase}${path}`, {
      ...init,
      cache: 'no-store',
      headers: {
        'content-type': 'application/json',
        'x-admin-api-key': process.env.ADMIN_API_KEY,
        ...init?.headers,
      },
    });

    if (!response.ok) return null;
    return response.json() as Promise<T>;
  } catch {
    // Network error, DNS failure, connection refused, etc.
    return null;
  }
}

export function text(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}
