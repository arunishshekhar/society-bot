# Repository Guidelines

## Project Structure & Module Organization

This repository is for Society Bot, a pnpm monorepo with a NestJS Telegram bot/API and a Next.js admin dashboard. Target layout:

- `apps/bot/`: NestJS app using `nestjs-telegraf`, Prisma, PostgreSQL, and Groq.
- `apps/bot/src/modules/`: feature modules such as `users`, `onboarding`, `vehicles`, `workers`, `microservices`, `carpool`, `search`, `notifications`, and `admin`.
- `apps/bot/src/scenes/`: Telegraf FSM scenes; keep one scene per feature.
- `apps/bot/prisma/schema.prisma`: Prisma schema and migrations for bot data.
- `apps/dashboard/`: Next.js + Tailwind admin UI for residents, vehicle lookup, workers, services, carpool, broadcast, and analytics.

## Build, Test, and Development Commands

The workspace has not been initialized yet. Once created, keep root scripts in `package.json` and prefer pnpm:

- `pnpm install`: install workspace dependencies.
- `pnpm dev:bot`: run the NestJS bot locally.
- `pnpm dev:dashboard`: run the Next.js dashboard.
- `pnpm prisma:migrate`: apply Prisma migrations from `apps/bot`.
- `pnpm test`: run all tests.
- `pnpm lint`: run formatting and static checks.

## Coding Style & Naming Conventions

Use TypeScript throughout. Follow NestJS naming patterns: `*.module.ts`, `*.service.ts`, `*.controller.ts`, `*.guard.ts`, and `*.scene.ts`. Keep modules feature-focused and avoid mixing bot scene logic with admin API logic. Use Prisma models as the source of truth for database shape. Environment variables should be uppercase, for example `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_GROUP_ID`, `ADMIN_TELEGRAM_IDS`, `ADMIN_PASSWORD`, and `GROQ_API_KEY`.

## Testing Guidelines

Add focused tests for services, guards, scene state transitions, and admin endpoints. Mock Telegram, Groq, and external network calls. Test onboarding resume behavior, group membership rejection, soft deletes, broadcast recipient filtering, and `isPaused` versus `isDisabled` behavior.

## Commit & Pull Request Guidelines

There is no commit history yet. Use concise imperative commits such as `Add Prisma schema` or `Implement onboarding scene`. Pull requests should include a summary, affected app (`bot`, `dashboard`, or both), database migration notes, test results, and screenshots for dashboard UI changes.

## Security & Configuration

Production bot mode must use Telegram webhooks, not polling. Guard every bot handler with group membership checks. Protect all admin API routes with an API key and dashboard routes with admin auth. Never commit `.env` files or Telegram, Railway, Groq, or database secrets.

## Agent-Specific Instructions

Start with the foundation: Prisma service and schema migration, group member guard, then `/start` with onboarding. Save after every scene step so flows are resumable. Use inline keyboard callbacks instead of text commands for actions. Groq failures must fall back silently to button-based search.
