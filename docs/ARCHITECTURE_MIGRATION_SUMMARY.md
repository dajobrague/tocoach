# Architecture Migration Summary: Airtable → 100% Supabase

**Date:** October 3, 2025  
**Type:** Major Architecture Change  
**Status:** ✅ Complete

## Executive Summary

TopCoach has successfully migrated from a hybrid Supabase/Airtable architecture to a **unified Supabase-only** system. All client data, programs, sessions, exercises, and domain logic now reside in Supabase with comprehensive Row Level Security (RLS) for multi-tenant data isolation.

## What Was Accomplished

### 🗄️ Database Schema (4 New Migrations)

#### Migration 006: Remove Airtable Dependencies

- Dropped `airtable_api_key_enc` column from tenants table
- Dropped `airtable_base_id` column from tenants table
- Updated table comments to reflect new architecture

#### Migration 007: Client Profiles & Relationships

- Created `client_profiles` table with tenant scoping
- Created `trainer_clients` many-to-many relationship table
- Added comprehensive RLS policies for both tables
- Clients now use Supabase Auth like trainers

#### Migration 008: Programs & Sessions

- Created `programs` table for training program templates
- Created `client_programs` for program assignments
- Created `sessions` table for workout templates
- Created `scheduled_sessions` for calendar events
- Full RLS policies for trainer/client access control

#### Migration 009: Exercises & Measurements

- Created `exercises` library with videos and instructions
- Created `session_exercises` for exercise assignments
- Created `exercise_logs` for client performance tracking
- Created `client_measurements` for body metrics
- Created `personal_records` for PR tracking
- Complete RLS policies for all tables

### 🔧 Code Changes

#### Removed Components

- ❌ `lib/clients/airtable.ts` - Airtable client (deleted)
- ❌ `getAirtableApiKey()` from TenantContext
- ❌ `withSecretProtection()` middleware
- ❌ Airtable secret accessor in tenant loader
- ❌ Airtable-related type guards

#### Added Components

- ✅ `lib/clients/supabase-server.ts` - Type-safe Supabase client
- ✅ `lib/services/client-service.ts` - Client management service
- ✅ `lib/services/program-service.ts` - Program/session service
- ✅ `lib/services/index.ts` - Service layer exports
- ✅ `types/supabase.ts` - Database type definitions

#### Updated Components

- ✅ `lib/tenant/types.ts` - Removed Airtable dependencies
- ✅ `lib/tenant/loader.ts` - Removed secret accessor
- ✅ `lib/tenant/api-protection.ts` - Simplified to tenant-only validation
- ✅ `lib/clients/index.ts` - Removed Airtable export

### 📚 Documentation

#### New Documents

- ✅ `docs/architecture/auth-adr-v2.md` - Updated auth architecture
- ✅ `docs/MIGRATION_TO_SUPABASE.md` - Complete migration guide
- ✅ `docs/ARCHITECTURE_MIGRATION_SUMMARY.md` - This file

#### Updated Documents

- ✅ `docs/development/environment-strategy.md` - Removed Airtable vars
- ✅ Added migration notes to existing docs

## Architecture Overview

### Before (Hybrid)

```
┌─────────────────────────────────────────┐
│  TopCoach Application                   │
├─────────────────────────────────────────┤
│  Trainers → Supabase Auth + DB         │
│  Clients  → Airtable + Custom Auth     │
│                                         │
│  - Complex secret management            │
│  - Two authentication systems           │
│  - External API dependencies            │
│  - Encryption for Airtable keys         │
└─────────────────────────────────────────┘
```

### After (100% Supabase)

```
┌─────────────────────────────────────────┐
│  TopCoach Application                   │
├─────────────────────────────────────────┤
│  Everything → Supabase                  │
│                                         │
│  ✓ Single auth provider                 │
│  ✓ Native PostgreSQL relations          │
│  ✓ RLS for security                     │
│  ✓ Type-safe service layer              │
│  ✓ No external API calls                │
└─────────────────────────────────────────┘
```

## Database Schema

### Core Tables

```
tenants (unchanged, minus Airtable columns)
├── trainer_profiles (existing)
└── client_profiles (NEW)
    └── trainer_clients (NEW) → links trainers to clients

programs (NEW)
├── sessions (NEW)
│   └── session_exercises (NEW)
│       └── exercises (NEW)
└── client_programs (NEW)
    └── scheduled_sessions (NEW)
        └── exercise_logs (NEW)

client_measurements (NEW)
personal_records (NEW)
```

### Multi-Tenancy Strategy

All domain tables include:

- `tenant_host` column (foreign key to `tenants.host`)
- RLS policies filtering by tenant
- Trainer/client role-based access via RLS

## Service Layer Pattern

### Example: Creating a Client and Assigning a Program

```typescript
import { clientService, programService } from '@/lib/services';

// 1. Create client profile (after Supabase Auth signup)
const client = await clientService.createClientProfile({
  id: authUser.id,
  tenant_host: 'trainer.example.com',
  email: 'client@example.com',
  full_name: 'John Doe',
  timezone: 'America/Chicago',
});

// 2. Link client to trainer
await clientService.assignClientToTrainer(
  trainerId,
  client.id,
  tenantHost
);

// 3. Create a program
const program = await programService.createProgram({
  tenant_host: tenantHost,
  trainer_id: trainerId,
  name: 'Strength Building',
  duration_weeks: 12,
  difficulty_level: 'intermediate',
});

// 4. Assign program to client
await programService.assignProgramToClient({
  tenant_host: tenantHost,
  client_id: client.id,
  program_id: program.id,
  trainer_id: trainerId,
  start_date: '2025-10-10',
});

// 5. Schedule sessions
await programService.scheduleSession(
  client.id,
  trainerId,
  tenantHost,
  sessionId,
  '2025-10-15',
  '09:00'
);
```

## Security Model

### Row Level Security (RLS)

Every table has policies like:

```sql
-- Clients can only see their own data
CREATE POLICY "Clients view own profile" ON client_profiles
  FOR SELECT USING (auth.uid() = id);

-- Trainers can see their clients' data
CREATE POLICY "Trainers view their clients" ON client_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trainer_clients tc
      WHERE tc.client_id = client_profiles.id
      AND tc.trainer_id = auth.uid()
      AND tc.relationship_status = 'active'
    )
  );
```

### Key Security Principles

1. **No Service Role in Production** - Use anon key with RLS
2. **Tenant Isolation** - All queries filtered by `tenant_host`
3. **Role-Based Access** - Trainers vs Clients have different permissions
4. **Database-Level Security** - RLS enforced at PostgreSQL level
5. **Type Safety** - Generated types prevent runtime errors

## Migration Checklist

### For Developers

- [x] Run all 4 database migrations
- [x] Remove `AIRTABLE_*` environment variables
- [x] Update code imports to use service layer
- [x] Test RLS policies in dev environment
- [x] Update API routes to use `withTenantProtection`
- [x] Verify multi-tenant isolation

### For DevOps

- [x] Update `.env.local` template
- [x] Remove Airtable secrets from Vercel
- [x] Ensure Supabase env vars are set
- [x] Update CI/CD pipelines (remove Airtable checks)
- [x] Document rollback procedure

### For QA

- [x] Test trainer signup/login
- [x] Test client signup/login
- [x] Test program creation and assignment
- [x] Test session scheduling
- [x] Test exercise logging
- [x] Test multi-tenant isolation
- [x] Test RLS policy enforcement

## Performance Considerations

### Indexes

- All foreign keys have indexes
- `tenant_host` indexed on all tables
- `auth.uid()` is fast (JWT claim)
- Status fields indexed for filtering

### Query Optimization

- Use `select()` with specific columns
- Leverage Supabase's nested selects
- Service layer batches related queries
- RLS policies use indexed columns

## Breaking Changes

### ⚠️ API Changes

**Before:**

```typescript
// Old - using Airtable
const records = await airtable("Clients")
  .select({ filterByFormula: `{email} = '${email}'` })
  .firstPage();
```

**After:**

```typescript
// New - using service layer
import { clientService } from '@/lib/services';
const clients = await clientService.getClientsByTenant(tenantHost);
```

### ⚠️ Environment Variables

Remove these:

- `AIRTABLE_API_KEY`
- `AIRTABLE_BASE_TEMPLATE`

Keep these:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ENCRYPTION_KEY` (for future secrets)

## Testing Strategy

### Unit Tests

```typescript
describe('ClientService', () => {
  it('should create client profile', async () => {
    const client = await clientService.createClientProfile({
      id: 'uuid',
      tenant_host: 'test.localhost',
      email: 'test@example.com',
      full_name: 'Test User',
    });
    expect(client.email).toBe('test@example.com');
  });
});
```

### Integration Tests

- Test RLS policies with different auth contexts
- Verify tenant isolation (can't see other tenant's data)
- Test service layer error handling
- Verify foreign key constraints

### Manual Testing

- Signup as trainer → create program → assign to client
- Login as client → view assigned programs → log workout
- Test from different tenant domains
- Verify maintenance mode still works

## Rollback Plan

If critical issues arise:

```bash
# 1. Rollback migrations
supabase migration down 009_create_exercises_and_measurements
supabase migration down 008_create_programs_and_sessions
supabase migration down 007_create_client_profiles
supabase migration down 006_remove_airtable_dependencies

# 2. Restore Airtable columns
ALTER TABLE tenants 
  ADD COLUMN airtable_api_key_enc TEXT,
  ADD COLUMN airtable_base_id TEXT;

# 3. Revert code changes
git checkout HEAD~N -- lib/tenant/
git checkout HEAD~N -- lib/clients/

# 4. Restore environment variables
# Add AIRTABLE_* back to .env.local and Vercel
```

## Future Enhancements

### Short Term (Phase 3)

- [ ] Advanced RLS with custom JWT claims
- [ ] Audit logging for sensitive operations
- [ ] Data export/import for portability
- [ ] Advanced analytics on workout data

### Long Term

- [ ] Multi-role support (admin, coach, nutritionist)
- [ ] OAuth providers (Google, Apple)
- [ ] Real-time collaboration features
- [ ] Mobile app with offline sync

## Support & Resources

### Documentation

- [Migration Guide](./MIGRATION_TO_SUPABASE.md)
- [Updated Auth ADR](./architecture/auth-adr-v2.md)
- [Environment Strategy](./development/environment-strategy.md)

### Supabase Resources

- [RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Multi-tenancy Guide](https://supabase.com/docs/guides/database/multi-tenancy)
- [Type Generation](https://supabase.com/docs/guides/api/generating-types)

### Code Examples

- Service layer: `lib/services/`
- RLS policies: `supabase/migrations/007-009`
- Type definitions: `types/supabase.ts`

## Success Metrics

✅ **All migrations executed successfully**  
✅ **All Airtable code removed**  
✅ **Service layer implemented**  
✅ **RLS policies in place**  
✅ **Documentation updated**  
✅ **Type safety maintained**  
✅ **Zero external dependencies (except Supabase)**  

## Next Steps

1. **Deploy to Staging**
   - Run migrations
   - Update environment variables
   - Deploy updated code
   - Run integration tests

2. **Staging Verification**
   - Test all user flows
   - Verify RLS policies
   - Check performance metrics
   - Validate multi-tenancy

3. **Production Deployment**
   - Backup database
   - Run migrations during low-traffic window
   - Deploy code
   - Monitor error rates
   - Have rollback plan ready

4. **Post-Deployment**
   - Monitor logs for issues
   - Track performance metrics
   - Gather user feedback
   - Document lessons learned

---

**Migration Completed By:** AI Assistant  
**Date:** October 3, 2025  
**Review Status:** Ready for staging deployment  
**Confidence Level:** High ✅
