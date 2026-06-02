-- Migra charts de catalog/* → form_question/* usando las preguntas reales
-- que cada tenant tiene en sus form_templates (descendiendo subQuestions).
--
-- Equivalente generalizado del shim 096 (que migró catalog/weight a
-- form_question/checkins/body_weight). Cubre los 11 catalog ids que
-- dependen de form_responses:
--   sleep_hours, steps, calories, protein, carbs, fats, water,
--   mood, energy, stress, body_fat
--
-- Excepciones que NO se migran (no tienen equivalente form_question):
--   - training_breakdown (lee exercise_logs)
--   - macros_breakdown (composite multi-series ring)
--
-- Para cada chart catalog migrable, busca la mejor pregunta enabled del
-- template del tenant usando la prioridad de matching:
--   1. canonical id (exact match)
--   2. id substring
--   3. unit match (kg, kcal, l, %)
-- Si no encuentra ninguna pregunta compatible, el chart queda como
-- catalog y el filtro de resolvability lo esconde en runtime.
--
-- Idempotente: re-ejecutar solo afecta charts que aún sean catalog.

CREATE OR REPLACE FUNCTION _migrate_match_question(
  p_tenant_host TEXT,
  p_catalog_id TEXT
) RETURNS JSONB AS $func$
DECLARE
  v_form_type TEXT;
  v_question_id TEXT;
BEGIN
  WITH RECURSIVE q_tree AS (
    SELECT
      ft.form_type::TEXT AS form_type,
      (q.value->>'id')::TEXT AS qid,
      LOWER(COALESCE(q.value->>'id', '')) AS qid_lower,
      LOWER(COALESCE(q.value->>'unit', '')) AS qunit_lower,
      COALESCE((q.value->>'enabled')::boolean, true) AS enabled_eff,
      q.value AS qnode
    FROM form_templates ft,
         jsonb_array_elements(
           COALESCE(
             CASE
               WHEN jsonb_typeof(ft.questions_config) = 'object'
                    AND jsonb_typeof(ft.questions_config -> 'questions') = 'array'
                 THEN ft.questions_config -> 'questions'
               WHEN jsonb_typeof(ft.questions_config) = 'array'
                 THEN ft.questions_config
               ELSE '[]'::jsonb
             END, '[]'::jsonb
           )
         ) AS q
    WHERE ft.tenant_host = p_tenant_host
      AND ft.is_active = true
      AND ft.form_type IN ('checkins', 'habits')

    UNION ALL

    SELECT
      qt.form_type,
      (sub.value->>'id')::TEXT,
      LOWER(COALESCE(sub.value->>'id', '')),
      LOWER(COALESCE(sub.value->>'unit', '')),
      qt.enabled_eff AND COALESCE((sub.value->>'enabled')::boolean, true),
      sub.value
    FROM q_tree qt,
         jsonb_array_elements(
           CASE WHEN qt.qnode->'subQuestions' IS NOT NULL
                AND jsonb_typeof(qt.qnode->'subQuestions') = 'array'
                THEN qt.qnode->'subQuestions'
                ELSE '[]'::jsonb
           END
         ) AS sub
  )
  SELECT form_type, qid INTO v_form_type, v_question_id
  FROM q_tree
  WHERE enabled_eff = true
    AND qid IS NOT NULL
    AND qid <> ''
    AND (
      CASE p_catalog_id
        WHEN 'sleep_hours' THEN
          qid_lower LIKE '%sleep%' OR qid_lower LIKE '%sueno%'
          OR qid_lower LIKE '%sueño%' OR qid_lower LIKE '%dormir%'
        WHEN 'steps' THEN
          qid_lower LIKE '%step%' OR qid_lower LIKE '%paso%'
          OR qunit_lower IN ('pasos', 'steps')
        WHEN 'calories' THEN
          qid_lower LIKE '%calor%' OR qid_lower LIKE '%kcal%'
          OR qunit_lower IN ('kcal', 'cal')
        WHEN 'protein' THEN
          qid_lower LIKE '%protein%' OR qid_lower LIKE '%proteina%'
          OR qid_lower LIKE '%proteína%'
        WHEN 'carbs' THEN
          qid_lower LIKE '%carb%' OR qid_lower LIKE '%hidrat%'
        WHEN 'fats' THEN
          qid_lower LIKE '%fat%' OR qid_lower LIKE '%grasa%'
          OR qid_lower LIKE '%lipid%'
        WHEN 'water' THEN
          qid_lower LIKE '%water%' OR qid_lower LIKE '%agua%'
          OR qid_lower LIKE '%hidrat%'
          OR qunit_lower IN ('l', 'litros', 'liters', 'ml')
        WHEN 'mood' THEN
          qid_lower LIKE '%mood%' OR qid_lower LIKE '%animo%'
          OR qid_lower LIKE '%ánimo%'
        WHEN 'energy' THEN
          qid_lower LIKE '%energy%' OR qid_lower LIKE '%energia%'
          OR qid_lower LIKE '%energía%'
        WHEN 'stress' THEN
          qid_lower LIKE '%stress%' OR qid_lower LIKE '%estres%'
          OR qid_lower LIKE '%estrés%'
        WHEN 'body_fat' THEN
          qid_lower LIKE '%body_fat%' OR qid_lower LIKE '%grasa_corp%'
          OR qid_lower LIKE '%bf_%'
        ELSE false
      END
    )
  ORDER BY
    -- Prioridad 1: canonical exact match
    CASE
      WHEN p_catalog_id = 'sleep_hours'
        AND qid_lower IN ('sleep_hours', 'sleep', 'sueno', 'horas_sueno') THEN 0
      WHEN p_catalog_id = 'steps'
        AND qid_lower IN ('steps', 'pasos') THEN 0
      WHEN p_catalog_id = 'calories'
        AND qid_lower IN ('calories', 'calorias') THEN 0
      WHEN p_catalog_id = 'protein'
        AND qid_lower IN ('protein', 'proteina') THEN 0
      WHEN p_catalog_id = 'carbs'
        AND qid_lower IN ('carbs', 'carbohidratos') THEN 0
      WHEN p_catalog_id = 'fats'
        AND qid_lower IN ('fats', 'grasas') THEN 0
      WHEN p_catalog_id = 'water'
        AND qid_lower IN ('water', 'water_liters', 'agua', 'litros_agua', 'hydration', 'hidratacion', 'hidratación') THEN 0
      WHEN p_catalog_id = 'mood'
        AND qid_lower IN ('mood', 'mood_levels', 'animo', 'ánimo') THEN 0
      WHEN p_catalog_id = 'energy'
        AND qid_lower IN ('energy', 'energy_levels', 'energia', 'energía') THEN 0
      WHEN p_catalog_id = 'stress'
        AND qid_lower IN ('stress', 'stress_levels', 'estres', 'estrés') THEN 0
      WHEN p_catalog_id = 'body_fat'
        AND qid_lower IN ('body_fat', 'body_fat_pct', 'bf_pct', 'grasa_corporal') THEN 0
      ELSE 1
    END,
    form_type, qid
  LIMIT 1;

  IF v_form_type IS NULL OR v_question_id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'kind', 'form_question',
    'form_type', v_form_type,
    'question_id', v_question_id
  );
END;
$func$ LANGUAGE plpgsql STABLE;

-- Apply to trainer_chart_templates: reescribe el `source` de cada chart
-- catalog migrable, preservando todos los otros campos (label, color,
-- chart_type, aggregation, icon si lo había, position, etc.).
UPDATE trainer_chart_templates tct
SET charts = jsonb_set(
  charts, '{charts}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN c->'source'->>'kind' = 'catalog'
          AND c->'source'->>'id' NOT IN ('training_breakdown', 'macros_breakdown')
          AND _migrate_match_question(tct.tenant_host, c->'source'->>'id') IS NOT NULL
        THEN jsonb_set(
          c, '{source}',
          _migrate_match_question(tct.tenant_host, c->'source'->>'id')
        )
        ELSE c
      END
      ORDER BY (c->>'position')::INT NULLS LAST
    )
    FROM jsonb_array_elements(charts->'charts') c
  )
)
WHERE charts->'charts' @> '[{"source":{"kind":"catalog"}}]';

-- Apply to client_chart_configs (overrides per cliente).
UPDATE client_chart_configs ccc
SET charts = jsonb_set(
  charts, '{charts}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN c->'source'->>'kind' = 'catalog'
          AND c->'source'->>'id' NOT IN ('training_breakdown', 'macros_breakdown')
          AND _migrate_match_question(ccc.tenant_host, c->'source'->>'id') IS NOT NULL
        THEN jsonb_set(
          c, '{source}',
          _migrate_match_question(ccc.tenant_host, c->'source'->>'id')
        )
        ELSE c
      END
      ORDER BY (c->>'position')::INT NULLS LAST
    )
    FROM jsonb_array_elements(charts->'charts') c
  )
)
WHERE charts->'charts' @> '[{"source":{"kind":"catalog"}}]';

DROP FUNCTION _migrate_match_question(TEXT, TEXT);
