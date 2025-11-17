# Vercel Deployment Guide

This guide walks you through deploying TopCoach to Vercel production.

## Prerequisites

- Vercel CLI installed: `npm i -g vercel`
- Supabase project configured
- Access to environment variables from `.env.local`

## Required Environment Variables

Set these in Vercel for production:

### Application Domain
```
NEXT_PUBLIC_APP_DOMAIN
```
Set to your Vercel-assigned domain (e.g., `topcoach-xyz.vercel.app`)
**Note: Set this AFTER first deployment when you know your Vercel domain**

### Supabase Configuration
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### Security & Encryption
```
ENCRYPTION_KEY=your-32-character-encryption-key-here
JWT_SECRET=your-jwt-secret-key-here
```

### Optional (for later)
```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```
⚠️ Warning: Service role key bypasses Row Level Security. Use sparingly.

## Deployment Steps

### Step 1: Initial Deployment
```bash
vercel --prod
```

This will:
- Build your application
- Deploy to Vercel production
- Assign you a domain (e.g., `topcoach-xyz.vercel.app`)

**Important:** Note the domain that Vercel assigns you!

### Step 2: Configure Environment Variables

Option A: Using Vercel CLI
```bash
# Set main domain (use the domain from Step 1)
vercel env add NEXT_PUBLIC_APP_DOMAIN production
# Enter: topcoach-xyz.vercel.app (or whatever Vercel assigned)

# Set Supabase URL
vercel env add NEXT_PUBLIC_SUPABASE_URL production
# Enter your Supabase URL

# Set Supabase anon key
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# Enter your Supabase anon key

# Set encryption key
vercel env add ENCRYPTION_KEY production
# Enter your encryption key (32+ characters)

# Set JWT secret
vercel env add JWT_SECRET production
# Enter your JWT secret (32+ characters)
```

Option B: Using Vercel Dashboard
1. Go to https://vercel.com
2. Select your project
3. Go to Settings > Environment Variables
4. Add each variable for "Production" environment

### Step 3: Redeploy with Environment Variables
```bash
vercel --prod
```

This redeploys with all environment variables configured.

### Step 4: Verify Deployment
Visit your production URL:
- Main domain: `https://your-app.vercel.app`
- Test trainer routes: `/trainer/login`, `/trainer/register`

## Subdomain Support

The application automatically supports subdomains:
- Main domain: `your-app.vercel.app` (trainers)
- Client subdomains: `trainer-slug.your-app.vercel.app` (clients)

Vercel handles subdomain routing automatically.

## Custom Domain (Future)

To add a custom domain later:
1. Go to Vercel dashboard > Domains
2. Add your custom domain (e.g., `topcoach.app`)
3. Update `NEXT_PUBLIC_APP_DOMAIN` environment variable
4. Redeploy: `vercel --prod`

## Troubleshooting

### Build Fails
- Check that all environment variables are set
- Review build logs in Vercel dashboard

### Middleware Issues
- Verify `NEXT_PUBLIC_APP_DOMAIN` matches your Vercel domain exactly
- Check that domain doesn't include `https://` or trailing slash

### Database Connection Issues
- Verify Supabase URL and keys are correct
- Check that Supabase project is active
- Test connection from local environment first

## Quick Reference

Current environment variables in your `.env.local`:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- ENCRYPTION_KEY
- JWT_SECRET

Copy these values to Vercel production environment.

## Post-Deployment Tasks

- [ ] Apply database migrations (can be done later this week)
- [ ] Test trainer registration and login
- [ ] Test client authentication (if test data exists)
- [ ] Configure custom domain (optional)
- [ ] Set up monitoring and error tracking (optional)

