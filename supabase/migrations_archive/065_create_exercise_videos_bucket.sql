-- Create exercise-videos storage bucket RLS policies
-- This bucket stores uploaded exercise demonstration videos (vertical format)
-- Note: Bucket must be created manually via Supabase dashboard first (set public, 100MB file size limit)
-- Drop existing policies if they exist (cleanup)
DROP POLICY IF EXISTS "Allow exercise video upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow exercise video update" ON storage.objects;
DROP POLICY IF EXISTS "Allow exercise video delete" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read exercise videos" ON storage.objects;
-- Policy 1: Allow authenticated users to upload exercise videos
CREATE POLICY "Allow exercise video upload" ON storage.objects FOR
INSERT TO anon,
    authenticated WITH CHECK (bucket_id = 'exercise-videos');
-- Policy 2: Allow authenticated users to update exercise videos
CREATE POLICY "Allow exercise video update" ON storage.objects FOR
UPDATE TO anon,
    authenticated USING (bucket_id = 'exercise-videos');
-- Policy 3: Allow authenticated users to delete exercise videos
CREATE POLICY "Allow exercise video delete" ON storage.objects FOR DELETE TO anon,
authenticated USING (bucket_id = 'exercise-videos');
-- Policy 4: Allow public read access to all exercise videos
CREATE POLICY "Allow public read exercise videos" ON storage.objects FOR
SELECT TO anon,
    public USING (bucket_id = 'exercise-videos');
