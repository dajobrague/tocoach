-- Borra los charts huérfanos cuyo source.kind = 'catalog' y cuyo id
-- ya no tiene adapter en el registry (post-cleanup de catalog.ts
-- 2026-05-12).
--
-- Adapters retirados: sleep_hours, steps, calories, protein, carbs,
-- fats, water, mood, energy, stress, body_fat, weight.
--
-- Adapters preservados (NO se tocan):
--   - training_breakdown (lee exercise_logs, sin equivalente)
--   - macros_breakdown (composite multi-series ring)
--
-- Por qué borrar:
--   La migration 102 reescribió los charts a form_question cuando el
--   tenant tenía la pregunta. Lo que quedó como catalog son tenants
--   SIN pregunta compatible — el filtro de resolvability ya los
--   escondía runtime, pero seguir cargándolos en el JSON, validándolos,
--   pasándolos por el filterUnusableCharts cada request es trabajo
--   inútil. Auditoría 2026-05-12 confirma 14 charts en este estado.
--
-- Conservadora: solo borra catalog ids retirados. Si en el futuro
-- decidimos reintroducir un adapter (e.g. mood vuelve), los datos del
-- chart se perdieron pero el trainer puede re-crearlo desde el picker.
--
-- Idempotente: re-ejecutar solo afecta charts que todavía cumplan la
-- condición (catalog id retirado).

UPDATE trainer_chart_templates
SET charts = jsonb_build_object(
  'version', COALESCE(charts->'version', '1'),
  'charts',
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_set(c, '{position}', to_jsonb(new_pos - 1))
        ORDER BY (c->>'position')::INT NULLS LAST
      )
      FROM (
        SELECT
          c,
          ROW_NUMBER() OVER (
            ORDER BY (c->>'position')::INT NULLS LAST
          ) AS new_pos
        FROM jsonb_array_elements(charts->'charts') c
        WHERE NOT (
          c->'source'->>'kind' = 'catalog'
          AND c->'source'->>'id' NOT IN ('training_breakdown', 'macros_breakdown')
        )
      ) renumbered
    ),
    '[]'::jsonb
  )
)
WHERE charts->'charts' @> '[{"source":{"kind":"catalog"}}]'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(charts->'charts') c
    WHERE c->'source'->>'kind' = 'catalog'
      AND c->'source'->>'id' NOT IN ('training_breakdown', 'macros_breakdown')
  );

UPDATE client_chart_configs
SET charts = jsonb_build_object(
  'version', COALESCE(charts->'version', '1'),
  'charts',
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_set(c, '{position}', to_jsonb(new_pos - 1))
        ORDER BY (c->>'position')::INT NULLS LAST
      )
      FROM (
        SELECT
          c,
          ROW_NUMBER() OVER (
            ORDER BY (c->>'position')::INT NULLS LAST
          ) AS new_pos
        FROM jsonb_array_elements(charts->'charts') c
        WHERE NOT (
          c->'source'->>'kind' = 'catalog'
          AND c->'source'->>'id' NOT IN ('training_breakdown', 'macros_breakdown')
        )
      ) renumbered
    ),
    '[]'::jsonb
  )
)
WHERE charts->'charts' @> '[{"source":{"kind":"catalog"}}]'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(charts->'charts') c
    WHERE c->'source'->>'kind' = 'catalog'
      AND c->'source'->>'id' NOT IN ('training_breakdown', 'macros_breakdown')
  );
