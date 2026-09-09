-- Deuda (2026-09-07): el seed de exercise_tags copió grupos musculares y
-- equipamiento tal cual, y 61 de esas cadenas eran listas separadas por coma
-- ("Dorsal ancho, redondo mayor, trapecio medio…") de más de 40 caracteres:
-- inservibles como etiqueta y fuera del registro. Se parten por coma en
-- etiquetas reales (87 distintas ≤40 chars en prod), se registran y los
-- arrays se reescriben con la grafía del registro. Las 8 cadenas largas sin
-- coma ("Máquina peck deck (contractora) con apoyo para codos") se quedan.
-- Reversible: exercise_tags_split_audit guarda el array anterior.

CREATE TABLE IF NOT EXISTS exercise_tags_split_audit (
    id BIGSERIAL PRIMARY KEY,
    exercise_id UUID NOT NULL,
    tenant_host TEXT NOT NULL,
    old_tags TEXT[] NOT NULL,
    new_tags TEXT[] NOT NULL,
    at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE exercise_tags_split_audit ENABLE ROW LEVEL SECURITY;

WITH affected AS (
    SELECT id, tenant_host, tags
    FROM exercises
    WHERE EXISTS (SELECT 1 FROM unnest(tags) t WHERE length(t) > 40 AND t LIKE '%,%')
),
rebuilt AS (
    SELECT a.id, a.tenant_host, a.tags AS old_tags,
        (
            SELECT COALESCE(array_agg(p ORDER BY first_ord), '{}')
            FROM (
                SELECT min(p) AS p, min(ord) AS first_ord
                FROM (
                    SELECT btrim(q.part) AS p, (u.ord * 1000 + q.pi) AS ord
                    FROM unnest(a.tags) WITH ORDINALITY AS u(t, ord)
                    CROSS JOIN LATERAL unnest(string_to_array(u.t, ',')) WITH ORDINALITY AS q(part, pi)
                    WHERE btrim(q.part) <> ''
                ) parts
                GROUP BY lower(p)
            ) dedup
        ) AS new_tags
    FROM affected a
),
audit AS (
    INSERT INTO exercise_tags_split_audit (exercise_id, tenant_host, old_tags, new_tags)
    SELECT id, tenant_host, old_tags, new_tags FROM rebuilt WHERE old_tags IS DISTINCT FROM new_tags
    RETURNING exercise_id
)
UPDATE exercises e
SET tags = r.new_tags
FROM rebuilt r
WHERE e.id = r.id AND r.old_tags IS DISTINCT FROM r.new_tags;

-- Registrar las partes nuevas (≤40) por tenant.
DO $$
DECLARE e RECORD;
BEGIN
  FOR e IN SELECT tenant_host, tags FROM exercises WHERE id IN (SELECT exercise_id FROM exercise_tags_split_audit) LOOP
    PERFORM library_ensure_tags(e.tenant_host, 'exercise', e.tags);
  END LOOP;
END $$;

-- Reescribir los arrays afectados con la grafía del registro (mismo criterio
-- que 20260907151000 §4) para que el filtro exacto `@>` los encuentre.
UPDATE exercises e
SET tags = (
    SELECT COALESCE(array_agg(name ORDER BY ord), '{}')
    FROM (
        SELECT DISTINCT ON (lower(u.t)) COALESCE(lt.name, u.t) AS name, u.ord
        FROM unnest(e.tags) WITH ORDINALITY AS u(t, ord)
        LEFT JOIN library_tags lt
          ON lt.tenant_host = e.tenant_host AND lt.kind = 'exercise'
         AND lower(lt.name) = lower(u.t)
        ORDER BY lower(u.t), u.ord
    ) canonical
)
WHERE e.id IN (SELECT exercise_id FROM exercise_tags_split_audit)
  AND EXISTS (
    SELECT 1 FROM unnest(e.tags) t
    JOIN library_tags lt ON lt.tenant_host = e.tenant_host AND lt.kind = 'exercise' AND lower(lt.name) = lower(t)
    WHERE lt.name <> t
  );
