-- Exercise log sets table + client video support
-- Enables per-set tracking (reps + weight per individual set) instead of aggregate values
-- Also adds video_url to exercise_logs for client form-check videos

-- =====================================================
-- 1. Create exercise_log_sets table
-- =====================================================

CREATE TABLE IF NOT EXISTS exercise_log_sets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    exercise_log_id UUID NOT NULL REFERENCES exercise_logs(id) ON DELETE CASCADE,
    set_number INTEGER NOT NULL,
    reps INTEGER,
    weight_kg DECIMAL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(exercise_log_id, set_number)
);

CREATE INDEX IF NOT EXISTS idx_exercise_log_sets_log_id ON exercise_log_sets(exercise_log_id);

ALTER TABLE exercise_log_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon to manage exercise log sets"
    ON exercise_log_sets FOR ALL TO anon USING (true) WITH CHECK (true);

-- =====================================================
-- 2. Migrate historical data into exercise_log_sets
-- =====================================================

INSERT INTO exercise_log_sets (exercise_log_id, set_number, reps, weight_kg)
SELECT
    el.id,
    gs.set_num,
    CASE
        WHEN el.reps_completed ~ '^\d+'
        THEN (regexp_match(el.reps_completed, '(\d+)'))[1]::INTEGER
        ELSE NULL
    END,
    el.weight_kg
FROM exercise_logs el
CROSS JOIN LATERAL generate_series(1, GREATEST(COALESCE(el.sets_completed, 1), 1)) AS gs(set_num)
WHERE el.sets_completed IS NOT NULL
   OR el.reps_completed IS NOT NULL
   OR el.weight_kg IS NOT NULL;

-- =====================================================
-- 3. Add video_url column to exercise_logs
-- =====================================================

ALTER TABLE exercise_logs ADD COLUMN IF NOT EXISTS video_url TEXT;

-- =====================================================
-- 4. Storage bucket for client exercise videos
-- =====================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('client-exercise-videos', 'client-exercise-videos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow client exercise video upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow client exercise video update" ON storage.objects;
DROP POLICY IF EXISTS "Allow client exercise video delete" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read client exercise videos" ON storage.objects;

CREATE POLICY "Allow client exercise video upload" ON storage.objects FOR
INSERT TO anon, authenticated WITH CHECK (bucket_id = 'client-exercise-videos');

CREATE POLICY "Allow client exercise video update" ON storage.objects FOR
UPDATE TO anon, authenticated USING (bucket_id = 'client-exercise-videos');

CREATE POLICY "Allow client exercise video delete" ON storage.objects FOR
DELETE TO anon, authenticated USING (bucket_id = 'client-exercise-videos');

CREATE POLICY "Allow public read client exercise videos" ON storage.objects FOR
SELECT TO anon, public USING (bucket_id = 'client-exercise-videos');
