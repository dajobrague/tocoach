# Authentication Architecture Decision Record (ADR)

**Status:** Approved  
**Date:** 2024-01-15  
**Deciders:** Development Team

## Context and Problem Statement

TopCoach requires a dual authentication system to support two distinct user types:

1. **Trainers** - Business owners who need full platform access
2. **Clients** - End users with limited, trainer-specific access

The system must be secure, scalable, and maintainable while supporting future multi-tenancy requirements.

## Decision Drivers

- **Security**: Strong authentication with proper password hashing
- **Scalability**: Support for multiple trainers and their clients
- **Maintainability**: Clear separation of concerns
- **Data Sovereignty**: Trainers control their client data
- **Future Multi-tenancy**: Prepare for Phase 2 tenant isolation
- **Cost Efficiency**: Minimize infrastructure complexity in Phase 1

## Considered Options

### Option 1: Single Database (Rejected)

- Store both trainers and clients in one database
- Use role-based access control
- **Pros**: Simpler to implement initially
- **Cons**: Data mixing, harder tenant isolation, scaling issues

### Option 2: Separate Services with Shared Auth (Rejected)

- Dedicated auth service for both user types
- **Pros**: Centralized authentication
- **Cons**: Complex to implement, overkill for Phase 1

### Option 3: Hybrid Approach (Selected)

- **Trainers**: Supabase for authentication and data
- **Clients**: Airtable for data storage with custom authentication
- **Pros**: Leverages existing tools, clear separation, tenant-ready
- **Cons**: Two authentication systems to maintain

## Decision

We will implement a **hybrid authentication approach**:

### Trainers: Supabase Authentication

- Use Supabase Auth for trainer authentication
- Store trainer data in Supabase database
- Leverage built-in security features and session management

### Clients: Airtable + Custom Authentication

- Store client data in Airtable (per-trainer bases)
- Implement custom password authentication
- Server-generated password hashes (never plaintext)

## Implementation Details

### Trainer Authentication (Supabase)

#### Database Schema

```sql
-- Supabase handles the auth.users table
-- Custom trainer profile table
CREATE TABLE trainer_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  business_name TEXT,
  tenant_host TEXT UNIQUE, -- For Phase 2 multi-tenancy
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  subscription_tier TEXT NOT NULL DEFAULT 'basic',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- Row Level Security
ALTER TABLE trainer_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Trainers can only see their own profile
CREATE POLICY "Trainers can view own profile" ON trainer_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Trainers can update own profile" ON trainer_profiles
  FOR UPDATE USING (auth.uid() = id);
```

#### Authentication Flow

```typescript
// Trainer login
async function loginTrainer(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new AuthError("Invalid trainer credentials", "INVALID_CREDENTIALS");
  }

  // Update last login
  await supabase
    .from("trainer_profiles")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", data.user.id);

  return data;
}

// Session verification
async function verifyTrainerSession(token: string) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new AuthError("Invalid session", "SESSION_EXPIRED");
  }

  return user;
}
```

### Client Authentication (Airtable + Custom)

#### Airtable Schema

```typescript
// Clients table structure (per trainer)
interface ClientRecord {
  id: string; // Airtable record ID
  email: string; // Unique within trainer's base
  client_alias: string; // Public-safe identifier (client_abc123)
  password_hash: string; // Argon2id hash
  password_salt: string; // Unique salt per client
  password_updated_at: string; // ISO timestamp
  status: "active" | "paused"; // Account status
  last_login_at?: string; // ISO timestamp
  failed_attempts: number; // For lockout policy
  locked_until?: string; // ISO timestamp
  trainer_id: string; // Reference to trainer

  // Personal info (separate from auth)
  first_name: string;
  last_name: string;
  phone?: string;
  date_of_birth?: string;

  // Metadata
  created_at: string;
  updated_at: string;
}
```

#### Client Authentication Implementation

```typescript
import Airtable from "airtable";
import argon2 from "argon2";

class ClientAuthService {
  private airtable: Airtable.Base;

  constructor(trainerAirtableBase: string) {
    this.airtable = new Airtable({
      apiKey: process.env.AIRTABLE_API_KEY,
    }).base(trainerAirtableBase);
  }

  async loginClient(email: string, password: string): Promise<ClientSession> {
    // Find client by email
    const records = await this.airtable("Clients")
      .select({
        filterByFormula: `{email} = '${email}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) {
      throw new AuthError("Invalid credentials", "INVALID_CREDENTIALS");
    }

    const client = records[0];
    const clientData = client.fields as ClientRecord;

    // Check account lockout
    if (
      clientData.locked_until &&
      new Date(clientData.locked_until) > new Date()
    ) {
      throw new AuthError("Account temporarily locked", "ACCOUNT_LOCKED");
    }

    // Verify password
    const isValid = await argon2.verify(clientData.password_hash, password);

    if (!isValid) {
      await this.handleFailedLogin(client.id, clientData);
      throw new AuthError("Invalid credentials", "INVALID_CREDENTIALS");
    }

    // Reset failed attempts and update last login
    await this.airtable("Clients").update([
      {
        id: client.id,
        fields: {
          failed_attempts: 0,
          locked_until: null,
          last_login_at: new Date().toISOString(),
        },
      },
    ]);

    return {
      clientId: client.id,
      clientAlias: clientData.client_alias,
      trainerId: clientData.trainer_id,
      email: clientData.email,
    };
  }

  private async handleFailedLogin(clientId: string, clientData: ClientRecord) {
    const failedAttempts = (clientData.failed_attempts || 0) + 1;
    const updates: Partial<ClientRecord> = {
      failed_attempts: failedAttempts,
    };

    // Lock account after 5 failed attempts
    if (failedAttempts >= 5) {
      const lockoutDuration = this.calculateLockoutDuration(failedAttempts);
      updates.locked_until = new Date(
        Date.now() + lockoutDuration
      ).toISOString();
    }

    await this.airtable("Clients").update([
      {
        id: clientId,
        fields: updates,
      },
    ]);
  }

  async createClientPassword(
    email: string,
    plainPassword: string
  ): Promise<string> {
    const hash = await argon2.hash(plainPassword, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16, // 64 MB
      timeCost: 3,
      parallelism: 1,
    });

    return hash;
  }
}
```

### Session Management

#### Session Cookie Strategy

```typescript
interface SessionConfig {
  name: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  maxAge: number;
  path: string;
  domain?: string;
}

const sessionConfig: SessionConfig = {
  name: "topcoach-session",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 7 * 24 * 60 * 60, // 7 days
  path: "/",
  domain: process.env.NODE_ENV === "production" ? ".topcoach.app" : undefined,
};

// Session data structure
interface SessionData {
  userId: string;
  userType: "trainer" | "client";
  trainerId?: string; // For clients, which trainer they belong to
  clientAlias?: string; // For clients
  expiresAt: number;
  createdAt: number;
}
```

#### Route Guards

```typescript
// Middleware for protected routes
export function requireAuth(userType?: "trainer" | "client") {
  return async (req: NextRequest, res: NextResponse) => {
    const session = await getSession(req);

    if (!session) {
      return NextResponse.redirect("/login");
    }

    if (userType && session.userType !== userType) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Add session to request context
    req.session = session;
    return NextResponse.next();
  };
}

// Usage in API routes
export const GET = requireAuth("trainer")(async (req) => {
  // Only trainers can access this endpoint
  const trainerId = req.session.userId;
  // ... handler logic
});
```

## Data Security Measures

### Password Security

- **Algorithm**: Argon2id for all password hashing
- **Parameters**: Memory cost 64MB, time cost 3, parallelism 1
- **Salt**: Unique cryptographic salt per password
- **Storage**: Never store plaintext passwords anywhere

### Client Data Protection

- **Airtable Views**: Hide password fields from default views
- **API Access**: Server-only API keys, never sent to browser
- **Field Permissions**: Restrict password field access to admin views only

### Session Security

- **Token Generation**: Cryptographically secure random tokens
- **Storage**: HttpOnly cookies to prevent XSS
- **Expiration**: Both absolute (7 days) and sliding (24 hours idle)
- **Invalidation**: Logout, password change, suspicious activity

## Multi-Tenant Preparation (Phase 2)

### Trainer Isolation

```sql
-- Add tenant_host to trainer_profiles for subdomain routing
ALTER TABLE trainer_profiles ADD COLUMN tenant_host TEXT UNIQUE;

-- Future: tenant-specific databases or RLS policies
```

### Client Data Isolation

- Each trainer gets separate Airtable base
- Base naming convention: `topcoach-{trainer_id}`
- API keys scoped to specific bases

### Session Context

```typescript
interface MultiTenantSession extends SessionData {
  tenantHost?: string; // For trainer sessions
  tenantId?: string; // Resolved tenant identifier
  permissions: string[]; // Role-based permissions
}
```

## Migration Strategy

### Phase 1 → Phase 2

1. **Trainer Migration**: Add tenant_host field, maintain backward compatibility
2. **Client Migration**: No changes needed (already isolated in Airtable)
3. **Session Updates**: Extend session data with tenant context
4. **Route Updates**: Add tenant resolution middleware

### Future Considerations

- **Centralized Auth**: Possible migration to Auth0 or similar
- **Client Database**: Move from Airtable to dedicated database
- **Federation**: Support for external identity providers

## Risks and Mitigations

### Risk: Dual Authentication Complexity

**Mitigation**: Clear documentation, shared utilities, comprehensive testing

### Risk: Airtable API Limits

**Mitigation**: Implement caching, rate limiting, graceful degradation

### Risk: Password Security in Airtable

**Mitigation**: Strong hashing, field-level permissions, audit logging

### Risk: Session Management Complexity

**Mitigation**: Shared session utilities, consistent cookie handling

## Testing Strategy

### Unit Tests

- Password hashing/verification
- Session token generation/validation
- Authentication flow logic

### Integration Tests

- End-to-end login flows
- Session persistence
- Route protection
- Multi-user scenarios

### Security Tests

- Password brute force protection
- Session hijacking prevention
- SQL injection (Supabase)
- API abuse (Airtable)

## Implementation Phases

### Phase 1.1: Trainer Authentication

1. Set up Supabase project and database
2. Implement trainer registration/login
3. Create session management utilities
4. Add route protection middleware

### Phase 1.2: Client Authentication

1. Design Airtable schema
2. Implement client authentication service
3. Create password management utilities
4. Add client-specific route protection

### Phase 1.3: Integration

1. Unified session handling
2. Cross-user-type interactions
3. Admin interfaces for trainers
4. Testing and security review

## Success Criteria

- [ ] Trainers can register and login via Supabase
- [ ] Clients can login with Airtable-stored credentials
- [ ] Sessions persist correctly across page reloads
- [ ] Route protection works for both user types
- [ ] Password policies are enforced
- [ ] Account lockout prevents brute force attacks
- [ ] Security headers are properly configured
- [ ] All authentication flows are tested

## Approval

This ADR has been reviewed and approved by the development team. Implementation will proceed according to the phases outlined above.
