-- Program-template folders (Sep 2 call, JC): the recipe folder system reused
-- for training templates — "hombre", "mujer", "tres días", "cuatro días",
-- "full body", "torso", "pierna". Mirror of recipe_folders: a folder IS a
-- tag — a template "in" a folder carries the folder's name in programs.tags
-- (the only membership mechanism) and only the HIERARCHY lives here.
-- Tags never create folders (JC's original complaint). Deleting a folder
-- floats its children to the root and leaves the tag on the templates.

CREATE TABLE IF NOT EXISTS program_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_host TEXT NOT NULL,
    name TEXT NOT NULL,
    parent_id UUID REFERENCES program_folders(id) ON DELETE SET NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One folder per tag name (case-insensitive) per tenant.
CREATE UNIQUE INDEX IF NOT EXISTS program_folders_tenant_name_idx
    ON program_folders (tenant_host, lower(name));
CREATE INDEX IF NOT EXISTS program_folders_tenant_parent_idx
    ON program_folders (tenant_host, parent_id);
-- FK index (ON DELETE SET NULL scans parent_id alone).
CREATE INDEX IF NOT EXISTS program_folders_parent_id_idx
    ON program_folders (parent_id);

ALTER TABLE program_folders ENABLE ROW LEVEL SECURITY;

-- Permissive like recipe_folders and programs: the app talks to Postgres
-- with the anon key and its own JWT cookie (no Supabase auth session), so
-- policies have no claim to compare tenant_host against. Isolation is the
-- tenant_host filter on every query in lib/library/folder-service.ts.
CREATE POLICY "Allow anon to manage program_folders" ON program_folders
    TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage program_folders" ON program_folders
    TO authenticated USING (true) WITH CHECK (true);

-- Renaming a folder renames its tag on every program of the tenant in one
-- statement (folder name and program tags must never drift apart).
-- Idempotent; rows with NULL tags are skipped.
CREATE OR REPLACE FUNCTION replace_program_tag(
    p_tenant_host TEXT,
    p_old_tag TEXT,
    p_new_tag TEXT
) RETURNS void LANGUAGE sql AS $$
    UPDATE programs
    SET tags = array_replace(tags, p_old_tag, p_new_tag)
    WHERE tenant_host = p_tenant_host
      AND tags @> ARRAY[p_old_tag];
$$;

-- GET /api/templates?tag=a&tag=b filters with `tags @> ARRAY[a, b]`.
CREATE INDEX IF NOT EXISTS programs_tags_idx ON programs USING gin (tags);
