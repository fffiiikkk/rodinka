# Rodinný kalendář — AI Assistant Guide

## Package layout

```
packages/
  shared/   — Zod schemas, shared types, constants (iconMap, badge catalog keys)
  backend/  — Express API + Prisma + background jobs
  frontend/ — React/Vite mobile-first PWA
```

## Key architecture patterns

- **Shared-first**: update `packages/shared` (Zod schemas) before touching backend routes or frontend consumers. Runtime-parse shared schemas on the frontend — never blind type assertions.
- **Thin routes**: route handlers validate input with Zod and call services. Business logic lives in `src/services/`, persistence in services using Prisma directly (no separate DAO layer needed at this scale).
- **Append-only logs**: `ActivityEvent`, `NotificationLog`, `AuditLog`, `UserBadge` — never mutate or delete rows; corrections are new explicit entries. Same pattern used by wallet ledgers in architecture-lessons.md.
- **State machines**: `Event.status` (`PROPOSED → APPROVED → CANCELLED`) is guarded in `eventService.ts`. Every status transition checks current state inside the same DB transaction.
- **Idempotency keys**: every `NotificationLog` and `UserBadge` row has an `idempotencyKey` unique to (user + event/badge + occurrence + channel/tier). Jobs can safely re-run.
- **Feature flags**: read from `FeatureFlag` table, bootstrapped into the session payload. Check `req.flags.badges`, etc. in routes and `useFlags()` in frontend.
- **Serialization**: all dates as UTC ISO strings over the wire. Displayed in `Europe/Prague`. Convert at the API boundary, never inside components.
- **i18n**: Czech default, English secondary. All UI strings via `react-i18next`. All backend email/label strings in `packages/shared/src/constants/labels.ts`. No per-call-site strings.

## Testing expectations

- Unit tests (Vitest) for all services: `packages/backend/src/services/__tests__/`
- Integration tests (Vitest + supertest): `packages/backend/src/__tests__/`
- Frontend unit tests: `packages/frontend/src/**/__tests__/`
- E2E (Playwright): `e2e/`
- Run `npm run verify` before every push (lint + typecheck + unit tests)

## Safety rules

- Never run destructive git commands unless explicitly requested.
- Never commit `.env`, credentials, uploaded files, or build artifacts.
- Never invent business rules, endpoints, or fields not in the plan.
- Never change schema.prisma without also updating/creating a migration.
- Never mutate or delete append-only rows (ActivityEvent, NotificationLog, AuditLog, UserBadge).
- Always read a file before editing it.

## Cross-package coordination

1. Update `packages/shared` schemas/types first.
2. Update backend routes/services next.
3. Update frontend hooks/components last.
4. Run `npm run verify` to confirm the change.

## Shell compatibility

This machine uses **PowerShell**. Use `;` to chain commands — never `&&`. No bash heredocs.

```powershell
# Correct:
cd packages/backend; npx prisma migrate dev --name add_feature
# Incorrect:
cd packages/backend && npx prisma migrate dev
```

## Common tasks

```powershell
# Add a new event type: edit packages/backend/prisma/seed/eventTypes.ts, re-run npm run db:seed
# Add a badge: edit packages/backend/prisma/seed/badges.ts, re-run npm run db:seed
# Add a feature flag: edit packages/backend/prisma/seed/index.ts flagSeeds array
# Add a migration: cd packages/backend; npx prisma migrate dev --name describe_change
# Regenerate Prisma client: cd packages/backend; npx prisma generate
```
