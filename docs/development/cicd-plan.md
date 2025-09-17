# CI/CD & Deployment Plan

This document outlines the continuous integration and deployment strategy for TopCoach.

## Overview

### Platforms

- **Git Repository**: GitHub
- **Deployment Platform**: Vercel
- **Database**: Supabase (hosted)
- **External Services**: Airtable, Stripe

### Environments

- **Development**: Local development (`localhost:3000`)
- **Preview**: Feature testing (`preview.topcoach.app`)
- **Production**: Live application (`app.topcoach.com`)

## Repository Structure

### Branch Strategy

```
main (production)
├── develop (preview environment)
├── feature/auth-implementation
├── feature/dashboard-ui
└── hotfix/security-patch
```

### Branch Policies

- **main**: Protected, requires PR review, all checks must pass
- **develop**: Semi-protected, automatic deployment to preview
- **feature/\***: Feature branches, create preview deployments
- **hotfix/\***: Critical fixes, can merge directly to main after review

## CI/CD Pipeline

### GitHub Actions Workflow

#### Pull Request Checks

```yaml
# .github/workflows/pr-checks.yml
name: PR Checks

on:
  pull_request:
    branches: [main, develop]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint:check

      - name: Check formatting
        run: npm run format:check

      - name: Type check
        run: npm run type-check

      - name: Run tests
        run: npm test

      - name: Build application
        run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.PREVIEW_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.PREVIEW_SUPABASE_ANON_KEY }}

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run security audit
        run: npm audit --audit-level high

      - name: Check for vulnerable dependencies
        uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npx audit-ci --high
```

#### Deployment Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main, develop]
  pull_request:
    types: [opened, synchronize]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: ${{ github.ref == 'refs/heads/main' && '--prod' || '' }}
```

## Environment Configuration

### Development Environment

- **Trigger**: Local development
- **Database**: Local Supabase or development project
- **Domain**: `localhost:3000`
- **Features**: All debugging enabled, test data

### Preview Environment

- **Trigger**: Push to `develop` branch or PR creation
- **Database**: Supabase preview project
- **Domain**: `preview.topcoach.app` or PR-specific URLs
- **Features**: Production-like but with test services

### Production Environment

- **Trigger**: Push to `main` branch
- **Database**: Supabase production project
- **Domain**: `app.topcoach.com`
- **Features**: Live services, monitoring enabled

## Vercel Configuration

### Project Settings

```json
{
  "name": "topcoach",
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm ci",
  "devCommand": "npm run dev"
}
```

### Environment Variables by Environment

#### Development

```bash
NODE_ENV=development
APP_ENV=dev
NEXT_PUBLIC_SUPABASE_URL=https://dev-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
AIRTABLE_API_KEY=keyDEVELOPMENTXXXXXX
STRIPE_SECRET_KEY=sk_test_XXXXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_XXXXXXXXXXXXXXXXXXXXXXXX
SESSION_SECRET=dev-session-secret-32-characters-min
```

#### Preview

```bash
NODE_ENV=production
APP_ENV=preview
NEXT_PUBLIC_SUPABASE_URL=https://preview-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
AIRTABLE_API_KEY=keyPREVIEWXXXXXXXXXX
STRIPE_SECRET_KEY=sk_test_XXXXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_XXXXXXXXXXXXXXXXXXXXXXXX
SESSION_SECRET=preview-session-secret-different-from-dev
```

#### Production

```bash
NODE_ENV=production
APP_ENV=prod
NEXT_PUBLIC_SUPABASE_URL=https://prod-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
AIRTABLE_API_KEY=keyPRODUCTIONXXXXXX
STRIPE_SECRET_KEY=sk_live_XXXXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_XXXXXXXXXXXXXXXXXXXXXXXX
SESSION_SECRET=production-session-secret-highly-secure
```

## Domain Configuration

### DNS Setup

```
# Production
app.topcoach.com → Vercel production deployment

# Preview
preview.topcoach.app → Vercel preview deployment

# Feature branches (automatic)
feature-auth-implementation-git-abc123.vercel.app
```

### SSL/TLS

- Automatic SSL certificates via Vercel
- HTTPS enforcement in production
- HSTS headers enabled

## Quality Gates

### Pre-commit Hooks (Husky)

```bash
# Runs automatically before commit
npm run lint:check
npm run format:check
npm run type-check
```

### Pre-push Hooks

```bash
# Runs automatically before push
npm run type-check
npm test
```

### PR Requirements

- [ ] All CI checks pass
- [ ] Code review approved
- [ ] No merge conflicts
- [ ] Branch is up to date with target

### Deployment Requirements

- [ ] All tests pass
- [ ] Security audit clean
- [ ] Build completes successfully
- [ ] Environment variables configured

## Monitoring & Alerting

### Deployment Monitoring

```typescript
// lib/monitoring/deployment.ts
export async function deploymentHealthCheck(): Promise<HealthStatus> {
  const checks = {
    database: await checkDatabaseConnection(),
    externalServices: await checkExternalServices(),
    authentication: await checkAuthenticationFlow(),
    payments: await checkPaymentIntegration(),
  };

  const isHealthy = Object.values(checks).every(
    (check) => check.status === "healthy"
  );

  return {
    status: isHealthy ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    checks,
  };
}
```

### Error Tracking

- **Development**: Console logging
- **Preview**: Basic error tracking
- **Production**: Full error tracking and alerting

### Performance Monitoring

```typescript
// lib/monitoring/performance.ts
export const performanceThresholds = {
  // Core Web Vitals
  LCP: 2500, // Largest Contentful Paint
  FID: 100, // First Input Delay
  CLS: 0.1, // Cumulative Layout Shift

  // Custom metrics
  apiResponseTime: 1000,
  databaseQueryTime: 500,
  pageLoadTime: 3000,
};
```

## Rollback Strategy

### Automatic Rollback Triggers

- Health check failures for > 5 minutes
- Error rate > 5% for > 2 minutes
- Critical security alerts

### Manual Rollback Process

1. **Immediate**: Revert to previous Vercel deployment
2. **Database**: Restore from backup if needed
3. **External Services**: Revert API configurations
4. **Monitoring**: Verify rollback success

### Rollback Commands

```bash
# Vercel CLI rollback
vercel rollback [deployment-url] --token=$VERCEL_TOKEN

# Or via Vercel dashboard
# 1. Go to project deployments
# 2. Find previous stable deployment
# 3. Click "Promote to Production"
```

## Deployment Checklist

### Pre-deployment

- [ ] All tests pass locally
- [ ] Code reviewed and approved
- [ ] Environment variables updated
- [ ] Database migrations ready (if any)
- [ ] External service configurations verified

### During Deployment

- [ ] Monitor deployment logs
- [ ] Verify health checks pass
- [ ] Test critical user flows
- [ ] Check performance metrics

### Post-deployment

- [ ] Verify all features working
- [ ] Monitor error rates
- [ ] Check external service integrations
- [ ] Update documentation if needed

## Security Considerations

### Secrets Management

- Never commit secrets to repository
- Use Vercel environment variables
- Rotate secrets regularly
- Audit secret access

### Build Security

```yaml
# Security scanning in CI
- name: Run security scan
  uses: securecodewarrior/github-action-add-sarif@v1
  with:
    sarif-file: "security-scan-results.sarif"
```

### Deployment Security

- HTTPS only in production
- Security headers configured
- CSP policies enforced
- Regular dependency updates

## Disaster Recovery

### Backup Strategy

- **Code**: Git repository (GitHub)
- **Database**: Supabase automatic backups
- **Configuration**: Environment variables documented
- **Assets**: CDN with backup storage

### Recovery Procedures

1. **Code Recovery**: Clone from GitHub, redeploy
2. **Database Recovery**: Restore from Supabase backup
3. **Configuration Recovery**: Restore environment variables
4. **Full Recovery**: Complete environment recreation

### Recovery Time Objectives

- **Code Issues**: 15 minutes (redeploy)
- **Database Issues**: 1 hour (restore from backup)
- **Infrastructure Issues**: 2 hours (full recreation)

## Phase 2 Considerations

### Multi-tenant Deployment

- Subdomain routing configuration
- Tenant-specific environment variables
- Database isolation strategies
- Performance monitoring per tenant

### Scaling Considerations

- Vercel Pro plan for higher limits
- Database connection pooling
- CDN optimization
- Caching strategies

### Advanced Monitoring

- APM integration (Datadog, New Relic)
- Custom business metrics
- User experience monitoring
- Cost optimization tracking

## Team Responsibilities

### Development Team

- Write and maintain tests
- Follow commit conventions
- Review pull requests
- Monitor deployment health

### DevOps/Admin

- Manage environment variables
- Configure deployment pipelines
- Monitor production systems
- Handle incident response

### Security Team

- Review security configurations
- Audit deployment processes
- Manage secret rotation
- Respond to security incidents

This CI/CD plan ensures reliable, secure, and efficient deployment processes while maintaining high code quality and system reliability.
