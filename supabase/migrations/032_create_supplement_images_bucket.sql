-- Create supplement-images storage bucket
-- This bucket stores product images for the supplement inventory
-- Create the bucket (if it doesn't exist)
INSERT INTO storage.buckets (
        id,
        name,
        public,
        file_size_limit,
        allowed_mime_types
    )
VALUES (
        'supplement-images',
        'supplement-images',
        true,
        -- Public bucket so images can be accessed via URL
        2097152,
        -- 2MB file size limit
        ARRAY ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    ) ON CONFLICT (id) DO NOTHING;
-- Drop existing policies if they exist (cleanup)
DROP POLICY IF EXISTS "Allow supplement image upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow supplement image update" ON storage.objects;
DROP POLICY IF EXISTS "Allow supplement image delete" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read supplement images" ON storage.objects;
-- Policy 1: Allow authenticated users to upload supplement images
CREATE POLICY "Allow supplement image upload" ON storage.objects FOR
INSERT TO anon,
    authenticated WITH CHECK (bucket_id = 'supplement-images');
-- Policy 2: Allow authenticated users to update supplement images
CREATE POLICY "Allow supplement image update" ON storage.objects FOR
UPDATE TO anon,
    authenticated USING (bucket_id = 'supplement-images');
-- Policy 3: Allow authenticated users to delete supplement images
CREATE POLICY "Allow supplement image delete" ON storage.objects FOR DELETE TO anon,
authenticated USING (bucket_id = 'supplement-images');
-- Policy 4: Allow public read access to all supplement images
CREATE POLICY "Allow public read supplement images" ON storage.objects FOR
SELECT TO anon,
    public USING (bucket_id = 'supplement-images');
-- Add comment
COMMENT ON TABLE storage.buckets IS 'Storage buckets including supplement-images for product photos';