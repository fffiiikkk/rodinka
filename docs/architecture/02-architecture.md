# Architecture — Rodinný kalendář

## System topology

```
Internet user
     │
     ▼
Cloudflare Tunnel (cloudflared)
     │
     ▼
Docker container: app (port 3000)
  ├── Express API  /api/*
  └── Vite static  /*  (built frontend)
     │
     ▼
Docker container: postgres (port 5432, internal only)
```

All three containers run via `docker-compose.yml` on Synology NAS. Uploads volume and DB volume are persisted across restarts.

## Package structure

```
packages/
  shared/           Zod schemas + enums + constants (iconMap, labelMaps)
  backend/          Express + Prisma + jobs + uploads
  frontend/         React + Vite + Tailwind (built into backend/dist/public)
```

## Backend layers

```
Request
  │
  ▼
express-session middleware  (reads session cookie → req.user)
flag middleware             (reads FeatureFlag rows → req.flags)
request logger (pino-http)
  │
  ▼
Route handler  (Zod parse → call service → return JSON)
  │
  ▼
Service layer  (business logic, Prisma calls, fire-and-forget triggers)
  │
  ▼
Prisma Client → PostgreSQL
  │
  ▼
Background side-effects (badge eval, notifications) — queued, never awaited
```

## Frontend architecture

```
App.tsx
├── ThemeProvider (CSS custom properties, localStorage + user profile)
├── I18nProvider  (react-i18next, CS default)
├── QueryClientProvider (react-query)
└── Router (react-router-dom)
    ├── /login          → LoginPage
    ├── /              → RoleDashboard (dispatches to Parent/Kid/Guardian/Guest)
    ├── /calendar       → CalendarPage (month / week / agenda tab)
    ├── /event/:id      → EventDetailPage
    ├── /profile        → ProfilePage
    ├── /admin/*        → AdminPages (PARENT only)
    └── /reports/*      → ReportPages (PARENT only)
```

Data fetching: all via `useQuery` / `useMutation` (react-query). API client in `src/lib/api.ts` — typed, returns parsed Zod results.

## Authentication

- Session cookie: `httpOnly`, `secure` (prod), `sameSite: lax`, 30-day max age.
- Session store: PostgreSQL via `connect-pg-simple` (same DB, `session` schema).
- Password: argon2 (default parameters, no customization needed for a family app).
- Password reset: `PasswordResetToken` row with SHA-256 hashed token, 1h expiry, single-use. Email sent via Resend.

## Background jobs (scheduler.ts)

| Job | Schedule | Guard |
|-----|----------|-------|
| Event reminders | Every 5 min | in-process Set |
| Weekly digest | Sunday 18:00 | in-process Set |
| Badge evaluation | Triggered fire-and-forget after relevant mutations | per-user Set |

## File uploads

- Multer disk storage to `UPLOAD_DIR` (env).
- Image thumbnails: Sharp, max 400px wide, stored alongside original.
- Attachments served at `/api/attachments/:id/file` (auth-gated).
- Photos served at `/api/users/:id/photo` (authenticated).

## Themes

CSS custom properties defined on `:root[data-theme][data-color-mode]`. Tailwind uses `@apply` and CSS vars for all semantic color tokens. Themes: `klasika`, `ocean`, `led`, `leto`, `les`. Color modes: `light`, `dark`, `system`.

## Logging

- `pino` + `pino-http` in backend. JSON to stdout.
- Every request: method, url, status, duration, correlation-id header.
- Every mutation: userId, entity, action, diff summary.
- Every job run: start, end, count processed, errors.
- Every email/push send: channel, userId, eventId, idempotencyKey.
- Startup: version, APP_VERSION env, migration status.

## Version stamping

`APP_VERSION` env var is set by CI to `1.0.<run_number>+<short_sha>`. The `/health` endpoint returns it. The running frontend also reads it from a `window.__APP_VERSION__` global injected at build time.
