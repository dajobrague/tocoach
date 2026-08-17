-- Recipe folders (Jul 28 call, Pablo): visual folder organization for the
-- recipe library. A folder IS a tag — recipes keep meal_type_tags as the
-- only membership mechanism (portable for the shared-recipes phase) and a
-- recipe "in" a folder simply carries the folder's name as a tag. Only the
-- HIERARCHY lives here: parent_id nests folders inside folders. Deleting a
-- folder floats its children to the root and leaves the tag on recipes.

CREATE TABLE IF NOT EXISTS recipe_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_host TEXT NOT NULL,
    name TEXT NOT NULL,
    parent_id UUID REFERENCES recipe_folders(id) ON DELETE SET NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One folder per tag name (case-insensitive) per tenant.
CREATE UNIQUE INDEX IF NOT EXISTS recipe_folders_tenant_name_idx
    ON recipe_folders (tenant_host, lower(name));
CREATE INDEX IF NOT EXISTS recipe_folders_tenant_parent_idx
    ON recipe_folders (tenant_host, parent_id);

ALTER TABLE recipe_folders ENABLE ROW LEVEL SECURITY;

-- Permissive like every nutrition-v2 table: isolation is app-layer via
-- tenant_host filters in the service.
CREATE POLICY "Allow anon to manage recipe_folders" ON recipe_folders
    TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage recipe_folders" ON recipe_folders
    TO authenticated USING (true) WITH CHECK (true);

-- Renaming a folder renames its tag on every recipe in one statement
-- (folder name and recipe tags must never drift apart). Idempotent.
CREATE OR REPLACE FUNCTION replace_recipe_tag(
    p_tenant_host TEXT,
    p_old_tag TEXT,
    p_new_tag TEXT
) RETURNS void LANGUAGE sql AS $$
    UPDATE recipes
    SET meal_type_tags = array_replace(meal_type_tags, p_old_tag, p_new_tag)
    WHERE tenant_host = p_tenant_host
      AND meal_type_tags @> ARRAY[p_old_tag];
$$;
