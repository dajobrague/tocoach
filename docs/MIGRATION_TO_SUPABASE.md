# Migration to 100% Supabase Architecture

**Date:** October 3, 2025  
**Status:** Completed  
**Migration Type:** Architectural - Airtable to Supabase

## Overview

This document outlines the complete migration from a hybrid Supabase/Airtable architecture to a 100% Supabase-based system. All client data, programs, sessions, and domain logic now reside in Supabase with Row Level Security (RLS) for multi-tenant isolation.

## What Changed

### Removed

1. **Airtable Integration**
   - ❌ `lib/clients/airtable.ts` - Airtable client library
   - ❌ `getAirtableApiKey()` - Secret accessor in TenantContext
   - ❌ `withSecretProtection()` - Middleware for Airtable API key access
   - ❌ Airtable API key encryption/decryption logic
   - ❌ Environment variables: `AIRTABLE_API_KEY`, `AIRTABLE_BASE_TEMPLATE`

2. **Database Columns**
   - ❌ `tenants.airtable_api_key_enc` - Encrypted Airtable API key
   - ❌ `tenants.airtable_base_id` - Airtable base identifier

3. **Documentation**
   - ❌ Airtable setup guides and references
   - ❌ Hybrid auth approach documentation

### Added

1. **New Tables**
   - ✅ `client_profiles` - Client user profiles with tenant scoping
   - ✅ `trainer_clients` - Trainer-client relationships
   - ✅ `programs` - Training program templates
   - ✅ `client_programs` - Program assignments to clients
   - ✅ `sessions` - Session templates within programs
   - ✅ `scheduled_sessions` - Calendar events for clients
   - ✅ `exercises` - Exercise library
   - ✅ `session_exercises` - Exercises within sessions
   - ✅ `exercise_logs` - Client performance tracking
   - ✅ `client_measurements` - Body measurements
   - ✅ `personal_records` - Client PRs

2. **Service Layer**
   - ✅ `lib/clients/supabase-server.ts` - Server-side Supabase client
   - ✅ `lib/services/client-service.ts` - Client management
   - ✅ `lib/services/program-service.ts` - Program and session management
   - ✅ `types/supabase.ts` - Database type definitions

3. **RLS Policies**
   - ✅ Comprehensive Row Level Security for all tables
   - ✅ Tenant-scoped data isolation
   - ✅ Role-based access (trainer vs client)

4. **Documentation**
   - ✅ `docs/architecture/auth-adr-v2.md` - Updated auth architecture
   - ✅ This migration guide

## Database Migrations

Run migrations in order:

```bash
# 1. Remove Airtable dependencies
supabase migration up --file 006_remove_airtable_dependencies.sql

# 2. Create client profiles and relationships
supabase migration up --file 007_create_client_profiles.sql

# 3. Create programs and sessions
supabase migration up --file 008_create_programs_and_sessions.sql

# 4. Create exercises and measurements
supabase migration up --file 009_create_exercises_and_measurements.sql
```

## Environment Variables

### Remove These

```bash
# Old Airtable variables - NO LONGER NEEDED
AIRTABLE_API_KEY=keyXXXXXXXXXXXXXX
AIRTABLE_BASE_TEMPLATE=appXXXXXXXXXXXXXX
```

### Keep These (Supabase Only)

```bash
# Public (client-side)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...

# Server-side (if needed for admin operations)
# Note: Most operations use anon key with RLS
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...

# Encryption (keep for future secrets like Stripe)
ENCRYPTION_KEY=your-32-byte-hex-key
```

## Code Changes

### Before: Airtable Client Usage (Removed)

```typescript
// ❌ OLD - No longer used
import { airtableClient } from '@/lib/clients/airtable';

const records = await airtable("Clients")
  .select({ filterByFormula: `{email} = '${email}'` })
  .firstPage();
```

### After: Supabase Service Layer

```typescript
// ✅ NEW - Use service layer
import { clientService } from '@/lib/services';

const clients = await clientService.getClientsByTenant(tenantHost);
```

### Before: withSecretProtection (Removed)

```typescript
// ❌ OLD - Airtable API key protection
export async function POST(request: NextRequest) {
  return withSecretProtection(request, async (context) => {
    const { apiKey } = context;
    // Use apiKey with Airtable...
  });
}
```

### After: withTenantProtection

```typescript
// ✅ NEW - Tenant validation only, data security via RLS
export async function POST(request: NextRequest) {
  return withTenantProtection(request, async (context) => {
    // Use Supabase with RLS - no secrets needed
    const supabase = createServerSupabaseClient();
    const { data } = await supabase
      .from('client_profiles')
      .select('*')
      .eq('tenant_host', context.tenant.host);
    
    return NextResponse.json({ data });
  });
}
```

### Using the Service Layer

```typescript
import { clientService, programService } from '@/lib/services';

// Create a client
const client = await clientService.createClientProfile({
  id: authUser.id,
  tenant_host: 'trainer.example.com',
  email: 'client@example.com',
  full_name: 'John Doe',
  timezone: 'America/Chicago',
});

// Assign client to trainer
await clientService.assignClientToTrainer(
  trainerId,
  client.id,
  tenantHost
);

// Create a program
const program = await programService.createProgram({
  tenant_host: tenantHost,
  trainer_id: trainerId,
  name: 'Strength Building Program',
  duration_weeks: 12,
  difficulty_level: 'intermediate',
});

// Assign program to client
await programService.assignProgramToClient({
  tenant_host: tenantHost,
  client_id: client.id,
  program_id: program.id,
  trainer_id: trainerId,
  start_date: '2025-10-10',
});
```

## Testing the Migration

### 1. Verify Database Schema

```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'client_profiles',
  'trainer_clients',
  'programs',
  'sessions',
  'exercises'
);

-- Verify Airtable columns removed
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'tenants' 
AND column_name LIKE '%airtable%';
-- Should return 0 rows
```

### 2. Test RLS Policies

```typescript
// As a trainer, create a client
const supabase = createServerSupabaseClient();

// This should work (trainer creating client)
const { data: client, error } = await supabase
  .from('client_profiles')
  .insert({
    id: newUserId,
    tenant_host: trainerTenantHost,
    email: 'test@example.com',
    full_name: 'Test Client',
  })
  .select()
  .single();

// This should be filtered by RLS (only see own clients)
const { data: clients } = await supabase
  .from('client_profiles')
  .select('*');
// Should only return clients associated with this trainer
```

### 3. Verify Service Layer

```typescript
import { clientService } from '@/lib/services';

// Test client creation
const client = await clientService.createClientProfile({
  id: authUser.id,
  tenant_host: 'test.localhost',
  email: 'test@example.com',
  full_name: 'Test User',
});

console.log('Client created:', client);

// Test getting clients for trainer
const clients = await clientService.getClientsForTrainer(trainerId);
console.log('Trainer clients:', clients.length);
```

## Rollback Plan (If Needed)

If issues arise, you can rollback migrations:

```bash
# Rollback all new migrations
supabase migration down 009_create_exercises_and_measurements
supabase migration down 008_create_programs_and_sessions
supabase migration down 007_create_client_profiles
supabase migration down 006_remove_airtable_dependencies

# Re-add Airtable columns if needed
ALTER TABLE tenants 
    ADD COLUMN airtable_api_key_enc TEXT,
    ADD COLUMN airtable_base_id TEXT;

# Restore code from git
git checkout HEAD~1 -- lib/tenant/loader.ts
git checkout HEAD~1 -- lib/tenant/api-protection.ts
git checkout HEAD~1 -- lib/tenant/types.ts
```

## Multi-Tenancy Verification

Ensure tenant isolation works correctly:

```typescript
// 1. Create two test tenants
INSERT INTO tenants (host, slug, theme_slug, theme_json, status) VALUES
  ('tenant1.test', 'tenant1', 'default', '{"meta":{},"fonts":{},"colors":{}}', 'active'),
  ('tenant2.test', 'tenant2', 'default', '{"meta":{},"fonts":{},"colors":{}}', 'active');

// 2. Create clients for each tenant
// Client 1 for tenant1
// Client 2 for tenant2

// 3. Verify RLS isolation
// Login as trainer for tenant1
// Query client_profiles - should only see tenant1 clients
// Query from tenant2 domain - should only see tenant2 clients
```

## Performance Considerations

1. **Indexes**: All foreign keys have indexes for performance
2. **RLS**: Policies use indexed columns (`auth.uid()`, `tenant_host`)
3. **Queries**: Use `select()` with specific columns to reduce payload
4. **Joins**: Service layer uses Supabase's nested selects for relations

## Security Checklist

- [x] RLS enabled on all tables
- [x] Policies enforce tenant isolation
- [x] No service role key in client code
- [x] Anon key used with RLS for security
- [x] No plaintext secrets in database
- [x] Session tokens are HTTP-only cookies
- [x] Foreign key constraints prevent orphaned data

## Support and Troubleshooting

### Common Issues

**Issue:** RLS blocking legitimate queries  
**Solution:** Check that `auth.uid()` matches the user's profile ID

**Issue:** Can't see other tenant's data  
**Solution:** This is correct! RLS enforces tenant isolation

**Issue:** Service layer errors  
**Solution:** Ensure Supabase env vars are set correctly

### Useful Queries

```sql
-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('client_profiles', 'programs', 'sessions');

-- Count records per tenant
SELECT tenant_host, COUNT(*) 
FROM client_profiles 
GROUP BY tenant_host;

-- Check foreign key constraints
SELECT
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name LIKE '%client%';
```

## Next Steps

1. ✅ Run all database migrations
2. ✅ Update environment variables
3. ✅ Deploy updated code to staging
4. ✅ Run integration tests
5. ✅ Verify multi-tenancy isolation
6. ✅ Test authentication flows
7. ✅ Monitor performance and errors
8. ✅ Deploy to production

## Questions or Issues?

If you encounter any issues during migration, check:

1. Database migration logs
2. Supabase dashboard for policy violations
3. Browser console for client-side errors
4. Server logs for API errors

Document any issues and solutions for future reference.
