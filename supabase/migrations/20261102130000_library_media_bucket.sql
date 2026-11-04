-- Private bucket for the licensed RepDB exercise media (compressed mp4 + poster,
-- one pair per exercise and sex: <male|female>/<slug>.mp4|.webp). The license
-- forbids public/bulk access to the catalog, so: private bucket, NO policies
-- (anon/authenticated get nothing), and every read goes through a short-lived
-- signed URL minted by /api/library/media for a logged-in trainer or client.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
        'library-media',
        'library-media',
        false,
        5242880, -- 5 MB; clips are ~50 KB
        ARRAY ['video/mp4', 'image/webp']
    ) ON CONFLICT (id) DO NOTHING;
