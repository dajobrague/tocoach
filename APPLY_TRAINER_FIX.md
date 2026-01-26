# Fix: Auto-Confirm Trainer Emails

## Problem

Trainers cannot set their password on first login because their emails are not auto-confirmed (unlike admin users).

## Solution

Apply migration `056_auto_confirm_trainer_emails.sql` to auto-confirm trainer emails.

## Quick Apply (2 minutes)

### Step 1: Open Supabase SQL Editor

Go to: https://supabase.com/dashboard/project/ydqhndnvrkvycnkaghro/sql/new

### Step 2: Copy and Run This SQL

```sql
-- Auto-confirm email for trainer users
-- This trigger automatically confirms emails for users in the trainers table
-- This ensures trainers can log in immediately with their temporary password on first login

-- Function to auto-confirm trainer emails
CREATE OR REPLACE FUNCTION auto_confirm_trainer_email()
RETURNS TRIGGER AS $$
BEGIN
  -- If this user is being added to trainers, confirm their email in auth.users
  -- confirmed_at will be automatically set by Supabase when email_confirmed_at is set
  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
  WHERE id = NEW.id
    AND email_confirmed_at IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on trainers insert
DROP TRIGGER IF EXISTS trigger_auto_confirm_trainer_email ON trainers;

CREATE TRIGGER trigger_auto_confirm_trainer_email
  AFTER INSERT ON trainers
  FOR EACH ROW
  EXECUTE FUNCTION auto_confirm_trainer_email();

-- Also confirm any existing trainers that aren't confirmed yet
-- This ensures any trainers created before this migration can also log in
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
WHERE id IN (
    SELECT id
    FROM trainers
  )
  AND email_confirmed_at IS NULL;
```

### Step 3: Click "RUN" button

You should see: "Success. No rows returned"

## Verification

After applying, any existing trainer with unconfirmed email will be confirmed, and all new trainers will be auto-confirmed on creation.

Test by:

1. Creating a new trainer in admin panel
2. Going to trainer login
3. Setting password on first login
4. Should work without "Contacta al administrador" error

## What This Does

1. **Creates function**: `auto_confirm_trainer_email()` - confirms email when trainer is added
2. **Creates trigger**: Runs the function automatically when a trainer record is inserted
3. **Fixes existing trainers**: Confirms any unconfirmed trainer emails in the database

## Technical Details

This mirrors the admin user email confirmation system (migration 045) but for trainers. Without this, Supabase requires email confirmation before allowing password authentication, which breaks the first-login password setup flow.
