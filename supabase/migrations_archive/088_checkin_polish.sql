-- Migración 088: Pulido del flujo de check-in.
--
-- Tres cambios pequeños y aditivos relacionados con el incidente del
-- formulario de check-in:
--
-- 1) `body_weight` deja de ser obligatorio por defecto. La auditoría
--    funcional reveló que tener el peso corporal como required:true
--    bloqueaba toda la sumisión cuando el cliente no tenía báscula a
--    mano (rellenaba reflexión + objetivos + fotos y al final el
--    servidor rechazaba con "Peso Corporal es obligatorio"). El
--    entrenador puede re-activar required desde el editor de plantilla
--    si lo necesita.
--
-- 2) Añadimos `image/heif` al allowlist de mime types del bucket
--    `form-photos`. La migración 063 ya añadió `image/heic`, pero iOS
--    a veces etiqueta Live Photos como HEIF y algunas cámaras de
--    Android producen HEIF. El route handler ya acepta ambos —
--    blindamos el bucket.
--
-- 3) Idempotente con guardas EXISTS / WHERE acotado. Re-ejecutarla no
--    deshace cambios que un trainer haya hecho manualmente después.

-- ── 1) form_templates: flip body_weight required → false ────────────
-- Solo toca filas donde la pregunta body_weight existe Y está marcada
-- required=true. Las plantillas curadas que ya tengan required=false
-- no se tocan.
UPDATE form_templates ft
SET
  questions_config = jsonb_set(
    ft.questions_config,
    '{questions}',
    (
      SELECT jsonb_agg(
        CASE
          WHEN q ->> 'id' = 'body_weight'
            THEN jsonb_set(q, '{required}', 'false'::jsonb)
          ELSE q
        END
      )
      FROM jsonb_array_elements(ft.questions_config -> 'questions') AS q
    )
  ),
  updated_at = NOW()
WHERE ft.form_type = 'checkins'
  AND ft.is_active = true
  AND jsonb_typeof(ft.questions_config) = 'object'
  AND jsonb_typeof(ft.questions_config -> 'questions') = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(ft.questions_config -> 'questions') AS qe
    WHERE qe ->> 'id' = 'body_weight'
      AND (qe ->> 'required')::boolean = true
  );

-- ── 2) client_form_configs: misma transformación ────────────────────
-- Cualquier client_form_config que arrastre body_weight required=true
-- (porque se sembró desde una plantilla pre-088 o porque el cliente
-- nunca abrió el editor) queda igualmente desbloqueado. No tocamos
-- configs custom donde el trainer ya lo cambió.
UPDATE client_form_configs cfc
SET
  questions_config = jsonb_set(
    cfc.questions_config,
    '{questions}',
    (
      SELECT jsonb_agg(
        CASE
          WHEN q ->> 'id' = 'body_weight'
            THEN jsonb_set(q, '{required}', 'false'::jsonb)
          ELSE q
        END
      )
      FROM jsonb_array_elements(cfc.questions_config -> 'questions') AS q
    )
  ),
  updated_at = NOW()
WHERE cfc.form_type = 'checkins'
  AND jsonb_typeof(cfc.questions_config) = 'object'
  AND jsonb_typeof(cfc.questions_config -> 'questions') = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(cfc.questions_config -> 'questions') AS qe
    WHERE qe ->> 'id' = 'body_weight'
      AND (qe ->> 'required')::boolean = true
  );

-- ── 3) form-photos bucket: añadir HEIF al allowlist ─────────────────
-- HEIC ya estaba (migración 063). HEIF es la variante de container que
-- algunas cámaras producen — el route handler acepta ambas, el bucket
-- también debería.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/heic',
  'image/heif'
]
WHERE id = 'form-photos'
  AND NOT ('image/heif' = ANY(allowed_mime_types));
