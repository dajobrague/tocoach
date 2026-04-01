-- Create meal-images storage bucket
-- This bucket stores meal photos (e.g. nutrition logging) accessible via public URLs

-- Create the bucket (if it doesn't exist)
INSERT INTO storage.buckets (
        id,
        name,
        public,
        file_size_limit,
        allowed_mime_types
    )
VALUES (
        'meal-images',
        'meal-images',
        true,
        5242880,
        -- 5MB file size limit; HEIC included for iOS gallery (same as form-photos)
        ARRAY [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/webp',
            'image/heic'
        ]
    ) ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist (cleanup)
DROP POLICY IF EXISTS "Allow meal image upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow meal image update" ON storage.objects;
DROP POLICY IF EXISTS "Allow meal image delete" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read meal images" ON storage.objects;

-- Policy 1: Allow any role to upload meal images (auth is handled at API level via JWT)
CREATE POLICY "Allow meal image upload" ON storage.objects FOR
INSERT TO anon,
    authenticated WITH CHECK (bucket_id = 'meal-images');

-- Policy 2: Allow any role to update meal images
CREATE POLICY "Allow meal image update" ON storage.objects FOR
UPDATE TO anon,
    authenticated USING (bucket_id = 'meal-images');

-- Policy 3: Allow any role to delete meal images
CREATE POLICY "Allow meal image delete" ON storage.objects FOR DELETE TO anon,
authenticated USING (bucket_id = 'meal-images');

-- Policy 4: Allow public read access to all meal images
CREATE POLICY "Allow public read meal images" ON storage.objects FOR
SELECT TO anon,
    public USING (bucket_id = 'meal-images');
