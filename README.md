# Society Bot

A Telegram-based management system for housing societies. Residents interact entirely through a Telegram bot — no app install required. Admins manage everything through a lightweight web dashboard.

---

## Features

- **Resident Onboarding** — Register via Telegram, step-by-step with resume support (restart anytime without losing progress)
- **Vehicle Registry** — Register vehicles linked to resident profile; admin vehicle lookup by plate number
- **Worker Recommendations** — Add and discover plumbers, electricians, maids and more; rated by residents
- **Micro-Services Directory** — List and browse resident-run home businesses (tiffin, tutoring, laundry)
- **Carpool Matching** — Post and find commute routes by destination, days, and timing
- **AI Search & FAQ (`/ask`)** — Natural language search across workers, services, carpools, and society FAQs via Groq (llama-3.1-8b-instant); falls back to keyword search if Groq is unavailable
- **Admin Dashboard** — Manage residents, moderate content, broadcast announcements, view analytics
- **Access Control** — Telegram group membership as single source of truth; no manual verification

---

## Tech Stack

| Layer | Technology |
|---|---|
| Bot runtime | NestJS + nestjs-telegraf |
| Database | PostgreSQL (Neon) + Prisma ORM |
| AI | Groq API (llama-3.1-8b-instant) |
| Routing API | OpenRouteService (ORS) for carpool polylines/distance |
| Admin UI | Next.js 15 (App Router) + Tailwind CSS + shadcn/ui |
| Backend hosting | Render (webhook mode) |
| Frontend hosting | Vercel |
| Package manager | pnpm (monorepo) |

---

## Project Structure

```
society-bot/
├── apps/
│   ├── bot/                        # NestJS — Telegram bot + REST admin API
│   │   ├── src/
│   │   │   ├── app.module.ts
│   │   │   ├── app.update.ts       # Top-level bot command handlers (/start, /menu, /ask)
│   │   │   ├── main.ts             # Bootstrap: webhook mounting, BigInt patch, retry logic
│   │   │   ├── modules/
│   │   │   │   ├── search/         # Groq intent classifier + fallback keyword search
│   │   │   │   └── admin/          # REST API for dashboard (guarded by API key)
│   │   │   ├── scenes/             # Telegraf FSM scenes (one per feature)
│   │   │   │   ├── onboarding.scene.ts
│   │   │   │   ├── profile.scene.ts
│   │   │   │   ├── vehicles.scene.ts
│   │   │   │   ├── workers.scene.ts
│   │   │   │   ├── microservices.scene.ts
│   │   │   │   ├── carpool.scene.ts
│   │   │   │   ├── search.scene.ts
│   │   │   │   └── settings.scene.ts
│   │   │   ├── guards/
│   │   │   │   ├── group-member.guard.ts   # Telegram group membership check
│   │   │   │   └── admin-api-key.guard.ts  # x-admin-api-key header check
│   │   │   ├── keyboards/
│   │   │   ├── prisma/
│   │   │   └── sessions/
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       └── migrations/
│   └── dashboard/                  # Next.js admin dashboard
│       └── app/
│           ├── lib/admin-api.ts    # Server-side fetch wrapper (uses ADMIN_API_URL + ADMIN_API_KEY)
│           ├── actions/admin.ts    # Next.js server actions for CRUD
│           ├── residents/
│           ├── workers/
│           ├── services/
│           ├── carpool/
│           ├── broadcast/
│           ├── analytics/
│           └── api/
│               ├── login/          # Sets admin-session cookie
│               └── broadcast/      # Proxies broadcast to bot backend
├── render.yaml                     # Render deployment config (build + start commands)
└── package.json                    # Root pnpm workspace scripts
```

---

## Bot Commands

| Command | Description |
|---|---|
| `/start` | Onboard new residents or show main menu if already registered |
| `/menu` | Show main menu |
| `/ask <query>` | AI-powered natural language search across workers, services, and carpools |

### `/ask` Examples

```
/ask I need a North Indian maid
/ask carpool to MG Road on Monday around 8AM
/ask plumber for bathroom leak
/ask what are the gym timings?
/ask someone who does tiffin service
```

The AI (Groq) extracts structured intent from the query, then filters the database directly:
- **Workers**: matches `category`, `notes`, `tags`, `name`
- **Services**: matches `name`, `description`, `category`
- **Carpool**: matches `destination` (ILIKE), `days` (array contains)
- **FAQ**: Answers directly using `Faq` database entries as LLM context

Falls back to keyword regex matching if Groq is unavailable.

---

## Local Development

### Prerequisites

- Node.js 20+
- pnpm
- A Telegram bot token from [@BotFather](https://t.me/botfather)
- PostgreSQL (local or [Neon](https://neon.tech) free tier)

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
cd apps/bot && npx prisma migrate dev && cd ../..

# Start bot in development (polling mode — leave WEBHOOK_DOMAIN empty)
pnpm dev:bot

# Start dashboard in development
pnpm dev:dashboard
```

> **Local vs Production mode**: When `WEBHOOK_DOMAIN` is empty, the bot runs in polling mode (good for local dev). When `WEBHOOK_DOMAIN` is set, it runs in webhook mode (required on Render).

---

## Environment Variables

### `apps/bot/.env`

```env
DATABASE_URL=""                  # Neon PostgreSQL connection string
TELEGRAM_BOT_TOKEN=""            # From @BotFather
TELEGRAM_GROUP_ID=""             # Numeric group ID (negative number, e.g. -1001234567890)
TELEGRAM_GROUP_INVITE_LINK=""    # https://t.me/+xxxxxxx
WEBHOOK_DOMAIN=""                # Production Render URL (leave empty for local polling)
ADMIN_TELEGRAM_IDS=""            # Comma-separated Telegram user IDs for admin access
ADMIN_API_KEY=""                 # Random secret: openssl rand -hex 32
ADMIN_PASSWORD=""                # Dashboard login password
GROQ_API_KEY=""                  # From console.groq.com (free tier available)
ORS_API_KEY=""                   # From openrouteservice.org (free tier available)
SOCIETY_LAT=""                   # Society latitude for carpool routing
SOCIETY_LNG=""                   # Society longitude for carpool routing
SOCIETY_ADDRESS=""               # Formatted society address
```

### `apps/dashboard/.env.local`

```env
ADMIN_API_URL=""     # Bot backend URL (http://localhost:3001 locally, Render URL in production)
ADMIN_API_KEY=""     # Must match ADMIN_API_KEY in apps/bot/.env
ADMIN_PASSWORD=""    # Dashboard login password (must match bot ADMIN_PASSWORD)
```

---

## Deployment

### Backend → Render

The repo includes `render.yaml` which configures the build automatically. When connecting to Render:

1. Create a new **Web Service** on [render.com](https://render.com)
2. Connect this GitHub repo — Render will detect `render.yaml`
3. Add all environment variables from `apps/bot/.env` in the Render dashboard (Environment tab)
4. After first deploy, set `WEBHOOK_DOMAIN` to your Render URL (e.g. `https://society-bot-xxxx.onrender.com`) and redeploy

**Build command** (from `render.yaml`):
```
pnpm install --frozen-lockfile && pnpm build:bot
```

**Start command**:
```
pnpm start:bot
```
This runs `prisma migrate deploy && node dist/main.js`.

### Frontend → Vercel

1. Import the repo on [vercel.com](https://vercel.com)
2. Set **Root Directory** to `apps/dashboard`
3. Add environment variables in Vercel → Settings → Environment Variables:
   - `ADMIN_API_URL` = your Render backend URL (no trailing slash)
   - `ADMIN_API_KEY` = same value as the bot's `ADMIN_API_KEY` on Render
   - `ADMIN_PASSWORD` = dashboard login password
4. Deploy

> ⚠️ **Vercel does not auto-redeploy when env vars change.** Always manually trigger a redeploy after updating environment variables: Deployments → ⋯ → Redeploy.

### Keep-Alive (Render Free Tier)

Render's free tier sleeps after 15 minutes of inactivity. A sleeping bot misses Telegram webhooks.

Set up a free monitor on [UptimeRobot](https://uptimerobot.com):
- Monitor type: HTTP(S)
- URL: `https://your-render-url.onrender.com/health`
- Interval: every 5 minutes

---

## Admin Dashboard

Accessible at your Vercel URL. Protected by a password set via `ADMIN_PASSWORD`.

| Page | Description |
|---|---|
| Vehicle Lookup | Search any registered vehicle by plate number |
| Residents | View, edit, disable/enable, delete residents |
| Workers | View, add, edit, ban/unban worker entries |
| Services | View, add, edit, disable micro-services |
| Carpool | View and manage carpool routes |
| FAQs | View, add, edit, delete society FAQs for the AI bot |
| Broadcast | Send a message to all active residents via the bot |
| Analytics | Overview stats (residents, services, carpools, workers) |

---

## Access Control & Security

Access is strictly controlled by Telegram group membership and onboarding completion. There is no manual approval process.

- **Group Membership Check**: Guarded by `GroupMemberGuard`. If a resident leaves or is removed from the Telegram group, bot access is immediately revoked.
- **Strict Onboarding Validation**: All scenes and commands enforce that a user has successfully completed the onboarding flow (name and flat number registered). Unregistered users are forcefully redirected to the onboarding scene.

---

## License

Private — for internal society use only.