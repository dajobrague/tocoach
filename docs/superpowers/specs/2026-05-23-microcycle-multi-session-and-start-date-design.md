# Microciclo: multi-session per day + start_date propagation

**Date:** 2026-05-23
**Authors:** David Bracho + Claude
**Status:** Design — pending plan

## TL;DR

Two user-visible bugs share one architectural root:

1. **"Client picks a different session and everything goes south"** — when a client opens or logs from more than one session on the same day (e.g. peeks at "Torso Fuerza" then trains "Bíceps y Pierna"), every log piles into a single `scheduled_sessions` row whose `session_id` is whichever session was tapped first. Status never completes, adherence is wrong, the trainer view shows the wrong session as "what the client did".
2. **"Changing the microcycle's `start_date` doesn't propagate to future dates"** — pre-existing `scheduled_sessions` rows (trainer per-date overrides, or rows pre-created against the old alignment) keep their frozen `session_id` and override the resolver. The trainer expects future dates to re-align to the new anchor; today they don't.

Both stem from the same mistake: `scheduled_sessions.session_id` is being used as the **prescription anchor** when it actually represents **the first session that got tapped**. Today's invariant — "exactly one `scheduled_sessions` row per `(client_id, scheduled_date)`" — was added in migration 106 to deduplicate concurrent inserts; it accidentally collapsed the data model.

Fix, in one sentence: **drop the (client, date) uniqueness; key on (client, date, session_id) instead; treat `scheduled_sessions` as an activity ledger, with the prescription always derived live from `microcycle` + per-date trainer overrides.**

## Problem evidence

Client 179 (Pedro Javier Orellana Pérez), trainer Carlos Torres. Microcycle: 21-day cycle starting 2026-05-11. Sample dates after divergence:

| Date        | Template          | `ss.session_id`        | `prescribed_by` | logs | distinct sessions logged from |
| ----------- | ----------------- | ---------------------- | --------------- | ---- | ----------------------------- |
| 5-12        | Torso Fuerza      | Bíceps y Pierna Fuerza | client          | 5    | 2                             |
| 5-14 (REST) | —                 | Bíceps y Pierna Fuerza | client          | 13   | **7**                         |
| 5-17 (REST) | —                 | Bíceps y Glúteo H      | client          | 10   | **8**                         |
| 5-23        | Bíceps y Glúteo H | Bíceps y Glúteo H      | trainer         | 9    | **7**                         |

On 5-14 (a REST day in the template) Pedro touched at least four different sessions; all 13 logs are bolted to one row labeled "Bíceps y Pierna Fuerza", including exercises that exist _only_ in Torso Hipertrofia (`Cruces de poleas`, `Press inclinado en multipower`) and Bíceps y Glúteo Hipertrofia (`Hip thrust unilateral`, `Zancada glutificada`, `Gemelo de pie`). Even trainer-prescribed days (5-23) collect cross-session pollution because additional logs piggyback on the same row.

`maybeMarkScheduledCompleted` (`app/api/clients/[clientId]/exercise-logs/route.ts:607`) measures finalized logs against `session_exercises` of `ss.session_id`. With the wrong `session_id` frozen on the row, the math never hits 100% and the day stays "scheduled" forever.

`use-week-metrics.ts:toPrescribedFromLogs` exists today as a band-aid: when the divergence is detected, it abandons the prescription template entirely and rebuilds adherence from raw logs. That hides the corruption visually but doesn't fix attribution.

## Design

### 1. Data model

`scheduled_sessions` becomes an **activity ledger**, not a prescription record. One row per **(client, date, session)** the client (or trainer via override) actually touched.

```
DROP CONSTRAINT scheduled_sessions_client_date_unique;
ADD CONSTRAINT  scheduled_sessions_client_date_session_unique
  UNIQUE (client_id, scheduled_date, session_id);
```

Columns stay the same; semantics change:

- `session_id` = "this row represents activity against this specific session" — no longer "the prescription". Required (non-null) going forward.
- `prescribed_by` = who _opened_ this row first:
  - `trainer` if the trainer explicitly created it via per-date override or session swap.
  - `client` if the client logged against it without a prior trainer override.
- `status` / `completion_date` = per (date, session) — i.e. "did the client finish Torso Fuerza on 5-14" independently of "did they finish Bíceps y Pierna on 5-14".

Migration 106's `(client_id, scheduled_date)` UNIQUE is dropped. Migrations 107 (`prescribed_by`), 108 (`microcycle.start_date`), 109/111 (RPC), 112 (re-backfill) keep their column-level intent but the row-level meaning is now per-session.

### 2. `upsert_scheduled_session` RPC

The advisory-lock key widens from `(client, date)` to `(client, date, session_id)`. The SELECT widens too. The shape of the function stays compatible — same args, same return.

```sql
v_lock_key := hashtextextended(
  p_client_id::text || ':' || p_scheduled_date::text || ':' || p_session_id::text, 0
);
PERFORM pg_advisory_xact_lock(v_lock_key);

SELECT id INTO v_id
FROM scheduled_sessions
WHERE client_id = p_client_id
  AND scheduled_date = p_scheduled_date
  AND session_id = p_session_id
FOR UPDATE;
```

`p_session_id` becomes required (the function already takes it, today's callers always pass it).

### 3. Prescription resolver — derive live, never read frozen

`app/api/client/scheduled-sessions/[date]/route.ts` stops using `ssRow.session_id` to decide "what to display for the day". The logic becomes:

1. **Compute the prescribed session** for the date:
   - If there's a `scheduled_sessions` row for this date with `prescribed_by='trainer'` → that's an explicit trainer per-date pin; use its `session_id` (plus its `scheduled_session_exercises` rows if populated, which override the session's default exercises for that date).
   - Otherwise → derive from the microcycle slot for the date (`dayIndex = ((date - microcycle.start_date) % duration_days) + 1`).
   - `prescribed_by='client'` rows are **activity only** and never participate in this decision.
2. **The current state of each session the client has touched** (`source`, status, completion) is read from the matching `scheduled_sessions` row keyed on `(client, date, session_id)`.

The client UI continues to show the prescribed session prominently and any other sessions the client has logged against on the same day are surfaced as additional cards (see §5).

### 4. Trainer per-date override

The trainer's "I want to swap session for this specific date" flow keeps using `replace_scheduled_session_overrides`. After this change:

- The override creates (or updates) the `scheduled_sessions` row with `prescribed_by='trainer'` and the session_id the trainer chose for that date.
- If the client subsequently logs against a _different_ session on the same date, a _new_ row is inserted for `(client, date, other_session_id)` with `prescribed_by='client'`. The trainer's override stays intact.
- The trainer's metrics view now shows both: the prescribed session (with adherence against the override) **and** the other sessions the client did (off-plan activity).

### 5. Trainer day-card UI

The trainer's microcycle metrics view (`components/dashboard/client-profile/tabs/microcycle/`) renders one card per `(date, session)` row the client touched, plus the prescribed card if no row exists for it yet. The day header shows the trainer's recommended session for context. The "Originalmente prescrito" chip moves from per-row to per-day (one chip when the recommended session isn't among the cards rendered, listing what it would have been).

`use-week-metrics.ts:toPrescribedFromLogs` is deleted. With per-session rows, adherence is computed cleanly per row against its own `session_exercises` — no log-shaped reconstruction needed.

### 6. `start_date` change propagation

Editing a microcycle's `start_date` triggers a server-side cleanup of **future** prescription rows:

- Effective date `D = new start_date` (the date the trainer chose; per the user spec, "I changed it to Wednesday the 10th → from the 10th onwards").
- Delete all `scheduled_sessions` rows where `scheduled_date >= D` AND `prescribed_by='trainer'` AND the row has no client logs attached (i.e. pre-populated future overrides that the client hasn't trained against).
- Keep rows where the client has already logged — that's preserved client activity even if the trainer realigns underneath.
- Keep rows with `scheduled_date < D` — that's history.

The trainer's microcycle editor, when saving a `start_date` that differs from the previous value, shows a confirmation modal: "Esto borrará las prescripciones futuras pre-cargadas a partir del {D} y las recalculará con la nueva alineación. ¿Continuar?" — single click, no per-row prompt.

Forward-rendering then just works: the resolver derives every future date from the new `start_date` (modulo `duration_days`) and the only frozen rows are deliberate trainer overrides on dates with no client activity past the new anchor — which we cleared.

### 7. No historical backfill

Per user direction, we do **not** migrate Pedro-style polluted historical rows. Past data stays where it is — those logs represent real client activity, and trying to split them by inferring session attribution from `exercise_id` (which can belong to multiple sessions) would introduce its own errors.

From the deploy of this change forward, every new (client, date, session_id) gets its own row. The trainer's historical view stays a bit noisy on already-corrupted dates but stops getting worse.

## Component-by-component impact

| Layer                                                                     | What changes                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/`                                                    | New migration: drop `scheduled_sessions_client_date_unique`, add `scheduled_sessions_client_date_session_unique`, update `upsert_scheduled_session` advisory lock + SELECT, comment-only updates on `prescribed_by` semantics       |
| `app/api/clients/[clientId]/exercise-logs/route.ts`                       | RPC call unchanged (already passes `p_session_id`); `maybeMarkScheduledCompleted` now meaningful because `ss.session_id` is correct                                                                                                 |
| `app/api/client/scheduled-sessions/[date]/route.ts`                       | Resolver no longer trusts `ssRow.session_id` for prescription; prescription derived live from microcycle + per-date trainer overrides; returns the full set of sessions the client has logged for the date (current shape extended) |
| `app/api/clients/[clientId]/scheduled-sessions/trainer/route.ts`          | Merge logic simplifies: real rows are activity, template rows are prescription; both coexist on the same date                                                                                                                       |
| `components/client-dashboard/workouts/active-session-view.tsx`            | Per-session state guard already exists (`resolved.session?.id === session.id`); becomes the standard path, no more fallback-to-template-because-resolved-is-wrong-session                                                           |
| `components/dashboard/client-profile/tabs/microcycle/use-week-metrics.ts` | Delete `toPrescribedFromLogs`; render N cards per date when multiple rows exist                                                                                                                                                     |
| `components/trainer/microcycle/`                                          | Save-microcycle hook gains the "reset future" confirmation flow when `start_date` changes                                                                                                                                           |

## Risks

1. **Existing client-divergent rows on dates yet to be migrated** — the deploy lands while clients have rows mid-day. New rows will be created for any session they touch after deploy; the existing polluted row stays. Acceptable per the no-backfill decision.
2. **Trainer overrides authored against the old (client, date) uniqueness** — these still exist as `prescribed_by='trainer'` rows. Once uniqueness widens, a trainer could create a _second_ override for the same date with a different session. UI gates this to one explicit override per date; the data layer just stops fighting it.
3. **Concurrency** — the advisory lock keying on `(client, date, session_id)` is strictly finer-grained than today; no regression. Cross-session client log bursts that previously serialized through one lock now run independently. Wins.

## Out of scope

- Multiple microcycles per program (still UNIQUE on `client_program_id`).
- Progressive microcycles (week 1 ≠ week 2).
- Historical row repair / backfill for clients other than the fix-forward behavior.
- Cancellation / "I rest-skipped this day" UX — orthogonal.

## Open questions before plan

None requiring product input — the user has signed off on:

- Start_date change: keep past, wipe pre-populated trainer overrides forward.
- Multi-session day cards: stacked list with per-session adherence.
- No historical backfill: fix forward only.
