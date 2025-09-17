# Logging & Error Taxonomy

This document defines the logging standards and error classification system for TopCoach.

## Log Entry Structure

All log entries must follow this standardized structure:

```typescript
interface LogEntry {
  timestamp: string; // ISO 8601 format
  level: LogLevel; // debug | info | warn | error
  environment: string; // dev | preview | prod
  requestId?: string; // UUID for request correlation
  tenantHost?: string; // For multi-tenant context (Phase 2)
  userType?: UserType; // trainer | client | guest
  clientAlias?: string; // Public-safe client identifier
  message: string; // Human-readable message
  data?: Record<string, unknown>; // Additional structured data
}

type LogLevel = "debug" | "info" | "warn" | "error";
type UserType = "trainer" | "client" | "guest";
```

## Log Levels

### DEBUG

- Detailed diagnostic information
- Only enabled in development
- Used for troubleshooting specific issues

### INFO

- General operational messages
- Application lifecycle events
- Business logic milestones

### WARN

- Potentially harmful situations
- Deprecated feature usage
- Performance concerns

### ERROR

- Error conditions that don't stop the application
- Handled exceptions
- Failed operations with fallbacks

## PII Masking Rules

### Email Addresses

- Log first 3 characters + domain
- Example: `user@example.com` → `use***@example.com`

### Phone Numbers

- Log only country code and last 4 digits
- Example: `+1234567890` → `+1***7890`

### Client Data

- Never log full names
- Use client aliases only
- Hash sensitive identifiers

### Implementation

```typescript
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${local.substring(0, 3)}***@${domain}`;
}

function maskPhone(phone: string): string {
  return phone.replace(/(\+\d{1,3})\d*(\d{4})/, "$1***$2");
}
```

## Error Taxonomy

### AuthError

Authentication and authorization failures.

**Codes:**

- `INVALID_CREDENTIALS` - Wrong email/password
- `ACCOUNT_LOCKED` - Too many failed attempts
- `SESSION_EXPIRED` - Session timeout
- `INSUFFICIENT_PERMISSIONS` - Access denied

**Example:**

```typescript
throw new AuthError("Invalid login credentials", "INVALID_CREDENTIALS");
```

### ValidationError

Data validation failures.

**Properties:**

- `field` - The field that failed validation
- `value` - The invalid value (masked if sensitive)

**Example:**

```typescript
throw new ValidationError("Email format is invalid", "email");
```

### RateLimitError

Rate limiting violations.

**Properties:**

- `retryAfter` - Seconds until next attempt allowed
- `limit` - Current rate limit

**Example:**

```typescript
throw new RateLimitError("Rate limit exceeded", 60);
```

### NotFoundError

Resource not found errors.

**Use cases:**

- User not found
- Session not found
- Exercise not found

**Example:**

```typescript
throw new NotFoundError("Client not found");
```

### UpstreamError

External service failures.

**Services:**

- `airtable` - Airtable API failures
- `stripe` - Payment processing failures
- `redis` - Cache failures
- `supabase` - Database failures

**Example:**

```typescript
throw new UpstreamError("Failed to fetch client data", "airtable");
```

### DomainError

Business logic violations.

**Use cases:**

- Scheduling conflicts
- Invalid workout plans
- Capacity limits exceeded

**Example:**

```typescript
throw new DomainError("Session conflicts with existing booking");
```

## Request Correlation

### Request ID Generation

- Use UUID v4 for request IDs
- Generated at middleware level
- Propagated through entire request lifecycle

### Implementation

```typescript
import { v4 as uuidv4 } from "uuid";

// Middleware
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  req.id = uuidv4();
  res.setHeader("X-Request-ID", req.id);
  next();
}

// Logger usage
logger.info("Processing login request", {
  requestId: req.id,
  userType: "client",
  clientAlias: "client_abc123",
});
```

## Structured Logging Examples

### Successful Login

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "environment": "prod",
  "requestId": "123e4567-e89b-12d3-a456-426614174000",
  "userType": "client",
  "clientAlias": "client_abc123",
  "message": "User login successful",
  "data": {
    "loginMethod": "password",
    "sessionDuration": 604800
  }
}
```

### Failed Payment

```json
{
  "timestamp": "2024-01-15T10:35:00.000Z",
  "level": "error",
  "environment": "prod",
  "requestId": "456e7890-e89b-12d3-a456-426614174001",
  "userType": "client",
  "clientAlias": "client_def456",
  "message": "Payment processing failed",
  "data": {
    "errorCode": "card_declined",
    "amount": 9999,
    "currency": "usd",
    "paymentMethodId": "pm_***4242"
  }
}
```

### Rate Limit Exceeded

```json
{
  "timestamp": "2024-01-15T10:40:00.000Z",
  "level": "warn",
  "environment": "prod",
  "requestId": "789e0123-e89b-12d3-a456-426614174002",
  "message": "Rate limit exceeded for login attempts",
  "data": {
    "ipAddress": "192.168.1.***",
    "endpoint": "/api/auth/login",
    "attempts": 5,
    "windowSeconds": 300
  }
}
```

## Log Storage and Retention

### Development

- Console output with pretty formatting
- Local file rotation (optional)

### Production

- Structured JSON to stdout
- Ingested by log aggregation service
- Retention: 90 days for errors, 30 days for others

## Monitoring and Alerting

### Critical Errors

- Authentication system failures
- Payment processing errors
- Database connection failures

### Performance Monitoring

- Response times > 2 seconds
- High error rates (>5% in 5min window)
- Memory/CPU usage spikes

### Business Metrics

- Login success/failure rates
- Session booking completions
- Payment success rates

## Implementation Guidelines

1. **Always include request ID** in log entries
2. **Use appropriate log levels** - don't spam with debug in production
3. **Mask PII** before logging
4. **Include context** - user type, tenant, operation
5. **Log errors with stack traces** in development
6. **Use structured data** instead of string concatenation
7. **Log business events** for analytics and debugging

## Testing Logging

### Unit Tests

- Verify log entries are created
- Check PII masking works correctly
- Validate error taxonomy usage

### Integration Tests

- Test request ID propagation
- Verify log correlation across services
- Check log aggregation pipeline
