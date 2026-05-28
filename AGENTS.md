# Repository Guidelines

## Project Structure & Module Organization

This repository is for **Society Bot**, a pnpm monorepo with a NestJS Telegram bot/API and a Next.js admin dashboard. Current layout:

- `apps/bot/`: NestJS app using `nestjs-telegraf`, Prisma, PostgreSQL, and Groq.
- `apps/bot/src/modules/`: feature modules — `search`, `admin`. Scene-heavy features live in `scenes/`.
- `apps/bot/src/scenes/`: Telegraf FSM scenes (one scene per feature): `onboarding`, `profile`, `vehicles`, `workers`, `microservices`, `carpool`, `search`, `settings`.
- `apps/bot/prisma/schema.prisma`: Prisma schema. Run `prisma migrate dev` locally, `prisma migrate deploy` in production.
- `apps/dashboard/`: Next.js + Tailwind admin UI (App Router, server components).
- `render.yaml`: Render deployment config — build and start commands are defined here, not in the Render dashboard.

## Build, Test, and Development Commands

Root scripts (run from repo root with pnpm):

- `pnpm install`: install all workspace dependencies.
- `pnpm dev:bot`: run the NestJS bot locally in polling mode (no `WEBHOOK_DOMAIN` set).
- `pnpm dev:dashboard`: run the Next.js dashboard locally.
- `pnpm build:bot`: compile the bot to `apps/bot/dist/`.
- `pnpm start:bot`: run `prisma migrate deploy && node dist/main.js` (production).
- `pnpm prisma:migrate`: apply Prisma migrations.
- `pnpm test`: run all tests.
- `pnpm lint`: run formatting and static checks.

## Coding Style & Naming Conventions

- TypeScript throughout.
- NestJS patterns: `*.module.ts`, `*.service.ts`, `*.controller.ts`, `*.guard.ts`, `*.scene.ts`.
- Keep modules feature-focused; never mix bot scene logic with admin API logic.
- Prisma models are the source of truth for DB shape.
- Environment variables are uppercase: `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_GROUP_ID`, `TELEGRAM_GROUP_INVITE_LINK`, `WEBHOOK_DOMAIN`, `ADMIN_TELEGRAM_IDS`, `ADMIN_API_KEY`, `ADMIN_PASSWORD`, `GROQ_API_KEY`, `SOCIETY_LAT`, `SOCIETY_LNG`, `ORS_API_KEY`.
- Dashboard env vars: `ADMIN_API_URL` (bot backend URL), `ADMIN_API_KEY` (same value as bot), `ADMIN_PASSWORD`.

## Testing Guidelines

Add focused tests for services, guards, scene state transitions, and admin endpoints. Mock Telegram, Groq, and external network calls. Test onboarding resume behaviour, group membership rejection, soft deletes, broadcast recipient filtering, and `isPaused` versus `isDisabled` behaviour.

## Commit & Pull Request Guidelines

Use concise imperative commits: `Add Prisma schema`, `Implement onboarding scene`, `Fix webhook 404`. Pull requests should include a summary, affected app (`bot`, `dashboard`, or both), migration notes, test results, and screenshots for dashboard UI changes.

## Security & Configuration

- Production bot mode **must** use Telegram webhooks, not polling. `WEBHOOK_DOMAIN` enables webhook mode automatically.
- Guard every bot handler with group membership checks (`GroupMemberGuard`).
- **Strict Onboarding Validation**: All scenes and commands must enforce that a user has successfully completed the onboarding flow. Unregistered users should be forcefully redirected to the onboarding scene.
- Protect all admin API routes with `AdminApiKeyGuard` (`x-admin-api-key` header).
- Dashboard routes are protected by `proxy.ts` middleware. It checks the `admin-session` cookie **against the server-side `validSessions` Set in `lib/sessions.ts`**. A non-empty cookie string alone is NOT sufficient for authentication.
- The Carpool module uses OpenRouteService (ORS) for route polyline encoding and distance calculation. Ensure `ORS_API_KEY` is present in the `.env` file and passed correctly via the `Authorization` header.
- Never commit `.env` files or secrets. Use `.env.example` as the schema.
- **All secret/password comparisons must use `timingSafeEqual` from Node's `crypto` module** — never `===` or `!==` for secrets. Applies to `ADMIN_PASSWORD` in the dashboard login and any future auth checks.

## Ownership & Authorization Rules (CRITICAL — never skip)

Every mutating bot action (edit, delete, pause, start) that targets a user-owned resource **must** verify the requesting user owns that resource before proceeding.

| Resource | Model | Ownership field | Check |
|----------|-------|-----------------|-------|
| Worker recommendations | `WorkerRecommendation` | `residentId` | Before update or delete |
| Vehicles | `Vehicle` | `residentId` | Before update or delete |
| Carpool routes | `CarpoolRoute` | `residentId` | Before delete, pause, or start ride |
| MicroServices | `MicroService` | `residentId` | Use `getOwnService(ctx)` — never fetch by ID alone |

**Pattern to always follow:**

```typescript
const resident = await this.getResident(ctx);  // fetches by ctx.from.id
const record = await this.prisma.X.findUnique({ where: { id } });
if (!record || !resident || record.residentId !== resident.id) {
  await ctx.reply('You can only modify your own records.');
  return;
}
```

**Dynamic Prisma field keys from session state are forbidden.** Always whitelist against an `isEditableField()` guard before using `{ [state.step]: value }` in a Prisma update. Session state can be tampered with via replayed callbacks.

## Admin Account & Ban Rules

- **Never set `isActive: true` in an upsert `update` block** for the `Resident` model. `isActive` is set to `true` only on the `create` path (Prisma default). Setting it in `update` allows a banned user to re-enable their own account by re-running onboarding — this is a security violation.
- `onboardingComplete: true` is safe to set in the `update` block.
- Admin bans (`isActive: false`) applied via the dashboard must remain permanent until an admin explicitly reverses them.

## Carpool Seat Count Rules

Seat counts are **direction-specific**:
- `seatsAvailable` — for MORNING direction
- `returnSeatsAvailable` — for RETURN direction

**Always branch on `direction` when incrementing or decrementing seats:**

```typescript
data: direction === 'MORNING'
  ? { seatsAvailable: { increment: 1 } }
  : { returnSeatsAvailable: { increment: 1 } }
```

This applies in: `carpool.service.ts` (decline/accept), `carpool.scheduler.ts` (expiry), and everywhere else seats are restored. Decrement uses `updateMany` with a `{ gt: 0 }` guard to prevent negative counts — do not change this pattern.

## Carpool Scene Session Safety

- **Never use bare `!` non-null assertions** on `ctx.session.carpool` or `ctx.session.carpool.postDraft` in action handlers. Users can replay stale Telegram inline keyboard messages from previous sessions, making these undefined at runtime.
- Always guard with optional chaining and exit gracefully:

```typescript
const draft = ctx.session.carpool?.postDraft;
if (!draft) {
  await ctx.reply('Session expired. Please start again.');
  return ctx.scene.enter('carpool');
}
```

- Before calling `prisma.carpoolRoute.create()`, **explicitly validate** all required fields (`morningPolyline`, `departureTime`, `type`, `seatsAvailable`, `startLat`, `destinationLat`, etc.) are non-null. Do not rely on TypeScript `!` assertions as a runtime safety mechanism.

## Dashboard Session Authentication

- Session validation is **stateless** — tokens are HMAC-SHA256 signed using `apps/dashboard/lib/session-crypto.ts`.
- `proxy.ts` (Next.js 16 middleware convention) calls `verifySessionToken(session.value)` which recomputes the HMAC using `ADMIN_PASSWORD` and verifies it cryptographically — no shared memory needed.
- The login route (`app/api/login/route.ts`) calls `createSessionToken()` to produce a signed `<uuid>.<hmac-hex>` cookie value.
- This approach works correctly in the **Edge Runtime** (where `proxy.ts` runs) and in the Node.js API route runtime — no in-memory `Set`, no Redis, no DB required.
- **Do not replace `verifySessionToken` with a plain non-empty string check** — that would allow any cookie value to bypass auth.
- For extra security: changing `ADMIN_PASSWORD` invalidates all existing sessions automatically (the HMAC signatures will no longer verify).

## Admin Worker Code Generation

- Worker codes **must be unique**. Always use a retry loop when generating codes — never insert a single random code without collision handling.
- Use `async createWorker()` with a `for` loop that catches Prisma `P2002` (unique constraint) and retries with a new code. Maximum 10 attempts.
- Worker codes are **4 characters** (`A-Z0-9`) = 1,679,616 combinations. Never reduce to 3 characters.

## File Upload Safety

- All `FileInterceptor` usages must include a size limit:

```typescript
@UseInterceptors(FileInterceptor('image', { limits: { fileSize: 5 * 1024 * 1024 } }))
```

- Never use `FileInterceptor('field')` without `limits` for any admin or public-facing endpoint.

## Geocoding & Location Bias

- `PhotonService` biases results using `SOCIETY_LAT` and `SOCIETY_LNG` env vars via Photon's `lat`/`lon` query parameters.
- **Do not hardcode city names** (e.g. appending `" Bangalore"` to queries). Use coordinate bias — it works correctly regardless of city and respects the configured society location.
- If `SOCIETY_LAT`/`SOCIETY_LNG` are `0` or unset, the bias is skipped (global search).

## Validation Rules

Use the helper functions in `apps/bot/src/utils/validation.ts` — do not inline regex:

| Field | Function | Pattern |
|-------|----------|---------|
| Name | `isValidName()` | 2–80 chars (trimmed) |
| Flat number | `isValidFlatNumber()` | Exactly `Tower-Floor-Unit` (3 segments): `/^[a-zA-Z0-9]{1,6}-[a-zA-Z0-9]{1,4}-[a-zA-Z0-9]{1,4}$/` |
| Vehicle number | `isValidVehicleNumber()` | 6–15 chars, must contain a letter |
| Phone | `isValidPhone()` | `/^[+]?[0-9][0-9\s-]{6,18}$/` |

The flat number regex must enforce **exactly 3 segments**. Do not loosen it to accept arbitrary hyphen-separated counts.

## Inform / DM Feature Rules

- Vehicle lookups in the `/ask inform` flow use **exact plate match** (`where: { number }`) — not `contains`. Partial matches allow enumeration of vehicle owners by probing.
- If adding new DM pathways between residents, add per-sender rate limiting (e.g. max 5 per hour) to prevent harassment.

## AI / Groq Prompt Safety

- FAQ content injected into LLM system prompts must be wrapped in XML delimiters to reduce prompt injection surface:

```
<faq_data>
Q: ...
A: ...
</faq_data>
```

- Never concatenate raw user-provided text into system prompt strings without clear delimiters.
- Groq failures **always** fall back to `fallbackIntent()`. Never propagate AI errors to the user.

## Known Technical Gotchas

### Webhook mounting (critical)
`nestjs-telegraf`'s `bot.launch({ webhook })` only registers the webhook URL with Telegram — it does **not** mount a route on the Express HTTP server. Mount it manually in `main.ts` **before** `app.listen()`:

```typescript
// Correct — mount at root so Express doesn't strip the path prefix
expressApp.use(bot.webhookCallback('/telegram-webhook'));

// Wrong — Express strips the prefix before the callback checks req.url
expressApp.use('/telegram-webhook', bot.webhookCallback('/telegram-webhook'));
```

### BigInt serialization
`telegramId` is stored as `BigInt` in Prisma. `JSON.stringify(BigInt(...))` throws by default, causing 500s on all admin endpoints that return residents. Patch globally in `main.ts`:

```typescript
(BigInt.prototype as any).toJSON = function () { return this.toString(); };
```

### Next.js Server Components
Event handlers (`onClick`, `onChange`) cannot be used in server components. Extract interactive elements (delete buttons, confirm dialogs) into dedicated `'use client'` components.

### Vercel env vars
Changing environment variables on Vercel does **not** trigger an automatic redeploy. Always manually redeploy after changing env vars.

## Agent-Specific Instructions

- Save after every scene step so flows are resumable.
- Use inline keyboard callbacks instead of text commands for actions.
- Groq failures must fall back silently to keyword-based search (the `fallbackIntent()` method in `SearchService`).
- The `/ask` command uses Groq to classify intent (`worker | service | carpool | faq | unknown`) and extract structured fields (destination, days, time for carpool; category and keywords for workers/services), then queries the DB directly. Do not bypass this pattern.
- Admin API responses that include `Resident` records must go through the BigInt patch or the endpoint will 500.
- The `render.yaml` in the repo root controls Render's build and start commands — update it instead of changing settings in the Render dashboard.
- **After any code change, run `pnpm build:bot` to verify TypeScript compiles cleanly before committing.**
