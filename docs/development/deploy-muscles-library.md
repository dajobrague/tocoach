# Deploy checklist: 16 muscle groups + RepDB exercise library

Branch: `feat/muscles-16` (on top of local `main` a424753, which is itself 13
commits ahead of `origin/main`: the share-card work needs the muscle columns
in prod before it can ship). Written Nov 2 2026 after reading prod
(`ydqhndnvrkvycnkaghro`) with SELECT only.

## State of prod when this was written

| Check                                                   | Result                 |
| ------------------------------------------------------- | ---------------------- |
| `exercises` rows                                        | 4,106                  |
| Rows with legacy `muscle_groups` text                   | 1,876 (none converted) |
| `primary_muscles` / `secondary_muscles` columns         | **do not exist**       |
| `library_exercise_id` column, `library_exercises` table | do not exist           |
| `tags` column                                           | exists                 |

So prod is missing the Oct 27 muscle migration too. Everything below runs in
order; do not skip step 1.

## Rules for this deploy

- Migrations are applied **by hand in the Supabase SQL editor** (the ledger
  needs repair before `supabase db push`; see project notes).
- **Database first, code second.** The new code selects `library_exercise_id`,
  `primary_muscles` and `secondary_muscles`; deploying it before the columns
  exist breaks `/api/client/scheduled-sessions/[date]` and the library.
- Old code against the new DB is safe (extra columns are ignored).
- **Never push until David has tested locally and asks for it.**
- Prod credentials are never put in `.env.local` (it points at the local stack).
  Export them in the shell for the two scripts that need them (steps 5 and 6)
  and close the shell afterwards.

## 0. Before touching anything

- [ ] Local branch is green: `npm run type-check`, `npm run lint:check`,
      `npx vitest run` (last run: 1,092 tests passing).
- [ ] David has reviewed the branch on the local server (library, picker,
      program editor volume, client session, share image, Biblioteca modal).
- [ ] Take a Supabase backup / note the point-in-time restore time
      (Dashboard -> Database -> Backups).
- [ ] Pick a low-traffic window. The migrations are fast, but the remap
      (step 2) updates every exercise that has muscles.

## 1. Muscle columns (existing migration, never applied to prod)

Run `supabase/migrations/20261027120000_exercise_muscles.sql`.

Verify:

```sql
select column_name from information_schema.columns
where table_name = 'exercises' and column_name in ('primary_muscles','secondary_muscles');
-- expect 2 rows
```

## 2. 16-group taxonomy

Run `supabase/migrations/20261102120000_muscles_16_groups.sql`.
It drops the old CHECK, remaps stored ids to the 16 groups, removes primary /
secondary overlaps, and re-adds the CHECKs (inside one transaction).

Right after step 1 the columns are empty, so the remap is a no-op in prod and
this step is fast. The real data arrives in step 4.

Verify:

```sql
select conname from pg_constraint
where conrelid = 'public.exercises'::regclass and conname like 'exercises_muscles_%';
-- expect exercises_muscles_known, exercises_muscles_disjoint
```

## 3. Library schema, bucket, indexes

Run in this order (all idempotent):

1. `20261102130000_library_media_bucket.sql` (private bucket `library-media`)
2. `20261102140000_library_catalog.sql` (`library_exercises`, `exercises.library_exercise_id`)
3. `20261102150000_exercises_indexes.sql` (pg_trgm + GIN + trainer/created)

Verify:

```sql
-- bucket is private and has no policies
select id, public from storage.buckets where id = 'library-media';           -- public = false
select count(*) from pg_policies where schemaname='storage' and policyname ilike '%library%'; -- 0
-- catalog is not readable by the public roles
select has_table_privilege('anon','library_exercises','select'),
       has_table_privilege('authenticated','library_exercises','select');     -- f | f
```

## 4. No data migration: the 1,876 legacy exercises are filled with the assistant

Decision (David, Oct 28): no bulk conversion of the old `muscle_groups` text.
There is no backfill script any more. Each trainer completes their own
exercises:

- The library shows a banner ("Completar con el asistente") with the count of
  exercises still without a primary muscle (`missing_muscles` in
  `GET /api/exercises`).
- The assistant (Claude Haiku, `POST /api/exercises/muscle-assistant`, 10
  exercises per call) proposes muscles from name, instructions, equipment and
  the old text as a hint. **Nothing is saved until the trainer accepts**
  (`.../muscle-assistant/apply`).
- The Inicio dashboard shows a one-time "novedad" modal and a reopen strip while
  the trainer has exercises without muscles.
- The model output is restricted to the 16 group ids and validated again with
  `parseMuscles`.

Needs `ANTHROPIC_API_KEY` in the Railway env (step 7). Cost scales with the
exercises trainers choose to complete (about 410 calls if all 4,106 were run).

Verify after deploy: open the library as a trainer with unfilled exercises,
run "Analizar con el asistente" on a batch, accept one, confirm it saves.

## 5. Seed the catalog (701 exercises)

With prod values exported in the shell (`NEXT_PUBLIC_SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`):

```bash
npx tsx scripts/library-catalog/seed.ts ~/Downloads/repdb-bundle-male/exercises.json
# expect: seeded 701 exercises; 1 without primary muscle
```

Idempotent: re-run after any change to the mapping in `lib/library/catalog.ts`.

## 6. Upload the media (about 48 MB, 2,490 files)

The compressed files are already built in `~/library-media-out/{male,female}`
(701 exercises each, 0 skipped). To rebuild: `node scripts/library-media/build.mjs <bundle> <sex> <outDir>`
(about 20 min per sex).

```bash
node scripts/library-media/upload.mjs ~/library-media-out/male male
node scripts/library-media/upload.mjs ~/library-media-out/female female
```

Verify (expect 1,245 per sex):

```sql
select split_part(name,'/',1) sex, count(*) from storage.objects
where bucket_id = 'library-media' group by 1;
```

Licence note: the bucket stays private; the only way to read it is
`GET /api/library/media` (signed URLs, 40 slugs per call). Do not add a
listing endpoint or make the bucket public.

## 7. Environment

- [ ] Railway has `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL` and
      `JWT_SECRET` (already required).
- [ ] **`ANTHROPIC_API_KEY`** is set in Railway (the muscle assistant; without it
      the endpoint answers "unavailable" and the rest of the app keeps working).
- [ ] No other new env vars are needed for the library or the media route.

## 8. Ship the code

- [ ] David asks for the push. Merge `feat/muscles-16` into `main`, then push.
- [ ] Railway runs `npm run build` (this does **not** type-check; step 0 did).
- [ ] If anything looks wrong, roll the deploy back first; the database
      changes are additive and old code keeps working against them.

## 9. Smoke tests (as a trainer and as a client)

Trainer:

- [ ] Library lists exercises; muscle filter shows the 16 groups.
- [ ] Edit an exercise: picker shows 16 chips, no "Principal" text, saves.
- [ ] **Biblioteca** modal: search "press banca", thumbnails load, "Añadir"
      creates it under **Fuerza** (everything except cardio is stored as strength).
- [ ] Add the same exercise twice: second time says Añadido, no duplicate.
- [ ] Program editor: expanded session shows "Series por músculo".
- [ ] Inicio shows the "novedad" modal (once) and then the reopen strip while
      exercises are missing muscles; "Completar con el asistente" opens the review.
- [ ] Assistant: analyze a batch, accept/correct one, save; it appears in the library.

Client:

- [ ] Session list shows thumbnails for catalog exercises.
- [ ] Opening an exercise plays the clip, matching the client's sex
      (set a client's sex in the trainer's edit-client modal to test female).
- [ ] "Músculos de hoy" card shows the figure and sets per group.
- [ ] Share image, "musculos" template: top muscle groups with series.

Security:

- [ ] `curl https://<host>/api/library/media?slugs=clean` without a session -> 401.
- [ ] A public storage URL for `library-media/male/clean.mp4` -> 400.

## 10. Later: drop the legacy column

The assistant and the picker read `muscle_groups` as a hint, so keep it until
trainers have completed their exercises (or David accepts losing the old text):

```sql
select count(*) from exercises
where array_length(muscle_groups,1) > 0 and primary_muscles = '{}';  -- must be 0
```

Then write the migration that drops `exercises.muscle_groups` and remove
`legacyToMuscles`, the picker's `legacy` prop, the assistant's `legacyMuscles`
hint and the `muscle_groups` fields in `types/training.ts`.
This is irreversible: back up first.

## Rollback

| Step | How to undo                                                                                                                                                          |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `alter table exercises drop column primary_muscles, drop column secondary_muscles;`                                                                                  |
| 2    | Not reversible once data exists (merged groups). Restore from the pre-deploy backup. Safe to ignore if the columns are still empty (step 1-2 before step 4).         |
| 3    | `drop table library_exercises cascade;` (also drops `exercises.library_exercise_id`), delete the bucket from the dashboard, `drop index` the three exercise indexes. |
| 4    | Assistant-saved muscles can be cleared per exercise in the picker; `muscle_groups` is never modified by the app.                                                     |
| 5-6  | Re-run the script after fixing, or empty the table / bucket.                                                                                                         |
| 8    | Roll back the Railway deploy.                                                                                                                                        |

## Known behaviours to expect (not bugs)

- Catalog exercises other than cardio land under **Fuerza** in the trainer's
  library (the app has two types). The catalog browser still shows the real categories.
- Trainers see the male figure; clients see the figure of the sex on their
  profile, or male if none is set.
- `kettlebell-tibialis-raise` has no primary muscle (all its muscles were dropped).
- Until trainers run the assistant, the 1,876 old exercises show the body map
  only as "sin músculos": the library banner counts them.
- Six hip-flexor stretches got their first secondary promoted to primary.
