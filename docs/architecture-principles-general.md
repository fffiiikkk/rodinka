# General Architecture Principles

A project-agnostic distillation of `architecture-lessons.md`. The original document maps
each rule to a concrete incident in FIFAWC26 (a betting app); this version abstracts the
same lessons so they apply to any application — e-commerce, SaaS, booking systems,
internal tools. Copy this file (or the companion Cursor rule) into new projects at day one.

Mapping of domain terms used below:

| FIFAWC26 term | General equivalent |
|---|---|
| Wallet / coins | Any balance, quota, credit, or inventory count |
| Bet / settlement | Any irreversible or hard-to-reverse business operation |
| Odds / picks | Any priced or versioned offer presented to a user |
| Live score sync | Any polling/webhook ingestion of external state |

---

## 1. Treat critical state as an append-only ledger

Applies to: money, credits, inventory, quotas, permissions grants, audit-relevant status.

- Record every change as an immutable event/transaction row; never update a balance in
  place and never reinterpret an old row. Corrections are new, explicitly-marked entries.
- Give every entry an **idempotency key** derived from its business identity
  (who, what, which attempt/cycle, which operation), designed before the first write path
  is coded. Retries, double-clicks, and job re-runs are guaranteed to happen.
- Snapshot the **context** into the entry (price at the time, version of the offer,
  quantity). Historical reporting must never join back to mutable rows to explain the
  past — those rows will have changed.
- Derive every displayed aggregate (balance, availability, totals) from the ledger via
  **one shared function**, not per-screen re-implementations that drift apart.

## 2. Model lifecycles as explicit state machines

Applies to: orders, subscriptions, bookings, documents, jobs — anything with a status field.

- Enumerate states and allowed transitions before writing handlers. Every mutation
  guards on current state inside the same transaction that applies the change.
- Reversal/undo/correction is a **forward transition that appends new records** — never
  rewrite historical timestamps or overwrite the original outcome.
- Make state-changing operations **idempotent**: running them twice must be a no-op.
- If an outcome depends on untrusted or noisy input (external feeds, ML output, user
  uploads), insert a **human confirmation state** by default and only automate the
  provably reliable subset.

## 3. Enforce the API contract, including serialization

- Pick a **serialization policy** on day one: how decimals/money, dates, big numbers,
  and nulls cross the wire. Convert at the boundary (serializer), never inside UI
  components. (Classic trap: backend decimal types serializing as strings while the
  frontend types them as numbers — crashes only at runtime.)
- Keep shared request/response schemas in one package and **runtime-parse** critical
  payloads on the consumer side, so contract drift fails loudly in development instead
  of silently in production.
- Error responses are machine-readable JSON with a stable shape from *every* layer —
  including middleware, proxies, and upload handlers. Map infrastructure failures
  (pool exhaustion, timeouts) to meaningful statuses (503), not generic 500s.

## 4. Performance is a default, not a retrofit

- Every list endpoint ships with **pagination and server-side filtering** in its first
  version. An unbounded query with deep joins/includes is a review blocker — it works in
  the demo and dies with real data.
- Render the **primary content first**; load secondary panels (analytics, leaderboards,
  recommendations) asynchronously with visible loading states. Never block first paint
  on the slowest of N parallel calls.
- Inside any loop, batch data access (one query + in-memory map). N+1 lookups are the
  single most common hidden cost.
- Set **explicit timeouts** on multi-step transactions; know your framework's defaults
  (they are usually too short for batch work and too long for request work).
- Background work triggered by user actions (notifications, recalculations, awards)
  goes through a **queue or is serialized** — never fan out one concurrent task per row.
- Use **optimistic UI** for cheap, reconcilable mutations; perceived latency is a
  correctness issue for users.

## 5. Concurrency: name the guard before the race happens

- Any operation that must not run twice concurrently (finalization, import, refresh,
  reconciliation) gets a **single-flight mechanism** in the design: in-process mutex,
  advisory lock, or queue. Decide which one at design time, not after the first
  double-execution incident.
- Handlers for frequent/polling endpoints stay cheap: they may *trigger* heavy work
  (fire-and-forget or enqueue) but never await it.
- Never nest a long-running transaction inside another; it holds pool connections and
  causes cascading timeouts under load.

## 6. Build operability with the feature, not after the incident

- For every feature that mutates critical state, ship the **invariant check /
  integrity report** in the same PR — and where feasible, a one-click repair action.
  If you cannot state the invariant, the design is not finished.
- Every summary number in a report must **visibly decompose** into the rows/columns
  shown. Hidden categories (cancelled, refunded, excluded) are how "the numbers don't
  add up" tickets are born.
- Record investigation context at write time (price/version at the moment of the
  operation), because you *will* investigate.
- For multi-user products, build **impersonation / view-as-user** early; reproducing
  user-specific issues without it is guesswork.

## 7. Distrust every external input

- Every external feed, import, or third-party API passes through a **tested
  normalization/classification layer** before it can affect critical state. Unit-test
  the ugly edge cases: locale decimal separators, diacritics, near-miss event types,
  partial data.
- Store the **raw payload alongside the parsed result** so you can reclassify
  historical data after fixing a parsing bug, without re-fetching.
- Define **fallback rendering** for missing external assets (images, labels, metadata)
  in the first implementation, not as a bug fix.

## 8. Deploy and branch hygiene

- One change-set = one branch cut from current `main`. A merged branch is **dead**;
  follow-up fixes get a new branch. Otherwise fixes silently miss deployment.
- Verify "what is deployed" with **commit SHAs** (compare branch vs main, check the
  deploy workflow's SHA) — never from memory.
- Stamp the build with traceable version metadata from CI (PR number, SHA) so the
  running version is always attributable.
- Integration tests scope their assertions to **data created by the test** (unique
  fixtures or time-scoped queries), so reruns and shared databases cannot pollute
  results.
- Document the local environment reset path (regenerate clients, kill stale processes,
  apply migrations); you will need it repeatedly.

## 9. Small UX conventions that prevent rework

- One timezone/date-handling convention, UTC in storage, explicit in pickers.
- Centralize display-label maps; per-call-site label strings guarantee copy drift.
- Persistent visibility for the user's key numbers (balance, quota, status) if the
  product revolves around them.
- Every data table eventually needs sorting, search, and row limits — ship them with
  the first table component and reuse it.

---

## Day-one checklist for any new project

1. Ledger schema for critical state: append-only, idempotency keys, context snapshots,
   one aggregate-builder function.
2. State machines for every lifecycle entity; corrections append, never mutate.
3. Serialization policy fixed and enforced at the boundary; shared schemas
   runtime-parsed by consumers.
4. Pagination + filtering on all list endpoints; async loading for secondary UI.
5. Single-flight guards and queues named in the design for non-reentrant operations.
6. Integrity check + repair action shipped with each critical-state feature.
7. Normalization layer + edge-case tests + raw-payload storage for every external input.
8. CI version stamping; merged branches are dead; deploy verification by SHA;
   isolated integration tests.
