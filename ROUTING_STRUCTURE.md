# Routing Structure - Client & Trainer Separation

## Problem Solved

Next.js was throwing a build error because both `app/login/page.tsx` (trainer) and `app/(client)/login/page.tsx` (client) resolved to the same `/login` path. Route groups don't create different routes at build time - they're just for organization.

## Solution

Moved trainer authentication pages to `/trainer/*` paths to avoid conflicts with client routes.

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

### Subdomains (e.g., ironfit.localhost, trainer.topcoach.app)

**Client-facing routes:**

```
/                    → Redirects to /dashboard or /login (app/(client)/page.tsx)
/login              → Branded client login (app/(client)/login/page.tsx)
/dashboard          → Client dashboard (app/(client)/dashboard/page.tsx)
/programs           → Training programs (app/(client)/programs/page.tsx)
/calendar           → Workout calendar (app/(client)/calendar/page.tsx)
/profile            → Client profile (app/(client)/profile/page.tsx)
/forgot-password    → Password reset request (app/(client)/forgot-password/page.tsx)
/reset-password     → Password reset form (app/(client)/reset-password/page.tsx)
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
/api/auth/client-login  → Client login (validates client + tenant, sets client-session cookie)
/api/auth/client-logout → Client logout
/api/auth/reset-password → Password reset email
```

## How Middleware Routes Requests

### Main Domain (localhost)

- Serves trainer pages directly
- No tenant branding applied
- Uses trainer-session cookie for authentication

### Subdomains (non-localhost)

1. **Root `/`:**
   - Has client session → rewrites to `/dashboard`
   - No session → rewrites to `/login`

2. **Protected Routes** (`/dashboard`, `/programs`, `/calendar`, `/profile`):
   - Checks for client-session cookie
   - Validates tenant_host matches subdomain
   - No session → redirects to `/login`
   - Wrong tenant → redirects to `/login`

3. **Public Routes** (`/login`, `/forgot-password`, `/reset-password`):
   - Allows access without authentication
   - Shows branded UI based on tenant

## Session Cookies

### Trainer Session

- **Cookie name:** `trainer-session`
- **Domain:** Main domain only
- **Duration:** 7 days
- **Contains:** `trainer_id`, `tenant_host`, `email`, `full_name`

### Client Session

- **Cookie name:** `client-session`
- **Domain:** Subdomain specific
- **Duration:** 30 days
- **Contains:** `client_id`, `tenant_host`, `email`, `full_name`

## Testing

### Test Main Domain (Trainer)

```bash
# Visit http://localhost:3000
# Should show theme demo page

# Visit http://localhost:3000/trainer/login
# Should show trainer login form
```

### Test Subdomain (Client)

```bash
# Visit http://ironfit.localhost:3000
# Should redirect to branded login page

# Login with client credentials
# Should redirect to dashboard with bottom navigation
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
├── (client)/                   # Client routes (subdomains)
│   ├── page.tsx               # Root redirect handler
│   ├── layout.tsx             # Simple wrapper
│   ├── login/page.tsx
│   ├── dashboard/page.tsx
│   ├── programs/page.tsx
│   ├── calendar/page.tsx
│   ├── profile/page.tsx
│   ├── forgot-password/page.tsx
│   └── reset-password/page.tsx
└── api/
    └── auth/
        ├── login/route.ts            # Trainer
        ├── register/route.ts         # Trainer
        ├── logout/route.ts           # Trainer
        ├── client-login/route.ts     # Client
        ├── client-logout/route.ts    # Client
        └── reset-password/route.ts   # Client
```

## Why This Works

1. **No Path Conflicts:** `/trainer/login` ≠ `/(client)/login`
2. **Domain Separation:** Middleware routes based on hostname
3. **Separate Sessions:** Different cookie names prevent conflicts
4. **Clear Organization:** Developer knows which routes serve which users
