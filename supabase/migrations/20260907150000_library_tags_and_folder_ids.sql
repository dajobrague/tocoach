-- Library tags vs folders (2026-09-07, David + JC): a folder is NOT a tag
-- any more. Membership moves to `recipes.folder_id` / `programs.folder_id`
-- (one folder per item, Drive-style) and tags become a managed registry per
-- tenant (`library_tags`). Items keep storing tag NAMES in their arrays so
-- every `@>` filter and GIN index keeps working; the registry is the source
-- of truth for which tags exist (a tag exists even while nothing carries it).
-- Exercises get tags but never folders.

-- 1. Tag registry --------------------------------------------------------

CREATE TABLE IF NOT EXISTS library_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_host TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('recipe', 'exercise', 'program')),
    name TEXT NOT NULL CHECK (btrim(name) <> '' AND length(name) <= 40),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One spelling per tag name per tenant and kind.
CREATE UNIQUE INDEX IF NOT EXISTS library_tags_tenant_kind_name_idx
    ON library_tags (tenant_host, kind, lower(name));

ALTER TABLE library_tags ENABLE ROW LEVEL SECURITY;

-- Permissive like recipe_folders / program_folders: the app talks to
-- Postgres with the anon key and its own JWT cookie, so policies have no
-- claim to compare tenant_host against. Isolation is the tenant_host filter
-- in lib/library/tag-service.ts (see rls-hardening-impact-2026-09-07.md).
CREATE POLICY "Allow anon to manage library_tags" ON library_tags
    TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage library_tags" ON library_tags
    TO authenticated USING (true) WITH CHECK (true);

-- 2. Folder membership ---------------------------------------------------

ALTER TABLE recipes
    ADD COLUMN IF NOT EXISTS folder_id UUID
        REFERENCES recipe_folders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS recipes_folder_id_idx ON recipes (folder_id);

ALTER TABLE programs
    ADD COLUMN IF NOT EXISTS folder_id UUID
        REFERENCES program_folders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS programs_folder_id_idx ON programs (folder_id);

-- 3. Tag helpers ---------------------------------------------------------

-- Rewrite one tag list: every spelling of p_old (case-insensitive) becomes
-- p_new — or disappears when p_new is NULL — keeping order and dropping
-- duplicates that the rewrite could create ("barra" + "Barra" → one).
CREATE OR REPLACE FUNCTION library_retag(
    p_tags TEXT[],
    p_old TEXT,
    p_new TEXT
) RETURNS TEXT[] LANGUAGE sql IMMUTABLE AS $$
    SELECT COALESCE(array_agg(t ORDER BY ord), '{}')
    FROM (
        SELECT DISTINCT ON (lower(t)) t, ord
        FROM (
            SELECT CASE WHEN lower(t) = lower(p_old) THEN p_new ELSE t END AS t,
                   ord
            FROM unnest(p_tags) WITH ORDINALITY AS u(t, ord)
        ) mapped
        WHERE t IS NOT NULL
        ORDER BY lower(t), ord
    ) deduped;
$$;

-- Rename (p_new_tag set) or remove (p_new_tag NULL) a tag on every item of
-- the tenant in one statement. Case-insensitive, so items whose spelling
-- drifted from the registry still follow. The recipe/program versions
-- replace the exact-match ones from the folder migrations.
CREATE OR REPLACE FUNCTION replace_recipe_tag(
    p_tenant_host TEXT,
    p_old_tag TEXT,
    p_new_tag TEXT
) RETURNS void LANGUAGE sql AS $$
    UPDATE recipes
    SET meal_type_tags = library_retag(meal_type_tags, p_old_tag, p_new_tag)
    WHERE tenant_host = p_tenant_host
      AND EXISTS (
          SELECT 1 FROM unnest(meal_type_tags) t
          WHERE lower(t) = lower(p_old_tag)
      );
$$;

CREATE OR REPLACE FUNCTION replace_program_tag(
    p_tenant_host TEXT,
    p_old_tag TEXT,
    p_new_tag TEXT
) RETURNS void LANGUAGE sql AS $$
    UPDATE programs
    SET tags = library_retag(tags, p_old_tag, p_new_tag)
    WHERE tenant_host = p_tenant_host
      AND EXISTS (
          SELECT 1 FROM unnest(tags) t WHERE lower(t) = lower(p_old_tag)
      );
$$;

CREATE OR REPLACE FUNCTION replace_exercise_tag(
    p_tenant_host TEXT,
    p_old_tag TEXT,
    p_new_tag TEXT
) RETURNS void LANGUAGE sql AS $$
    UPDATE exercises
    SET tags = library_retag(tags, p_old_tag, p_new_tag)
    WHERE tenant_host = p_tenant_host
      AND EXISTS (
          SELECT 1 FROM unnest(tags) t WHERE lower(t) = lower(p_old_tag)
      );
$$;

-- Register names that are not in the registry yet (case-insensitive), in
-- one statement. Used by write paths that receive tags from elsewhere
-- (community imports) so the registry never lags behind the arrays.
CREATE OR REPLACE FUNCTION library_ensure_tags(
    p_tenant_host TEXT,
    p_kind TEXT,
    p_names TEXT[]
) RETURNS void LANGUAGE sql AS $$
    INSERT INTO library_tags (tenant_host, kind, name)
    SELECT DISTINCT ON (lower(btrim(n))) p_tenant_host, p_kind, btrim(n)
    FROM unnest(p_names) n
    WHERE btrim(n) <> '' AND length(btrim(n)) <= 40
    ORDER BY lower(btrim(n)), btrim(n)
    ON CONFLICT DO NOTHING;
$$;

-- The registry with how many items carry each tag — one query for the
-- "Gestionar etiquetas" panel. Archived recipes don't count; programs count
-- templates only (the library the folders organise).
CREATE OR REPLACE FUNCTION library_tags_with_usage(
    p_tenant_host TEXT,
    p_kind TEXT
) RETURNS TABLE (id UUID, name TEXT, created_at TIMESTAMPTZ, usage BIGINT)
LANGUAGE sql STABLE AS $$
    WITH used AS (
        SELECT lower(t) AS key, count(*) AS n
        FROM (
            SELECT unnest(meal_type_tags) AS t FROM recipes
            WHERE p_kind = 'recipe' AND tenant_host = p_tenant_host
              AND status <> 'archived'
            UNION ALL
            SELECT unnest(tags) FROM exercises
            WHERE p_kind = 'exercise' AND tenant_host = p_tenant_host
            UNION ALL
            SELECT unnest(tags) FROM programs
            WHERE p_kind = 'program' AND tenant_host = p_tenant_host
              AND is_template = true
        ) x
        GROUP BY lower(t)
    )
    SELECT lt.id, lt.name, lt.created_at, COALESCE(used.n, 0)
    FROM library_tags lt
    LEFT JOIN used ON used.key = lower(lt.name)
    WHERE lt.tenant_host = p_tenant_host AND lt.kind = p_kind
    ORDER BY lower(lt.name);
$$;
