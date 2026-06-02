-- Create exercise-images storage bucket RLS policies
-- This bucket stores exercise demonstration images for the trainer's exercise library
-- Note: Bucket should be created manually via Supabase dashboard first
-- Drop existing policies if they exist (cleanup)
DROP POLICY IF EXISTS "Allow exercise image upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow exercise image update" ON storage.objects;
DROP POLICY IF EXISTS "Allow exercise image delete" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read exercise images" ON storage.objects;
-- Policy 1: Allow authenticated users to upload exercise images
CREATE POLICY "Allow exercise image upload" ON storage.objects FOR
INSERT TO anon,
    authenticated WITH CHECK (bucket_id = 'exercise-images');
-- Policy 2: Allow authenticated users to update exercise images
CREATE POLICY "Allow exercise image update" ON storage.objects FOR
UPDATE TO anon,
    authenticated USING (bucket_id = 'exercise-images');
-- Policy 3: Allow authenticated users to delete exercise images
CREATE POLICY "Allow exercise image delete" ON storage.objects FOR DELETE TO anon,
authenticated USING (bucket_id = 'exercise-images');
-- Policy 4: Allow public read access to all exercise images
CREATE POLICY "Allow public read exercise images" ON storage.objects FOR
SELECT TO anon,
    public USING (bucket_id = 'exercise-images');