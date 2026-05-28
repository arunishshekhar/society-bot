/**
 * Server-side session store.
 *
 * This is a simple in-memory Set, sufficient for a single-instance Render
 * deployment. For multi-instance or serverless, swap for Redis/DB.
 *
 * Tokens are 8-hour UUIDs set in the admin-session cookie on login.
 * The middleware validates against this Set before admitting requests.
 */
export const validSessions = new Set<string>();
