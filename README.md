# Society Bot

A Telegram-based management system for housing societies. Residents interact entirely through a Telegram bot — no app install required. Admins manage everything through a lightweight web dashboard.

---

## Features

| Feature | Description |
|---|---|
| **Resident Onboarding** | Step-by-step registration via Telegram with resume support (restart anytime, progress is saved) |
| **Vehicle Registry** | Register vehicles linked to resident profile; admin vehicle lookup by plate number |
| **Worker Recommendations** | Add, browse, and rate plumbers, electricians, maids and more; crowdsourced avg ratings |
| **Micro-Services Directory** | List and browse resident-run home businesses (tiffin, tutoring, laundry, etc.) |
| **Carpool Matching** | Post commute routes with polyline + timing; browse and request seats by destination/day |
| **AI Search & FAQ (`/ask`)** | Natural language search across workers, services, carpools, and FAQs via Groq; keyword fallback |
| **Lost & Found** | Report found/lost items with photo + AI description; automatic cross-matching with Telegram notification |
| **Admin Dashboard** | Manage all entities, broadcast announcements, reprocess lost-found matches, view analytics |
| **Access Control** | Telegram group membership + completed onboarding required for all bot features |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Bot runtime | NestJS + nestjs-telegraf (Telegraf v4) |
| Database | PostgreSQL (Neon) + Prisma ORM |
| AI / LLM | Groq API — `llama-3.1-8b-instant` (search & lost-found enrichment), `meta-llama/llama-4-scout-17b-16e-instruct` (vision, found item description) |
| Geocoding | Photon (komoot) — biased to society coordinates via `SOCIETY_LAT`/`SOCIETY_LNG` |
| Routing | OpenRouteService (ORS) — carpool polylines, distance, duration |
| Admin UI | Next.js 16 (App Router) + Tailwind CSS + shadcn/ui |
| Session auth | HMAC-SHA256 signed cookies via Web Crypto API (stateless, Edge Runtime compatible) |
| Backend hosting | Render (webhook mode in production) |
| Frontend hosting | Vercel |
| Package manager | pnpm 9 (monorepo) |

---

## Project Structure

```
society-bot/
├── apps/
│   ├── bot/                              # NestJS — Telegram bot + REST admin API
│   │   ├── src/
│   │   │   ├── app.module.ts             # Root module
│   │   │   ├── app.update.ts             # Top-level command handlers (/start, /menu, /ask, lf_ callbacks)
│   │   │   ├── main.ts                   # Bootstrap: webhook mount, BigInt patch, retry logic
│   │   │   ├── modules/
│   │   │   │   ├── admin/                # REST API (guarded by x-admin-api-key)
│   │   │   │   │   ├── admin.controller.ts   # All /admin/* endpoints
│   │   │   │   │   ├── admin.service.ts      # DB queries for admin operations
│   │   │   │   │   └── admin-api-key.guard.ts
│   │   │   │   ├── carpool/
│   │   │   │   │   ├── carpool.service.ts    # Accept/decline requests, seat management
│   │   │   │   │   ├── carpool.scheduler.ts  # Cron: expire stale requests, restore seats
│   │   │   │   │   ├── ors.service.ts        # OpenRouteService polyline + distance
│   │   │   │   │   ├── photon.service.ts     # Geocoding with society coordinate bias
│   │   │   │   │   └── polyline.service.ts   # Polyline encode/decode
│   │   │   │   ├── lost-found/
│   │   │   │   │   ├── lost-found.ai.ts      # Groq Vision (found) + text enrichment (lost)
│   │   │   │   │   ├── lost-found.search.ts  # Groq semantic match + keyword fallback
│   │   │   │   │   └── lost-found.service.ts # Save items, scan matches, send Telegram notifications
│   │   │   │   ├── search/
│   │   │   │   │   ├── search.service.ts     # /ask intent classification + DB queries
│   │   │   │   │   └── search-intent.ts      # Intent type definitions
│   │   │   │   └── workers/
│   │   │   │       ├── rating.service.ts     # Worker rating CRUD + avg calculation
│   │   │   │       └── worker-tags.ts        # Tag derivation from category + notes
│   │   │   ├── scenes/                   # Telegraf FSM scenes (one per feature)
│   │   │   │   ├── onboarding.scene.ts   # Registration flow (name, flat, phone)
│   │   │   │   ├── profile.scene.ts      # View/edit own profile
│   │   │   │   ├── vehicle.scene.ts      # Add/edit/delete vehicles
│   │   │   │   ├── worker.scene.ts       # Add/browse/edit worker recommendations
│   │   │   │   ├── microservice.scene.ts # Add/browse/edit micro-services
│   │   │   │   ├── search.scene.ts       # /ask result display
│   │   │   │   ├── settings.scene.ts     # User preferences
│   │   │   │   ├── carpool/
│   │   │   │   │   ├── carpool-home.scene.ts    # Carpool menu
│   │   │   │   │   ├── carpool-post.scene.ts    # Post new carpool route
│   │   │   │   │   ├── carpool-search.scene.ts  # Search for carpool seats
│   │   │   │   │   ├── carpool-manage.scene.ts  # Manage own routes (pause, delete)
│   │   │   │   │   └── carpool-ride.scene.ts    # Active ride session
│   │   │   │   └── lost-found/
│   │   │   │       ├── found-report.scene.ts    # Report a found item (photo + description)
│   │   │   │       ├── lost-report.scene.ts     # Report a lost item (description + auto-match)
│   │   │   │       └── lost-found-manage.scene.ts # View and resolve own reports
│   │   │   ├── guards/
│   │   │   │   └── group-member.guard.ts # Verifies Telegram group membership
│   │   │   ├── sessions/
│   │   │   │   ├── prisma-session.middleware.ts  # DB-backed Telegraf session store
│   │   │   │   ├── idle-timeout.middleware.ts    # Auto-leave idle scenes
│   │   │   │   └── private-chat-only.middleware.ts
│   │   │   ├── utils/
│   │   │   │   ├── validation.ts         # isValidName, isValidFlatNumber, isValidPhone, etc.
│   │   │   │   └── callback-data.ts      # Telegram callback_data helpers
│   │   │   └── types/
│   │   │       └── bot-context.ts        # Extended BotContext with session typing
│   │   └── prisma/
│   │       ├── schema.prisma             # Source of truth for DB shape
│   │       └── migrations/
│   └── dashboard/                        # Next.js 16 admin dashboard
│       ├── proxy.ts                      # Middleware: validates HMAC session cookie
│       ├── lib/
│       │   ├── session-crypto.ts         # createSessionToken / verifySessionToken (Web Crypto)
│       │   └── sessions.ts               # Deprecated (kept for import safety)
│       └── app/
│           ├── layout.tsx                # Root layout with nav + Sonner toasts
│           ├── page.tsx                  # Dashboard home (stats cards)
│           ├── lib/
│           │   ├── admin-api.ts          # adminFetch helper (ADMIN_API_URL + ADMIN_API_KEY)
│           │   └── api-client.ts         # apiFetch (boolean) + apiFetchJson<T> (body)
│           ├── actions/
│           │   └── admin.ts              # All server actions (CRUD + reprocess)
│           ├── api/
│           │   ├── login/route.ts        # POST: verify password, set HMAC-signed cookie
│           │   └── broadcast/route.ts    # POST: proxy multipart broadcast to bot API
│           ├── residents/                # Manage residents (ban, edit, delete)
│           ├── workers/                  # Manage worker recommendations
│           ├── services/                 # Manage micro-services
│           ├── carpool/                  # View carpool routes
│           ├── faq/                      # CRUD for FAQ entries used by /ask AI
│           ├── broadcast/                # Send messages/photos to all active residents
│           ├── lost-found/               # View lost/found items + Reprocess Matches button
│           ├── analytics/                # Usage stats charts
│           └── login/                    # Login page
├── render.yaml                           # Render deployment config
└── package.json                          # pnpm workspace scripts
```

---

## Database Models (Prisma)

| Model | Purpose |
|---|---|
| `Resident` | Core user record: name, flatNumber, phone, telegramId, isActive, onboardingComplete |
| `BotSession` | Telegraf session store (persisted to DB) |
| `Vehicle` | Resident-owned vehicles (plate numbers) |
| `WorkerRecommendation` | Worker entries with category, tags, notes, avgRating |
| `WorkerRating` | Individual ratings per worker per resident |
| `MicroService` | Resident-run services with category and description |
| `Category` | Admin-managed category list shared by workers and services |
| `CarpoolRoute` | Route with polyline, seats (morning + return), schedule |
| `CarpoolRequest` | Seat request from a rider (PENDING/ACCEPTED/DECLINED/EXPIRED) |
| `RideSession` / `RideSessionMember` | Active ride tracking |
| `Faq` | Society FAQ entries used as LLM context for `/ask` |
| `Broadcast` | Log of sent broadcasts |
| `FoundItem` | Found items with photo, user description, AI description |
| `LostItem` | Lost item reports with user description, AI-enriched description |
| `LostFoundMatch` | Cross-references between found and lost items (triggers notification) |

---

## Bot Commands & Navigation

| Entry point | How to access |
|---|---|
| `/start` | Onboard new residents or show menu if already registered |
| `/menu` | Show main menu inline keyboard |
| `/ask <query>` | AI-powered search (workers, services, carpool, FAQs) |
| `/exit` | Leave current scene, return to main menu |

### Main Menu Sections

- 🏠 **My Profile** — view/edit name, flat, phone
- 🚗 **My Vehicles** — add/edit/delete registered vehicles
- 👷 **Workers** — browse or recommend a worker; rate via code
- 🏪 **Services** — browse or list a micro-service
- 🚌 **Carpool** — post a route, search for seats, manage rides
- 📦 **Lost & Found** — report found/lost items; view own reports
- ⚙️ **Settings** — preferences

### `/ask` Examples

```
/ask I need a North Indian maid
/ask carpool to MG Road on Monday around 8AM
/ask plumber for bathroom leak
/ask what are the gym timings?
/ask someone who does tiffin service
```

The AI (Groq `llama-3.1-8b-instant`) classifies intent into `worker | service | carpool | faq | unknown`, extracts structured fields, then queries the DB. Falls back to keyword matching if Groq is unavailable or fails.

---

## Lost & Found Flow

1. **Found item**: Resident uploads photo → Groq Vision generates detailed AI description → saved to DB → system scans all open lost reports for matches → matching residents notified via Telegram with photo + Yes/No buttons
2. **Lost item**: Resident describes lost item → Groq enriches description with synonyms → saved → system scans all open found items for matches → resident notified immediately if a match exists
3. **Matching engine**: Groq semantic scoring (primary) + keyword overlap scoring (fallback). Already-matched pairs are never re-notified.
4. **Admin reprocess**: Dashboard **🔄 Reprocess Matches** button re-runs matching across all open items without re-generating AI descriptions.

---

## Local Development

### Prerequisites

- Node.js 20+
- pnpm 9
- A Telegram bot token from [@BotFather](https://t.me/botfather)
- A Telegram group (the bot must be an admin in it)
- PostgreSQL (local Docker or [Neon](https://neon.tech) free tier)
- Groq API key from [console.groq.com](https://console.groq.com) (free tier)
- OpenRouteService API key from [openrouteservice.org](https://openrouteservice.org) (free tier, for carpool)

### Setup

```bash
git clone https://github.com/yourusername/society-bot.git
cd society-bot

pnpm install

# Bot environment
cp apps/bot/.env.example apps/bot/.env
# Fill in values (see Environment Variables below)

# Dashboard environment
cp apps/dashboard/.env.example apps/dashboard/.env.local
# Fill in values

# Run database migrations
pnpm prisma:migrate

# Start bot in development (polling mode — WEBHOOK_DOMAIN must be empty)
pnpm dev:bot

# Start dashboard in development (separate terminal)
pnpm dev:dashboard
```

> **Local vs Production**: When `WEBHOOK_DOMAIN` is empty the bot runs in polling mode. When set, it runs in webhook mode (required on Render).

### Useful Dev Commands

```bash
pnpm db:up          # Start local Postgres via Docker Compose
pnpm db:studio      # Open Prisma Studio (GUI for the DB)
pnpm db:migrate     # Create and apply a new migration
pnpm test           # Run unit tests
pnpm lint           # Run ESLint + Prettier
pnpm build:bot      # TypeScript compile check (run before committing)
```

---

## Environment Variables

### `apps/bot/.env`

```env
DATABASE_URL=""             # Neon pooled connection (include ?pgbouncer=true)
DIRECT_URL=""               # Neon direct connection (required for migrations)
TELEGRAM_BOT_TOKEN=""       # From @BotFather
TELEGRAM_GROUP_ID=""        # Numeric group ID (negative, e.g. -1001234567890)
TELEGRAM_GROUP_INVITE_LINK="" # https://t.me/+xxxxxxx
WEBHOOK_DOMAIN=""           # Render URL in production; empty = polling mode locally
ADMIN_TELEGRAM_IDS=""       # Comma-separated Telegram user IDs for bot admin commands
ADMIN_API_KEY=""            # Shared secret for dashboard→bot API: openssl rand -hex 32
ADMIN_PASSWORD=""           # Dashboard login password
GROQ_API_KEY=""             # From console.groq.com
ORS_API_KEY=""              # From openrouteservice.org (carpool routing)
SOCIETY_LAT=""              # Society latitude (for Photon geocoding bias)
SOCIETY_LNG=""              # Society longitude
SOCIETY_ADDRESS=""          # Formatted address shown in carpool flows
```

### `apps/dashboard/.env.local`

```env
ADMIN_API_URL=""    # Bot backend URL (http://localhost:3001 locally, Render URL in prod)
ADMIN_API_KEY=""    # Must match ADMIN_API_KEY in apps/bot/.env
ADMIN_PASSWORD=""   # Dashboard login password (must match bot ADMIN_PASSWORD)
```

---

## Deployment

### Backend → Render

`render.yaml` in the repo root configures everything automatically.

1. Create a **Web Service** on [render.com](https://render.com)
2. Connect this GitHub repo — Render detects `render.yaml`
3. Add all environment variables from `apps/bot/.env` in the Render **Environment** tab
   > **Neon tip**: `DATABASE_URL` = pooled connection string (with `-pooler` and `?pgbouncer=true`). `DIRECT_URL` = direct/unpooled string. Render runs `prisma migrate deploy` at startup which requires `DIRECT_URL`.
4. After first deploy, set `WEBHOOK_DOMAIN` to your Render URL (e.g. `https://society-bot-xxxx.onrender.com`) and redeploy

**Build command** (from `render.yaml`):
```
pnpm install --frozen-lockfile && pnpm build:bot
```

**Start command**:
```
pnpm start:bot
```
Runs: `prisma migrate deploy && node dist/main.js`

### Frontend → Vercel

1. Import the repo on [vercel.com](https://vercel.com)
2. Set **Root Directory** to `apps/dashboard`
3. Add environment variables in Vercel → Settings → Environment Variables:
   - `ADMIN_API_URL` = your Render URL (no trailing slash)
   - `ADMIN_API_KEY` = same as bot `ADMIN_API_KEY`
   - `ADMIN_PASSWORD` = dashboard login password
4. Deploy

> ⚠️ **Changing env vars on Vercel does NOT auto-redeploy.** Go to Deployments → ⋯ → Redeploy after any env var change. Changing `ADMIN_PASSWORD` also invalidates all existing dashboard sessions automatically (sessions are HMAC-signed with the password).

### Keep-Alive (Render Free Tier)

Render free tier sleeps after 15 min of inactivity. A sleeping bot misses webhooks.

Set up a free monitor on [UptimeRobot](https://uptimerobot.com):
- **Type**: HTTP(S)
- **URL**: `https://your-render-url.onrender.com/health`
- **Interval**: every 5 minutes

---

## Admin Dashboard

Accessible at your Vercel URL. Protected by `ADMIN_PASSWORD` (HMAC-signed session cookies — no session DB required).

| Page | Description |
|---|---|
| **Home** | Key stats: total residents, workers, services, carpools |
| **Residents** | View, search, edit, ban/unban, delete residents |
| **Workers** | View, add, edit worker recommendations; see avg ratings |
| **Services** | View, add, edit, disable micro-services |
| **Carpool** | View all carpool routes and their status |
| **FAQ** | Create, edit, delete FAQ entries (used as LLM context by `/ask`) |
| **Lost & Found** | View found and lost item reports; resolve, delete; **🔄 Reprocess Matches** |
| **Broadcast** | Send a text or photo message to all active residents |
| **Analytics** | Charts: worker categories, service distribution, resident growth, carpool stats |

---

## Security Model

| Concern | Implementation |
|---|---|
| Bot access | Telegram group membership (`GroupMemberGuard`) + completed onboarding |
| Admin API | `x-admin-api-key` header checked with `timingSafeEqual` (`AdminApiKeyGuard`) |
| Dashboard auth | `ADMIN_PASSWORD` compared with `timingSafeEqual`; session cookie is HMAC-SHA256 signed |
| Ownership checks | Every edit/delete verifies `record.residentId === resident.id` before mutating |
| Dynamic field keys | Whitelisted via `isEditableField()` before use in Prisma updates |
| Vehicle lookup (inform) | Exact plate match only — no `contains` to prevent owner enumeration |
| File uploads | `FileInterceptor` enforces 5 MB max on all endpoints |
| Banned accounts | `isActive` never set in upsert `update` block — admin bans survive re-onboarding |
| AI prompt injection | FAQ content wrapped in `<faq_data>...</faq_data>` XML delimiters |
| Secrets | All comparisons use `crypto.timingSafeEqual`; `.env` files never committed |

---

## License

Private — for internal society use only.