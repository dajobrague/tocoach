# Environment & Secrets Strategy

This document defines how environment variables, secrets, and configuration are managed across different environments.

## Environment Overview

### Development (Local)

- **Purpose**: Local development and testing
- **Domain**: `localhost:3000`
- **Database**: Local Supabase instance or development project
- **Payments**: Stripe test mode
- **Logging**: Console output with debug level

### Preview (Staging)

- **Purpose**: Feature testing and stakeholder review
- **Domain**: `preview.topcoach.app`
- **Database**: Supabase preview project
- **Payments**: Stripe test mode
- **Logging**: Structured JSON to monitoring service

### Production

- **Purpose**: Live application
- **Domain**: `app.topcoach.com`
- **Database**: Supabase production project
- **Payments**: Stripe live mode
- **Logging**: Structured JSON with monitoring and alerting

## Environment Variables

### Naming Convention

- **Public variables**: `NEXT_PUBLIC_*` (accessible in browser)
- **Server-only variables**: No prefix (server-side only)
- **Service prefixes**: `SUPABASE_*`, `AIRTABLE_*`, `STRIPE_*`, `REDIS_*`

### Variable Categories

#### Application Configuration

```bash
# Environment identification
NODE_ENV=development|preview|production
APP_ENV=dev|preview|prod
APP_URL=https://app.topcoach.com

# Feature flags (public)
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_PAYMENTS=true
NEXT_PUBLIC_DEBUG_MODE=false
```

#### Database & Authentication (Supabase)

```bash
# Server-side only
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...

# Public (for client-side auth)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
```

#### External Services

```bash
# Airtable (server-side only)
AIRTABLE_API_KEY=keyXXXXXXXXXXXXXX
AIRTABLE_BASE_TEMPLATE=appXXXXXXXXXXXXXX

# Stripe (server-side only)
STRIPE_SECRET_KEY=sk_test_XXXXXXXXXXXXXXXXXXXXXXXX
STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXXXXXXXXXXXXXXXX

# Public Stripe key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_XXXXXXXXXXXXXXXXXXXXXXXX

# Redis (future)
REDIS_URL=redis://localhost:6379
REDIS_TOKEN=your-redis-token

# Email service (future)
SENDGRID_API_KEY=SG.XXXXXXXXXXXXXXXXXXXXXXXX
```

#### Security & Monitoring

```bash
# Session encryption
SESSION_SECRET=your-very-long-random-string-here
JWT_SECRET=another-long-random-string-for-jwt

# Rate limiting
RATE_LIMIT_REDIS_URL=redis://localhost:6379

# Monitoring (future)
SENTRY_DSN=https://xxx@sentry.io/xxx
DATADOG_API_KEY=your-datadog-api-key
```

## Secret Management

### Development Environment

- **Storage**: `.env.local` file (gitignored)
- **Access**: Direct file reading
- **Rotation**: Manual, as needed
- **Sharing**: Secure document sharing for team

```bash
# .env.local example
NODE_ENV=development
APP_ENV=dev
SUPABASE_URL=https://dev-project.supabase.co
SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
AIRTABLE_API_KEY=keyDEVELOPMENTXXXXXX
STRIPE_SECRET_KEY=sk_test_XXXXXXXXXXXXXXXXXXXXXXXX
SESSION_SECRET=dev-session-secret-change-in-production
```

### Preview Environment

- **Storage**: Vercel environment variables
- **Access**: Vercel dashboard or CLI
- **Rotation**: Monthly or as needed
- **Values**: Test/staging service credentials

### Production Environment

- **Storage**: Vercel environment variables (encrypted)
- **Access**: Restricted to admin users only
- **Rotation**: Quarterly or after security incidents
- **Values**: Production service credentials

## Configuration Management

### Environment-Specific Configuration

```typescript
// config/environment.ts
interface EnvironmentConfig {
  app: {
    env: string;
    url: string;
    debug: boolean;
  };
  database: {
    url: string;
    anonKey: string;
    serviceRoleKey?: string;
  };
  services: {
    airtable: {
      apiKey: string;
      baseTemplate: string;
    };
    stripe: {
      secretKey: string;
      publishableKey: string;
      webhookSecret: string;
    };
  };
  features: {
    analytics: boolean;
    payments: boolean;
    videoMeetings: boolean;
  };
}

export const config: EnvironmentConfig = {
  app: {
    env: process.env.APP_ENV || "dev",
    url: process.env.APP_URL || "http://localhost:3000",
    debug: process.env.NODE_ENV === "development",
  },
  database: {
    url: process.env.SUPABASE_URL!,
    anonKey: process.env.SUPABASE_ANON_KEY!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  services: {
    airtable: {
      apiKey: process.env.AIRTABLE_API_KEY!,
      baseTemplate: process.env.AIRTABLE_BASE_TEMPLATE!,
    },
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY!,
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
    },
  },
  features: {
    analytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === "true",
    payments: process.env.NEXT_PUBLIC_ENABLE_PAYMENTS === "true",
    videoMeetings: false, // Phase 3 feature
  },
};

// Validation
function validateConfig(): void {
  const required = [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "AIRTABLE_API_KEY",
    "STRIPE_SECRET_KEY",
    "SESSION_SECRET",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
}

validateConfig();
```

### Feature Flags

```typescript
// config/features.ts
export const featureFlags = {
  // Phase 1 features
  trainerAuth: true,
  clientAuth: true,
  basicDashboard: true,

  // Phase 2 features
  multiTenant: process.env.APP_ENV === "prod",
  advancedAnalytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === "true",

  // Phase 3 features
  videoMeetings: false,
  mobileApp: false,

  // Development features
  debugMode: process.env.NODE_ENV === "development",
  mockPayments: process.env.APP_ENV !== "prod",
} as const;

export function isFeatureEnabled(feature: keyof typeof featureFlags): boolean {
  return featureFlags[feature];
}
```

## Security Best Practices

### Secret Rotation

```typescript
// lib/security/rotation.ts
interface SecretRotationSchedule {
  [key: string]: {
    lastRotated: Date;
    rotationInterval: number; // days
    owner: string;
    critical: boolean;
  };
}

const rotationSchedule: SecretRotationSchedule = {
  SESSION_SECRET: {
    lastRotated: new Date("2024-01-01"),
    rotationInterval: 90,
    owner: "dev-team",
    critical: true,
  },
  STRIPE_SECRET_KEY: {
    lastRotated: new Date("2024-01-01"),
    rotationInterval: 180,
    owner: "dev-team",
    critical: true,
  },
  AIRTABLE_API_KEY: {
    lastRotated: new Date("2024-01-01"),
    rotationInterval: 90,
    owner: "dev-team",
    critical: false,
  },
};

export function getSecretsNeedingRotation(): string[] {
  const now = new Date();

  return Object.entries(rotationSchedule)
    .filter(([_, config]) => {
      const daysSinceRotation = Math.floor(
        (now.getTime() - config.lastRotated.getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysSinceRotation >= config.rotationInterval;
    })
    .map(([secret]) => secret);
}
```

### Environment Variable Validation

```typescript
// lib/config/validation.ts
import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  APP_ENV: z.enum(["dev", "preview", "prod"]),
  APP_URL: z.string().url(),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  // Airtable
  AIRTABLE_API_KEY: z.string().regex(/^key[a-zA-Z0-9]{14}$/),
  AIRTABLE_BASE_TEMPLATE: z.string().regex(/^app[a-zA-Z0-9]{14}$/),

  // Stripe
  STRIPE_SECRET_KEY: z.string().regex(/^sk_(test_|live_)[a-zA-Z0-9]{24}$/),
  STRIPE_WEBHOOK_SECRET: z.string().regex(/^whsec_[a-zA-Z0-9]+$/),

  // Security
  SESSION_SECRET: z.string().min(32),
});

export function validateEnvironment(): void {
  try {
    environmentSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("\n");

      throw new Error(`Environment validation failed:\n${issues}`);
    }
    throw error;
  }
}
```

## Deployment Configuration

### Vercel Environment Variables

```bash
# Set environment variables via Vercel CLI
vercel env add SUPABASE_URL development preview production
vercel env add SUPABASE_ANON_KEY development preview production
vercel env add AIRTABLE_API_KEY development preview production

# Or via vercel.json
{
  "env": {
    "NODE_ENV": "production",
    "APP_ENV": "prod"
  },
  "build": {
    "env": {
      "SUPABASE_URL": "@supabase-url",
      "SUPABASE_ANON_KEY": "@supabase-anon-key"
    }
  }
}
```

### Environment-Specific Build Configuration

```typescript
// next.config.js
const nextConfig = {
  env: {
    APP_VERSION: process.env.npm_package_version,
    BUILD_TIME: new Date().toISOString(),
  },

  // Environment-specific settings
  ...(process.env.NODE_ENV === "production" && {
    output: "standalone",
    experimental: {
      optimizePackageImports: ["@heroui/react"],
    },
  }),

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // More security headers...
        ],
      },
    ];
  },
};

module.exports = nextConfig;
```

## Monitoring & Alerting

### Environment Health Checks

```typescript
// api/health/environment.ts
export async function GET() {
  const checks = {
    environment: process.env.APP_ENV,
    timestamp: new Date().toISOString(),
    services: {
      supabase: await checkSupabaseConnection(),
      airtable: await checkAirtableConnection(),
      stripe: await checkStripeConnection(),
    },
    features: featureFlags,
    secrets: {
      // Never expose actual secrets, just their presence
      sessionSecret: !!process.env.SESSION_SECRET,
      stripeKey: !!process.env.STRIPE_SECRET_KEY,
      airtableKey: !!process.env.AIRTABLE_API_KEY,
    },
  };

  const allServicesHealthy = Object.values(checks.services).every(Boolean);
  const allSecretsPresent = Object.values(checks.secrets).every(Boolean);

  return Response.json(checks, {
    status: allServicesHealthy && allSecretsPresent ? 200 : 500,
  });
}
```

### Secret Expiration Monitoring

```typescript
// lib/monitoring/secrets.ts
export async function monitorSecretHealth(): Promise<void> {
  const needsRotation = getSecretsNeedingRotation();

  if (needsRotation.length > 0) {
    // Send alert to team
    await sendAlert({
      type: "secret_rotation_needed",
      secrets: needsRotation,
      environment: process.env.APP_ENV,
    });
  }

  // Check for missing critical secrets
  const criticalSecrets = ["SESSION_SECRET", "STRIPE_SECRET_KEY"];
  const missingCritical = criticalSecrets.filter((key) => !process.env[key]);

  if (missingCritical.length > 0) {
    await sendAlert({
      type: "critical_secrets_missing",
      secrets: missingCritical,
      environment: process.env.APP_ENV,
      severity: "critical",
    });
  }
}
```

## Team Access & Responsibilities

### Access Levels

- **Developers**: Development environment variables
- **Tech Lead**: Preview environment variables
- **Admin**: Production environment variables

### Responsibilities

- **Development Team**: Maintain development configs, rotate development secrets
- **DevOps/Admin**: Manage production secrets, monitor rotation schedules
- **Security Team**: Audit secret usage, enforce rotation policies

### Emergency Procedures

1. **Compromised Secret**: Immediately rotate in all environments
2. **Service Outage**: Check environment variables first
3. **Deployment Issues**: Verify environment-specific configurations

## Migration & Updates

### Adding New Environment Variables

1. Update documentation first
2. Add to validation schema
3. Set in all environments (dev → preview → prod)
4. Update deployment scripts
5. Test in each environment

### Removing Environment Variables

1. Mark as deprecated with timeline
2. Update code to handle absence gracefully
3. Remove from environments in reverse order (prod → preview → dev)
4. Clean up validation and documentation

This environment strategy ensures secure, maintainable configuration management across all deployment environments while supporting the application's growth from Phase 1 through future phases.
