# Tenant Operations Guide

## Tenant Onboarding

### 1. Domain Setup
```bash
# Add domain in Vercel (production)
vercel domains add yourdomain.com

# For development, add to /etc/hosts
echo "127.0.0.1 ironfit.localhost" >> /etc/hosts
echo "127.0.0.1 zencoach.localhost" >> /etc/hosts
```

### 2. Create Brand Assets
```bash
# Create brand folder structure
mkdir -p public/brands/{tenant-slug}

# Add required assets
cp default-logo.svg public/brands/{tenant-slug}/logo.svg
cp default-theme.json public/brands/{tenant-slug}/theme.json

# Edit theme.json with tenant's colors/fonts
```

### 3. Insert Tenant Record
```sql
INSERT INTO tenants (
    host, 
    slug, 
    theme_slug, 
    airtable_base_id,
    features,
    status
) VALUES (
    'yourdomain.com',
    'tenant-slug',
    'theme-slug',
    'appXXXXXXXXXX',
    '{"premium": true}',
    'active'
);
```

### 4. Encrypt Airtable API Key (if needed)
```typescript
import { encryptSecret } from '@/lib/security/encryption';

const encryptedKey = await encryptSecret('your-airtable-api-key');

// Update tenant record
UPDATE tenants 
SET airtable_api_key_enc = 'encrypted-key-here'
WHERE host = 'yourdomain.com';
```

### 5. Smoke Test
```bash
# Test domain resolution
curl -H "Host: yourdomain.com" http://localhost:3000/

# Verify theme CSS loads
curl -H "Host: yourdomain.com" http://localhost:3000/brands/theme-slug/styles.css
```

## Tenant Maintenance

### Disable Tenant
```sql
UPDATE tenants SET status = 'inactive' WHERE host = 'yourdomain.com';
-- Effect: Next request will use default theme, no secrets accessible
```

### Update Theme
```sql
UPDATE tenants SET theme_slug = 'new-theme' WHERE host = 'yourdomain.com';
-- Effect: Within 60s cache TTL or immediate with cache clear
```

### Clear Cache (Development)
```typescript
import { clearTenantCache } from '@/lib/tenant/loader';

// Clear specific tenant
clearTenantCache('yourdomain.com');

// Clear all tenant cache
clearTenantCache();
```

### Rotate Encryption Key
```bash
# 1. Generate new key
openssl rand -base64 32

# 2. Update ENCRYPTION_KEY in environment
# 3. Re-encrypt all secrets with new key
# 4. Deploy with zero-downtime strategy
```

## Security Checklist

### ✅ Secrets Protection
- [ ] No decrypted secrets in HTML/props
- [ ] No secrets in client components
- [ ] No secrets in logs (use correlation IDs)
- [ ] Encryption key not in version control

### ✅ Host Validation
- [ ] Only whitelisted domains honored
- [ ] Host header sanitized and normalized
- [ ] Unknown hosts fallback safely
- [ ] Port stripping in production

### ✅ Fallback Behavior
- [ ] Unknown host → default theme
- [ ] Inactive tenant → default theme  
- [ ] Missing theme folder → default theme
- [ ] Decryption error → theme works, secrets blocked

## Monitoring

### Key Metrics
- Tenant resolution success rate
- Cache hit ratio
- Fallback frequency by reason
- Decryption error rate

### Log Correlation
All logs include correlation ID for request tracing:
```
[Layout] Using tenant theme: ironfit for host: ironfit.localhost { correlationId: 'req-1234567890-abc123' }
```

## Troubleshooting

### Theme Not Loading
1. Check tenant record exists and is active
2. Verify theme folder exists: `/public/brands/{theme_slug}/`
3. Check theme.json validation
4. Clear tenant cache if needed

### Secrets Not Working
1. Verify ENCRYPTION_KEY is set
2. Check airtable_api_key_enc is not null
3. Test decryption in server context only
4. Check correlation ID in logs

### Performance Issues
1. Monitor cache hit ratio
2. Check database query performance
3. Verify TTL settings appropriate
4. Consider CDN for static assets
