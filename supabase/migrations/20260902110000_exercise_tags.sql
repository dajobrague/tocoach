-- Exercise tags (Sep 2 call, JC): free-form labels ("pectoral", "mancuernas",
-- "barra", "empuje") the trainer filters by when picking exercises for a
-- session — e.g. a client who only trains at home with a barbell and
-- dumbbells. Same predictive input as recipe tags; no folders for exercises.

ALTER TABLE exercises
    ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

-- GET /api/exercises?tag=a&tag=b filters with `tags @> ARRAY[a, b]`.
CREATE INDEX IF NOT EXISTS exercises_tags_idx ON exercises USING gin (tags);

-- One-time seed so the filter is useful on day one: the muscle groups and
-- equipment already typed on each exercise become its first tags. Only rows
-- with no tags yet are touched, so re-running is safe.
UPDATE exercises
SET tags = (
    SELECT COALESCE(array_agg(DISTINCT btrim(t)), '{}')
    FROM unnest(COALESCE(muscle_groups, '{}') || COALESCE(equipment, '{}')) AS t
    WHERE btrim(t) <> ''
)
WHERE tags = '{}';
