# Routing Structure - Client & Trainer Separation

## Problem Solved

Next.js was throwing a build error because both `app/login/page.tsx` (trainer) and `app/(client)/login/page.tsx` (client) resolved to the same `/login` path. Route groups don't create different routes at build time - they're just for organization.

## Solution

**Architecture Change (November 2024):** Migrated from subdomain-based routing to slug-based routing. Client routes now use `/[slug]/...` pattern instead of subdomains.

## Current Route Structure

### Main Domain (localhost, topcoach.app)

**Trainer-facing routes:**

```
/                          → Theme demo page (app/page.tsx)
/trainer/login            → Trainer login (app/trainer/login/page.tsx)
/trainer/register         → Trainer registration (app/trainer/register/page.tsx)
/trainer/dashboard        → Trainer dashboard (app/trainer/dashboard/page.tsx)
/trainer/dashboard/setup  → Setup wizard
/trainer/dashboard/clients → Client management
```

### Slug-Based Client Routes (e.g., /ironfit/...)

**Client-facing routes:**

```
/[slug]/                    → Redirects to /[slug]/dashboard or /[slug]/login
/[slug]/login              → Branded client login (app/[slug]/login/page.tsx)
/[slug]/dashboard          → Client dashboard (app/[slug]/dashboard/page.tsx)
/[slug]/programs           → Training programs (app/[slug]/programs/page.tsx)
/[slug]/calendar           → Workout calendar (app/[slug]/calendar/page.tsx)
/[slug]/profile            → Client profile (app/[slug]/profile/page.tsx)
/[slug]/nutricion          → Nutrition content (app/[slug]/nutricion/page.tsx)
/[slug]/ejercicio          → Workout exercises (app/[slug]/ejercicio/page.tsx)
/[slug]/mas                → More options (app/[slug]/mas/page.tsx)
/[slug]/forgot-password    → Password reset request (app/[slug]/forgot-password/page.tsx)
/[slug]/reset-password     → Password reset form (app/[slug]/reset-password/page.tsx)
```

### API Routes (Both Domains)

**Trainer Auth:**

```
/api/auth/login     → Trainer login (validates trainer, sets trainer-session cookie)
/api/auth/register  → Trainer registration
/api/auth/logout    → Trainer logout
```

**Client Auth:**

```
/api/auth/client-login         → Client login (validates client + tenant slug, sets client-session cookie)
/api/auth/client-logout        → Client logout
/api/auth/reset-password       → Password reset email
/api/auth/setup-client-password → First-time password setup
/api/auth/check-client-email   → Check if client email exists
```

## How Middleware Routes Requests

### Trainer Routes (no slug in path)

- Serves trainer pages directly
- No tenant branding applied
- Uses trainer-session cookie for authentication
- Blocks client-only routes (`/dashboard`, `/login` without slug prefix)

### Client Routes (slug detected in path `/[slug]/...`)

1. **Slug Validation:**

   - Extracts slug from URL path (e.g., `/ironfit/dashboard` → `ironfit`)
   - Validates slug exists in database (`tenants.host = slug`)
   - Returns 404 if slug is invalid

2. **Root `/[slug]/`:**

   - Has client session → rewrites to `/[slug]/dashboard`
   - No session → rewrites to `/[slug]/login`

3. **Protected Routes** (`/[slug]/dashboard`, `/[slug]/programs`, etc.):

   - Checks for client-session cookie
   - Validates `tenant_slug` matches URL slug
   - No session → redirects to `/[slug]/login`
   - Wrong tenant → redirects to `/[slug]/login`

4. **Public Routes** (`/[slug]/login`, `/[slug]/forgot-password`, `/[slug]/reset-password`):
   - Allows access without authentication
   - Shows branded UI based on tenant slug

## Session Cookies

### Trainer Session

- **Cookie name:** `trainer-session`
- **Domain:** Main domain only
- **Duration:** 7 days
- **Contains:** `trainer_id`, `email`, `full_name`

### Client Session

- **Cookie name:** `client-session`
- **Domain:** Same domain (no subdomain isolation needed)
- **Duration:** 30 days
- **Contains:** `client_id`, `tenant_slug`, `email`, `full_name`

## Testing

### Test Main Domain (Trainer)

```bash
# Visit http://localhost:3000
# Should show theme demo page

# Visit http://localhost:3000/trainer/login
# Should show trainer login form
```

### Test Slug-Based Client Routes

```bash
# Visit http://localhost:3000/ironfit/login
# Should show branded login page for IronFit tenant

# Login with client credentials
# Should redirect to http://localhost:3000/ironfit/dashboard

# All navigation should maintain the slug in the URL
```

## File Organization

```
app/
├── page.tsx                    # Main domain home (theme demo)
├── trainer/                    # Trainer routes (main domain)
│   ├── login/page.tsx
│   ├── register/page.tsx
│   └── dashboard/
│       ├── page.tsx
│       └── clients/[clientId]/page.tsx
├── [slug]/                     # Client routes (slug-based)
│   ├── page.tsx               # Root redirect handler
│   ├── layout.tsx             # Simple wrapper
│   ├── login/page.tsx
│   ├── dashboard/page.tsx
│   ├── programs/page.tsx
│   ├── calendar/page.tsx
│   ├── profile/page.tsx
│   ├── nutricion/page.tsx
│   ├── ejercicio/page.tsx
│   ├── mas/page.tsx
│   ├── forgot-password/page.tsx
│   └── reset-password/page.tsx
└── api/
    └── auth/
        ├── login/route.ts                # Trainer
        ├── register/route.ts             # Trainer
        ├── logout/route.ts               # Trainer
        ├── client-login/route.ts         # Client
        ├── client-logout/route.ts        # Client
        ├── check-client-email/route.ts   # Client
        ├── setup-client-password/route.ts # Client
        └── reset-password/route.ts       # Client
```

## Why This Works

1. **No Path Conflicts:** `/trainer/login` ≠ `/[slug]/login`
2. **Slug Validation:** Middleware validates tenant exists in database
3. **Separate Sessions:** Different cookie names prevent conflicts
4. **Clear Organization:** Developer knows which routes serve which users
5. **Scalable:** No subdomain DNS configuration needed
6. **SEO Friendly:** All client sites under main domain

## Database Notes

- The `tenants` table uses the `host` field to store slug values
- Example: `host = 'ironfit'` (not 'ironfit.localhost' or 'ironfit.topcoach.app')
- In code, we treat `host` field conceptually as `tenant_slug`
- No database schema changes were needed for the migration
