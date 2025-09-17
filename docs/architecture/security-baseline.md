# Security Baseline

This document defines the security policies, headers, and practices for TopCoach.

## Security Headers

### Content Security Policy (CSP)

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: https:;
  connect-src 'self' https://api.stripe.com https://*.supabase.co wss://*.supabase.co;
  frame-src https://js.stripe.com;
  media-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
```

**Rationale:**

- `'unsafe-inline'` for styles needed for HeroUI components
- `'unsafe-eval'` may be needed for Next.js in development
- Stripe domains for payment processing
- Supabase domains for authentication and database
- Will be refined as integrations are added

### Permissions Policy

```
Permissions-Policy:
  geolocation=(),
  microphone=(),
  camera=(),
  payment=(self),
  usb=(),
  magnetometer=(),
  accelerometer=(),
  gyroscope=(),
  autoplay=(),
  encrypted-media=(),
  picture-in-picture=()
```

**Notes:**

- Payment permission enabled for Stripe integration
- Camera/microphone disabled initially (may enable for video calls in Phase 3)
- Geolocation disabled (not needed for MVP)

### Other Security Headers

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-DNS-Prefetch-Control: off
```

### Implementation

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Security headers
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-DNS-Prefetch-Control", "off");

  // CSP header (simplified for readability)
  response.headers.set("Content-Security-Policy", CSP_HEADER);
  response.headers.set("Permissions-Policy", PERMISSIONS_POLICY);

  return response;
}
```

## Rate Limiting Policy

### Authentication Endpoints

#### Login POST `/api/auth/login`

- **Limit:** 5 attempts per 5 minutes per IP + email combination
- **Extended lockout:** 10 attempts per hour per IP
- **Response:** HTTP 429 with `Retry-After` header

#### Password Reset POST `/api/auth/reset-password`

- **Limit:** 3 attempts per 15 minutes per email
- **Daily limit:** 10 attempts per email per day
- **Response:** Always returns success (don't reveal if email exists)

#### Registration POST `/api/auth/register`

- **Limit:** 5 attempts per hour per IP
- **Daily limit:** 20 attempts per IP per day

### API Endpoints

#### General API Routes

- **Authenticated users:** 100 requests per minute per user
- **Guest users:** 20 requests per minute per IP

#### File Upload Endpoints

- **Limit:** 10 uploads per hour per user
- **Size limit:** 10MB per file, 50MB per hour per user

#### Search/Query Endpoints

- **Limit:** 30 requests per minute per user
- **Expensive queries:** 5 per minute per user

### Implementation Strategy

```typescript
// Rate limiting with Redis
interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  max: number; // Maximum requests per window
  keyGenerator: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
}

const loginRateLimit: RateLimitConfig = {
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5,
  keyGenerator: (req) => `login:${req.ip}:${req.body.email}`,
  skipSuccessfulRequests: true,
};
```

## Password Policy

### Requirements

- **Minimum length:** 10 characters
- **Character requirements:** Must contain letters and numbers
- **Recommended:** Include symbols and mixed case
- **Prohibited:** Common passwords, sequential characters, personal information

### Validation Rules

```typescript
interface PasswordValidation {
  minLength: 10;
  requireLetters: true;
  requireNumbers: true;
  requireSymbols: false; // Recommended but not required
  prohibitCommon: true;
  prohibitPersonalInfo: true;
}

function validatePassword(
  password: string,
  userInfo?: UserInfo
): ValidationResult {
  const errors: string[] = [];

  if (password.length < 10) {
    errors.push("Password must be at least 10 characters long");
  }

  if (!/[a-zA-Z]/.test(password)) {
    errors.push("Password must contain letters");
  }

  if (!/\d/.test(password)) {
    errors.push("Password must contain numbers");
  }

  // Check against common passwords list
  if (COMMON_PASSWORDS.includes(password.toLowerCase())) {
    errors.push("Password is too common");
  }

  // Check against personal information
  if (userInfo && containsPersonalInfo(password, userInfo)) {
    errors.push("Password cannot contain personal information");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
```

### Storage Requirements

- **Hashing algorithm:** Argon2id (preferred) or bcrypt
- **Cost factor:** High enough to take ~100ms on server hardware
- **Salt:** Unique per password, generated cryptographically
- **Storage:** Never store plaintext passwords

```typescript
import argon2 from "argon2";

async function hashPassword(password: string): Promise<string> {
  return await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16, // 64 MB
    timeCost: 3,
    parallelism: 1,
  });
}

async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch (error) {
    return false;
  }
}
```

### Account Lockout Policy

- **Failed attempts threshold:** 5 consecutive failures
- **Lockout duration:** 15 minutes for first lockout
- **Escalation:** Double lockout time for subsequent lockouts (max 24 hours)
- **Reset:** Successful login resets failure count

```typescript
interface AccountLockout {
  failedAttempts: number;
  lockedUntil?: Date;
  lastFailedAttempt?: Date;
}

function calculateLockoutDuration(failedAttempts: number): number {
  const baseMinutes = 15;
  const maxHours = 24;

  // Exponential backoff: 15min, 30min, 1hr, 2hr, 4hr, 8hr, 24hr
  const lockoutMinutes = Math.min(
    baseMinutes * Math.pow(2, Math.max(0, failedAttempts - 5)),
    maxHours * 60
  );

  return lockoutMinutes * 60 * 1000; // Convert to milliseconds
}
```

## Session Management

### Cookie Configuration

```typescript
const sessionCookieConfig = {
  name: "topcoach-session",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
  path: "/",
  domain: process.env.NODE_ENV === "production" ? ".topcoach.com" : undefined,
};
```

### Session Security

- **Session ID:** Cryptographically random, 128+ bits
- **Rotation:** New session ID on login/privilege escalation
- **Expiration:** Absolute timeout (7 days) and idle timeout (24 hours)
- **Invalidation:** Logout, password change, suspicious activity

## Data Protection

### PII Handling

- **Minimize collection:** Only collect necessary data
- **Encryption at rest:** Sensitive data encrypted in database
- **Encryption in transit:** TLS 1.3 for all communications
- **Access logging:** Log all access to sensitive data

### Database Security

- **Connection encryption:** Required for all database connections
- **Row Level Security (RLS):** Enabled for multi-tenant data
- **Principle of least privilege:** Each service has minimal required permissions
- **Audit logging:** All data modifications logged

### File Upload Security

```typescript
const fileUploadSecurity = {
  allowedTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  maxSize: 10 * 1024 * 1024, // 10MB
  scanForMalware: true,
  virusScanning: process.env.NODE_ENV === "production",
  storageLocation: "s3://topcoach-uploads-{environment}/",
  publicAccess: false,
};

function validateFileUpload(file: File): ValidationResult {
  if (!fileUploadSecurity.allowedTypes.includes(file.type)) {
    return { isValid: false, error: "File type not allowed" };
  }

  if (file.size > fileUploadSecurity.maxSize) {
    return { isValid: false, error: "File too large" };
  }

  // Additional security checks
  return { isValid: true };
}
```

## Environment-Specific Configurations

### Development

- Relaxed CSP for hot reloading
- Debug headers enabled
- Rate limiting disabled or very lenient
- Detailed error messages

### Preview/Staging

- Production-like security headers
- Moderate rate limiting
- Limited error details
- Test payment processors

### Production

- Strict security headers
- Full rate limiting
- Minimal error exposure
- Real payment processors
- Enhanced monitoring

## Incident Response

### Security Event Categories

1. **Authentication failures** - Monitor for brute force attacks
2. **Authorization bypasses** - Detect privilege escalation attempts
3. **Data access anomalies** - Unusual data access patterns
4. **Payment fraud** - Suspicious payment activities

### Automated Responses

- **Account lockout** for repeated failures
- **IP blocking** for suspicious patterns
- **Alert notifications** for critical events
- **Graceful degradation** for system overload

### Manual Response Procedures

1. **Immediate containment** - Block malicious IPs/accounts
2. **Impact assessment** - Determine scope of compromise
3. **Evidence preservation** - Maintain logs and audit trails
4. **Communication** - Notify stakeholders and users if needed
5. **Recovery** - Restore normal operations
6. **Post-incident review** - Improve security measures

## Compliance Considerations

### GDPR (if applicable)

- Right to data portability
- Right to erasure ("right to be forgotten")
- Data breach notification (72 hours)
- Privacy by design principles

### PCI DSS (for payment processing)

- Never store card data directly
- Use Stripe for PCI compliance
- Secure transmission of payment data
- Regular security assessments

### SOC 2 (future consideration)

- Security controls documentation
- Regular security audits
- Access control procedures
- Change management processes

## Security Testing

### Automated Testing

- SAST (Static Application Security Testing)
- Dependency vulnerability scanning
- Container security scanning
- Infrastructure security testing

### Manual Testing

- Penetration testing (quarterly)
- Security code reviews
- Authentication testing
- Authorization testing

### Monitoring

- Real-time security alerts
- Anomaly detection
- Log analysis and correlation
- Performance impact monitoring
