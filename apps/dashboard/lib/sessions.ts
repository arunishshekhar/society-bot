/**
 * DEPRECATED — session validation is now stateless.
 *
 * Session tokens are HMAC-SHA256 signed using `lib/session-crypto.ts`.
 * Both the login API route (Node.js) and proxy.ts middleware (Edge Runtime)
 * use `createSessionToken()` / `verifySessionToken()` directly — no shared
 * in-memory state needed.
 *
 * This file is kept to avoid breaking any lingering imports.
 */
export const validSessions = new Set<string>(); // unused
