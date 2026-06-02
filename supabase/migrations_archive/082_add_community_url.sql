-- Migration 082: Add community URL field for trainers
--
-- Context: Trainers can embed their Go High Level community page
-- (or any external URL) in the client dashboard. The URL is configured
-- in trainer settings and displayed to clients in a new "Community" tab.
--
-- Design:
--  - community_url: TEXT, nullable (trainer may not have a community)
--  - No validation constraint - URL validation happens in the API layer
--  - Existing trainers get NULL (no community tab shown to their clients)

ALTER TABLE trainers
  ADD COLUMN IF NOT EXISTS community_url TEXT;

COMMENT ON COLUMN trainers.community_url IS
  'External URL for trainer community (Go High Level, etc.). Displayed in client dashboard Community tab when set.';
