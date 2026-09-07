-- Backfill for the tags/folders split (2026-09-07, decision 3: "move to the
-- folder and drop the homonymous tag"). Reversible by design: every change
-- to an item is written to `library_backfill_audit` first (which folder was
-- assigned, which tags were stripped, which folders competed).
--
-- Rules per recipe / program template whose tag array contains a name that
-- matches (case-insensitive) a folder of its tenant:
--   * folder_id = that folder. Several matches → the deepest wins; same
--     depth → alphabetical. Every candidate is recorded in `candidates`.
--   * only the chosen folder's tag leaves the array; other folder-named
--     tags stay as plain tags (they are tags now).
-- Then the registry is seeded with what is left in the arrays, and the
-- arrays are rewritten to the registry's spelling so exact `@>` filters
-- keep matching ("barra" and "Barra" were two filter options before; now
-- they are one tag).
--
-- Idempotent: items that already have a folder_id are skipped, seeding uses
-- ON CONFLICT DO NOTHING and the spelling rewrite only touches drifted rows.

CREATE TABLE IF NOT EXISTS library_backfill_audit (
    id BIGSERIAL PRIMARY KEY,
    item_kind TEXT NOT NULL CHECK (item_kind IN ('recipe', 'program')),
    item_id UUID NOT NULL,
    folder_id UUID,
    stripped_tags TEXT[] NOT NULL DEFAULT '{}',
    candidates JSONB,
    at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE library_backfill_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon to manage library_backfill_audit"
    ON library_backfill_audit TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage library_backfill_audit"
    ON library_backfill_audit TO authenticated USING (true) WITH CHECK (true);

-- 1. Recipes → recipe_folders -------------------------------------------

WITH RECURSIVE folder_depth AS (
    SELECT id, tenant_host, name, 0 AS depth
    FROM recipe_folders WHERE parent_id IS NULL
    UNION ALL
    SELECT f.id, f.tenant_host, f.name, d.depth + 1
    FROM recipe_folders f
    JOIN folder_depth d ON f.parent_id = d.id
    WHERE d.depth < 100
),
matches AS (
    SELECT r.id AS item_id, f.id AS folder_id, f.name, f.depth,
           ARRAY(
               SELECT t FROM unnest(r.meal_type_tags) t
               WHERE lower(t) = lower(f.name)
           ) AS matched_tags
    FROM recipes r
    JOIN folder_depth f ON f.tenant_host = r.tenant_host
    WHERE r.folder_id IS NULL
      AND EXISTS (
          SELECT 1 FROM unnest(r.meal_type_tags) t
          WHERE lower(t) = lower(f.name)
      )
),
chosen AS (
    SELECT DISTINCT ON (item_id) item_id, folder_id, name, matched_tags
    FROM matches
    ORDER BY item_id, depth DESC, lower(name) ASC
),
audit AS (
    INSERT INTO library_backfill_audit
        (item_kind, item_id, folder_id, stripped_tags, candidates)
    SELECT 'recipe', c.item_id, c.folder_id, c.matched_tags,
           (SELECT jsonb_agg(
                jsonb_build_object(
                    'folder_id', m.folder_id, 'name', m.name, 'depth', m.depth
                ) ORDER BY m.depth DESC, lower(m.name)
            ) FROM matches m WHERE m.item_id = c.item_id)
    FROM chosen c
    RETURNING item_id
)
UPDATE recipes r
SET folder_id = c.folder_id,
    meal_type_tags = library_retag(r.meal_type_tags, c.name, NULL)
FROM chosen c
WHERE r.id = c.item_id;

-- 2. Program templates → program_folders --------------------------------

WITH RECURSIVE folder_depth AS (
    SELECT id, tenant_host, name, 0 AS depth
    FROM program_folders WHERE parent_id IS NULL
    UNION ALL
    SELECT f.id, f.tenant_host, f.name, d.depth + 1
    FROM program_folders f
    JOIN folder_depth d ON f.parent_id = d.id
    WHERE d.depth < 100
),
matches AS (
    SELECT p.id AS item_id, f.id AS folder_id, f.name, f.depth,
           ARRAY(
               SELECT t FROM unnest(p.tags) t WHERE lower(t) = lower(f.name)
           ) AS matched_tags
    FROM programs p
    JOIN folder_depth f ON f.tenant_host = p.tenant_host
    WHERE p.is_template = true
      AND p.folder_id IS NULL
      AND EXISTS (
          SELECT 1 FROM unnest(p.tags) t WHERE lower(t) = lower(f.name)
      )
),
chosen AS (
    SELECT DISTINCT ON (item_id) item_id, folder_id, name, matched_tags
    FROM matches
    ORDER BY item_id, depth DESC, lower(name) ASC
),
audit AS (
    INSERT INTO library_backfill_audit
        (item_kind, item_id, folder_id, stripped_tags, candidates)
    SELECT 'program', c.item_id, c.folder_id, c.matched_tags,
           (SELECT jsonb_agg(
                jsonb_build_object(
                    'folder_id', m.folder_id, 'name', m.name, 'depth', m.depth
                ) ORDER BY m.depth DESC, lower(m.name)
            ) FROM matches m WHERE m.item_id = c.item_id)
    FROM chosen c
    RETURNING item_id
)
UPDATE programs p
SET folder_id = c.folder_id,
    tags = library_retag(p.tags, c.name, NULL)
FROM chosen c
WHERE p.id = c.item_id;

-- 3. Seed the registry with what is left in the arrays -------------------

INSERT INTO library_tags (tenant_host, kind, name)
SELECT DISTINCT ON (tenant_host, lower(t)) tenant_host, 'recipe', t
FROM recipes, unnest(meal_type_tags) t
WHERE btrim(t) <> '' AND length(t) <= 40
ORDER BY tenant_host, lower(t), t
ON CONFLICT DO NOTHING;

INSERT INTO library_tags (tenant_host, kind, name)
SELECT DISTINCT ON (tenant_host, lower(t)) tenant_host, 'exercise', t
FROM exercises, unnest(tags) t
WHERE btrim(t) <> '' AND length(t) <= 40
ORDER BY tenant_host, lower(t), t
ON CONFLICT DO NOTHING;

INSERT INTO library_tags (tenant_host, kind, name)
SELECT DISTINCT ON (tenant_host, lower(t)) tenant_host, 'program', t
FROM programs, unnest(tags) t
WHERE is_template = true AND btrim(t) <> '' AND length(t) <= 40
ORDER BY tenant_host, lower(t), t
ON CONFLICT DO NOTHING;

-- 4. Rewrite arrays to the registry's spelling ---------------------------
-- Only rows with at least one drifted spelling are touched; tags the
-- registry does not know (blank, over-long) are left as they are.

UPDATE recipes r
SET meal_type_tags = (
    SELECT COALESCE(array_agg(name ORDER BY ord), '{}')
    FROM (
        SELECT DISTINCT ON (lower(u.t)) COALESCE(lt.name, u.t) AS name, u.ord
        FROM unnest(r.meal_type_tags) WITH ORDINALITY AS u(t, ord)
        LEFT JOIN library_tags lt
          ON lt.tenant_host = r.tenant_host AND lt.kind = 'recipe'
         AND lower(lt.name) = lower(u.t)
        ORDER BY lower(u.t), u.ord
    ) canonical
)
WHERE EXISTS (
    SELECT 1 FROM unnest(r.meal_type_tags) t
    JOIN library_tags lt
      ON lt.tenant_host = r.tenant_host AND lt.kind = 'recipe'
     AND lower(lt.name) = lower(t)
    WHERE lt.name <> t
);

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
WHERE EXISTS (
    SELECT 1 FROM unnest(e.tags) t
    JOIN library_tags lt
      ON lt.tenant_host = e.tenant_host AND lt.kind = 'exercise'
     AND lower(lt.name) = lower(t)
    WHERE lt.name <> t
);

UPDATE programs p
SET tags = (
    SELECT COALESCE(array_agg(name ORDER BY ord), '{}')
    FROM (
        SELECT DISTINCT ON (lower(u.t)) COALESCE(lt.name, u.t) AS name, u.ord
        FROM unnest(p.tags) WITH ORDINALITY AS u(t, ord)
        LEFT JOIN library_tags lt
          ON lt.tenant_host = p.tenant_host AND lt.kind = 'program'
         AND lower(lt.name) = lower(u.t)
        ORDER BY lower(u.t), u.ord
    ) canonical
)
WHERE p.tags IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM unnest(p.tags) t
    JOIN library_tags lt
      ON lt.tenant_host = p.tenant_host AND lt.kind = 'program'
     AND lower(lt.name) = lower(t)
    WHERE lt.name <> t
);
