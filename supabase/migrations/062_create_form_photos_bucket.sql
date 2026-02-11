-- Create form-photos storage bucket
-- This bucket stores photos uploaded by clients as part of form responses
-- (progress photos, body measurements photos, etc.)

-- Create the bucket (if it doesn't exist)
INSERT INTO storage.buckets (
        id,
        name,
        public,
        file_size_limit,
        allowed_mime_types
    )
VALUES (
        'form-photos',
        'form-photos',
        true,
        5242880,
        -- 5MB file size limit (progress photos can be larger)
        ARRAY ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    ) ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist (cleanup)
DROP POLICY IF EXISTS "Allow form photo upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow form photo update" ON storage.objects;
DROP POLICY IF EXISTS "Allow form photo delete" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read form photos" ON storage.objects;

-- Policy 1: Allow any role to upload form photos (auth is handled at API level via JWT)
CREATE POLICY "Allow form photo upload" ON storage.objects FOR
INSERT TO anon,
    authenticated WITH CHECK (bucket_id = 'form-photos');

-- Policy 2: Allow any role to update form photos
CREATE POLICY "Allow form photo update" ON storage.objects FOR
UPDATE TO anon,
    authenticated USING (bucket_id = 'form-photos');

-- Policy 3: Allow any role to delete form photos
CREATE POLICY "Allow form photo delete" ON storage.objects FOR DELETE TO anon,
authenticated USING (bucket_id = 'form-photos');

-- Policy 4: Allow public read access to all form photos
CREATE POLICY "Allow public read form photos" ON storage.objects FOR
SELECT TO anon,
    public USING (bucket_id = 'form-photos');
