# Admin Dashboard System - Setup & Testing Guide

## Overview

The admin dashboard system has been successfully implemented. This system allows a super admin to manage trainer accounts, control subscriptions, and handle trainer onboarding with first-time password setup.

## Architecture Summary

```
Super Admin → Creates Trainer (no password)
              ↓
Trainer receives email with login URL
              ↓
Trainer goes to /trainer/login
              ↓
System detects no password set → Redirects to /trainer/setup-password
              ↓
Trainer sets password → Redirected to dashboard
              ↓
Admin manages subscription (active/paused/cancelled)
```

## Implementation Completed

### ✅ Database Changes

- **Migration**: `040_create_admin_system.sql`
  - Created `admin_users` table
  - Added subscription fields to `trainers` table
  - Added RLS policies for admin access

### ✅ Admin Features

- Admin login page: `/admin/login`
- Admin dashboard: `/admin/dashboard`
- Trainers management: `/admin/dashboard/trainers`
- Create trainer functionality
- Update subscription status (active/paused/cancelled)
- Search and filter trainers

### ✅ Trainer Features

- Modified login flow to detect password setup needed
- Password setup page: `/trainer/setup-password`
- Subscription status enforcement in login
- Public registration disabled (endpoint kept for future use)

### ✅ API Routes

- `POST /api/admin/login` - Admin authentication
- `GET /api/admin/trainers` - List all trainers
- `POST /api/admin/trainers` - Create new trainer
- `GET /api/admin/trainers/[trainerId]` - Get trainer details
- `PATCH /api/admin/trainers/[trainerId]` - Update trainer
- `DELETE /api/admin/trainers/[trainerId]` - Soft delete trainer
- `POST /api/auth/setup-password` - First-time password setup

## Deployment Steps

### 1. Apply Database Migration

Run the migration in your Supabase dashboard or via CLI:

```bash
# Option A: Via Supabase CLI (if you have it set up)
supabase db push

# Option B: Via Supabase Dashboard
# 1. Go to https://supabase.com/dashboard
# 2. Select your project
# 3. Go to SQL Editor
# 4. Copy contents of supabase/migrations/040_create_admin_system.sql
# 5. Execute the SQL
```

### 2. Create First Admin User

**Step 2.1: Create User in Supabase Auth**

1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add user" → "Create new user"
3. Enter:
   - Email: Your admin email (e.g., `admin@topcoach.com`)
   - Password: Set a secure password
   - Auto Confirm User: ✅ Check this box
4. Click "Create user"
5. **Copy the User ID** from the users list

**Step 2.2: Insert Admin Record**

Go to SQL Editor and run:

```sql
INSERT INTO admin_users (id, email, full_name, role, status)
VALUES (
  'PASTE-USER-ID-HERE',  -- Replace with the UUID from Step 2.1
  'admin@topcoach.com',   -- Replace with your admin email
  'Admin Name',           -- Replace with admin name
  'super_admin',
  'active'
);
```

### 3. Disable Supabase Email Confirmation (Production)

**Important**: For trainer creation to work, you need to disable email confirmation:

1. Go to Supabase Dashboard
2. Navigate to **Authentication** → **Providers** → **Email**
3. Find **"Confirm email"** toggle
4. **Disable it** (turn it off)
5. Save changes

This allows trainers to be created without email verification, enabling the first-time password setup flow.

### 4. Deploy to Railway

Since you're using Railway, push your changes:

```bash
git add .
git commit -m "feat: Add admin dashboard system with trainer management"
git push origin main
```

Railway will automatically deploy. Monitor the deployment logs.

### 5. Verify Environment Variables

Ensure these are set in Railway:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
ENCRYPTION_KEY=your-encryption-key
JWT_SECRET=your-jwt-secret
NEXT_PUBLIC_APP_DOMAIN=${{RAILWAY_PUBLIC_DOMAIN}}
```

## Testing Guide

### Test 1: Admin Login

1. Go to `https://your-domain.railway.app/admin/login`
2. Login with the admin credentials you created
3. ✅ Should redirect to `/admin/dashboard/trainers`
4. ✅ Should see empty trainers list (or existing trainers)

### Test 2: Create Trainer

1. In admin dashboard, click **"Agregar Entrenador"**
2. Fill in the form:
   - Full Name: `Test Trainer`
   - Email: `test@example.com`
   - Subdomain: `test-trainer` (auto-generated from name)
3. Click **"Crear Entrenador"**
4. ✅ Should see success message with instructions
5. ✅ Trainer should appear in the list with status "active"
6. ✅ "PASSWORD" column should show "Pendiente" (pending)

### Test 3: Trainer First-Time Login

1. Open new incognito/private window
2. Go to `https://your-domain.railway.app/trainer/login`
3. Enter the trainer email: `test@example.com`
4. For password, use any random string (it won't work, but that's expected)
5. ❌ Should get "Invalid credentials" error
6. **Why?** The trainer was created with a random temp password they don't know

**The correct flow is:**

1. Trainer goes to `/trainer/login`
2. Admin needs to provide them a way to access - we need to handle this!

**Important Discovery**: We need to modify the flow so trainers can access without knowing the temp password. Let me create a better solution.

## Issues Found During Testing

### Issue: Trainers Can't Login Without Knowing Temp Password

**Problem**: When admin creates a trainer, we set a random temp password. The trainer doesn't know this password, so they can't even reach the password setup page.

**Solution Options**:

1. **Email Magic Link** (Recommended): Send email with magic link to setup password
2. **Password Reset Flow**: Trainer uses "Forgot Password" immediately
3. **Admin Sets Temp Password**: Admin provides temp password to trainer manually

**Recommended Fix**: Implement magic link system where:

- Admin creates trainer
- System sends email with magic link
- Trainer clicks link → Setup password page (authenticated)
- No need to know temp password

## Current Status

### ✅ Completed

- Admin dashboard UI and functionality
- Trainer creation by admin
- Subscription management
- Database schema and migrations
- UI components and pages

### ⚠️ Needs Fix

- Trainer first-time authentication flow
- Either implement magic links or use password reset flow

### 📝 Next Steps

Choose one approach:

**Option A: Use Existing Password Reset**

- Admin creates trainer
- Admin tells trainer to use "Forgot Password" on their first visit
- Trainer resets password via email
- Simple, uses existing Supabase features

**Option B: Implement Magic Links**

- Admin creates trainer → System sends magic link email
- Trainer clicks link → Authenticated session → Setup password
- Better UX but requires email configuration

**Option C: Admin Provides Temp Password**

- Admin creates trainer with known temp password (e.g., "Welcome123")
- Admin shares temp password with trainer
- Trainer logs in with temp → Redirected to setup password
- Simplest for MVP but less secure

## Recommendation for MVP

Use **Option C** (Admin Provides Temp Password) for MVP:

1. Modify create trainer API to accept optional `tempPassword`
2. If not provided, use a default like "Welcome123!"
3. Admin shares this with trainer
4. Trainer logs in → Setup password flow works as designed

This gets you working immediately while you can implement proper email/magic links later.

## Files Created/Modified

### New Files

- `supabase/migrations/040_create_admin_system.sql`
- `app/api/admin/login/route.ts`
- `app/api/admin/trainers/route.ts`
- `app/api/admin/trainers/[trainerId]/route.ts`
- `app/api/auth/setup-password/route.ts`
- `app/admin/login/page.tsx`
- `app/admin/dashboard/layout.tsx`
- `app/admin/dashboard/page.tsx`
- `app/admin/dashboard/trainers/page.tsx`
- `app/trainer/setup-password/page.tsx`
- `components/admin/add-trainer-modal.tsx`

### Modified Files

- `app/api/auth/login/route.ts` - Added password setup check and subscription enforcement
- `app/api/auth/register/route.ts` - Added feature flag to disable public registration
- `app/trainer/login/page.tsx` - Added password setup redirect, removed signup link

## Support

If you encounter issues:

1. Check Railway logs for errors
2. Verify database migration was applied
3. Confirm admin user was created in `admin_users` table
4. Check Supabase email confirmation is disabled
5. Verify all environment variables are set

## Security Notes

- Admin routes are protected by session verification
- Trainers can only be created by authenticated admins
- Subscription status is enforced on login
- Public registration is disabled by default
- RLS policies prevent unauthorized data access
