# Data Model — Rodinný kalendář

See `packages/backend/prisma/schema.prisma` for the authoritative source. This document describes intent and constraints.

## Core entities

### User
Central entity. `role` determines permissions everywhere. `photo` is a path to an uploaded file (fallback: generated avatar from initials). `theme` + `colorMode` drive the UI theme.

### EventType
Admin-managed catalog. Not an enum. Each type has: slug (unique), Czech + English name, icon (Lucide icon name), color (hex), group label (for the picker grouping), default duration, default reminder offset, sort order, isActive flag.

### Event
- `start`/`end` always stored as UTC. Frontend converts to Europe/Prague for display.
- `recurrenceRule`: iCal RRULE string (e.g. `FREQ=WEEKLY;BYDAY=TU,TH`). Expanded into virtual occurrences by `recurrenceService.ts`. A recurrence exception is a new Event row with `parentEventId` set and the same `recurrenceRule = null`.
- `status` state machine: `PROPOSED → APPROVED → CANCELLED`. Kids create at PROPOSED. Parents approve/reject.
- `isHoliday`: flag for seeded Czech public/school holidays — shown as background layer, cannot be deleted by non-admin.

### EventParticipant
Many-to-many link between users and events. Used for: which kid attends a training, who is the guardian for a trip.

### EventAttachment
Uploaded file linked to an event. `storagePath` is relative to `UPLOAD_DIR`. `thumbnailPath` is set for images.

### Availability
Per guardian: a date range with status (`AVAILABLE` | `UNAVAILABLE` | `ON_CALL`). `location` is free text. Multiple ranges can overlap; the coverage service merges them.

### MessageOfTheDay
Time-bounded announcement. `audience`: `ALL` | `KIDS` | `ADULTS`. Active MOTD for the user's audience is fetched on dashboard load.

### BadgeDefinition
Declarative badge specification. `ruleType` determines evaluation logic:
- `FIRST`: awarded when `metric` ActivityEvent type appears for the first time.
- `COUNT`: awarded when count of `metric` events reaches `threshold`.
- `STREAK`: awarded when consecutive daily counts of `metric` reach `threshold`.
- `SPECIAL`: custom evaluation in badgeService.ts (date-based, combination, etc.).

### UserBadge
Append-only. `idempotencyKey` = `userId:badgeDefinitionId:tier`. The evaluator can run multiple times safely.

### ActivityEvent
Append-only audit/analytics log of user actions. Types (string enum, checked in services):
`LOGIN`, `LOGOUT`, `EVENT_CREATED`, `EVENT_EDITED`, `EVENT_DELETED`, `PROPOSAL_SUBMITTED`, `PROPOSAL_APPROVED`, `PROPOSAL_REJECTED`, `AVAILABILITY_SET`, `ATTACHMENT_UPLOADED`, `PROFILE_UPDATED`, `PASSWORD_RESET`, `BADGE_EARNED`, `THEME_CHANGED`.

### NotificationLog
Append-only. `idempotencyKey` = `userId:eventId:occurrenceDate:channel:notificationType`. The reminder job can re-run every 5 minutes safely.

### FeatureFlag
Key-value flags. Populated into `req.flags` by middleware. Changed via admin UI (parent role only). Defaults seeded at startup if missing.

### PasswordResetToken
Single-use. `tokenHash` = SHA-256 of the raw token sent by email. `usedAt` set on first use; subsequent uses are rejected.

### AuditLog
Admin trail. `userId` = who acted. `targetId` = who was affected (for user management actions). `diff` = JSON patch of what changed.

### PushSubscription
Web Push subscription endpoint + keys. One user can have multiple (different devices).

### EventTemplate
Reusable quick-add template. Can be personal or shared (`isPublic`). Stores default participants, duration, recurrence rule. Not the same as an Event — it's a prefill preset.

## Key constraints

- `User.username` unique (login identifier).
- `User.email` unique (password reset target).
- `EventParticipant` unique on `(eventId, userId)`.
- `UserBadge` unique on `(userId, badgeDefinitionId)`.
- `UserBadge.idempotencyKey` unique globally.
- `NotificationLog.idempotencyKey` unique globally.
- `PushSubscription.endpoint` unique globally.
- `PasswordResetToken.tokenHash` unique globally.
- `EventType.slug` unique globally.
- `BadgeDefinition.key` unique globally.
- `FeatureFlag.key` unique globally.
