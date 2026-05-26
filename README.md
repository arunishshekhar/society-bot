# POC: Society Bot

A Telegram-based management system for housing societies. Residents interact entirely through a Telegram bot — no app install required. Admins manage everything through a lightweight web dashboard.

---

## Features

- **Resident Onboarding** — Register via Telegram, modular editable profiles, no re-onboarding ever
- **Vehicle Registry** — Register vehicles, admin vehicle lookup by plate number
- **Worker Recommendations** — Add and discover plumbers, electricians, maids and more
- **Micro-Services Directory** — List and browse resident-run home businesses (tiffin, tutoring, laundry)
- **Carpool Matching** — Post and find commute routes by destination and timing
- **AI Search** — Natural language search across workers, services, and carpools via Groq
- **Admin Dashboard** — Manage residents, moderate content, broadcast announcements, view analytics
- **Access Control** — Telegram group membership as single source of truth, no manual verification

---

## Tech Stack

| Layer | Technology |
|---|---|
| Bot | NestJS + nestjs-telegraf |
| Backend | NestJS (monolith) |
| Database | PostgreSQL (Neon) + Prisma |
| Admin UI | Next.js + Tailwind CSS |
| AI | Groq API (llama-3.1-8b-instant) |
| Backend Hosting | Render |
| Frontend Hosting | Vercel |

---

## Project Structure

```
society-bot/
├── apps/
│   ├── bot/                   # NestJS — Telegram bot + REST API
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   ├── users/
│   │   │   │   ├── onboarding/
│   │   │   │   ├── vehicles/
│   │   │   │   ├── workers/
│   │   │   │   ├── microservices/
│   │   │   │   ├── carpool/
│   │   │   │   ├── search/
│   │   │   │   ├── notifications/
│   │   │   │   └── admin/
│   │   │   ├── scenes/
│   │   │   ├── guards/
│   │   │   └── prisma/
│   │   └── prisma/
│   │       └── schema.prisma
│   └── dashboard/             # Next.js admin dashboard
│       └── app/
│           ├── residents/
│           ├── vehicles/
│           ├── workers/
│           ├── services/
│           ├── carpool/
│           ├── broadcast/
│           └── analytics/
└── package.json
```

---

## Local Development

### Prerequisites

- Node.js 20+
- pnpm
- PostgreSQL (local or Neon)
- Telegram bot token from @BotFather

### Setup

```bash
# Clone the repo
git clone https://github.com/yourusername/society-bot.git
cd society-bot

# Install dependencies
pnpm install

# Set up environment variables
cp apps/bot/.env.example apps/bot/.env
cp apps/dashboard/.env.example apps/dashboard/.env
# Fill in values — see Environment Variables section below

# Run database migrations
cd apps/bot
npx prisma migrate dev

# Start bot (development)
pnpm --filter bot start:dev

# Start dashboard (development)
pnpm --filter dashboard dev
```

---

## Environment Variables

### `apps/bot/.env`

```env
DATABASE_URL=""           # Neon PostgreSQL connection string
TELEGRAM_BOT_TOKEN=""     # From @BotFather
TELEGRAM_GROUP_ID=""      # Numeric group ID (negative number)
WEBHOOK_DOMAIN=""         # Your Render URL e.g. https://society-bot.onrender.com
ADMIN_TELEGRAM_IDS=""     # Comma-separated admin Telegram user IDs
ADMIN_API_KEY=""          # Random secret — run: openssl rand -hex 32
GROQ_API_KEY=""           # From console.groq.com (free)
```

### `apps/dashboard/.env`

```env
NEXT_PUBLIC_API_URL=""    # Your Render backend URL
ADMIN_API_KEY=""          # Same as backend
ADMIN_PASSWORD=""         # Dashboard login password
```

---

## Deployment

### Backend → Render

1. Create a new Web Service on [render.com](https://render.com)
2. Connect this GitHub repo
3. Set root directory: `apps/bot`
4. Build command: `pnpm install && pnpm build && npx prisma migrate deploy`
5. Start command: `node dist/main.js`
6. Add all `apps/bot` env vars in Render dashboard
7. After first deploy, copy the Render URL into `WEBHOOK_DOMAIN` and redeploy

### Frontend → Vercel

1. Import this repo on [vercel.com](https://vercel.com)
2. Set root directory: `apps/dashboard`
3. Add `apps/dashboard` env vars in Vercel dashboard
4. Deploy

### Keep-alive (Required for Render free tier)

Render free tier sleeps after 15 minutes of inactivity. A sleeping bot misses Telegram webhooks.

Set up a free monitor on [UptimeRobot](https://uptimerobot.com):
- Monitor type: HTTP(S)
- URL: `https://your-render-url.onrender.com/admin/health`
- Interval: every 5 minutes

Add a `/health` endpoint to your NestJS app:
```typescript
@Get('health')
health() {
  return { status: 'ok' };
}
```

---

## Branch Strategy

```
main        → production (auto-deploys to Render + Vercel)
dev         → active development
feature/*   → individual features
```

Never push directly to `main`. Work on `dev`, merge when stable.

---

## Access Control

Access is controlled entirely by Telegram group membership. There is no manual approval process.

- Resident joins society Telegram group → can use the bot
- Resident leaves or is removed from group → bot access revoked automatically
- No offboarding flow needed

---

## License

Private — for internal society use only.