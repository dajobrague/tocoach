# Form Notifications Cron Setup

This guide explains how to set up automated form notifications using Supabase pg_cron.

## Overview

The system automatically sends notifications to clients for:

- **Daily Habits Form**: Every day at 8:00 AM UTC
- **Weekly Check-in**: Every Monday at 8:00 AM UTC

## Setup Instructions

### 1. Deploy to Railway

First, make sure your app is deployed to Railway and you have the deployment URL.

Example: `https://top-coach-production.up.railway.app`

### 2. Update the Migration File

Open `supabase/migrations/038_setup_form_notifications_cron.sql` and replace `YOUR_RAILWAY_APP_URL` with your actual Railway deployment URL.

**Find this line (around line 25):**

```sql
url := 'https://YOUR_RAILWAY_APP_URL.up.railway.app/api/forms/notifications/create',
```

**Replace with your actual URL:**

```sql
url := 'https://top-coach-production.up.railway.app/api/forms/notifications/create',
```

### 3. Verify Supabase Plan

The `pg_net` extension requires **Supabase Pro plan**.

- ✅ If you have Pro: Continue to next step
- ❌ If you have Free: You'll need to upgrade or use an alternative solution (see below)

### 4. Run the Migration

Run the migration in Supabase:

**Option A: Via Supabase Dashboard**

1. Go to your Supabase project
2. Navigate to SQL Editor
3. Copy the contents of `038_setup_form_notifications_cron.sql`
4. Execute the SQL

**Option B: Via Supabase CLI**

```bash
supabase db push
```

### 5. Verify the Cron Job

Check that the job was created successfully:

```sql
SELECT * FROM cron.job;
```

You should see a job named `send-form-notifications` with schedule `0 * * * *`.

## Monitoring

### Check Job Execution History

```sql
SELECT *
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'send-form-notifications')
ORDER BY start_time DESC
LIMIT 10;
```

### Check Recent Notifications Created

```sql
SELECT
  type,
  title,
  COUNT(*) as count,
  MAX(created_at) as last_created
FROM notifications
WHERE metadata->>'created_by' = 'system'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY type, title
ORDER BY last_created DESC;
```

## Timezone Configuration

The cron job runs in **UTC timezone**. The schedule `0 * * * *` means:

- Notifications are sent at 8:00 AM UTC every day
- For clients in different timezones, you may want to adjust this

**To change the schedule:**

1. Unschedule the existing job:

   ```sql
   SELECT cron.unschedule('send-form-notifications');
   ```

2. Create a new schedule (example for 9 AM UTC):

   ```sql
   SELECT cron.schedule(
     'send-form-notifications',
     '0 9 * * *',  -- 9 AM UTC
     $$
     SELECT net.http_request(
       method := 'PUT',
       url := 'https://YOUR_URL.up.railway.app/api/forms/notifications/create',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{}'::jsonb,
       timeout_milliseconds := 30000
     ) AS request_id;
     $$
   );
   ```

## Troubleshooting

### Job not running?

1. Check if pg_cron extension is enabled:

   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
   ```

2. Check job status:

   ```sql
   SELECT * FROM cron.job WHERE jobname = 'send-form-notifications';
   ```

3. Check for errors in execution:

   ```sql
   SELECT *
   FROM cron.job_run_details
   WHERE status = 'failed'
   ORDER BY start_time DESC
   LIMIT 5;
   ```

### Notifications not appearing?

1. Check if the API endpoint is working:

   ```bash
   curl -X PUT https://YOUR_URL.up.railway.app/api/forms/notifications/create \
     -H "Content-Type: application/json"
   ```

2. Check Railway logs for errors

3. Verify clients exist in database:

   ```sql
   SELECT COUNT(*) FROM clients;
   ```

### Extension not available?

If you get "extension pg_net does not exist":

- You need Supabase Pro plan
- Alternative: Use external cron service (see below)

## Alternative Solutions (Without Supabase Pro)

If you don't have Supabase Pro, you can use:

### Option 1: Free External Cron Service

1. Sign up at [cron-job.org](https://cron-job.org) (free)
2. Create a new cron job:
   - URL: `https://YOUR_URL.up.railway.app/api/forms/notifications/create`
   - Method: PUT
   - Schedule: Every hour at minute 0
   - Headers: `Content-Type: application/json`

### Option 2: Railway Cron Service

Create a separate lightweight service in Railway:

```javascript
// cron-worker.js
const cron = require("node-cron");
const fetch = require("node-fetch");

const API_URL = process.env.API_URL;

// Run every hour at minute 0
cron.schedule("0 * * * *", async () => {
  console.log("Running form notifications job...");
  try {
    const response = await fetch(`${API_URL}/api/forms/notifications/create`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
    });
    const data = await response.json();
    console.log("Job completed:", data);
  } catch (error) {
    console.error("Job failed:", error);
  }
});

console.log("Cron worker started");
```

Deploy as a separate Railway service (costs ~$5/month).

## Manual Testing

To manually trigger the notification job:

```bash
curl -X PUT https://YOUR_URL.up.railway.app/api/forms/notifications/create \
  -H "Content-Type: application/json"
```

The response will show how many notifications were created.

## Disable Cron Job

To stop the automated notifications:

```sql
SELECT cron.unschedule('send-form-notifications');
```

## Support

For issues or questions:

1. Check Railway logs
2. Check Supabase logs
3. Verify the migration ran successfully
4. Test the API endpoint manually
