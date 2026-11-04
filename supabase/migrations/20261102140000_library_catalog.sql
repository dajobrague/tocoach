-- Global, read-only catalog of the licensed RepDB exercises (701), seeded by
-- scripts/library-catalog/seed.ts. Spanish is the main text; de/en/fr live in
-- i18n. Muscles are already mapped to the app's 16 groups. Trainers "add" an
-- entry: that creates (or links) a row in their own `exercises` table, which
-- keeps pointing here through library_exercise_id (logs/sessions untouched).
-- Service-role only: no grants for anon/authenticated (see CLAUDE.md: tenant
-- isolation is in the API layer; the licence also forbids public catalog access).

CREATE TABLE IF NOT EXISTS library_exercises (
    slug TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    instructions TEXT[] NOT NULL DEFAULT '{}',
    tips TEXT[] NOT NULL DEFAULT '{}',
    category TEXT NOT NULL,
    body_part TEXT,
    difficulty TEXT,
    equipment TEXT,
    primary_muscles TEXT[] NOT NULL DEFAULT '{}',
    secondary_muscles TEXT[] NOT NULL DEFAULT '{}',
    has_animation BOOLEAN NOT NULL DEFAULT FALSE,
    is_unilateral BOOLEAN NOT NULL DEFAULT FALSE,
    -- lower-case, accent-free names + synonyms, for ILIKE search
    search TEXT NOT NULL DEFAULT '',
    i18n JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT library_exercises_category_check CHECK (
        category IN ('strength', 'cardio', 'flexibility', 'balance', 'plyometric', 'olympic', 'powerlifting', 'bodyweight', 'other')
    )
);

ALTER TABLE library_exercises ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON library_exercises FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS library_exercises_category_idx ON library_exercises (category);
CREATE INDEX IF NOT EXISTS library_exercises_primary_idx ON library_exercises USING GIN (primary_muscles);

ALTER TABLE exercises
    ADD COLUMN IF NOT EXISTS library_exercise_id TEXT REFERENCES library_exercises (slug) ON DELETE SET NULL;

-- One library entry per trainer: adding twice returns the same exercise.
CREATE UNIQUE INDEX IF NOT EXISTS exercises_trainer_library_uniq
    ON exercises (trainer_id, library_exercise_id)
    WHERE library_exercise_id IS NOT NULL;
