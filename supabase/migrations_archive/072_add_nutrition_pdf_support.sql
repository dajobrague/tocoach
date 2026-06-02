-- Nutrition PDF meal plans: storage bucket + nutrition_plans columns
-- structured: days/meals/ingredients only; pdf: PDF only; hybrid: both

-- Create the bucket (if it doesn't exist)
INSERT INTO storage.buckets (
        id,
        name,
        public,
        file_size_limit,
        allowed_mime_types
    )
VALUES (
        'nutrition-pdfs',
        'nutrition-pdfs',
        true,
        20971520,
        -- 20MB; PDF only
        ARRAY ['application/pdf']
    ) ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist (cleanup)
DROP POLICY IF EXISTS "Allow nutrition pdf upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow nutrition pdf update" ON storage.objects;
DROP POLICY IF EXISTS "Allow nutrition pdf delete" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read nutrition pdfs" ON storage.objects;

-- Policy 1: Allow any role to upload (auth is handled at API level via JWT)
CREATE POLICY "Allow nutrition pdf upload" ON storage.objects FOR
INSERT TO anon,
    authenticated WITH CHECK (bucket_id = 'nutrition-pdfs');

-- Policy 2: Allow any role to update
CREATE POLICY "Allow nutrition pdf update" ON storage.objects FOR
UPDATE TO anon,
    authenticated USING (bucket_id = 'nutrition-pdfs');

-- Policy 3: Allow any role to delete
CREATE POLICY "Allow nutrition pdf delete" ON storage.objects FOR DELETE TO anon,
authenticated USING (bucket_id = 'nutrition-pdfs');

-- Policy 4: Allow public read access
CREATE POLICY "Allow public read nutrition pdfs" ON storage.objects FOR
SELECT TO anon,
    public USING (bucket_id = 'nutrition-pdfs');

ALTER TABLE nutrition_plans
    ADD COLUMN plan_mode TEXT NOT NULL DEFAULT 'structured',
    ADD COLUMN pdf_url TEXT,
    ADD COLUMN pdf_name TEXT,
    ADD CONSTRAINT nutrition_plans_plan_mode_check CHECK (
        plan_mode IN ('structured', 'pdf', 'hybrid')
    );

UPDATE nutrition_plans
SET
    plan_mode = 'structured';
