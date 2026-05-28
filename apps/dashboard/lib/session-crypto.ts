/**
 * Stateless session signing utilities using the Web Crypto API.
 *
 * Works in both Edge Runtime (middleware) and Node.js (API routes) — no
 * shared in-memory state required.
 *
 * The cookie value is:  <uuid>.<hex-hmac-sha256>
 * The HMAC is computed over the uuid using ADMIN_PASSWORD as the key.
 * The middleware verifies the HMAC on every request — no Set/DB needed.
 */

const SECRET_PREFIX = 'sb-session-v1:';

async function getCryptoKey(): Promise<CryptoKey> {
  const secret = process.env.ADMIN_PASSWORD ?? '';
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRET_PREFIX + secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/** Sign a random token and return the full cookie value: `<token>.<signature>` */
export async function createSessionToken(): Promise<string> {
  const token = crypto.randomUUID();
  const key = await getCryptoKey();
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(token),
  );
  const sigHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${token}.${sigHex}`;
}

/** Verify a cookie value created by `createSessionToken`. Returns true if valid. */
export async function verifySessionToken(value: string): Promise<boolean> {
  if (!process.env.ADMIN_PASSWORD) return false;
  const dot = value.lastIndexOf('.');
  if (dot === -1) return false;
  const token = value.slice(0, dot);
  const sigHex = value.slice(dot + 1);
  if (!token || !sigHex) return false;

  try {
    const key = await getCryptoKey();
    const sigBytes = new Uint8Array(
      sigHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)),
    );
    return await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      new TextEncoder().encode(token),
    );
  } catch {
    return false;
  }
}
