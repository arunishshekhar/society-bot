export type AdminRecord = Record<string, unknown>;

const apiBase = process.env.ADMIN_API_URL ?? 'http://localhost:3001';

export async function adminFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  if (!process.env.ADMIN_API_KEY) {
    console.error('[adminFetch] ADMIN_API_KEY is not set — check Vercel environment variables');
    return null;
  }

  const url = `${apiBase}${path}`;

  try {
    const response = await fetch(url, {
      ...init,
      cache: 'no-store',
      headers: {
        'content-type': 'application/json',
        'x-admin-api-key': process.env.ADMIN_API_KEY,
        ...init?.headers,
      },
    });

    if (!response.ok) {
      console.error(`[adminFetch] ${init?.method ?? 'GET'} ${url} → ${response.status} ${response.statusText}`);
      return null;
    }
    return response.json() as Promise<T>;
  } catch (err) {
    console.error(`[adminFetch] ${init?.method ?? 'GET'} ${url} → network error:`, err);
    return null;
  }
}

export function text(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}
