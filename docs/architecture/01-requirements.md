# Requirements — Rodinný kalendář

## 1. Overview

A family calendar web application for coordinating schedules between parents, grandparents, relatives, and children (ages 9 and 11). Primary use case: maintaining oversight of children's activities during school holidays when adult supervision needs explicit coordination.

**Primary language**: Czech. Secondary: English. Each user sets their preference.

**Primary device**: mobile phone (kids use it daily). Desktop for parents when planning.

## 2. Actors and roles

| Role | Czech label | Permissions |
|------|------------|-------------|
| `PARENT` | Rodič | Full admin: CRUD all events/users, approve proposals, manage types/flags, impersonate |
| `GRANDPARENT` | Prarodič | Add/edit own availability, view all calendars, add own events |
| `RELATIVE` | Příbuzný (strýc/teta) | Same as GRANDPARENT |
| `KID` | Dítě | View calendar, propose events (require parent approval), view own badges |
| `GUEST` | Host | Read-only calendar access (no personal data) |

## 3. Event types (seeded catalog)

### Ice Hockey (9yo — Jakub)
- Trénink hokej, Zápas hokej, Turnaj hokej, Letní hokejový kemp, Soustředění hokej, Servis výstroje

### Swimming (11yo — Tereza)
- Trénink plavání, Závody plavání, Plavecké soustředění, Kondiční trénink

### School
- Vyučování, Test/písemka, Domácí úkol (termín), Třídní schůzky, Školní besídka, Výlet se školou, Ředitelské volno, Kroužek

### Lessons
- Hudební škola, Jazykový kroužek, Doučování

### Family & Travel
- Rodinný výlet, Roadtrip, Dovolená, Pobyt u prarodičů, Návštěva, Oslava/narozeniny, Svátek

### Camps
- Letní tábor, Příměstský tábor, Zimní tábor/lyžák

### Health & Admin
- Lékař/zubař, Očkování, Úřad/administrativa

### Other
- Ostatní

## 4. Functional requirements

### Calendar
- Month, week, and agenda (day list) views
- Agenda is the primary mobile landing view for all users
- Per-person color coding with filter chips
- Guardian availability shown as coverage layer
- Days with uncovered kid events highlighted in red/warning
- Czech public holidays + school holidays as background layer
- Birthdays auto-derived from user DOB

### Events
- Create/edit/delete events (parents, guardians)
- Two-tap create: pick event type tile → prefilled form → save
- Recurring events (RRULE): school schedule, weekly trainings
- Recurring exception support (edit single occurrence)
- Attachments: images (jpg, png, gif, webp) + documents (pdf, docx, xlsx), max 20 MB each
- Event status: PROPOSED / APPROVED / CANCELLED

### Kid proposals
- Kids submit event proposals (status = PROPOSED)
- Parents see proposal inbox on dashboard
- Parents approve → APPROVED, reject → CANCELLED
- Kids see proposal status with friendly feedback

### Guardian availability
- Guardians enter date ranges: AVAILABLE / UNAVAILABLE / ON_CALL
- Optional location field ("u nás doma", "Praha")
- Shown on calendar and coverage report

### User accounts
- Fields: username, name, email, mobile, date of birth, role, photo, language preference, theme, color mode
- Argon2 password hashing
- Session cookie auth (httpOnly, secure)
- Password reset: email link (expires 1h) + admin manual reset
- Admin: deactivate/reactivate accounts, impersonate (view as user)

### Notifications
- Email via Resend: event reminders (configurable offset), weekly digest, password reset
- Web Push (PWA service worker): event reminders, proposal approved/rejected
- SMS: adapter interface, Czech gateway stub (feature-flagged, disabled by default)
- All sends idempotent (NotificationLog with idempotency key)

### Badges (100+)
- Engine reads ActivityEvent append-only log
- Award UX: animated badge pop toast + confetti
- Badge cabinet on profile (earned in color, locked in gray)
- Progress bars toward nearest unearned badges on dashboard

### Reports (parents only)
- User activity: logins, events created/edited, proposals, last seen
- Free/unoccupied time per kid (gap analysis within configurable awake hours)
- Coverage report: days with kid events but no available guardian
- Occupancy summary: hours per event type per kid per week/month

### Message of the Day
- Admins post announcements with date range and audience (all/kids/adults)
- Shown as banner at the top of each dashboard

### Feature toggles
- `badges`, `push_notifications`, `email_notifications`, `sms_notifications`
- `guest_access`, `kid_proposals`, `attachments`, `reports`
- `motd`, `ics_feed`, `weekly_digest`, `birthdays_layer`
- Admin toggle UI; checked server-side and delivered in session

### ICS feed
- Secret per-user URL (token-protected) exporting user's events as `.ics`
- Subscribe from Google Calendar / phone calendar apps

## 5. Non-functional requirements

- **Mobile-first**: all views usable on 375px viewport; large touch targets; swipe navigation
- **Performance**: calendar page first load < 2s on LAN; list endpoints paginated; secondary panels lazy-loaded
- **Offline installable**: PWA manifest + service worker
- **Observability**: structured pino logs, correlation IDs, /health endpoint with version + DB status
- **Security**: httpOnly session cookies, helmet headers, input validation at all boundaries, rate limiting on auth endpoints
- **Deployment**: single Docker image, PostgreSQL sidecar, Cloudflare tunnel, Synology NAS

## 6. Out of scope (v1)

- Chat/comments on events
- Packing checklists
- Carpool coordination
- Offline editing (beyond PWA installability)
- Native mobile app
