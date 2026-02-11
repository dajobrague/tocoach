-- Create client-profile-pictures storage bucket
-- This bucket stores profile/avatar images uploaded by clients

-- Create the bucket (if it doesn't exist)
INSERT INTO storage.buckets (
        id,
        name,
        public,
        file_size_limit,
        allowed_mime_types
    )
VALUES (
        'client-profile-pictures',
        'client-profile-pictures',
        true,
        -- Public bucket so images can be accessed via URL
        2097152,
        -- 2MB file size limit
        ARRAY ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    ) ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist (cleanup)
DROP POLICY IF EXISTS "Allow client profile picture upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow client profile picture update" ON storage.objects;
DROP POLICY IF EXISTS "Allow client profile picture delete" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read client profile pictures" ON storage.objects;

-- Policy 1: Allow any role to upload client profile pictures (auth is handled at API level via JWT)
CREATE POLICY "Allow client profile picture upload" ON storage.objects FOR
INSERT TO anon,
    authenticated WITH CHECK (bucket_id = 'client-profile-pictures');

-- Policy 2: Allow any role to update client profile pictures
CREATE POLICY "Allow client profile picture update" ON storage.objects FOR
UPDATE TO anon,
    authenticated USING (bucket_id = 'client-profile-pictures');

-- Policy 3: Allow any role to delete client profile pictures
CREATE POLICY "Allow client profile picture delete" ON storage.objects FOR DELETE TO anon,
authenticated USING (bucket_id = 'client-profile-pictures');

-- Policy 4: Allow public read access to all client profile pictures
CREATE POLICY "Allow public read client profile pictures" ON storage.objects FOR
SELECT TO anon,
    public USING (bucket_id = 'client-profile-pictures');
