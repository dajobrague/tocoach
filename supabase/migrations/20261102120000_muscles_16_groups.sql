-- Muscle taxonomy 30 -> 16 groups (Nov 2 call, JC). Merges: serrato /
-- pectoral_superior -> pectoral; braquial -> biceps; trapecio_superior /
-- trapecio_medio / romboides -> trapecio; redondo_mayor -> dorsal; lumbares ->
-- erectores; abdominales / oblicuos / transverso -> abdomen; gluteo_mayor /
-- gluteo_medio -> gluteo; soleo -> gemelos. Removed (no replacement):
-- manguito_rotador, flexores_cadera, tibial, cuello.
-- Same list as MUSCLES in lib/training/muscles.ts (muscles.test.ts checks the
-- ARRAY below). Apply by hand in the Supabase SQL editor (project norm).
--
-- Exercises left without a primary muscle because they only had removed ones
-- show up in the library's "missing muscles" banner for the assistant to fill.

BEGIN;

ALTER TABLE exercises
    DROP CONSTRAINT IF EXISTS exercises_muscles_known,
    DROP CONSTRAINT IF EXISTS exercises_muscles_disjoint;

CREATE FUNCTION pg_temp.map_muscles(arr TEXT[]) RETURNS TEXT[]
LANGUAGE sql IMMUTABLE AS $$
    SELECT COALESCE(array_agg(m ORDER BY o), '{}')
    FROM (
        SELECT m, min(ord) AS o
        FROM (
            SELECT CASE x
                WHEN 'pectoral_superior' THEN 'pectoral'
                WHEN 'serrato' THEN 'pectoral'
                WHEN 'braquial' THEN 'biceps'
                WHEN 'trapecio_superior' THEN 'trapecio'
                WHEN 'trapecio_medio' THEN 'trapecio'
                WHEN 'romboides' THEN 'trapecio'
                WHEN 'redondo_mayor' THEN 'dorsal'
                WHEN 'lumbares' THEN 'erectores'
                WHEN 'abdominales' THEN 'abdomen'
                WHEN 'oblicuos' THEN 'abdomen'
                WHEN 'transverso' THEN 'abdomen'
                WHEN 'gluteo_mayor' THEN 'gluteo'
                WHEN 'gluteo_medio' THEN 'gluteo'
                WHEN 'soleo' THEN 'gemelos'
                WHEN 'manguito_rotador' THEN NULL
                WHEN 'flexores_cadera' THEN NULL
                WHEN 'tibial' THEN NULL
                WHEN 'cuello' THEN NULL
                ELSE x
            END AS m, ord
            FROM unnest(arr) WITH ORDINALITY AS t(x, ord)
        ) mapped
        WHERE m IS NOT NULL
        GROUP BY m
    ) merged
$$;

UPDATE exercises
SET primary_muscles = pg_temp.map_muscles(primary_muscles),
    secondary_muscles = pg_temp.map_muscles(secondary_muscles)
WHERE primary_muscles <> '{}' OR secondary_muscles <> '{}';

-- A merge can put the same group in both lists (e.g. oblicuos + abdominales).
UPDATE exercises
SET secondary_muscles = ARRAY(
    SELECT s FROM unnest(secondary_muscles) AS s
    WHERE NOT s = ANY (primary_muscles)
)
WHERE primary_muscles && secondary_muscles;

ALTER TABLE exercises
    ADD CONSTRAINT exercises_muscles_known CHECK (
        (primary_muscles || secondary_muscles) <@ ARRAY[
            'pectoral',
            'deltoides_anterior',
            'deltoides_lateral',
            'deltoides_posterior',
            'biceps',
            'triceps',
            'antebrazo',
            'trapecio',
            'dorsal',
            'erectores',
            'abdomen',
            'gluteo',
            'aductores',
            'cuadriceps',
            'isquiotibiales',
            'gemelos'
        ]::TEXT[]
    ),
    ADD CONSTRAINT exercises_muscles_disjoint CHECK (
        NOT (primary_muscles && secondary_muscles)
    );

COMMIT;
