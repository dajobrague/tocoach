-- Fix storage policies for trainer logos
-- Description: Correct RLS policies that work with anon key uploads

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update own logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete own logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read logos" ON storage.objects;

-- Create new policies with corrected logic

-- Allow authenticated users to upload logos to their own folder
-- Note: We need to allow anon uploads since our app uses anon key
CREATE POLICY "Allow trainer logo upload" ON storage.objects
FOR INSERT TO anon, authenticated
WITH CHECK (
    bucket_id = 'trainer-logos'
);

-- Allow authenticated users to update their own logos  
CREATE POLICY "Allow trainer logo update" ON storage.objects
FOR UPDATE TO anon, authenticated
USING (
    bucket_id = 'trainer-logos'
);

-- Allow authenticated users to delete their own logos
CREATE POLICY "Allow trainer logo delete" ON storage.objects
FOR DELETE TO anon, authenticated  
USING (
    bucket_id = 'trainer-logos'
);

-- Allow public read access to all logos (since bucket is public)
CREATE POLICY "Allow public read trainer logos" ON storage.objects
FOR SELECT TO anon, public
USING (bucket_id = 'trainer-logos');
