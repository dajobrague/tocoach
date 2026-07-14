-- Meal-log photo storage bucket (P5-T2)
--
-- A public bucket for client meal-log photos. Mirrors the recipe-media bucket
-- conventions (public read, permissive upload by bucket; authorization is
-- enforced at the API layer — the client log photo route stores only under the
-- authed client's own id path). Images only.

INSERT INTO storage.buckets (
        id,
        name,
        public,
        file_size_limit,
        allowed_mime_types
    )
VALUES (
        'meal-photos',
        'meal-photos',
        true,
        10485760, -- 10 MB (a phone photo; no video here)
        ARRAY [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/webp',
            'image/heic'
        ]
    ) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow meal photo upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow meal photo update" ON storage.objects;
DROP POLICY IF EXISTS "Allow meal photo delete" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read meal photos" ON storage.objects;

-- Upload / update / delete: auth + own-path scoping enforced at the API level.
CREATE POLICY "Allow meal photo upload" ON storage.objects FOR
INSERT TO anon,
    authenticated WITH CHECK (bucket_id = 'meal-photos');

CREATE POLICY "Allow meal photo update" ON storage.objects FOR
UPDATE TO anon,
    authenticated USING (bucket_id = 'meal-photos');

CREATE POLICY "Allow meal photo delete" ON storage.objects FOR DELETE TO anon,
authenticated USING (bucket_id = 'meal-photos');

CREATE POLICY "Allow public read meal photos" ON storage.objects FOR
SELECT TO anon,
    public USING (bucket_id = 'meal-photos');
