# Development Conventions

This document outlines the coding standards, naming conventions, and development practices for TopCoach.

## Code Style & Formatting

### TypeScript/JavaScript

- **Strict TypeScript**: All strict options enabled
- **ESLint**: Enforced via pre-commit hooks
- **Prettier**: Automated formatting
- **Import order**: Organized by type, external, internal

### Naming Conventions

#### Files and Directories

```
components/
├── ui/
│   ├── button.tsx          # kebab-case for components
│   └── modal-dialog.tsx
├── service-worker-registration.tsx
└── navbar.tsx

features/
├── auth/
│   ├── components/         # feature-specific components
│   ├── hooks/             # feature-specific hooks
│   ├── types.ts           # type definitions
│   └── index.ts           # barrel exports

lib/
├── clients/
│   ├── supabase.ts        # service clients
│   └── airtable.ts
└── utils/
    ├── date-helpers.ts    # utility functions
    └── validation.ts
```

#### Variables and Functions

```typescript
// Variables: camelCase
const userName = "john_doe";
const isAuthenticated = true;
const userPreferences = {};

// Functions: camelCase, descriptive verbs
function getUserById(id: string) {}
function validateEmailFormat(email: string) {}
function calculateSessionDuration() {}

// Constants: SCREAMING_SNAKE_CASE
const MAX_LOGIN_ATTEMPTS = 5;
const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const API_ENDPOINTS = {
  AUTH: "/api/auth",
  USERS: "/api/users",
} as const;

// Types and Interfaces: PascalCase
interface UserProfile {
  id: string;
  email: string;
  createdAt: Date;
}

type AuthenticationStatus = "authenticated" | "unauthenticated" | "pending";

// Enums: PascalCase
enum UserRole {
  TRAINER = "trainer",
  CLIENT = "client",
  ADMIN = "admin",
}
```

#### React Components

```typescript
// Component names: PascalCase
export function UserDashboard() {}
export function SessionBookingModal() {}
export function TrainerProfileCard() {}

// Props interfaces: ComponentName + Props
interface UserDashboardProps {
  userId: string;
  onLogout: () => void;
}

// Hooks: use + PascalCase
export function useUserSession() {}
export function useSessionBooking() {}
export function useTrainerProfile() {}
```

## Project Structure

### Feature-Based Organization

```
features/
├── auth/                   # Authentication feature
│   ├── components/
│   │   ├── login-form.tsx
│   │   └── signup-form.tsx
│   ├── hooks/
│   │   ├── use-auth.ts
│   │   └── use-login.ts
│   ├── types.ts
│   ├── utils.ts
│   └── index.ts           # Barrel exports
├── dashboard/             # Dashboard feature
├── sessions/              # Session management
└── billing/               # Payment processing
```

### Import/Export Patterns

```typescript
// Barrel exports in index.ts
export * from "./components";
export * from "./hooks";
export * from "./types";
export * from "./utils";

// Named exports preferred
export function LoginForm() {}
export function useAuth() {}
export type User = {};

// Import patterns
import { LoginForm, useAuth } from "@/features/auth";
import { Button } from "@/components/ui";
import { config } from "@/config/environment";
```

## API Conventions

### Route Structure

```
api/
├── auth/
│   ├── login/
│   │   └── route.ts       # POST /api/auth/login
│   ├── logout/
│   │   └── route.ts       # POST /api/auth/logout
│   └── me/
│       └── route.ts       # GET /api/auth/me
├── trainers/
│   ├── route.ts           # GET /api/trainers, POST /api/trainers
│   └── [id]/
│       ├── route.ts       # GET /api/trainers/[id], PUT /api/trainers/[id]
│       └── clients/
│           └── route.ts   # GET /api/trainers/[id]/clients
└── sessions/
    ├── route.ts           # GET /api/sessions, POST /api/sessions
    └── [id]/
        └── route.ts       # GET /api/sessions/[id], PUT /api/sessions/[id]
```

### HTTP Methods

- **GET**: Retrieve data (idempotent)
- **POST**: Create new resources
- **PUT**: Update entire resource
- **PATCH**: Partial updates
- **DELETE**: Remove resources

### Response Formats

```typescript
// Success responses
{
  "data": { /* resource data */ },
  "message": "Operation successful",
  "timestamp": "2024-01-15T10:30:00.000Z"
}

// Error responses
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "field": "email"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}

// List responses
{
  "data": [/* array of resources */],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "hasMore": true
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Git Conventions

### Commit Messages (Conventional Commits)

```bash
# Format: type(scope): description

# Types
feat(auth): add password reset functionality
fix(dashboard): resolve session timeout issue
docs(api): update authentication endpoints
style(ui): fix button spacing in mobile view
refactor(sessions): extract booking logic to hook
test(auth): add unit tests for login validation
chore(deps): update dependencies to latest versions
perf(dashboard): optimize data fetching

# Examples
feat(auth): implement trainer login with Supabase
fix(billing): handle Stripe webhook timeout errors
docs(deployment): add CI/CD pipeline documentation
```

### Branch Naming

```bash
# Feature branches
feature/auth-implementation
feature/dashboard-redesign
feature/payment-integration

# Bug fixes
fix/session-booking-error
fix/mobile-responsive-issues

# Hotfixes
hotfix/security-vulnerability
hotfix/payment-processing-error

# Release branches
release/v1.0.0
release/v1.1.0
```

### Pull Request Template

```markdown
## Description

Brief description of changes made.

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] Manual testing completed

## Accessibility

- [ ] Keyboard navigation tested
- [ ] Screen reader compatibility verified
- [ ] Color contrast meets WCAG standards

## Security

- [ ] No sensitive data exposed
- [ ] Input validation implemented
- [ ] Authentication/authorization verified

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or properly documented)
```

## Testing Conventions

### Test File Structure

```
src/
├── components/
│   ├── button.tsx
│   └── button.test.tsx
├── features/
│   └── auth/
│       ├── hooks/
│       │   ├── use-auth.ts
│       │   └── use-auth.test.ts
│       └── utils/
│           ├── validation.ts
│           └── validation.test.ts
```

### Test Naming

```typescript
// Test suites: describe what is being tested
describe("LoginForm", () => {
  describe("when user submits valid credentials", () => {
    it("should call onLogin with email and password", () => {});
    it("should show loading state during submission", () => {});
    it("should redirect to dashboard on success", () => {});
  });

  describe("when user submits invalid credentials", () => {
    it("should display error message", () => {});
    it("should not call onLogin", () => {});
    it("should reset form after error", () => {});
  });
});

// Test descriptions: should describe expected behavior
it("should validate email format before submission", () => {});
it("should disable submit button when form is invalid", () => {});
it("should clear error message when user starts typing", () => {});
```

### Test Categories

```typescript
// Unit tests: Test individual functions/components
describe('validateEmail', () => {
  it('should return true for valid email', () => {
    expect(validateEmail('user@example.com')).toBe(true);
  });
});

// Integration tests: Test feature workflows
describe('Authentication Flow', () => {
  it('should complete login process end-to-end', async () => {
    // Test full login workflow
  });
});

// Component tests: Test React components
describe('LoginForm Component', () => {
  it('should render all form fields', () => {
    render(<LoginForm />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });
});
```

## Database Conventions

### Table Naming

```sql
-- Tables: snake_case, plural
CREATE TABLE trainer_profiles (...);
CREATE TABLE client_sessions (...);
CREATE TABLE payment_transactions (...);

-- Columns: snake_case
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes: descriptive names
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_sessions_trainer_date ON client_sessions(trainer_id, session_date);
```

### Migration Naming

```
migrations/
├── 001_create_trainer_profiles.sql
├── 002_add_subscription_tiers.sql
├── 003_create_client_sessions_table.sql
└── 004_add_payment_status_index.sql
```

## Error Handling

### Error Classes

```typescript
// Custom error classes
class AuthError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = "AuthError";
  }
}

// Error usage
throw new AuthError("Invalid credentials", "INVALID_CREDENTIALS");
throw new ValidationError("Email is required", "email");
throw new RateLimitError("Too many attempts", 300);
```

### Error Boundaries

```typescript
// Component error boundaries
function FeatureErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      fallback={<ErrorFallback />}
      onError={(error, errorInfo) => {
        logger.error('Component error', { error, errorInfo });
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
```

## Performance Guidelines

### Code Splitting

```typescript
// Route-based code splitting
const Dashboard = lazy(() => import("@/features/dashboard"));
const Sessions = lazy(() => import("@/features/sessions"));

// Component-based code splitting
const HeavyChart = lazy(() => import("@/components/heavy-chart"));
```

### Optimization Patterns

```typescript
// Memoization for expensive calculations
const expensiveValue = useMemo(() => {
  return calculateComplexValue(data);
}, [data]);

// Callback memoization
const handleClick = useCallback((id: string) => {
  onItemClick(id);
}, [onItemClick]);

// Component memoization
export const UserCard = memo(({ user }: UserCardProps) => {
  return <div>{user.name}</div>;
});
```

## Accessibility Guidelines

### Semantic HTML

```tsx
// Use semantic elements
<main>
  <section aria-labelledby="dashboard-heading">
    <h1 id="dashboard-heading">Dashboard</h1>
    <nav aria-label="Dashboard navigation">
      <ul>
        <li>
          <a href="/sessions">Sessions</a>
        </li>
      </ul>
    </nav>
  </section>
</main>
```

### ARIA Labels

```tsx
// Descriptive labels
<button aria-label="Close dialog">×</button>
<input aria-describedby="email-help" />
<div id="email-help">Enter your email address</div>

// Live regions for dynamic content
<div aria-live="polite" aria-atomic="true">
  {statusMessage}
</div>
```

### Keyboard Navigation

```tsx
// Focus management
const dialogRef = useRef<HTMLDialogElement>(null);

useEffect(() => {
  if (isOpen) {
    dialogRef.current?.focus();
  }
}, [isOpen]);

// Keyboard event handling
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === "Escape") {
    onClose();
  }
};
```

## Documentation Standards

### Code Comments

```typescript
/**
 * Validates user authentication credentials
 * @param email - User's email address
 * @param password - User's password (will be hashed)
 * @returns Promise resolving to authentication result
 * @throws {AuthError} When credentials are invalid
 */
async function validateCredentials(
  email: string,
  password: string
): Promise<AuthResult> {
  // Implementation...
}

// Inline comments for complex logic
// Calculate lockout duration using exponential backoff
const lockoutMs = BASE_LOCKOUT_MS * Math.pow(2, failedAttempts - 1);
```

### README Structure

```markdown
# Feature Name

## Overview

Brief description of the feature.

## Installation

Steps to set up the feature.

## Usage

Examples of how to use the feature.

## API Reference

Detailed API documentation.

## Testing

How to run tests for this feature.

## Contributing

Guidelines for contributing to this feature.
```

These conventions ensure consistent, maintainable, and high-quality code across the TopCoach project.
