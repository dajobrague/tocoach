# 🚀 QUICK FIX: Trainer Password Setup Issue

## Problem Found

Trainers get "Contacta al administrador" error when setting password on first login.

**Root Cause**: Trainer emails are not auto-confirmed (unlike admin users), so authentication with temporary password fails.

## ✅ Solution (3 Steps - 5 Minutes)

### Step 1: Sign in to Supabase Dashboard

1. Go to: https://supabase.com/dashboard/sign-in
2. Sign in with your credentials
3. Select project: `ydqhndnvrkvycnkaghro`

### Step 2: Apply SQL Migration

1. Navigate to: **SQL Editor** (left sidebar)
2. Click: **New query** (top right)
3. **Copy and paste this SQL** into the editor:

```sql
-- Auto-confirm email for trainer users
CREATE OR REPLACE FUNCTION auto_confirm_trainer_email()
RETURNS TRIGGER AS $$
BEGIN
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

-- Confirm any existing trainers
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
WHERE id IN (SELECT id FROM trainers)
  AND email_confirmed_at IS NULL;
```

4. Click **RUN** (or press Cmd+Enter / Ctrl+Enter)
5. You should see: ✅ **"Success. No rows returned"**

### Step 3: Verify Fix Works

```bash
node verify-trainer-fix.js
```

This will check that trainers are in the database and confirmed.

## 🧪 Final Test

1. Go to admin panel: http://localhost:3000/admin/login
2. Create a new test trainer (or use existing one)
3. Go to trainer login: http://localhost:3000/trainer/login
4. Enter trainer email
5. Set a new password
6. **Should work!** ✅ No more "Contacta al administrador" error

## What Changed

- ✅ Function created: `auto_confirm_trainer_email()`
- ✅ Trigger added: Auto-runs when trainer record inserted
- ✅ Existing trainers: All emails confirmed in auth.users
- ✅ New trainers: Will auto-confirm on creation

## Technical Explanation

The first-login flow works like this:

1. Trainer enters email → System detects first login
2. Trainer creates new password → Frontend tries to sign in with temp password "TopCoach2026!"
3. **Before fix**: Sign-in fails because email not confirmed ❌
4. **After fix**: Email auto-confirmed, sign-in works ✅
5. System updates to new password → Success!

## Files Created

- ✅ `supabase/migrations/056_auto_confirm_trainer_emails.sql` - Migration file
- ✅ `verify-trainer-fix.js` - Verification script
- ✅ `APPLY_TRAINER_FIX.md` - Detailed guide
- ✅ `QUICK_FIX_GUIDE.md` - This quick guide

## Need Help?

If after applying the migration trainers still can't set passwords:

1. Check browser console for errors
2. Run: `node verify-trainer-fix.js` to verify migration applied
3. Check Supabase Dashboard → Authentication → Users to see if trainer emails are confirmed
