-- =====================================================
-- PER-CLIENT PDF DIETS (nutrition-v2 delivery ladder)
-- =====================================================
-- One PDF diet per client, uploaded from the v2 trainer UI. The client's
-- Nutrición page resolves delivery as: active meal plan → PDF → goals-only →
-- empty; this table is checked BEFORE the legacy nutrition_plans.pdf_url
-- pointer, which stays as the read-only fallback for pre-v2 uploads.
-- Files live in the existing public 'nutrition-pdfs' storage bucket under
-- <trainer_id>/diet/<client_id>/. Mirrors client_nutrition_goals conventions:
-- tenant_host FK + permissive RLS + app-layer tenant scoping.
CREATE TABLE IF NOT EXISTS client_diet_pdfs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_host TEXT NOT NULL REFERENCES tenants(host) ON DELETE CASCADE,
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    pdf_url TEXT NOT NULL CHECK (pdf_url <> ''),
    pdf_name TEXT NOT NULL DEFAULT 'plan-nutricional.pdf',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_host, client_id)
);

DROP TRIGGER IF EXISTS update_client_diet_pdfs_updated_at ON client_diet_pdfs;
CREATE TRIGGER update_client_diet_pdfs_updated_at BEFORE UPDATE
    ON client_diet_pdfs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE client_diet_pdfs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon to manage client_diet_pdfs" ON client_diet_pdfs;
DROP POLICY IF EXISTS "Authenticated users can manage client_diet_pdfs" ON client_diet_pdfs;

CREATE POLICY "Allow anon to manage client_diet_pdfs" ON client_diet_pdfs
    TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage client_diet_pdfs" ON client_diet_pdfs
    TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE client_diet_pdfs IS 'One PDF diet per client (v2 uploads). Client sees it only when no meal plan is active; checked before the legacy nutrition_plans.pdf_url fallback.';

-- =====================================================
-- STORAGE: nutrition-pdfs bucket + policies (idempotent)
-- =====================================================
-- The bucket predates this migration in production (created via dashboard for
-- the legacy PDF uploader) but its objects policies were never captured in a
-- migration — a fresh/local stack has the bucket without write access, which
-- breaks uploads. Mirror the recipe-media convention: permissive per-bucket
-- policies; authorization is enforced at the API layer.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
        'nutrition-pdfs',
        'nutrition-pdfs',
        true,
        20971520, -- 20 MB, matching the API-layer cap
        ARRAY ['application/pdf']
    ) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow nutrition pdf upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow nutrition pdf update" ON storage.objects;
DROP POLICY IF EXISTS "Allow nutrition pdf delete" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read nutrition pdfs" ON storage.objects;

CREATE POLICY "Allow nutrition pdf upload" ON storage.objects FOR
INSERT TO anon,
    authenticated WITH CHECK (bucket_id = 'nutrition-pdfs');

CREATE POLICY "Allow nutrition pdf update" ON storage.objects FOR
UPDATE TO anon,
    authenticated USING (bucket_id = 'nutrition-pdfs');

CREATE POLICY "Allow nutrition pdf delete" ON storage.objects FOR DELETE TO anon,
authenticated USING (bucket_id = 'nutrition-pdfs');

CREATE POLICY "Allow public read nutrition pdfs" ON storage.objects FOR
SELECT TO public USING (bucket_id = 'nutrition-pdfs');
