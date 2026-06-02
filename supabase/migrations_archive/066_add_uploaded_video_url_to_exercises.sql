-- Add uploaded_video_url column to exercises table
-- This stores Supabase bucket URLs for directly uploaded vertical videos
-- Coexists with video_url which stores external links (YouTube/Vimeo)
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS uploaded_video_url TEXT;
