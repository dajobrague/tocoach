# Plan de deduplicación de `scheduled_sessions(client_id, scheduled_date)`

Producción tiene >50 grupos de duplicados en esta combinación. Antes de
agregar el constraint `UNIQUE (client_id, scheduled_date)` recomendado
por F4.5, hay que deduplicar.

## Auditoría inicial

```sql
SELECT client_id, scheduled_date, count(*) AS dup_count
FROM scheduled_sessions
GROUP BY client_id, scheduled_date
HAVING count(*) > 1
ORDER BY dup_count DESC;
```

## Plan de dedupe (NO aplicar sin revisión)

Para cada grupo `(client_id, scheduled_date)` con >1 fila:

1. Elegir la fila canónica: la que tiene mayor `updated_at`, o como
   tiebreak la que tiene overrides (`scheduled_session_exercises`) o
   logs (`exercise_logs.scheduled_session_id`).
2. Relinkear `exercise_logs.scheduled_session_id` y
   `scheduled_session_exercises.scheduled_session_id` de las filas
   no-canónicas al ID canónico.
3. Borrar las filas no-canónicas.

```sql
WITH ranked AS (
    SELECT
        id,
        client_id,
        scheduled_date,
        ROW_NUMBER() OVER (
            PARTITION BY client_id, scheduled_date
            ORDER BY
                (
                    SELECT count(*) FROM scheduled_session_exercises
                    WHERE scheduled_session_id = scheduled_sessions.id
                ) DESC,
                (
                    SELECT count(*) FROM exercise_logs
                    WHERE scheduled_session_id = scheduled_sessions.id
                ) DESC,
                updated_at DESC NULLS LAST,
                created_at DESC NULLS LAST,
                id ASC
        ) AS rk
    FROM scheduled_sessions
)
-- canonical IDs por grupo
SELECT * FROM ranked WHERE rk = 1;
```

Después:

```sql
-- Relinkear exercise_logs
UPDATE exercise_logs el
SET scheduled_session_id = canon.canonical_id
FROM (
    SELECT
        ranked.id AS dup_id,
        FIRST_VALUE(ranked.id) OVER (
            PARTITION BY ranked.client_id, ranked.scheduled_date
            ORDER BY ranked.rk
        ) AS canonical_id
    FROM (
        SELECT id, client_id, scheduled_date,
               ROW_NUMBER() OVER (...) AS rk
        FROM scheduled_sessions
    ) ranked
) canon
WHERE el.scheduled_session_id = canon.dup_id
  AND canon.dup_id <> canon.canonical_id;

-- Relinkear scheduled_session_exercises (ojo: UNIQUE en
-- (scheduled_session_id, exercise_order) puede chocar; resolver
-- prioridad antes)
-- ...

-- Borrar duplicados
DELETE FROM scheduled_sessions ss
USING (
    SELECT id, client_id, scheduled_date,
           ROW_NUMBER() OVER (
               PARTITION BY client_id, scheduled_date
               ORDER BY ...
           ) AS rk
    FROM scheduled_sessions
) ranked
WHERE ss.id = ranked.id AND ranked.rk > 1;

-- AHORA sí, agregar el constraint
ALTER TABLE scheduled_sessions
    ADD CONSTRAINT scheduled_sessions_client_date_unique
    UNIQUE (client_id, scheduled_date);
```

## Riesgos

- `scheduled_session_exercises` tiene UNIQUE
  `(scheduled_session_id, exercise_order)`. Al relinkear, dos filas con
  distintos `exercise_order` ok; misma `exercise_order` → conflicto.
  Hay que mergear / preferir uno antes del UPDATE.
- Los logs huérfanos que ya están linkeados a una `scheduled_sessions`
  no-canónica tienen historia consistente. Relinkear los preserva.
- Test en staging con un dump real antes de prod.

## Por qué no se hace ahora

El dedupe involucra decisiones de negocio (¿cuál es la fila correcta
cuando dos sesiones del mismo día tienen logs distintos?) que ameritan
una llamada con el equipo. La RPC actual ya previene NUEVOS duplicados
vía `pg_advisory_xact_lock`; los duplicados existentes son
históricos pre-095 cuando la lógica de upsert no tenía advisory lock.
