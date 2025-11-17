-- Storage policies and database changes only
-- Description: RLS policies for trainer-logos bucket (create bucket manually first)

-- IMPORTANT: Before running this SQL, create the bucket manually in Supabase Dashboard:
-- 1. Go to Storage in Supabase Dashboard
-- 2. Click "Create Bucket"
-- 3. Name: trainer-logos
-- 4. Public bucket: YES
-- 5. File size limit: 2MB
-- 6. Allowed MIME types: image/png, image/jpeg, image/jpg, image/svg+xml, image/webp

-- 1. Create storage policies for the trainer-logos bucket

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow authenticated upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update own logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete own logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read logos" ON storage.objects;

-- Allow authenticated users to upload logos to their own folder
CREATE POLICY "Allow authenticated upload to own folder" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'trainer-logos' 
    AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to update their own logos
CREATE POLICY "Allow authenticated update own logos" ON storage.objects
FOR UPDATE TO authenticated
USING (
    bucket_id = 'trainer-logos' 
    AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to delete their own logos
CREATE POLICY "Allow authenticated delete own logos" ON storage.objects
FOR DELETE TO authenticated
USING (
    bucket_id = 'trainer-logos' 
    AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
);

-- Allow public read access to all logos (since bucket is public)
CREATE POLICY "Allow public read logos" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'trainer-logos');

-- 2. Add logo_url column to tenants table
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Add index for logo_url lookups
CREATE INDEX IF NOT EXISTS tenants_logo_url_idx ON tenants(logo_url);

-- 3. Add comments for documentation
COMMENT ON COLUMN tenants.logo_url IS 'URL of the uploaded logo stored in Supabase Storage';

-- 4. File structure will be:
-- Path: trainer-logos/{trainer_id}/logo.{extension}
-- Example: trainer-logos/123e4567-e89b-12d3-a456-426614174000/logo.png
-- Public URL: https://your-project.supabase.co/storage/v1/object/public/trainer-logos/{trainer_id}/logo.png
