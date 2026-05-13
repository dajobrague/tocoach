-- Fecha de inicio explícita del microciclo (el "día 1" del ciclo).
--
-- Antes el resolver de prescripciones anclaba el modulo del ciclo
-- al client_program.start_date. El trainer no podía elegir cuándo
-- empezaba el ciclo: si el cliente arrancó un programa un miércoles,
-- el "Día 1" del microciclo caía siempre en miércoles, sin manera
-- de re-anclarlo a lunes ni a la fecha que el trainer tenía en
-- mente. Con esta columna el trainer escoge la fecha desde el editor
-- del microciclo, y el resolver usa esa fecha como ancla:
--   dayIndex = ((date - microcycle.start_date) % duration_days) + 1
--
-- Backfill: para microciclos existentes, copiamos
-- client_programs.start_date para preservar el comportamiento actual
-- y no romper la prescripción de los clientes hoy mismo. Si por
-- alguna razón el client_program no tiene start_date (data tribal),
-- defaulteamos a hoy. Después marcamos NOT NULL.
--
-- Nota: la columna es nullable durante el backfill (UPDATE no toca
-- filas si no hay match) y se vuelve NOT NULL al final. Si la
-- migración corre con tabla vacía, el ALTER NOT NULL pasa sin
-- problema (no hay filas que validar).

ALTER TABLE microcycles
  ADD COLUMN IF NOT EXISTS start_date DATE;

UPDATE microcycles m
SET start_date = cp.start_date
FROM client_programs cp
WHERE m.client_program_id = cp.id
  AND m.start_date IS NULL
  AND cp.start_date IS NOT NULL;

UPDATE microcycles
SET start_date = CURRENT_DATE
WHERE start_date IS NULL;

ALTER TABLE microcycles
  ALTER COLUMN start_date SET NOT NULL;
