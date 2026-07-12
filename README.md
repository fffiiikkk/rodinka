# Rodinný kalendář 📅

Family calendar application for managing schedules, activities, and coordination between parents, grandparents, and kids.

**Primary language: Czech** | Secondary: English

## Features

- Role-based dashboards (parents, grandparents/relatives, kids, guests)
- Rich event type catalog: ice hockey, swimming, school, camps, travel, and more
- Guardian availability + coverage warnings
- Kid event proposals with parent approval
- 5 visual themes with light/dark mode (Klasika, Oceán, Led, Léto, Les)
- Badges and achievements system (100+ badges)
- Email notifications (Resend) + Web Push
- Reports: activity, free-time gaps, coverage
- Attachments (images, documents) on events
- ICS calendar feed
- PWA — installable on mobile phones

## Tech stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Frontend | React 18 + Vite + Tailwind CSS |
| Shared | Zod schemas (API contract) |
| Auth | Session cookies + argon2 |
| Email | Resend |
| Push | Web Push API (VAPID) |
| Icons | Lucide React |
| i18n | react-i18next |

## Local development

### Prerequisites

- Node.js ≥ 20
- Docker (for PostgreSQL)

### Setup

```powershell
# 1. Copy environment template
Copy-Item .env.example .env
# Edit .env — at minimum set DATABASE_URL, SESSION_SECRET

# 2. Start database
docker compose -f docker-compose.dev.yml up -d

# 3. Install dependencies
npm install

# 4. Run migrations + seed
npm run db:migrate
npm run db:seed

# 5. Start dev servers (backend :3000, frontend :5173)
npm run dev
```

### Useful commands

```powershell
npm run verify          # lint + typecheck + unit tests (run before pushing)
npm run test            # all tests
npm run test:integration  # integration tests (needs Postgres running)
npm run db:studio       # open Prisma Studio
npm run db:migrate      # apply pending migrations
npm run db:seed         # (re-)seed database with demo data
```

### Default seed accounts

| Username | Password | Role |
|----------|----------|------|
| `admin` | `Admin123!` | Parent (admin) |
| `mama` | `Admin123!` | Parent |
| `babicka` | `Admin123!` | Grandparent |
| `jakub` | `Admin123!` | Kid (9 – ice hockey) |
| `tereza` | `Admin123!` | Kid (11 – swimming) |

## Production deployment (Synology NAS)

See [`docs/runbook/deploy.md`](docs/runbook/deploy.md) for the full deployment guide including Cloudflare tunnel setup, backup configuration, and rollback procedures.

## CI/CD

Pushes to `main` trigger GitHub Actions:
1. Lint + type-check + unit tests + integration tests
2. Build production Docker image
3. Push image to GHCR (version-stamped: `1.0.<run>+<sha>`)
4. Trigger deploy webhook on Synology NAS
5. Verify `/health` returns the new version SHA

## Architecture

See [`docs/architecture/`](docs/architecture/) for requirements, architecture decisions, and the full data model.

## License

Private — family use only.
