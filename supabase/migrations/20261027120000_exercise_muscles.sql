-- Structured muscles per exercise (Oct 14 call, JC): primary muscles
-- (required in the editor, several allowed) and optional secondary ones,
-- from the fixed taxonomy in lib/training/muscles.ts. Feeds the client's
-- muscle map on the share card and the library filter. The legacy free-text
-- muscle_groups column stays untouched; the backfill from it is a separate
-- reviewed script (scripts/backfill-exercise-muscles.ts), not this migration.

ALTER TABLE exercises
    ADD COLUMN IF NOT EXISTS primary_muscles TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS secondary_muscles TEXT[] NOT NULL DEFAULT '{}';

-- Same list as MUSCLES in lib/training/muscles.ts (muscles.test.ts checks).
ALTER TABLE exercises
    DROP CONSTRAINT IF EXISTS exercises_muscles_known,
    ADD CONSTRAINT exercises_muscles_known CHECK (
        (primary_muscles || secondary_muscles) <@ ARRAY[
            'pectoral_superior',
            'pectoral',
            'serrato',
            'deltoides_anterior',
            'deltoides_lateral',
            'deltoides_posterior',
            'manguito_rotador',
            'biceps',
            'braquial',
            'triceps',
            'antebrazo',
            'trapecio_superior',
            'trapecio_medio',
            'romboides',
            'dorsal',
            'redondo_mayor',
            'lumbares',
            'abdominales',
            'oblicuos',
            'transverso',
            'gluteo_mayor',
            'gluteo_medio',
            'flexores_cadera',
            'aductores',
            'cuadriceps',
            'isquiotibiales',
            'gemelos',
            'soleo',
            'tibial',
            'cuello'
        ]::TEXT[]
    ),
    DROP CONSTRAINT IF EXISTS exercises_muscles_disjoint,
    ADD CONSTRAINT exercises_muscles_disjoint CHECK (
        NOT (primary_muscles && secondary_muscles)
    );
