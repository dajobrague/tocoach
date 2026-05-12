-- Fallback for migration 096. The chart shim hardcoded
--     question_id: 'body_weight'
-- assuming every tenant kept the default check-in question. Tenants who
-- renamed/disabled that question wake up with a PESO chart that resolves
-- to a missing source → orphan card.
--
-- This migration scans both trainer_chart_templates and client_chart_configs
-- for chart sources pointing at body_weight, and for each affected tenant:
--   1. Checks if the tenant's checkins template actually has a
--      `body_weight` question enabled.
--   2. If not, tries to discover an alternative numeric question with
--      unit='kg' (typical "Peso" rename pattern) and rewrites the chart
--      source to it.
--   3. If no alternative exists, logs a NOTICE — the chart will render
--      as an empty/orphan card until the trainer fixes the source. No
--      data is destroyed.
--
-- Idempotent: re-running only rewrites tenants that still have the
-- mismatch.

DO $$
DECLARE
    v_tenant TEXT;
    v_alt_qid TEXT;
    v_has_body_weight BOOLEAN;
    v_affected_tenants TEXT[];
BEGIN
    -- Collect distinct tenants that have at least one chart pointing at
    -- form_question/body_weight, across both templates and per-client
    -- configs.
    SELECT array_agg(DISTINCT tenant_host) INTO v_affected_tenants
    FROM (
        SELECT tenant_host
        FROM trainer_chart_templates
        WHERE charts->'charts' @> '[{"source":{"kind":"form_question","question_id":"body_weight"}}]'
        UNION
        SELECT tenant_host
        FROM client_chart_configs
        WHERE charts->'charts' @> '[{"source":{"kind":"form_question","question_id":"body_weight"}}]'
    ) sub;

    IF v_affected_tenants IS NULL THEN
        RAISE NOTICE 'No tenants reference body_weight in chart configs.';
        RETURN;
    END IF;

    FOR v_tenant IN SELECT unnest(v_affected_tenants) LOOP
        -- Does this tenant actually have a body_weight question in its
        -- checkins template?
        SELECT EXISTS (
            SELECT 1
            FROM form_templates ft,
                 jsonb_array_elements(ft.questions_config) q
            WHERE ft.tenant_host = v_tenant
              AND ft.form_type = 'checkins'
              AND ft.is_active = true
              AND q->>'id' = 'body_weight'
              AND COALESCE((q->>'enabled')::boolean, true) = true
        ) INTO v_has_body_weight;

        IF v_has_body_weight THEN
            CONTINUE;
        END IF;

        -- Try to find an alternative weight-like question: numeric with
        -- unit kg, label containing peso/weight, AND enabled.
        SELECT q->>'id' INTO v_alt_qid
        FROM form_templates ft,
             jsonb_array_elements(ft.questions_config) q
        WHERE ft.tenant_host = v_tenant
          AND ft.form_type = 'checkins'
          AND ft.is_active = true
          AND q->>'type' = 'number'
          AND q->>'unit' = 'kg'
          AND COALESCE((q->>'enabled')::boolean, true) = true
        ORDER BY
          CASE
            WHEN LOWER(q->>'label') LIKE '%peso%' THEN 0
            WHEN LOWER(q->>'label') LIKE '%weight%' THEN 1
            ELSE 2
          END
        LIMIT 1;

        IF v_alt_qid IS NULL THEN
            RAISE NOTICE 'Tenant % - body_weight no encontrado y sin alternativa de peso (kg). PESO chart quedará como orphan card hasta que el trainer lo configure.', v_tenant;
            CONTINUE;
        END IF;

        RAISE NOTICE 'Tenant % - reescribiendo body_weight → %', v_tenant, v_alt_qid;

        -- Rewrite trainer template
        UPDATE trainer_chart_templates
        SET charts = jsonb_set(
            charts,
            '{charts}',
            (
                SELECT jsonb_agg(
                    CASE
                        WHEN c->'source'->>'kind' = 'form_question'
                         AND c->'source'->>'question_id' = 'body_weight'
                        THEN jsonb_set(
                            c, '{source,question_id}', to_jsonb(v_alt_qid)
                        )
                        ELSE c
                    END
                )
                FROM jsonb_array_elements(charts->'charts') c
            )
        )
        WHERE tenant_host = v_tenant
          AND charts->'charts' @> '[{"source":{"kind":"form_question","question_id":"body_weight"}}]';

        -- Rewrite per-client configs for this tenant
        UPDATE client_chart_configs
        SET charts = jsonb_set(
            charts,
            '{charts}',
            (
                SELECT jsonb_agg(
                    CASE
                        WHEN c->'source'->>'kind' = 'form_question'
                         AND c->'source'->>'question_id' = 'body_weight'
                        THEN jsonb_set(
                            c, '{source,question_id}', to_jsonb(v_alt_qid)
                        )
                        ELSE c
                    END
                )
                FROM jsonb_array_elements(charts->'charts') c
            )
        )
        WHERE tenant_host = v_tenant
          AND charts->'charts' @> '[{"source":{"kind":"form_question","question_id":"body_weight"}}]';
    END LOOP;
END $$;
