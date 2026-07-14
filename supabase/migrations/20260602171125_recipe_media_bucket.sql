-- Recipe media storage bucket (P1-T2)
--
-- A public bucket for recipe photos and vertical videos. Mirrors the existing
-- bucket conventions (meal-images for the SQL bucket creation; exercise-videos
-- for the permissive storage RLS policy style and the 1 GB video size limit set
-- in migration 090). Authorization is enforced at the API layer (the recipe
-- routes verify trainer auth + tenant ownership); the storage policies are
-- permissive by bucket, matching the rest of the app.

-- Create the bucket (idempotent). 1 GB limit matches the training video side;
-- both image and video MIME types are allowed.
INSERT INTO storage.buckets (
        id,
        name,
        public,
        file_size_limit,
        allowed_mime_types
    )
VALUES (
        'recipe-media',
        'recipe-media',
        true,
        1073741824, -- 1 GB (matches exercise-videos after migration 090)
        ARRAY [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/webp',
            'image/heic',
            'video/mp4',
            'video/webm',
            'video/quicktime',
            'video/x-m4v'
        ]
    ) ON CONFLICT (id) DO NOTHING;

-- Cleanup any prior policies of the same name.
DROP POLICY IF EXISTS "Allow recipe media upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow recipe media update" ON storage.objects;
DROP POLICY IF EXISTS "Allow recipe media delete" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read recipe media" ON storage.objects;

-- Policy 1: upload (auth handled at the API level via JWT).
CREATE POLICY "Allow recipe media upload" ON storage.objects FOR
INSERT TO anon,
    authenticated WITH CHECK (bucket_id = 'recipe-media');

-- Policy 2: update.
CREATE POLICY "Allow recipe media update" ON storage.objects FOR
UPDATE TO anon,
    authenticated USING (bucket_id = 'recipe-media');

-- Policy 3: delete.
CREATE POLICY "Allow recipe media delete" ON storage.objects FOR DELETE TO anon,
authenticated USING (bucket_id = 'recipe-media');

-- Policy 4: public read.
CREATE POLICY "Allow public read recipe media" ON storage.objects FOR
SELECT TO anon,
    public USING (bucket_id = 'recipe-media');
