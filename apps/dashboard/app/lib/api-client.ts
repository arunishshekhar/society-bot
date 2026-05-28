/**
 * Shared API client for dashboard server actions.
 * All calls go through the bot admin API with the API key header.
 */

const api = process.env.ADMIN_API_URL ?? 'http://localhost:3001';
const key = process.env.ADMIN_API_KEY ?? '';

export async function apiFetch(
  path: string,
  method: string,
  body?: unknown,
): Promise<boolean> {
  try {
    const res = await fetch(`${api}${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-admin-api-key': key },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export { api, key };
