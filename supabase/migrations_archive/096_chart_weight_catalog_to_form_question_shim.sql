-- Rewrites stored chart data sources from the removed catalog/weight adapter
-- to the form_question/body_weight adapter introduced in commit ef5435c.
--
-- Background: commit e28cc0c removed the catalog "weight" adapter in favor of
-- routing the weight chart through the form_question source pointing at the
-- check-in form's `body_weight` question. Migrations 083 originally seeded
-- every tenant's template with `{kind:"catalog",id:"weight"}` so without this
-- shim every existing trainer wakes up to a "Esta pregunta ya no existe"
-- orphan card on each client's PESO chart.
--
-- Walks `charts->'charts'` (the JSONB array of chart configs) and rewrites
-- only the elements whose source matches the old shape. All other fields
-- (id, position, label, chart_type, color, aggregation, …) are preserved.
--
-- Idempotent: re-running is a no-op because the WHERE clause matches only
-- rows that still contain the catalog/weight shape.

UPDATE trainer_chart_templates
SET charts = jsonb_set(
    charts,
    '{charts}',
    (
        SELECT jsonb_agg(
            CASE
                WHEN c->'source'->>'kind' = 'catalog'
                 AND c->'source'->>'id' = 'weight'
                THEN jsonb_set(
                    c,
                    '{source}',
                    jsonb_build_object(
                        'kind', 'form_question',
                        'form_type', 'checkins',
                        'question_id', 'body_weight'
                    )
                )
                ELSE c
            END
        )
        FROM jsonb_array_elements(charts->'charts') c
    )
)
WHERE charts->'charts' @> '[{"source":{"kind":"catalog","id":"weight"}}]';

UPDATE client_chart_configs
SET charts = jsonb_set(
    charts,
    '{charts}',
    (
        SELECT jsonb_agg(
            CASE
                WHEN c->'source'->>'kind' = 'catalog'
                 AND c->'source'->>'id' = 'weight'
                THEN jsonb_set(
                    c,
                    '{source}',
                    jsonb_build_object(
                        'kind', 'form_question',
                        'form_type', 'checkins',
                        'question_id', 'body_weight'
                    )
                )
                ELSE c
            END
        )
        FROM jsonb_array_elements(charts->'charts') c
    )
)
WHERE charts->'charts' @> '[{"source":{"kind":"catalog","id":"weight"}}]';
