# Production Domain Setup - Slug-Based Routing

## Overview

The application has been updated to use **slug-based routing** instead of subdomain-based routing for production. The production domain is **`app.topcoach.io`**, and each trainer gets a unique slug that becomes part of the URL path.

## URL Structure

### Before (Development - Subdomain)

```
trainer1.localhost:3000
trainer2.localhost:3000
```

### After (Production - Slug-Based)

```
app.topcoach.io/trainer1
app.topcoach.io/trainer2
```

## Changes Made

### 1. Configuration (`config/app.ts`)

Created a centralized configuration file for domain management:

- **Production Domain**: `app.topcoach.io`
- **Development Domain**: `localhost:3000`
- Helper functions to get the current domain based on environment

### 2. Onboarding/Setup Wizard (`components/setup-wizard/domain-setup.tsx`)

- Updated UI to show slug selection instead of subdomain
- Changed input label from "Tu subdominio" to "Tu slug (nombre único)"
- Updated preview to show full URL: `app.topcoach.io/[slug]`
- Added visual preview card showing the final URL
- Updated validation messages and rules

### 3. API Routes

#### a. Check Domain/Slug (`app/api/setup/check-domain/route.ts`)

- Renamed validation from domain to slug format
- Updated validation pattern: `/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/`
- Changed database query from `host` to `slug` field
- Updated suggestions to generate slug-based alternatives

#### b. Save Domain/Slug (`app/api/setup/save-domain/route.ts`)

- Updated to save slug instead of full domain
- Changed database operations to use `slug` field
- Kept `host` field in sync with `slug` for backward compatibility

#### c. Save Configuration (`app/api/setup/save-configuration/route.ts`)

- Updated to handle slug-based configuration
- Changed all references from `normalizedDomain` to `normalizedSlug`
- Updated database queries to use `slug` field

#### d. Get Current Config (`app/api/setup/get-current-config/route.ts`)

- Updated to return slug instead of full domain
- Changed query to select `slug` field from tenants table

### 4. Middleware (`middleware.ts`)

- Updated `validateTenantSlug()` to query by `slug` field instead of `host`
- Slug validation now checks the correct database column

### 5. Registration (`app/api/auth/register/route.ts`)

- Changed temporary tenant generation from `email123.localhost` to `email123`
- Updated database inserts to use slug format
- Removed `.localhost` suffix from temporary tenant names

### 6. Helper Functions (`lib/auth/invitation.ts`)

- Updated `generateTenantHostSuggestions()` to return slugs instead of domains
- Updated `validateTenantHostFormat()` to validate slug format
- Removed `.localhost` suffix from suggestions

### 7. Live Preview (`components/setup-wizard/live-preview.tsx`)

- Updated browser address bar preview to show: `app.topcoach.io/[slug]`
- Integrated with `APP_CONFIG` for dynamic domain display

### 8. Setup Page (`app/trainer/dashboard/setup/page.tsx`)

- Changed variable names from `currentDomain` to `currentSlug`
- Updated default value from `temp-domain.localhost` to `temp-slug`

## Environment Variables

Add the following to your environment configuration:

```bash
# Production
NEXT_PUBLIC_APP_DOMAIN=app.topcoach.io
NODE_ENV=production

# Development
NEXT_PUBLIC_APP_DOMAIN=localhost:3000
NODE_ENV=development
```

## Database Schema

The system uses the following fields in the `tenants` table:

- **`slug`**: The unique identifier for the tenant (e.g., "trainer1")
- **`host`**: Currently kept in sync with slug for backward compatibility
- **`status`**: Must be "active" for the tenant to be accessible

## Migration Notes

### For Existing Tenants

If you have existing tenants with subdomain-style hosts (e.g., `trainer1.localhost`):

1. Extract the slug from the host:

   ```sql
   UPDATE tenants
   SET slug = SPLIT_PART(host, '.', 1)
   WHERE slug IS NULL OR slug = '';
   ```

2. Update the host to match the slug:
   ```sql
   UPDATE tenants
   SET host = slug
   WHERE host LIKE '%.localhost';
   ```

### For Existing Trainers

Update trainer records to use slug format:

```sql
UPDATE trainers
SET tenant_host = SPLIT_PART(tenant_host, '.', 1)
WHERE tenant_host LIKE '%.localhost';
```

## Testing

### Development

1. Start the development server: `npm run dev`
2. Access the trainer dashboard: `http://localhost:3000/trainer/dashboard`
3. Complete the onboarding wizard
4. Your URL will be: `http://localhost:3000/[your-slug]`

### Production

1. Deploy to production with `NEXT_PUBLIC_APP_DOMAIN=app.topcoach.io`
2. Complete the onboarding wizard
3. Your URL will be: `https://app.topcoach.io/[your-slug]`

## Slug Validation Rules

- **Characters**: Only lowercase letters (a-z), numbers (0-9), and hyphens (-)
- **Length**: Minimum 3 characters, maximum 30 characters
- **Format**: Must start and end with an alphanumeric character
- **Uniqueness**: Each slug must be unique across all tenants

## URL Examples

### Trainer Dashboard (Setup)

```
https://app.topcoach.io/trainer/dashboard
```

### Client Login

```
https://app.topcoach.io/john-fitness/login
```

### Client Dashboard

```
https://app.topcoach.io/john-fitness/dashboard
```

### Client Programs

```
https://app.topcoach.io/john-fitness/programs
```

## Important Notes

1. **DNS Configuration**: Ensure `app.topcoach.io` points to your production server
2. **SSL Certificate**: Make sure you have a valid SSL certificate for `app.topcoach.io`
3. **Middleware**: The middleware automatically validates slugs and redirects invalid ones to 404
4. **Caching**: Slug validation results are cached for 60 seconds to improve performance
5. **Backward Compatibility**: The `host` field is kept in sync with `slug` for now

## Next Steps

1. Update DNS records to point `app.topcoach.io` to your production server
2. Configure SSL certificate for the domain
3. Set environment variables in your production environment
4. Run database migrations to update existing tenant records
5. Test the onboarding flow in production
6. Monitor logs for any slug-related issues

## Support

If you encounter any issues with slug-based routing:

1. Check the middleware logs for slug validation errors
2. Verify the `slug` field is properly set in the `tenants` table
3. Ensure `NEXT_PUBLIC_APP_DOMAIN` is correctly configured
4. Check that the slug matches the validation pattern
