# Quick Start: Supabase-Only Architecture

**Updated:** October 3, 2025  
**Status:** Production Ready

## What You Need to Know

TopCoach now runs **100% on Supabase**. No Airtable, no external databases.

## Quick Setup

### 1. Environment Variables

Create/update `.env.local`:

```bash
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...

# Encryption (for future secrets)
ENCRYPTION_KEY=your-32-byte-hex-key

# Optional: Service role (use sparingly)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

### 2. Run Migrations

```bash
# Make sure you're in the project root
cd /Users/davidbracho/top_coach

# Apply all migrations
supabase db push

# Or apply individually
supabase migration up --file supabase/migrations/006_remove_airtable_dependencies.sql
supabase migration up --file supabase/migrations/007_create_client_profiles.sql
supabase migration up --file supabase/migrations/008_create_programs_and_sessions.sql
supabase migration up --file supabase/migrations/009_create_exercises_and_measurements.sql
```

### 3. Verify Setup

```bash
# Check tables exist
npx supabase db diff

# Verify RLS policies
supabase db inspect
```

## Common Tasks

### Create a Client

```typescript
import { clientService } from '@/lib/services';

const client = await clientService.createClientProfile({
  id: authUser.id, // From Supabase Auth
  tenant_host: 'trainer.example.com',
  email: 'client@example.com',
  full_name: 'John Doe',
  timezone: 'America/Chicago',
});
```

### Assign Client to Trainer

```typescript
await clientService.assignClientToTrainer(
  trainerId,
  clientId,
  tenantHost
);
```

### Create a Program

```typescript
import { programService } from '@/lib/services';

const program = await programService.createProgram({
  tenant_host: tenantHost,
  trainer_id: trainerId,
  name: 'Beginner Strength',
  duration_weeks: 8,
  difficulty_level: 'beginner',
});
```

### Assign Program to Client

```typescript
await programService.assignProgramToClient({
  tenant_host: tenantHost,
  client_id: clientId,
  program_id: programId,
  trainer_id: trainerId,
  start_date: '2025-10-15',
});
```

### Schedule a Session

```typescript
await programService.scheduleSession(
  clientId,
  trainerId,
  tenantHost,
  sessionId,
  '2025-10-20', // date
  '09:00'       // time
);
```

## API Route Pattern

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withTenantProtection } from '@/lib/tenant/api-protection';
import { clientService } from '@/lib/services';

export async function GET(request: NextRequest) {
  return withTenantProtection(request, async (context) => {
    // context.tenant has host, slug, status, features
    const clients = await clientService.getClientsByTenant(
      context.tenant.host
    );
    
    return NextResponse.json({ clients });
  });
}
```

## Database Tables

### Core Tables

- `tenants` - Multi-tenant configuration
- `trainer_profiles` - Trainer accounts
- `client_profiles` - Client accounts
- `trainer_clients` - Trainer-client relationships

### Domain Tables

- `programs` - Training program templates
- `client_programs` - Program assignments
- `sessions` - Workout session templates
- `scheduled_sessions` - Calendar events
- `exercises` - Exercise library
- `session_exercises` - Exercises in sessions
- `exercise_logs` - Client performance data
- `client_measurements` - Body measurements
- `personal_records` - Personal records

## Security (RLS)

All tables have Row Level Security enabled:

- **Trainers** can manage their own data and their clients' data
- **Clients** can view their own data and assigned programs
- **Tenant isolation** enforced on all queries
- **No cross-tenant data leakage**

## Key Changes from Before

### ❌ Removed

- Airtable client and integration
- `getAirtableApiKey()` function
- `withSecretProtection()` middleware
- Airtable environment variables

### ✅ Added

- Service layer (`lib/services/`)
- Type-safe Supabase client
- Comprehensive RLS policies
- Database type definitions

## Troubleshooting

### Can't see data

- Check `auth.uid()` matches profile ID
- Verify tenant_host is correct
- Check RLS policies allow access

### Permission denied

- Verify user is authenticated
- Check relationship exists (trainer_clients)
- Ensure tenant is active

### Type errors

- Update `types/supabase.ts` if schema changed
- Run type generation: `supabase gen types typescript`

## Resources

- [Full Migration Guide](./MIGRATION_TO_SUPABASE.md)
- [Architecture Summary](./ARCHITECTURE_MIGRATION_SUMMARY.md)
- [Auth ADR v2](./architecture/auth-adr-v2.md)
- [Service Layer Code](../lib/services/)

## Need Help?

Check these files:

- Migrations: `supabase/migrations/`
- Services: `lib/services/`
- Types: `types/supabase.ts`
- API Protection: `lib/tenant/api-protection.ts`
