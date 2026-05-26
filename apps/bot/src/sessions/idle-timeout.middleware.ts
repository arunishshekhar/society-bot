import { BotContext } from '../types/bot-context';

const IDLE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Clears all scene-specific session data and the Telegraf scene pointer
 * when the user has been inactive for more than IDLE_TIMEOUT_MS.
 *
 * NOTE: In webhook mode the bot only receives updates when the user
 * sends a message, so this fires on the *next* message after the
 * timeout — not autonomously. That is the standard Telegram bot behaviour.
 */
export function createIdleTimeoutMiddleware() {
  return async (ctx: BotContext, next: () => Promise<void>) => {
    const now = Date.now();
    const session = ctx.session;
    const last = session.__lastActivity;

    if (last && now - last > IDLE_TIMEOUT_MS) {
      // Check whether the user is currently inside a scene
      const scenesState = (session as Record<string, unknown>).__scenes as
        | { current?: string }
        | undefined;

      if (scenesState?.current) {
        // Clear all per-scene state
        session.onboarding = undefined;
        session.profile = {};
        session.vehicles = {};
        session.workers = {};
        session.microServices = {};
        session.carpool = {};
        session.search = {};
        // Clear Telegraf's internal scene pointer so the next update
        // is processed by the global handlers, not a stale scene.
        (session as Record<string, unknown>).__scenes = {};

        // Notify the user only on text/command messages (not callbacks)
        if (ctx.message) {
          await ctx.reply(
            '⏱ Your session timed out after 2 minutes of inactivity.\n\nUse /menu to start fresh or /ask to search.',
          );
        }
      }
    }

    // Always refresh the activity timestamp
    session.__lastActivity = now;
    return next();
  };
}
