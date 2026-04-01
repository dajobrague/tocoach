# TopCoach — OTP Password Recovery with Resend: Implementation Roadmap

## Current State Analysis

### What exists today

**Trainers** authenticate via Supabase Auth (`signInWithPassword`). Their password recovery uses `supabase.auth.resetPasswordForEmail()` which sends a magic link that redirects to `/trainer/reset-password`, where the frontend calls `supabase.auth.updateUser({ password })`.

**Clients** authenticate with plain-text password comparison against the `clients` table (not Supabase Auth). Their password recovery hits `POST /api/auth/reset-password`, which also calls `supabase.auth.resetPasswordForEmail()` — but since clients aren't really Supabase Auth users, this is fragile and unreliable.

### Key files involved

| Area                         | File                                   | Role                                                        |
| ---------------------------- | -------------------------------------- | ----------------------------------------------------------- |
| Client forgot-password page  | `app/[slug]/forgot-password/page.tsx`  | Renders form, uses `ForgotPasswordForm` component           |
| Client reset-password page   | `app/[slug]/reset-password/page.tsx`   | Client-side Supabase `updateUser` call                      |
| Client forgot-password form  | `components/forgot-password-form.tsx`  | Sends POST to `/api/auth/reset-password`                    |
| Client reset API             | `app/api/auth/reset-password/route.ts` | Checks `client_profiles`, calls Supabase reset email        |
| Client login API             | `app/api/auth/client-login/route.ts`   | Plain-text password comparison                              |
| Client session               | `lib/auth/client-session.ts`           | JWT cookie management                                       |
| Trainer forgot-password page | `app/trainer/forgot-password/page.tsx` | Sends POST to `/api/trainer/reset-password`                 |
| Trainer reset-password page  | `app/trainer/reset-password/page.tsx`  | Supabase `updateUser` + calls `/api/trainer/setup-password` |
| Trainer session              | `lib/auth/session.ts`                  | JWT cookie management                                       |
| Middleware                   | `middleware.ts`                        | Route protection, tenant validation                         |
| Supabase client              | `lib/clients/supabase-api.ts`          | Shared Supabase client factory                              |

### Architecture notes

- Multi-tenant via slug-based routing (`/[slug]/login`, `/[slug]/dashboard`, etc.)
- Tenant validation happens in middleware against `tenants` table
- Two separate cookie systems: `client-session` (30 days) and `trainer-session` (7 days)
- UI uses HeroUI components + Iconify icons
- App language is Spanish for user-facing strings

---

## New Flow Design

```
1. User enters email on forgot-password page
2. Backend verifies account exists (without revealing to user if it doesn't)
3. Backend generates 6-digit OTP, stores it with expiration in Supabase
4. Backend sends OTP email via Resend with branded template
5. User is redirected to OTP verification screen
6. User enters 6-digit code
7. Backend validates OTP (with rate limiting + max attempts)
8. On valid OTP, backend issues a short-lived reset token
9. User is shown new password form
10. Backend validates reset token + updates password
11. OTP record is marked as used
```

---

## Implementation Steps

---

### STEP 1: Install Resend & Create Email Service

**Goal:** Add Resend SDK, create a reusable email service, and set up environment variables.

**Prompt for Cursor:**

```
CONTEXT:
I'm working on the TopCoach Next.js application. The project uses:
- Next.js App Router (app/ directory)
- Supabase for database and auth
- TypeScript throughout
- Utility modules live in lib/

TASK:
1. Install the `resend` npm package.

2. Create a new file `lib/services/email.ts` that exports a reusable email service:
   - Import Resend from 'resend'
   - Lazy-initialize the Resend client using `RESEND_API_KEY` env var
   - Export an async function `sendOTPEmail({ to, otp, brandName, logoUrl })` that:
     - Sends a beautifully styled HTML email with the 6-digit OTP code
     - The email subject should be: `${brandName} - Código de verificación`
     - The body should show the OTP in large, spaced characters (like bank verification emails)
     - Include text: "Este código expira en 10 minutos"
     - Include text: "Si no solicitaste este código, ignora este correo"
     - Use the `from` address from env var `RESEND_FROM_EMAIL` (default: "TopCoach <noreply@topcoach.app>")
     - The HTML template should be responsive, inline-styled, and look professional
     - Return { success: boolean, error?: string }

3. Also export a `sendPasswordChangedEmail({ to, brandName })` function:
   - Sends a confirmation email when password is successfully changed
   - Subject: `${brandName} - Contraseña actualizada`
   - Body confirms the password was changed and tells them to contact support if it wasn't them

4. Add these env vars to `.env.example` (create if doesn't exist):
   - RESEND_API_KEY=
   - RESEND_FROM_EMAIL=TopCoach <noreply@topcoach.app>

Do NOT modify any existing files. Only create new files.
```

---

### STEP 2: Create OTP Database Table via Supabase Migration

**Goal:** Create a `password_reset_otps` table to store OTP codes with expiration, attempt tracking, and rate limiting.

**Prompt for Cursor:**

```
CONTEXT:
I'm working on the TopCoach Next.js application. Supabase migrations live in `supabase/migrations/`. The latest migration is numbered 066. The database has:
- `trainers` table (id is UUID from Supabase Auth, has email, full_name, tenant_host)
- `clients` table (id, email, name, last_name, password [plain text], tenant [references trainer_id], status)
- `tenants` table (slug, host, trainer_id, status)
- RLS is enabled but anon access is used for most operations via the API layer

TASK:
Create a new migration file `supabase/migrations/067_create_password_reset_otps.sql` that:

1. Creates table `password_reset_otps` with columns:
   - `id` UUID primary key (default gen_random_uuid())
   - `email` TEXT NOT NULL (lowercase normalized)
   - `otp_hash` TEXT NOT NULL (we store a SHA-256 hash of the OTP, never the plain OTP)
   - `user_type` TEXT NOT NULL CHECK (user_type IN ('trainer', 'client'))
   - `tenant_slug` TEXT (nullable — null for trainers, required for clients)
   - `expires_at` TIMESTAMPTZ NOT NULL
   - `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
   - `used_at` TIMESTAMPTZ (null until used)
   - `attempts` INTEGER NOT NULL DEFAULT 0
   - `max_attempts` INTEGER NOT NULL DEFAULT 5
   - `ip_address` TEXT (for audit trail)
   - `reset_token` TEXT (short-lived token issued after OTP verification, also hashed)
   - `reset_token_expires_at` TIMESTAMPTZ

2. Create indexes:
   - On (email, user_type, tenant_slug) for lookups
   - On (expires_at) for cleanup
   - On (reset_token) for token verification

3. Enable RLS on the table. Create a policy that allows anon to INSERT, SELECT, and UPDATE (our API routes use the anon key and handle authorization in the application layer).

4. Create a function `cleanup_expired_otps()` that deletes rows where `expires_at < now() - interval '1 hour'` (keep expired ones for 1 hour for debugging, then clean up).

5. Add a rate-limiting check: create a function `check_otp_rate_limit(p_email TEXT, p_user_type TEXT, p_window_minutes INTEGER DEFAULT 15, p_max_requests INTEGER DEFAULT 3)` that returns BOOLEAN. It should count OTPs created in the last `p_window_minutes` minutes for that email+user_type combination. Returns TRUE if under the limit, FALSE if rate limited.

Do NOT modify any existing migration files.
```

---

### STEP 3: Create OTP Generation & Verification Utility

**Goal:** Build a server-side utility for generating, hashing, and verifying OTPs.

**Prompt for Cursor:**

```
CONTEXT:
I'm working on the TopCoach Next.js application. Server utilities live in `lib/`. We just created a `password_reset_otps` table in Supabase with columns: id, email, otp_hash, user_type, tenant_slug, expires_at, created_at, used_at, attempts, max_attempts, ip_address, reset_token, reset_token_expires_at.

The Supabase client factory is at `lib/clients/supabase-api.ts` and exports `createSupabaseClient()`.

TASK:
Create a new file `lib/security/otp.ts` that exports:

1. `generateOTP()`: Returns a cryptographically random 6-digit string (use Node.js crypto.randomInt). Never starts with 0 padding — wait, actually it CAN have leading zeros since it's a 6-char string. Use crypto.randomInt(0, 999999) and pad to 6 digits.

2. `hashOTP(otp: string)`: Returns a SHA-256 hex hash of the OTP using Node.js crypto.

3. `generateResetToken()`: Returns a cryptographically random 64-character hex string using crypto.randomBytes(32).

4. `async requestOTP({ email, userType, tenantSlug, ipAddress })`:
   - Normalize email to lowercase trim
   - Call the `check_otp_rate_limit` Supabase function to verify rate limiting. If rate limited, throw an error with message "Demasiados intentos. Espera 15 minutos antes de intentar de nuevo."
   - Invalidate any existing unused OTPs for this email+userType+tenantSlug (set used_at = now())
   - Generate a new OTP, hash it
   - Insert into `password_reset_otps` table with:
     - expires_at = now() + 10 minutes
     - max_attempts = 5
   - Return the PLAIN OTP (so we can email it). The plain OTP is never stored.

5. `async verifyOTP({ email, otp, userType, tenantSlug })`:
   - Hash the provided OTP
   - Look up the most recent UNUSED, NON-EXPIRED record for this email+userType+tenantSlug
   - If no record found, return { valid: false, error: "Código inválido o expirado" }
   - If record.attempts >= record.max_attempts, mark as used, return { valid: false, error: "Demasiados intentos fallidos. Solicita un nuevo código." }
   - If hash doesn't match, increment attempts, return { valid: false, error: "Código incorrecto. Te quedan X intentos." }
   - If hash matches:
     - Generate a reset token, hash it
     - Update the record: set reset_token = hashed token, reset_token_expires_at = now() + 15 minutes
     - Return { valid: true, resetToken: PLAIN_TOKEN }

6. `async verifyResetToken({ email, resetToken, userType, tenantSlug })`:
   - Hash the token
   - Look up record matching email+userType+tenantSlug+hashed token where reset_token_expires_at > now() and used_at IS NULL
   - If found, return { valid: true, otpRecordId: record.id }
   - If not, return { valid: false }

7. `async markOTPUsed(otpRecordId: string)`:
   - Set used_at = now() on the record

All crypto operations should use Node.js built-in `crypto` module. Never store plain OTPs or plain reset tokens in the database.
```

---

### STEP 4: Create API Routes for Client Password Recovery

**Goal:** Build three new API endpoints for the client OTP-based password recovery flow.

**Prompt for Cursor:**

```
CONTEXT:
I'm working on the TopCoach Next.js application (App Router). The existing password reset API route is at `app/api/auth/reset-password/route.ts` — we will NOT modify it yet (we'll replace it later). API routes follow this pattern:
- Import NextRequest, NextResponse from "next/server"
- Import createSupabaseClient from "@/lib/clients/supabase-api"
- All user-facing error messages are in Spanish

We have these new utilities available:
- `@/lib/security/otp` — exports requestOTP, verifyOTP, verifyResetToken, markOTPUsed
- `@/lib/services/email` — exports sendOTPEmail, sendPasswordChangedEmail

The `clients` table has: id, email, name, last_name, password (plain text), tenant (trainer_id FK), status.
The `tenants` table has: slug, host, trainer_id, status.

TASK:
Create THREE new API route files:

### 1. `app/api/auth/client-forgot-password/route.ts`
POST handler that:
- Accepts { email, tenantSlug } in the body
- Validates both fields are present
- Resolves tenantSlug → tenant (query tenants table for slug + status='active')
- Looks up client by email (case-insensitive using ilike) + tenant = tenant.trainer_id
- If client NOT found: still return { success: true } (prevent email enumeration). Log it.
- If client found but status is not 'Activo' or 'Onboarding Completado': return success (don't reveal status)
- If client found and active:
  - Get IP from request headers (x-forwarded-for or x-real-ip)
  - Call requestOTP({ email, userType: 'client', tenantSlug, ipAddress })
  - If rate limited (catch the error), return { success: false, error: the rate limit message, rateLimited: true }
  - Call sendOTPEmail with the OTP, using tenant theme name as brandName and tenant logo_url
  - To get brandName and logoUrl: query tenants table joining with any theme config (or just use the trainer's full_name from the trainers table as brandName)
- Always return { success: true } on the happy path (even if email send fails — log the error)

### 2. `app/api/auth/client-verify-otp/route.ts`
POST handler that:
- Accepts { email, otp, tenantSlug }
- Validates all fields
- Calls verifyOTP({ email, otp, userType: 'client', tenantSlug })
- If invalid: return { success: false, error: result.error }
- If valid: return { success: true, resetToken: result.resetToken }
- The resetToken is what the frontend will send with the new password

### 3. `app/api/auth/client-reset-password/route.ts`
POST handler that:
- Accepts { email, resetToken, newPassword, confirmPassword, tenantSlug }
- Validates all fields
- Validate passwords match
- Validate password strength (min 8 chars, at least 1 uppercase, at least 1 number) — reuse the same validation logic from `app/api/auth/setup-client-password/route.ts`
- Call verifyResetToken({ email, resetToken, userType: 'client', tenantSlug })
- If invalid: return 401 { error: "El enlace de restablecimiento ha expirado. Solicita uno nuevo." }
- If valid:
  - Update the client's password in the `clients` table (match by email ilike + tenant = trainer_id from tenantSlug)
  - Call markOTPUsed(otpRecordId)
  - Call sendPasswordChangedEmail({ to: email, brandName })
  - Return { success: true, message: "Contraseña actualizada correctamente" }

Do NOT modify any existing files. Create only the three new route files.
```

---

### STEP 5: Create API Routes for Trainer Password Recovery

**Goal:** Build three parallel API endpoints for trainer OTP-based password recovery.

**Prompt for Cursor:**

```
CONTEXT:
I'm working on the TopCoach Next.js application (App Router). Trainers authenticate via Supabase Auth (they have real Supabase Auth accounts). Their data is in the `trainers` table (id = Supabase Auth user UUID, email, full_name, status, subscription_status, password_set_at, tenant_host).

We have the same utilities:
- `@/lib/security/otp` — exports requestOTP, verifyOTP, verifyResetToken, markOTPUsed
- `@/lib/services/email` — exports sendOTPEmail, sendPasswordChangedEmail
- `@/lib/clients/supabase-api` — exports createSupabaseClient()

For trainers, the actual password update needs to go through Supabase Auth Admin API since we need to update the auth.users password. We'll need a Supabase service role client for this.

TASK:

### 1. First, create `lib/clients/supabase-admin.ts`:
- Export a function `createSupabaseAdminClient()` that creates a Supabase client using `SUPABASE_SERVICE_ROLE_KEY` env var (not the anon key)
- This gives us admin access to update auth.users passwords
- Add SUPABASE_SERVICE_ROLE_KEY to .env.example

### 2. Create `app/api/auth/trainer-forgot-password/route.ts`
POST handler:
- Accepts { email }
- Validates email
- Looks up trainer by email (case-insensitive) in trainers table
- If NOT found or status !== 'active': return { success: true } (prevent enumeration)
- If found:
  - Get IP from request headers
  - Call requestOTP({ email, userType: 'trainer', tenantSlug: null, ipAddress })
  - Handle rate limiting
  - Call sendOTPEmail({ to: email, otp, brandName: 'TopCoach', logoUrl: null })
- Return { success: true }

### 3. Create `app/api/auth/trainer-verify-otp/route.ts`
POST handler:
- Accepts { email, otp }
- Calls verifyOTP({ email, otp, userType: 'trainer', tenantSlug: null })
- Same pattern as client version

### 4. Create `app/api/auth/trainer-reset-password/route.ts`
POST handler:
- Accepts { email, resetToken, newPassword, confirmPassword }
- Validate fields, password match, password strength
- Call verifyResetToken({ email, resetToken, userType: 'trainer', tenantSlug: null })
- If valid:
  - Look up trainer by email to get their Supabase Auth UUID (trainer.id)
  - Use the ADMIN Supabase client: `supabaseAdmin.auth.admin.updateUserById(trainerId, { password: newPassword })`
  - Also update `trainers` table: set `password_set_at = now()` if it was null
  - Call markOTPUsed(otpRecordId)
  - Call sendPasswordChangedEmail({ to: email, brandName: 'TopCoach' })
  - Return { success: true }

Do NOT modify any existing files.
```

---

### STEP 6: Rebuild Client Forgot-Password Frontend (OTP Flow)

**Goal:** Replace the current client forgot-password page with a multi-step OTP flow.

**Prompt for Cursor:**

```
CONTEXT:
I'm working on the TopCoach Next.js application. The client forgot-password page is at `app/[slug]/forgot-password/page.tsx` and uses a `ForgotPasswordForm` component from `components/forgot-password-form.tsx`.

The UI uses:
- HeroUI components (Button, Input, Form from "@heroui/react")
- Iconify icons (Icon from "@iconify/react")
- Tailwind CSS classes
- Font classes: font-heading for titles, font-body for text
- All user-facing text is in Spanish

The new API endpoints are:
- POST /api/auth/client-forgot-password → { email, tenantSlug }
- POST /api/auth/client-verify-otp → { email, otp, tenantSlug } → returns { resetToken }
- POST /api/auth/client-reset-password → { email, resetToken, newPassword, confirmPassword, tenantSlug }

TASK:
Replace the contents of `components/forgot-password-form.tsx` with a NEW multi-step component that has 3 steps:

### Step 1: Email Input
- Input field for email
- Button "Enviar código de verificación"
- On submit: POST to /api/auth/client-forgot-password
- On success: move to Step 2, show toast "Te enviamos un código a tu correo"
- On rate limit (check rateLimited flag in response): show error message from API
- Store email in component state

### Step 2: OTP Verification
- Show text: "Ingresa el código de 6 dígitos que enviamos a {email}"
- 6 individual input boxes for the OTP digits (like a PIN input), auto-advance focus on each digit input
- Allow pasting a full 6-digit code
- Button "Verificar código"
- A "Reenviar código" link that re-calls Step 1's API (with a 60-second cooldown timer showing countdown)
- A "Cambiar correo" link that goes back to Step 1
- On submit: POST to /api/auth/client-verify-otp
- On success: store resetToken, move to Step 3
- On error: show error message (includes remaining attempts info)

### Step 3: New Password
- Password input with visibility toggle (eye icon)
- Confirm password input with visibility toggle
- Real-time password strength indicator showing:
  - Minimum 8 characters ✓/✗
  - At least 1 uppercase letter ✓/✗
  - At least 1 number ✓/✗
- Button "Cambiar contraseña"
- On submit: POST to /api/auth/client-reset-password with { email, resetToken, newPassword, confirmPassword, tenantSlug }
- On success: show success screen with checkmark icon, message "¡Contraseña actualizada!", auto-redirect to /{slug}/login after 3 seconds
- On error (expired token): show message and link back to Step 1

### General requirements:
- The component receives `tenantSlug` as prop (same as current)
- Use React useState for step management (step 1, 2, or 3)
- Add smooth transitions between steps
- All loading states should disable buttons and show HeroUI isLoading spinner
- Error messages in red alert boxes (same style as existing: bg-danger-50, border-danger-200)
- The OTP input should auto-focus the first box on mount

Also update `app/[slug]/forgot-password/page.tsx` if needed (the page description text should change from "send you a reset link" to match the new OTP flow).

Do NOT create any new files other than modifying these two.
```

---

### STEP 7: Rebuild Trainer Forgot-Password Frontend (OTP Flow)

**Goal:** Replace the trainer's forgot-password and reset-password pages with the same OTP flow.

**Prompt for Cursor:**

```
CONTEXT:
I'm working on the TopCoach Next.js application. The trainer forgot-password flow has two pages:
- `app/trainer/forgot-password/page.tsx` — currently sends POST to /api/trainer/reset-password
- `app/trainer/reset-password/page.tsx` — currently uses supabase.auth.updateUser

The new API endpoints for trainers are:
- POST /api/auth/trainer-forgot-password → { email }
- POST /api/auth/trainer-verify-otp → { email, otp } → returns { resetToken }
- POST /api/auth/trainer-reset-password → { email, resetToken, newPassword, confirmPassword }

The UI uses HeroUI components, Iconify icons, Tailwind CSS. User-facing text is in Spanish.

TASK:
1. Rewrite `app/trainer/forgot-password/page.tsx` to be a COMPLETE self-contained multi-step "use client" component with 3 steps (same pattern as the client version):

   - Step 1: Email input → calls /api/auth/trainer-forgot-password
   - Step 2: OTP input (6 digit boxes, auto-advance, paste support, resend cooldown) → calls /api/auth/trainer-verify-otp
   - Step 3: New password + confirm (with strength indicator) → calls /api/auth/trainer-reset-password
   - Success screen → auto-redirect to /trainer/login after 3 seconds

   This should be fully self-contained in one page component (no external form component needed since it's trainer-specific).

2. Modify `app/trainer/reset-password/page.tsx` to REDIRECT to `/trainer/forgot-password`. Since we no longer use the Supabase magic link flow, the reset-password page should just redirect users to start the OTP flow. Make it a simple component that:
   - Shows a message: "El método de recuperación ha cambiado. Redirigiendo..."
   - Auto-redirects to /trainer/forgot-password after 2 seconds
   - This handles any old/bookmarked links gracefully

3. Keep the same visual style as the existing pages (centered card layout, max-w-md, rounded-large bg-content1 shadow-small cards).

Do NOT modify any API routes or other files.
```

---

### STEP 8: Clean Up Old Password Recovery Code

**Goal:** Remove the old Supabase-based password reset flow and update references.

**Prompt for Cursor:**

```
CONTEXT:
I'm working on the TopCoach Next.js application. We've implemented a new OTP-based password recovery system using Resend. The old system used Supabase's built-in `resetPasswordForEmail` magic link flow. Now we need to clean up.

Old files/code to address:
- `app/api/auth/reset-password/route.ts` — old API that called supabase.auth.resetPasswordForEmail
- `app/[slug]/reset-password/page.tsx` — old page that called supabase.auth.updateUser directly on the client
- Any references to the old flow

TASK:
1. Replace `app/api/auth/reset-password/route.ts` with a simple redirect/deprecation handler:
   - POST: return { error: "This endpoint is deprecated. Use /api/auth/client-forgot-password", deprecated: true } with status 410 (Gone)
   - This prevents breaking anything that might still call it while making it clear it's deprecated

2. Replace `app/[slug]/reset-password/page.tsx` with a redirect page (same pattern as trainer):
   - "use client" component
   - Shows message: "El método de recuperación ha cambiado. Redirigiendo..."
   - Extracts slug from pathname
   - Auto-redirects to /{slug}/forgot-password after 2 seconds

3. Search the ENTIRE codebase for any remaining references to:
   - `supabase.auth.resetPasswordForEmail` — remove or comment out
   - `/reset-password` links in components — update to point to `/forgot-password`
   - Any `reset-password` text in login pages that describes the old flow

4. In `app/[slug]/login/page.tsx` (or wherever the "forgot password?" link is on the client login), make sure it points to `/{slug}/forgot-password`.

5. In the trainer login page, make sure the forgot password link points to `/trainer/forgot-password`.

List all files you modified so I can review them.
```

---

### STEP 9: Add Monitoring, Logging & Edge Cases

**Goal:** Add proper logging, handle edge cases, and set up OTP cleanup.

**Prompt for Cursor:**

```
CONTEXT:
I'm working on the TopCoach Next.js application. We have a complete OTP password recovery system with:
- `password_reset_otps` table in Supabase
- API routes under /api/auth/ for both client and trainer flows
- `lib/security/otp.ts` for OTP logic
- `lib/services/email.ts` for Resend emails

The project has a `cron-service/` directory for scheduled tasks.

TASK:
1. Add structured logging to ALL the new API routes (client-forgot-password, client-verify-otp, client-reset-password, trainer-forgot-password, trainer-verify-otp, trainer-reset-password):
   - Log format: `[PasswordRecovery:{step}]` prefix (e.g., [PasswordRecovery:RequestOTP], [PasswordRecovery:VerifyOTP], [PasswordRecovery:ResetPassword])
   - Log: email (masked: d***@gmail.com), userType, tenantSlug, success/failure, IP address
   - On failure: log the reason (rate limited, invalid OTP, expired token, etc.)
   - NEVER log the plain OTP or reset token

2. Create `app/api/cron/cleanup-otps/route.ts`:
   - GET handler (for cron service to call)
   - Verify a CRON_SECRET header/param to prevent unauthorized calls
   - Delete all rows from password_reset_otps where expires_at < now() - interval '24 hours'
   - Return count of deleted rows
   - Add CRON_SECRET to .env.example

3. Add error handling improvements to `lib/security/otp.ts`:
   - In requestOTP: wrap the entire flow in a try/catch. If Supabase insert fails, throw a user-friendly error
   - In verifyOTP: add a check that the OTP record's created_at is not more than 10 minutes ago (belt and suspenders with expires_at)
   - In verifyResetToken: add same expiration double-check

4. Add rate limiting at the IP level in addition to email level:
   - In the forgot-password API routes (both client and trainer), before calling requestOTP, check if this IP has made more than 10 OTP requests in the last hour across ALL emails
   - Query: SELECT count(*) FROM password_reset_otps WHERE ip_address = $1 AND created_at > now() - interval '1 hour'
   - If > 10, return rate limit error

Do NOT modify any frontend files.
```

---

### STEP 10: Testing & Verification

**Goal:** Manually verify the complete flow works end-to-end and handle any issues.

**Prompt for Cursor:**

```
CONTEXT:
I'm working on the TopCoach Next.js application. We've implemented a complete OTP-based password recovery system using Resend for both clients and trainers.

TASK:
Create a comprehensive test checklist file at `docs/password-recovery-testing.md` that covers:

### Client Flow Tests
1. Happy path: email exists → OTP received → enter OTP → set new password → login with new password
2. Non-existent email: should show success (no enumeration)
3. Wrong OTP: should show error with remaining attempts
4. Expired OTP (wait 10+ min): should show expiration error
5. Max attempts exceeded (5 wrong OTPs): should lock out and require new OTP
6. Rate limiting: request 4+ OTPs in 15 minutes → should get rate limited
7. Resend OTP: click resend → cooldown timer works → new OTP arrives → old OTP invalidated
8. Reset token expiration: get valid OTP → wait 15+ min → try to set password → should fail
9. Inactive client: status not 'Activo' → should still show success (no enumeration)
10. Wrong tenant: email exists on tenant A, try on tenant B → should show success (no enumeration)

### Trainer Flow Tests
11. Happy path: email → OTP → new password → Supabase Auth password updated → login works
12. Non-existent trainer email → success message (no enumeration)
13. Inactive trainer → success message (no enumeration)
14. Password meets requirements (8 chars, uppercase, number)
15. Password doesn't meet requirements → clear error messages

### Security Tests
16. Verify OTP is never logged in plain text (check all console.log statements)
17. Verify OTP hash is stored, not plain OTP (check database)
18. Verify reset token hash is stored, not plain token
19. Verify old Supabase magic link flow is completely disabled
20. Verify /api/auth/reset-password returns 410 Gone
21. Verify /{slug}/reset-password redirects to forgot-password
22. Verify /trainer/reset-password redirects to forgot-password
23. Cross-tenant isolation: client OTP for tenant A can't be used on tenant B

### Email Tests
24. OTP email arrives with correct branding (tenant name/logo for clients, TopCoach for trainers)
25. Password changed confirmation email arrives
26. Email renders correctly on mobile

Also create a simple test script at `scripts/test-otp-flow.ts` (Node.js script) that:
- Calls the client-forgot-password endpoint with a test email
- Verifies the response shape
- Can be run with: npx tsx scripts/test-otp-flow.ts
```

---

## Environment Variables Summary

Add these to your deployment environment (Railway/Vercel):

```
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_FROM_EMAIL=TopCoach <noreply@topcoach.app>
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJI...  (already likely exists for admin operations)
CRON_SECRET=a-random-secret-for-cron-jobs
```

## Execution Order

Steps 1-3 are foundational and have no dependencies on each other (infrastructure). Steps 4-5 build the APIs. Steps 6-7 build the frontends. Step 8 cleans up. Steps 9-10 harden and verify.

Recommended execution: **1 → 2 → 3 → 4 & 5 (parallel) → 6 & 7 (parallel) → 8 → 9 → 10**
