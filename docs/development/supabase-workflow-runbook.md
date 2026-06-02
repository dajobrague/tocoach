# Supabase Workflow Runbook

> How to stop editing production by hand and move to a safe **local → staging → production** migration flow. Follow the parts in order. Each step is tagged **[SAFE]** (read-only / local only) or **[TOUCHES PROD]** (changes or reads production — slow down and read the notes).
>
> Project ref: `ydqhndnvrkvycnkaghro` (production, eu-west-2, Postgres 17). Today there is **one** project (prod), **no** `supabase/config.toml`, **116** migration files, and likely **undocumented drift** from past dashboard edits. The order below exists to deal with that drift safely.
>
> **Golden rule from here on:** the Supabase dashboard becomes read-only. Every schema change is a migration file, committed to git, applied in order to every environment. No exceptions.

---

## Part 0 — Prerequisites (one-time)

**[SAFE]**

1. Install the CLI (macOS):
   ```bash
   brew install supabase/tap/supabase
   supabase --version
   ```
2. Install Docker Desktop (or OrbStack) — required for the local stack and for schema diffing (the shadow database). Make sure it's running.
3. Log in:
   ```bash
   supabase login
   ```

---

## Part 1 — Back up production first

**[TOUCHES PROD — read-only, but do it anyway]**

Before any reconciliation, take a backup you can restore from.

1. Dashboard → Database → Backups → confirm a recent daily backup exists (or trigger one if your plan allows).
2. Also take your own schema + data dump locally:
   ```bash
   # schema only
   supabase db dump --linked -f backup_schema_$(date +%Y%m%d).sql
   # data only (optional, can be large)
   supabase db dump --linked --data-only -f backup_data_$(date +%Y%m%d).sql
   ```
   _(You'll link in Part 2; if you want the dump first, link first, then come back.)_

**Do not proceed past here until you have a backup you trust.**

---

## Part 2 — Link the repo to production & init the CLI

**[TOUCHES PROD — read-only]**

1. Initialize the CLI config that's currently missing (creates `supabase/config.toml`; keep your existing `supabase/migrations/`):
   ```bash
   supabase init
   ```
   If it warns the directory exists, that's fine — we only want the config file.
2. Link to the production project:
   ```bash
   supabase link --project-ref ydqhndnvrkvycnkaghro
   ```
3. Tidy the stray file: `supabase/migrations/clients_rows.sql` is a data dump, not a migration — move it out of `migrations/`:
   ```bash
   mkdir -p supabase/seed-data
   git mv supabase/migrations/clients_rows.sql supabase/seed-data/clients_rows.sql
   ```

---

## Part 3 — Diagnose the drift (look, don't touch)

**[SAFE / TOUCHES PROD — all read-only]**

This is the most important part. We find out how far the migration files have diverged from real production **before** changing anything.

1. Compare which migrations are applied where:

   ```bash
   supabase migration list --linked
   ```

   This shows three columns: local file, remote (applied on prod), and status. Watch for:

   - Files **local but not remote** → never applied to prod (or applied by hand and not recorded).
   - Versions **remote but not local** → applied on prod with no file.
   - **Version-format mismatch** — your files are numbered (`116_…`) but prod's history uses timestamps (`20260508…`). The CLI may not match them up cleanly. Note what it reports; we may need `migration repair` in Part 4.

2. Diff the _actual prod schema_ against your migration files:
   ```bash
   supabase db diff --linked --schema public > drift_report.sql
   ```
   - If `drift_report.sql` is **empty** → no drift, your files already equal production. Skip Part 4's capture step.
   - If it has content → that SQL **is your undocumented drift** (columns, policies, buckets you changed by hand that no file records). Read it carefully; this is exactly what's been at risk.

**Stop and review `drift_report.sql` with your own eyes before continuing.** Don't run it anywhere yet.

---

## Part 4 — Reconcile: make the files equal production

**[TOUCHES PROD — writes to the migration history table only, not your schema]**

Goal: get to a state where `supabase/migrations/` is the single source of truth and matches prod exactly. Pick the path that matches what Part 3 showed.

**If there was drift (`drift_report.sql` had content):** capture prod's real schema as one catch-up migration.

```bash
supabase db pull            # generates a migration file representing current remote schema
```

- Review the generated file. Rename it descriptively, e.g. `117_reconcile_prod_drift.sql`.
- This file documents reality. Commit it. From now the folder matches prod.

**If `migration list` showed history-table mismatches** (numbered vs timestamp, or files marked unapplied that actually _are_ live on prod): align the history table so the CLI agrees with reality — **without re-running the SQL**:

```bash
supabase migration repair --status applied <version>     # mark a migration as already-applied on prod
supabase migration repair --status reverted <version>    # mark one as not-applied
```

- `repair` only edits Supabase's bookkeeping of _which migrations ran_; it does **not** alter your tables. Use it to tell the CLI "these files are already live."
- Re-run `supabase migration list --linked` until local and remote agree with no surprises.

**Verify you've reached parity:**

```bash
supabase db diff --linked --schema public
```

Should now output **nothing**. That empty result is the goal — files == production. Commit everything.

---

## Part 5 — Stand up local development

**[SAFE — entirely on your machine]**

Now you have a place to make changes that isn't production.

1. Start the local stack (Docker must be running):
   ```bash
   supabase start
   ```
   Prints local URLs + keys. This is a full Postgres + Auth + Storage on your laptop.
2. Apply all migrations to the local DB from scratch to prove they're clean:
   ```bash
   supabase db reset
   ```
   This wipes local and replays every migration in order. If it errors, a migration file is broken — fix it now, locally, where it's harmless.
3. Point the app + our Vitest **integration tests** at the local stack (use the local URL/keys in a `.env.test` / `.env.local`). This is the test DB the coding rules (P0-T3) require.

Daily loop from here: change schema locally → `supabase db reset` → run tests → iterate.

---

## Part 6 — Set up staging (choose one)

**[TOUCHES PROD-adjacent — creates a separate environment]**

You want one gate between local and prod. Two options:

**Option A — Supabase Branching (preferred if your plan supports it).**

- Connect the GitHub repo in the Supabase dashboard (Branching / Integrations).
- Each git branch gets an isolated remote DB seeded from your migrations; opening a PR builds a preview, and **merging the PR applies the migrations to production automatically.** This is the "remote then merge" model you wanted.
- Cost: requires a paid plan; preview branches bill while running.

**Option B — A second free project as permanent staging (zero cost).**

- Create a new Supabase project named `topcoach-staging`.
- Link a `staging` git branch to it; push migrations there first:
  ```bash
  supabase link --project-ref <staging-ref>
  supabase db push          # applies pending migrations to staging
  ```
- Manually promote to prod once staging is verified (Part 7).

Recommendation: start with **Option B** (free, simple, gets you a safety gate today); graduate to **Option A** when you want the automated PR-to-prod flow.

---

## Part 7 — The new everyday workflow

**[mixed — but prod is touched only by `db push`, deliberately]**

For every schema change from now on:

1. **Create a migration** (never edit the dashboard):
   ```bash
   supabase migration new <descriptive_name>
   ```
   Write the SQL — additive, RLS included, numbered after 116/117.
2. **Test locally:**
   ```bash
   supabase db reset && npm run test       # migrations replay clean + tests pass
   ```
3. **Push to staging & verify:**
   ```bash
   supabase link --project-ref <staging-ref>
   supabase db push
   ```
   Run the app + e2e against staging.
4. **Promote to production** — only after staging is green:
   ```bash
   supabase link --project-ref ydqhndnvrkvycnkaghro
   supabase db push
   ```
   (With Branching/Option A, steps 3–4 are just "merge the PR.")
5. **Regenerate types** after schema changes and commit:
   ```bash
   supabase gen types typescript --linked > types/database.ts
   ```

**Guardrails:** never `supabase db push` straight to prod without staging passing; never edit schema in the dashboard; back up before any migration that drops or alters existing columns; keep migrations additive (the nutrition plan's cutover rule).

---

## Quick reference

| I want to…                                 | Command                                                      |
| ------------------------------------------ | ------------------------------------------------------------ |
| See what's applied where                   | `supabase migration list --linked`                           |
| Find undocumented drift                    | `supabase db diff --linked --schema public`                  |
| Capture prod schema as a file              | `supabase db pull`                                           |
| Fix history bookkeeping only               | `supabase migration repair --status applied <version>`       |
| Run a local DB                             | `supabase start`                                             |
| Replay all migrations locally              | `supabase db reset`                                          |
| New migration                              | `supabase migration new <name>`                              |
| Apply pending migrations to linked project | `supabase db push`                                           |
| Regenerate TS types                        | `supabase gen types typescript --linked > types/database.ts` |

---

## The order, in one breath

Back up → link + init → **diagnose drift (read-only)** → reconcile so files == prod → local stack for dev/tests → a staging gate → and then every change rides local → staging → prod through migration files, never the dashboard. The drift reconciliation (Parts 3–4) is the one-time cleanup; everything after is the routine.

_Want me to walk these with you live? I can run the read-only diagnostics (Parts 2–3) while you watch and we read the drift report together — I won't run anything that changes production without your go-ahead on each step._
