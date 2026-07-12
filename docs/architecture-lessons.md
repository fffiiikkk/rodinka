# Architecture Lessons Learned

Recommendations distilled from the development history of FIFAWC26 (June–July 2026).
Every rule below is backed by a real incident that cost debugging time, a hotfix PR, or a
production data repair. Use this document when planning the next phase of this project and
as a starting checklist for future projects.

The short, enforceable subset lives in `.cursor/rules/architecture-guardrails.mdc` and is
applied to every AI-assisted coding session automatically. A project-agnostic version of
these principles, reusable in any application, is in `architecture-principles-general.md`.

---

## 1. Ledger-first money handling

**What happened here**

- Cancelled bets and cancelled side-market bets were paid out during settlement
  (required an emergency guard plus the `CancelledPayoutAnomalies` and
  `DuplicateCreditGuard` admin reports, and a one-click corrective-deduction workflow).
- All stakes by a user on the same market shared one `referenceId`. After
  cancel + re-stake, obsolete transactions displayed the latest bet's stake/payout and
  reports could not reconstruct what actually happened. Fixing this required a
  retrofit: `stakeCycle` tracking plus immutable per-transaction snapshots
  (`betPick`, `betStakeSnapshot`, ...).
- Re-settlement of side markets produced wallet artifacts (a user gained 250 coins from
  a BTTS result change) because correction transactions distorted the "at stake"
  timeline reconstruction, and updated `settledAt` values rewrote history.

**Rules for next time**

1. Money movements are **append-only ledger entries**. Never mutate or reinterpret an
   existing wallet transaction; corrections are new, explicitly-marked entries.
2. Every ledger entry carries an **idempotency key** unique to (user, wager, stake cycle,
   operation). Design the key before writing the first credit function.
3. Every ledger entry carries **immutable snapshots** of the context that produced it
   (pick, stake, odds, potential return). Reports must never join back to mutable rows
   (`Bet`, `SideBet`) to explain a historical transaction.
4. Balances shown anywhere (available / at stake / total) are derived from the ledger by
   one shared function (here: `buildWalletTransactionTimeline`), not re-implemented per
   screen. Unify the three balance labels once and reuse them.
5. Settlement credits must check wager status inside the same transaction that writes
   the credit (guard: never pay a CANCELLED/REFUNDED wager).

## 2. Explicit state machines for anything with a lifecycle

**What happened here**

- Bets, side bets, and matches each have lifecycles (open → locked → settled →
  re-settled/reverted), but transitions were enforced ad hoc. That allowed double
  settlement paths, payouts on cancelled bets, and "repair open bets" states after
  partial settlement.
- Flipping a bet LOST → WON via re-settlement left a gap in the historical exposure
  timeline that needed a synthetic `BET_SETTLED` marker to patch.
- Incident-based side markets (first team to score, first-half result) were auto-settled
  from unreliable API data (a missed penalty classified as a goal), so auto-settlement
  had to be selectively disabled per market type afterwards.

**Rules for next time**

1. Model each lifecycle as an explicit state machine: enumerate states, allowed
   transitions, and the side effects of each transition, before writing handlers.
2. Reversals and corrections are **forward transitions that append new records**; never
   rewrite timestamps (`settledAt`) or statuses in place without preserving the original.
3. Classify external data sources by trustworthiness up front. Anything derived from
   incident feeds gets a **human confirmation step** by default; only provably reliable
   values (final score, computed over/under, BTTS) may auto-settle.
4. Make every settlement-like operation **re-runnable**: running it twice must be a
   no-op (status guards + idempotent ledger writes), because retries and admin repairs
   will happen.

## 3. Contract-enforced API boundary

**What happened here**

- Prisma `Decimal` fields serialize to JSON strings. The frontend typed them as
  `number` and called `.toFixed(2)`, producing a white-screen crash in the admin
  settlement modal — on production.
- The shared package exports zod schemas but responses were mostly consumed via
  `api<T>()` type assertions, so drift between backend serialization and frontend types
  was invisible until runtime.
- An upload endpoint failure returned an HTML error page where the client expected
  JSON ("Unexpected token '<'").

**Rules for next time**

1. Decide a **serialization policy** on day one: Decimals and money as numbers or
   strings (pick one), dates as ISO strings. Convert at the API boundary
   (`Number(value)` in the route/serializer), never in individual components.
2. Shared zod schemas in `packages/shared` are the contract. For critical payloads,
   **parse** (not just type-assert) on the frontend, so drift fails loudly in dev.
3. Error responses are always JSON with a stable shape, including from middleware
   (upload limits, auth, proxies). Map infrastructure errors (Prisma P2024/P2028) to
   meaningful HTTP statuses instead of generic 500s.
4. Any formatting helper that touches API numbers must tolerate strings
   (see `formatOdds`) — but treat that as defense-in-depth, not the fix.

## 4. Performance as a default, not a retrofit

**What happened here**

- Admin matches endpoint returned every match with deep includes (markets, options,
  bet counts); loading became "really too long" and had to be retrofitted with
  server-side pagination, filters, and stats aggregation.
- `My results` blocked first paint on a `Promise.all` of two heavy endpoints; the
  rankings endpoint recomputed six leaderboards per request; analytics had to be split
  out and deferred.
- Settlement caused an unresponsive app and 500s: default 5s Prisma transaction
  timeouts, nested long transactions holding pool connections, N+1 wallet lookups per
  side bet, and a "badge storm" of concurrent background jobs.
- Special contests UI felt broken because every click waited for the server round-trip
  (fixed with optimistic UI, same later for bracket picks).

**Rules for next time**

1. Every list endpoint ships with **pagination + server-side filtering** from its first
   version. Unbounded `findMany` with deep includes is a review blocker.
2. Page loads render the **critical content first**; secondary panels (rankings,
   analytics, badges) load asynchronously with visible loading states.
3. Set **explicit transaction timeouts** and never nest a transaction inside another
   long-running one. Batch lookups (one `findMany` + in-memory map) instead of per-row
   queries inside loops.
4. Background work triggered by user actions (badges, auto-settlement, stats refresh)
   goes through a **queue or single-flight guard**, never fire-per-row concurrency.
5. User interactions that mutate state get **optimistic UI** when the operation is
   cheap to reconcile.

## 5. Concurrency policy

**What happened here**

- Auto-settlement ran inside live-score sync requests, holding a 120s transaction and
  racing itself across polls; it needed an in-process mutex and fire-and-forget
  decoupling.
- Tournament stats refresh collided under concurrent runs.

**Rules for next time**

1. Any operation that must not run twice concurrently (settlement, refresh, import)
   gets a **single-flight guard** (in-process map, advisory lock, or job queue) from the
   start. Name the guard in the design, not after the first race.
2. Request handlers never `await` heavy derived work; they enqueue it. Live/polling
   endpoints especially must stay cheap.

## 6. Operability designed with the feature

**What happened here**

- Wallet anomalies were investigated via exported CSVs and ad hoc queries until
  integrity reports (`BetTransactionIntegrityReport`, duplicate-credit guard,
  cancelled-payout anomalies) and one-click resolution were built — after the incidents.
- Settlement investigations needed data that was not visible: odds offered at
  settlement time, cancelled-bet counts in summaries, pick-based filters. Each was a
  follow-up request after confusion ("summaries don't fit").
- Admin "view as user" impersonation was needed to reproduce user-reported issues.

**Rules for next time**

1. For every money-moving feature, build the **integrity report + repair action** in the
   same PR as the feature. If you can't write the invariant check, the design is not
   done.
2. Reports must be **self-consistent**: every total shown must visibly decompose into
   the displayed rows/columns (the missing "Cancelled" column lesson).
3. Include investigation context in operational views (odds at time of settlement,
   stake cycle, snapshots), because you will investigate.
4. Build impersonation/read-as-user early for any multi-user product.

## 7. External data ingestion

**What happened here**

- API-Football incidents misclassified a missed penalty as a goal, corrupting
  first-team-to-score and first-half-result settlements.
- CSV player imports broke on locale/diacritics normalization (Višinský, Gutiérrez...)
  and locale decimal separators broke odds input ("Please enter valid exact-score odds").
- Team flags, player photos, FIFA rankings arrived incomplete and needed fallbacks.

**Rules for next time**

1. Every external feed gets an explicit **classification/normalization layer** with unit
   tests for edge cases (missed vs scored penalty, VAR-disallowed goals, diacritics,
   `,` vs `.` decimals) before the data drives any money-affecting logic.
2. Always define **fallback rendering** for missing external assets (avatar placeholder,
   default flag) as part of the first implementation.
3. Store what you fetched (raw + parsed) so reclassification is possible without
   re-fetching.

## 8. Environment, deploy, and branch hygiene

**What happened here**

- A fix was pushed to an already-merged PR branch (PR 85), silently leaving the
  "odds crash + pick filter" fix undeployed; it had to be found by cross-checking
  `git cherry` against `main` and cherry-picked into PR 86.
- Local Prisma client drift produced confusing errors (`prisma://` protocol error,
  "Database schema is missing"), and stale Node processes masked fixes.
- CI failures came from unused imports, PowerShell-vs-bash command syntax, and test
  pollution from prior runs (fixed by time-scoped assertions).

**Rules for next time**

1. One PR = one branch cut from current `main`; after a PR merges, its branch is dead —
   never push follow-ups to it. Verify "what is deployed" with commit SHAs
   (`git cherry`, deploy workflow run SHA), not memory.
2. Automate version stamping from CI metadata (done here: `1.0.<PR_NUMBER>`), so the
   running version is always traceable to a PR.
3. Integration tests must be **isolated in time and data** (scope assertions to records
   created by the test; unique fixtures), so CI reruns and shared DBs don't pollute.
4. Keep a documented local-env reset path (regenerate Prisma client, kill stale
   processes, apply migrations) — it was needed repeatedly.

## 9. UX conventions that prevented rework

Smaller lessons that repeatedly generated fix requests:

- **Timezones/dates**: use one date-picker convention and store UTC; the special-contest
  datepicker "hours around current time" confusion came from mixing local defaults.
- **Labels**: copy errors (exact-score market labelled "first scorer") slip through when
  labels are duplicated per call-site; centralize label maps (`sideMarketLabel`).
- **Sticky/global UI**: balance visibility mattered enough that a sticky compact topbar
  was requested; consider persistent key-numbers UI early for wallet-style apps.
- **Tables**: any stats/report table should ship with sorting, search, and row limits —
  they were requested for every table eventually.

---

## Quick-start checklist for a new project of this type

1. Define the wallet/ledger schema first: append-only, idempotency keys, snapshots,
   stake cycles, one timeline builder.
2. Write state machines for every lifecycle entity; reversals append, never mutate.
3. Fix the serialization policy (Decimal, dates) and parse shared schemas at the client
   boundary.
4. Pagination, filtering, and async secondary loading by default.
5. Single-flight guards + queues for settlement-like and background work.
6. Integrity report + repair action shipped with each money feature.
7. Normalization + tests for every external feed; fallbacks for missing assets.
8. CI version stamping; PR branches die at merge; deploy verification by SHA.
