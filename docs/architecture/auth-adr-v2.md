# Authentication Architecture Decision Record (ADR) v2

**Status:** Approved - Updated for 100% Supabase Architecture  
**Date:** 2025-10-03  
**Deciders:** Development Team  
**Previous Version:** auth-adr.md (hybrid Supabase/Airtable approach)

## Context and Problem Statement

TopCoach has migrated from a hybrid Supabase/Airtable approach to a **100% Supabase** architecture. This decision eliminates external dependencies, simplifies the tech stack, and leverages Supabase's powerful Row Level Security (RLS) for data isolation.

## Decision Drivers

- **Unified Data Layer**: Single source of truth in Supabase
- **Security**: Leverage Supabase RLS for multi-tenant data isolation
- **Simplicity**: Eliminate Airtable API management and encryption complexity
- **Scalability**: Native PostgreSQL performance and relationships
- **Cost Efficiency**: Reduce external service dependencies
- **Developer Experience**: One client library, consistent patterns

## Architecture Overview

Both trainers and clients use **Supabase Auth** with tenant-scoped data access via RLS policies.

### User Types

1. **Trainers** - Business owners with full platform access
2. **Clients** - End users with limited, trainer-specific access

Both user types authenticate through `auth.users` with role differentiation via profile tables.

## Implementation Details

### Database Schema

#### Trainer Profiles

```sql
-- Trainers table (already exists)
CREATE TABLE trainer_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  business_name TEXT,
  tenant_host TEXT REFERENCES tenants(host),
  status TEXT NOT NULL DEFAULT 'active',
  subscription_tier TEXT NOT NULL DEFAULT 'basic',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);
```

#### Client Profiles

```sql
-- Clients table (new)
CREATE TABLE client_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  tenant_host TEXT NOT NULL REFERENCES tenants(host),
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  onboarding_completed BOOLEAN DEFAULT false,
  profile_image_url TEXT,
  timezone TEXT DEFAULT 'America/Chicago',
  date_of_birth DATE,
  emergency_contact JSONB,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);
```

#### Trainer-Client Relationships

```sql
-- Many-to-many relationship with tenant scoping
CREATE TABLE trainer_clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trainer_id UUID NOT NULL REFERENCES trainer_profiles(id),
  client_id UUID NOT NULL REFERENCES client_profiles(id),
  tenant_host TEXT NOT NULL REFERENCES tenants(host),
  relationship_status TEXT NOT NULL DEFAULT 'active',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Authentication Flow

#### Trainer Login

```typescript
import { createClient } from '@supabase/supabase-js';

async function loginTrainer(email: string, password: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error("Invalid credentials");
  }

  // Update last login
  await supabase
    .from("trainer_profiles")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", data.user.id);

  return data;
}
```

#### Client Login

```typescript
async function loginClient(email: string, password: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error("Invalid credentials");
  }

  // Update last login
  await supabase
    .from("client_profiles")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", data.user.id);

  return data;
}
```

#### Session Verification

```typescript
async function verifySession(token: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new Error("Invalid session");
  }

  // Determine user type by checking profile tables
  const { data: trainerProfile } = await supabase
    .from("trainer_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (trainerProfile) {
    return { user, role: "trainer", profile: trainerProfile };
  }

  const { data: clientProfile } = await supabase
    .from("client_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (clientProfile) {
    return { user, role: "client", profile: clientProfile };
  }

  throw new Error("User profile not found");
}
```

### Row Level Security (RLS) Policies

#### Client Profiles

```sql
-- Clients can view their own profile
CREATE POLICY "Clients can view own profile" ON client_profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Trainers can view their clients
CREATE POLICY "Trainers can view their clients" ON client_profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM trainer_clients tc
            WHERE tc.client_id = client_profiles.id
            AND tc.trainer_id = auth.uid()
            AND tc.relationship_status = 'active'
        )
    );
```

#### Programs and Sessions

```sql
-- Trainers can manage their programs
CREATE POLICY "Trainers can manage their programs" ON programs
    FOR ALL
    USING (trainer_id = auth.uid());

-- Clients can view programs assigned to them
CREATE POLICY "Clients can view their assigned programs" ON programs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM client_programs cp
            WHERE cp.program_id = programs.id
            AND cp.client_id = auth.uid()
        )
    );
```

## Service Layer

### Client Service Example

```typescript
import { createServerSupabaseClient } from '@/lib/clients/supabase-server';

export class ClientService {
  private supabase = createServerSupabaseClient();

  async createClientProfile(data: CreateClientProfileData) {
    const { data: profile, error } = await this.supabase
      .from('client_profiles')
      .insert(data)
      .select()
      .single();

    if (error) throw new Error(`Failed to create client: ${error.message}`);
    return profile;
  }

  async getClientsForTrainer(trainerId: string) {
    const { data, error } = await this.supabase
      .from('trainer_clients')
      .select(`
        *,
        client:client_profiles(*)
      `)
      .eq('trainer_id', trainerId)
      .eq('relationship_status', 'active');

    if (error) throw new Error(`Failed to get clients: ${error.message}`);
    return data;
  }
}
```

## Security Considerations

### Password Security

- **Supabase Auth** handles password hashing (bcrypt by default)
- Passwords never stored in plaintext
- Built-in rate limiting and account lockout
- Email verification and password reset flows

### Multi-Tenancy

- All tables include `tenant_host` foreign key
- RLS policies enforce tenant isolation
- Middleware validates tenant status before serving requests
- No cross-tenant data leakage via RLS

### Session Management

- JWT tokens with configurable expiry
- Automatic token refresh
- Secure HTTP-only cookies
- CSRF protection built-in

## Migration from Previous Architecture

### Removed Components

- ❌ Airtable client and API integration
- ❌ `getAirtableApiKey` secret accessor
- ❌ Airtable API key encryption/decryption
- ❌ `withSecretProtection` middleware
- ❌ Custom Argon2 password hashing (replaced with Supabase Auth)

### Added Components

- ✅ `client_profiles` table with Supabase Auth integration
- ✅ `trainer_clients` relationship table
- ✅ Domain tables: programs, sessions, exercises, measurements
- ✅ Comprehensive RLS policies for all tables
- ✅ Type-safe service layer (`ClientService`, `ProgramService`)
- ✅ Database type definitions

## Benefits of New Architecture

1. **Unified Auth**: Single auth provider for all users
2. **Native Relations**: PostgreSQL foreign keys and joins
3. **RLS Security**: Database-level access control
4. **Type Safety**: Generated TypeScript types from schema
5. **Performance**: No external API latency
6. **Simplicity**: One client library, one data source
7. **Scalability**: PostgreSQL proven at scale
8. **Cost**: Reduced external service costs

## Future Enhancements

- [ ] Role-based permissions beyond trainer/client
- [ ] OAuth providers (Google, Apple)
- [ ] Multi-factor authentication (MFA)
- [ ] Audit logging for sensitive operations
- [ ] Data export/import for client portability

## References

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Multi-tenancy Patterns](https://supabase.com/docs/guides/database/multi-tenancy)
