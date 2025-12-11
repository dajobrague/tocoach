-- Setup automated form notifications using Supabase pg_cron
-- This migration creates a scheduled job that calls the Railway API endpoint
-- to generate form notifications for all clients
-- =====================================================
-- ENABLE EXTENSIONS
-- =====================================================
-- Enable pg_cron for scheduling jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
-- Enable pg_net for making HTTP requests (requires Supabase Pro)
CREATE EXTENSION IF NOT EXISTS pg_net;
-- =====================================================
-- CREATE CRON JOB
-- =====================================================
-- Schedule job to run every hour at minute 0
-- This will call the Railway API to generate form notifications
-- Note: Replace YOUR_RAILWAY_APP_URL with your actual Railway deployment URL
SELECT cron.schedule(
        'send-form-notifications',
        -- Job name
        '0 * * * *',
        -- Cron schedule: Every hour at minute 0
        $$
        SELECT net.http_request(
                method := 'PUT',
                url := 'https://tocoach-production-23fd.up.railway.app/api/forms/notifications/create',
                headers := '{"Content-Type": "application/json"}'::jsonb,
                body := '{}'::jsonb,
                timeout_milliseconds := 30000
            ) AS request_id;
$$
);
-- =====================================================
-- VERIFY CRON JOB
-- =====================================================
-- You can verify the job was created by running:
-- SELECT * FROM cron.job;
-- =====================================================
-- MONITOR CRON JOB EXECUTIONS
-- =====================================================
-- To see the job execution history:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON EXTENSION pg_cron IS 'PostgreSQL job scheduler for running scheduled tasks';
COMMENT ON EXTENSION pg_net IS 'PostgreSQL extension for making HTTP requests';
-- =====================================================
-- MANUAL EXECUTION (FOR TESTING)
-- =====================================================
-- To manually trigger the job for testing, run:
-- SELECT cron.unschedule('send-form-notifications');
-- Then run the schedule command again
-- =====================================================
-- IMPORTANT SETUP NOTES:
-- =====================================================
-- 1. This migration will FAIL on first run because you need to replace
--    YOUR_RAILWAY_APP_URL with your actual Railway deployment URL
-- 
-- 2. Before running this migration:
--    - Deploy your app to Railway
--    - Get your Railway app URL (e.g., top-coach-production.up.railway.app)
--    - Replace YOUR_RAILWAY_APP_URL in line 25 with your actual URL
--
-- 3. The pg_net extension requires Supabase Pro plan
--    If you're on the free plan, you'll need to upgrade or use an alternative
--    cron solution (see README for alternatives)
--
-- 4. The cron job runs in UTC timezone. The API endpoint handles
--    the logic for determining which notifications to send based on
--    the current time.
--
-- 5. To disable the cron job later, run:
--    SELECT cron.unschedule('send-form-notifications');
-- =====================================================