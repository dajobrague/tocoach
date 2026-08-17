-- Ancla explícita del microciclo: client_programs.is_primary — Aug 2026.
--
-- Contexto: el hotfix del 14-ago restauró multi-activo (fuerza + cardio
-- conviven) y retiró el invariante un-solo-activo. El plan semanal
-- (microcycles, UNIQUE por client_program_id) seguía anclado a un pick
-- POSICIONAL — el activo más reciente por start_date — así que asignar un
-- programa nuevo re-anclaba el editor del microciclo y el plan "desaparecía".
-- is_primary hace el ancla explícita: asignar/activar programas ya no la
-- mueve; solo pausar/completar/eliminar el primario promueve al siguiente.
--
-- Los lectores (lib/microcycles/db.ts, /api/client/sessions) ordenan
-- is_primary primero y CAEN AL DESEMPATE determinista (start_date desc,
-- created_at desc, id desc) si ningún activo es primario — la ausencia de
-- primario degrada al comportamiento actual, nunca rompe.
--
-- ⚠️ ORDEN DE DEPLOY: aplicar esta migración ANTES de desplegar el código
-- que la acompaña (los selects incluyen is_primary y fallarían sin la
-- columna).

ALTER TABLE public.client_programs
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;

-- Backfill: replica el pick determinista vigente entre los programas
-- ACTIVOS de cada cliente, para que el deploy no cambie qué microciclo
-- ve nadie (mismo orden que el comparator de lib/microcycles/db.ts).
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY client_id
           ORDER BY start_date DESC NULLS LAST,
                    created_at DESC NULLS LAST,
                    id DESC
         ) AS rn
  FROM public.client_programs
  WHERE lower(btrim(status)) = 'active'
)
UPDATE public.client_programs cp
SET is_primary = true
FROM ranked r
WHERE r.id = cp.id
  AND r.rn = 1;

-- A lo sumo un primario ACTIVO por cliente. El código mantiene el flag
-- (limpia al pausar, promueve si no queda ninguno); el índice es el
-- cinturón contra estados imposibles.
CREATE UNIQUE INDEX IF NOT EXISTS client_programs_one_primary_active_idx
  ON public.client_programs (client_id)
  WHERE is_primary AND lower(btrim(status)) = 'active';

-- El RPC del invariante un-solo-activo quedó huérfano con el hotfix del
-- 14-ago (ya no lo llama ningún endpoint). El plan de "índice único parcial
-- (client_id) WHERE status='active'" anotado en 20260811090000 queda
-- RETIRADO: multi-activo es estado válido y deliberado, ese conteo nunca
-- va a drenar a cero por diseño.
DROP FUNCTION IF EXISTS public.activate_client_program(uuid, bigint);
