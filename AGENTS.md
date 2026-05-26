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
- Environment variables are uppercase: `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_GROUP_ID`, `TELEGRAM_GROUP_INVITE_LINK`, `WEBHOOK_DOMAIN`, `ADMIN_TELEGRAM_IDS`, `ADMIN_API_KEY`, `ADMIN_PASSWORD`, `GROQ_API_KEY`.
- Dashboard env vars: `ADMIN_API_URL` (bot backend URL), `ADMIN_API_KEY` (same value as bot), `ADMIN_PASSWORD`.

## Testing Guidelines

Add focused tests for services, guards, scene state transitions, and admin endpoints. Mock Telegram, Groq, and external network calls. Test onboarding resume behaviour, group membership rejection, soft deletes, broadcast recipient filtering, and `isPaused` versus `isDisabled` behaviour.

## Commit & Pull Request Guidelines

Use concise imperative commits: `Add Prisma schema`, `Implement onboarding scene`, `Fix webhook 404`. Pull requests should include a summary, affected app (`bot`, `dashboard`, or both), migration notes, test results, and screenshots for dashboard UI changes.

## Security & Configuration

- Production bot mode **must** use Telegram webhooks, not polling. `WEBHOOK_DOMAIN` enables webhook mode automatically.
- Guard every bot handler with group membership checks (`GroupMemberGuard`).
- Protect all admin API routes with `AdminApiKeyGuard` (`x-admin-api-key` header).
- Dashboard routes are protected by `proxy.ts` middleware (checks `admin-session` cookie).
- Never commit `.env` files or secrets. Use `.env.example` as the schema.

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
- The `/ask` command uses Groq to classify intent (`worker | service | carpool | unknown`) and extract structured fields (destination, days, time for carpool; category and keywords for workers/services), then queries the DB directly. Do not bypass this pattern.
- Admin API responses that include `Resident` records must go through the BigInt patch or the endpoint will 500.
- The `render.yaml` in the repo root controls Render's build and start commands — update it instead of changing settings in the Render dashboard.
