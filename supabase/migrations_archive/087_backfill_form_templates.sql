-- Migración 087: Backfill de plantillas de formularios y configs por cliente.
--
-- Contexto del incidente:
--   - 22 de 33 tenants activos no tienen plantilla `checkins` en `form_templates`.
--   - 33 de 33 tenants activos no tienen plantilla `habits` (la tabla nunca
--     recibió ninguna fila para ese form_type pese a que hay 990+ respuestas).
--   - 1 plantilla (`david-train` checkins) quedó persistida con
--     `{pages:[...placeholder], questions:[]}` el 2026-04-22 — la misma fecha
--     que el commit 8d0cce6 que cambió la forma del config a {pages, questions}.
--   - 13 clientes no tienen ninguna fila en `client_form_configs` (la creación
--     lazy en `/api/forms/configs/[clientId]` solo dispara cuando el cliente
--     abre su check-in; mientras tanto el trainer ve el perfil vacío).
--
-- Esta migración deja el estado consistente:
--   1. INSERT plantilla `checkins` para los tenants que no la tienen.
--   2. INSERT plantilla `habits` para los tenants que no la tienen.
--   3. UPDATE plantillas con `questions_config` vacío (objeto con
--      questions:[] o array []) — sobrescribe con el default canónico del
--      tipo correspondiente. Cubre david-train y cualquier otra plantilla
--      corrupta por el mismo bug histórico.
--   4. UPDATE auto_apply_to_new_clients=true en todas las plantillas
--      activas. Decisión explícita del owner: por defecto los nuevos
--      clientes deben recibir la plantilla del trainer; el opt-out queda
--      como toggle manual en la UI.
--   5. INSERT client_form_configs para los clientes que no tienen fila para
--      cada form_type que su tenant tenga plantilla — los 13 clientes
--      detectados quedan cubiertos automáticamente porque sus tenants
--      ahora tienen plantillas tras los pasos 1-2.
--
-- Los JSON `v_checkin_default` y `v_habit_default` son la copia exacta de
-- `DEFAULT_CHECKIN_CONFIG` y `DEFAULT_HABIT_CONFIG` en
-- `lib/forms/defaults.ts`. Si esos defaults cambian en TS, este blob es la
-- referencia "as of" que se aplicó en producción para la remediación; no se
-- pretende mantenerlo sincronizado más allá de este punto.
--
-- Idempotente: cada paso usa NOT EXISTS / WHERE acotado. Re-ejecutarlo no
-- crea duplicados ni revierte cambios manuales posteriores del trainer.

DO $migration$
DECLARE
  v_checkin_default JSONB := $checkin_json$
{"pages":[{"id":"checkin_reflection","title":"Reflexión Personal","icon":"solar:user-heart-bold","order":0},{"id":"checkin_goals","title":"Objetivos","icon":"solar:target-bold","order":1},{"id":"checkin_service","title":"Valoración del Servicio","icon":"solar:star-bold","order":2},{"id":"checkin_body","title":"Fotos y Medidas","icon":"solar:camera-bold","order":3}],"questions":[{"id":"personal_life","label":"Vida Personal","fullQuestion":"¿Cómo va todo a nivel personal?","icon":"solar:user-heart-bold","type":"text","enabled":true,"required":true,"pageId":"checkin_reflection"},{"id":"gym_achievement","label":"Triunfo en el Gimnasio","fullQuestion":"Triunfo que has conseguido en el gimnasio desde última revisión","icon":"solar:cup-star-bold","type":"text","enabled":true,"required":true,"pageId":"checkin_reflection"},{"id":"other_victory","label":"Otra Victoria","fullQuestion":"¿Alguna otra victoria que celebrar?","icon":"solar:star-circle-bold","type":"text","enabled":true,"required":false,"pageId":"checkin_reflection"},{"id":"biggest_challenge","label":"Mayor Desafío","fullQuestion":"¿Cuál ha sido el mayor desafío al que te has enfrentado?","icon":"solar:shield-warning-bold","type":"text","enabled":true,"required":true,"pageId":"checkin_reflection"},{"id":"goals_completed","label":"Objetivos Cumplidos","fullQuestion":"¿Has cumplido objetivos que te marcaste en nuestra última revisión?","icon":"solar:check-square-bold","type":"boolean","enabled":true,"required":true,"pageId":"checkin_goals"},{"id":"goals_impediment","label":"Impedimentos","fullQuestion":"¿Qué te lo ha impedido?","icon":"solar:close-circle-bold","type":"text","enabled":true,"required":false,"conditionalOn":"goals_completed","conditionalValue":false,"pageId":"checkin_goals"},{"id":"focus_next_weeks","label":"Enfoque Próximas Semanas","fullQuestion":"¿En qué quieres enfocarte especialmente para mejorar en estas próximas semanas?","icon":"solar:target-bold","type":"text","enabled":true,"required":true,"pageId":"checkin_goals"},{"id":"service_rating","label":"Valoración del Servicio","fullQuestion":"¿Cómo valoras el servicio que te estamos dando?","icon":"solar:star-bold","type":"rating","enabled":true,"required":true,"pageId":"checkin_service"},{"id":"service_details","label":"Detalles del Servicio","fullQuestion":"¿Me puedes dar más detalles?","icon":"solar:chat-round-dots-bold","type":"text","enabled":true,"required":false,"conditionalOn":"service_rating","conditionalValue":true,"pageId":"checkin_service"},{"id":"photos","label":"Fotos de Progreso","icon":"solar:camera-bold","type":"group","enabled":true,"required":false,"pageId":"checkin_body","subQuestions":[{"id":"photo_front","label":"Foto de Frente","icon":"solar:user-bold","type":"photo","enabled":true,"required":false},{"id":"photo_side","label":"Foto de Perfil","icon":"solar:user-bold","type":"photo","enabled":true,"required":false},{"id":"photo_back","label":"Foto de Espaldas","icon":"solar:user-bold","type":"photo","enabled":true,"required":false}]},{"id":"body_measurements","label":"Medidas Corporales","icon":"solar:ruler-bold","type":"group","enabled":true,"required":false,"pageId":"checkin_body","subQuestions":[{"id":"chest","label":"Pecho","icon":"solar:ruler-cross-pen-bold","type":"number","unit":"cm","enabled":true,"required":false},{"id":"shoulders","label":"Hombros","icon":"solar:ruler-cross-pen-bold","type":"number","unit":"cm","enabled":true,"required":false},{"id":"arm","label":"Brazo","icon":"solar:ruler-cross-pen-bold","type":"number","unit":"cm","enabled":true,"required":false},{"id":"above_navel","label":"Sobre el Ombligo 3cm","icon":"solar:ruler-cross-pen-bold","type":"number","unit":"cm","enabled":true,"required":false},{"id":"below_navel","label":"Bajo el Ombligo 3cm","icon":"solar:ruler-cross-pen-bold","type":"number","unit":"cm","enabled":true,"required":false},{"id":"groin","label":"Ingle","icon":"solar:ruler-cross-pen-bold","type":"number","unit":"cm","enabled":true,"required":false},{"id":"thigh","label":"Muslo","icon":"solar:ruler-cross-pen-bold","type":"number","unit":"cm","enabled":true,"required":false},{"id":"calf","label":"Gemelo","icon":"solar:ruler-cross-pen-bold","type":"number","unit":"cm","enabled":true,"required":false}]},{"id":"body_weight","label":"Peso Corporal","icon":"solar:scale-bold","type":"number","unit":"kg","enabled":true,"required":true,"pageId":"checkin_body"}]}
$checkin_json$::jsonb;

  v_habit_default JSONB := $habit_json$
{"pages":[{"id":"habit_wellbeing","title":"Bienestar","icon":"solar:heart-pulse-bold","order":0},{"id":"habit_activity","title":"Actividad Física","icon":"solar:running-bold","order":1},{"id":"habit_nutrition","title":"Nutrición","icon":"solar:plate-bold","order":2},{"id":"habit_sleep","title":"Sueño","icon":"solar:sleeping-bold","order":3}],"questions":[{"id":"body_weight","label":"Peso Corporal","fullQuestion":"¿Cuánto pesas hoy?","icon":"solar:scale-bold","type":"number","unit":"kg","enabled":true,"required":false,"pageId":"habit_wellbeing"},{"id":"energy_levels","label":"Niveles de Energía","fullQuestion":"Niveles de energía durante el día","icon":"solar:bolt-bold","type":"rating","enabled":true,"required":false,"pageId":"habit_wellbeing"},{"id":"stress_levels","label":"Manejo del Estrés","fullQuestion":"¿Qué tal has sobrellevado el estrés?","icon":"solar:shield-warning-bold","type":"rating","enabled":true,"required":false,"pageId":"habit_wellbeing"},{"id":"illness_signs","label":"Signos de Enfermedad","fullQuestion":"¿Has tenido algún signo de enfermedad, infección, dolor?","icon":"solar:health-bold","type":"boolean","enabled":true,"required":false,"pageId":"habit_wellbeing"},{"id":"illness_details","label":"Detalles de Enfermedad","fullQuestion":"Más detalles","icon":"solar:notes-bold","type":"text","enabled":true,"required":false,"conditionalOn":"illness_signs","conditionalValue":true,"pageId":"habit_wellbeing"},{"id":"steps","label":"Pasos del Día","fullQuestion":"¿Cuántos pasos has hecho hoy?","icon":"solar:walking-bold","type":"number","unit":"pasos","enabled":true,"required":false,"pageId":"habit_activity"},{"id":"other_activity","label":"Otra Actividad Física","fullQuestion":"¿Otra actividad física exigente?","icon":"solar:running-bold","type":"boolean","enabled":true,"required":false,"pageId":"habit_activity"},{"id":"other_activity_details","label":"Detalles de Actividad","fullQuestion":"Más detalles","icon":"solar:notes-bold","type":"text","enabled":true,"required":false,"conditionalOn":"other_activity","conditionalValue":true,"pageId":"habit_activity"},{"id":"sun_exposure","label":"Exposición Solar","fullQuestion":"Horas de exposición al sol durante el día","icon":"solar:sun-bold","type":"number","unit":"horas","enabled":true,"required":false,"pageId":"habit_activity"},{"id":"macro_tracking","label":"Seguimiento de Macros","fullQuestion":"¿Seguimiento de macros hoy?","icon":"solar:pie-chart-bold","type":"group","enabled":true,"required":false,"pageId":"habit_nutrition","subQuestions":[{"id":"calories","label":"Calorías Totales","icon":"solar:fire-bold","type":"number","unit":"kcal","enabled":true,"required":false},{"id":"protein","label":"Proteína","icon":"solar:bone-bold","type":"number","unit":"g","enabled":true,"required":false},{"id":"carbs","label":"Carbohidratos","icon":"solar:leaf-bold","type":"number","unit":"g","enabled":true,"required":false},{"id":"fats","label":"Grasas","icon":"solar:cloud-waterdrop-bold","type":"number","unit":"g","enabled":true,"required":false}]},{"id":"hunger_levels","label":"Niveles de Hambre","fullQuestion":"¿Cómo han sido tus niveles de hambre?","icon":"solar:plate-bold","type":"rating","enabled":true,"required":false,"pageId":"habit_nutrition"},{"id":"adherence","label":"Adherencia al Plan","fullQuestion":"¿Cómo ha sido la adherencia?","icon":"solar:check-circle-bold","type":"rating","enabled":true,"required":false,"pageId":"habit_nutrition"},{"id":"adherence_reason","label":"Razón de No Adherencia","fullQuestion":"¿Por qué no te has podido ceñir al plan?","icon":"solar:question-circle-bold","type":"text","enabled":true,"required":false,"conditionalOn":"adherence","conditionalValue":true,"pageId":"habit_nutrition"},{"id":"caffeine","label":"Consumo de Cafeína","fullQuestion":"¿Cuánta cafeína se ha consumido?","icon":"solar:cup-hot-bold","type":"number","unit":"mg","enabled":true,"required":false,"pageId":"habit_nutrition"},{"id":"supplementation","label":"Suplementación","fullQuestion":"Suplementación","icon":"solar:pill-bold","type":"text","enabled":true,"required":false,"pageId":"habit_nutrition"},{"id":"bedtime","label":"Hora de Acostar","fullQuestion":"¿A qué hora te acostaste ayer?","icon":"solar:moon-stars-bold","type":"text","enabled":true,"required":false,"pageId":"habit_sleep"},{"id":"wake_time","label":"Hora de Despertar","fullQuestion":"¿A qué hora te has despertado hoy?","icon":"solar:sun-fog-bold","type":"text","enabled":true,"required":false,"pageId":"habit_sleep"},{"id":"sleep_hours","label":"Horas de Sueño","fullQuestion":"¿Cuántas horas has dormido en total?","icon":"solar:sleeping-bold","type":"number","unit":"horas","enabled":true,"required":false,"pageId":"habit_sleep"},{"id":"morning_feeling","label":"Sensación al Despertar","fullQuestion":"Al salir de cama esta mañana sentías que","icon":"solar:smile-circle-bold","type":"rating","enabled":true,"required":false,"pageId":"habit_sleep"},{"id":"morning_feeling_details","label":"Detalles de Despertar","fullQuestion":"Más detalles","icon":"solar:notes-bold","type":"text","enabled":true,"required":false,"conditionalOn":"morning_feeling","conditionalValue":true,"pageId":"habit_sleep"},{"id":"special_comment","label":"Comentario Especial","fullQuestion":"Comentario especial","icon":"solar:chat-round-dots-bold","type":"boolean","enabled":false,"required":false,"pageId":"habit_sleep"}]}
$habit_json$::jsonb;
BEGIN
  -- 1) Plantilla checkins para tenants activos sin una.
  INSERT INTO form_templates
    (tenant_host, form_type, name, questions_config, is_active, auto_apply_to_new_clients)
  SELECT t.host, 'checkins', 'Plantilla de Check-in', v_checkin_default, true, true
  FROM tenants t
  WHERE t.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM form_templates ft
      WHERE ft.tenant_host = t.host
        AND ft.form_type = 'checkins'
        AND ft.is_active = true
    );

  -- 2) Plantilla habits para tenants activos sin una.
  INSERT INTO form_templates
    (tenant_host, form_type, name, questions_config, is_active, auto_apply_to_new_clients)
  SELECT t.host, 'habits', 'Plantilla de Hábitos', v_habit_default, true, true
  FROM tenants t
  WHERE t.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM form_templates ft
      WHERE ft.tenant_host = t.host
        AND ft.form_type = 'habits'
        AND ft.is_active = true
    );

  -- 3) Sobrescribe plantillas con questions_config vacío.
  -- Detecta tanto el shape histórico (array vacío) como el actual
  -- (objeto con questions:[]). Cualquier plantilla activa cuyo
  -- contenido sea estructuralmente vacío recibe el default canónico.
  UPDATE form_templates ft
  SET questions_config = CASE
        WHEN ft.form_type = 'checkins' THEN v_checkin_default
        ELSE v_habit_default
      END,
      updated_at = NOW()
  WHERE ft.is_active = true
    AND (
      (jsonb_typeof(ft.questions_config) = 'object'
        AND COALESCE(jsonb_array_length(ft.questions_config -> 'questions'), 0) = 0)
      OR (jsonb_typeof(ft.questions_config) = 'array'
        AND jsonb_array_length(ft.questions_config) = 0)
    );

  -- 4) Activa auto_apply_to_new_clients en plantillas activas.
  UPDATE form_templates
  SET auto_apply_to_new_clients = true
  WHERE is_active = true
    AND auto_apply_to_new_clients = false;

  -- 5) Crea client_form_configs faltantes desde la plantilla del tenant.
  -- Cubre los 13 clientes detectados sin fila + cualquier futuro hueco.
  INSERT INTO client_form_configs
    (tenant_host, client_id, form_type, questions_config, uses_template, template_id, schedule)
  SELECT
    ft.tenant_host,
    c.id,
    ft.form_type,
    ft.questions_config,
    true,
    ft.id,
    CASE WHEN ft.form_type = 'checkins' THEN ft.default_schedule ELSE NULL END
  FROM clients c
  JOIN tenants t ON t.trainer_id = c.tenant
  JOIN form_templates ft
    ON ft.tenant_host = t.host
   AND ft.is_active = true
  WHERE NOT EXISTS (
    SELECT 1 FROM client_form_configs cfc
    WHERE cfc.client_id = c.id
      AND cfc.form_type = ft.form_type
      AND cfc.tenant_host = ft.tenant_host
  );
END $migration$;
