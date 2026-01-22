# Domain Not Loading - Troubleshooting

## Current Issue

`app.topcoach.io` shows "ERR_FAILED - This site can't be reached"

This means the domain is **not responding at all** - not a routing issue but a deployment/DNS issue.

## Quick Diagnostic

Run these commands to check:

```bash
# Check if domain resolves
nslookup app.topcoach.io

# Check if server responds
curl -I https://app.topcoach.io

# Check if it's deployed somewhere else
# (Railway or Vercel might give you a different URL)
```

## Possible Causes & Solutions

### 1. App Not Deployed Yet

**Check:** Is your app actually deployed to production?

**Solution:**

- Deploy to Railway: Follow `RAILWAY_DEPLOYMENT.md`
- Or deploy to Vercel: `vercel --prod`

### 2. Using Railway/Vercel Default Domain

**Check:** Railway/Vercel gives you a default domain like:

- Railway: `your-app.railway.app`
- Vercel: `your-app.vercel.app`

**Solution for GHL Testing:**
Use the default domain for now:

```
https://your-app.railway.app
https://your-app.vercel.app
```

### 3. Custom Domain Not Configured

**Check:** Is `app.topcoach.io` pointed to your deployment?

**For Railway:**

1. Go to Railway Dashboard
2. Settings → Domains
3. Add custom domain: `app.topcoach.io`
4. Update DNS records at your domain registrar

**For Vercel:**

1. Go to Vercel Dashboard → Project Settings
2. Domains → Add Domain
3. Add: `app.topcoach.io`
4. Update DNS records

### 4. DNS Not Propagated

**Check:** Did you just add the custom domain?

**Solution:** DNS can take 24-48 hours to propagate. Use the default Railway/Vercel domain meanwhile.

## Immediate Solution for GHL Testing

**Don't wait for `app.topcoach.io` to work!**

1. **Find your deployment URL:**

   - Check Railway Dashboard → Deployments → Domain
   - Or check Vercel Dashboard → Project → Domains

2. **Use that URL for GHL testing:**

   ```
   https://your-app.railway.app/iframe-diagnostic
   ```

   Or:

   ```
   https://your-app.vercel.app/iframe-diagnostic
   ```

3. **The URL format doesn't matter** - what matters is:
   - ✅ HTTPS enabled
   - ✅ Actually deployed and responding
   - ✅ Latest code deployed

## How to Find Your Current Deployment URL

### If Using Railway:

```bash
# Check Railway service
railway status

# Or check in Railway dashboard:
# https://railway.app/dashboard
# → Your project → Deployments
# Look for the domain shown there
```

### If Using Vercel:

```bash
# Check Vercel deployments
vercel ls

# Or check in Vercel dashboard:
# https://vercel.com/dashboard
# → Your project
# Look for the production URL
```

## Testing the Actual Deployment

Once you find your deployment URL, test it:

```bash
# Replace with your actual URL
curl -I https://your-actual-deployment-url.com

# Should return HTTP 200 or 307 (redirect)
# Should NOT return connection error
```

## For GHL Embedding

**Use whichever URL is actually working:**

1. ✅ `https://your-app.railway.app` (if Railway)
2. ✅ `https://your-app.vercel.app` (if Vercel)
3. ❌ `https://app.topcoach.io` (not working yet)

**The custom domain can be fixed later - test GHL embedding with the working URL first!**

## Next Steps

1. **Find your working deployment URL** (Railway/Vercel dashboard)
2. **Test it works:** `https://your-deployment-url.com`
3. **Use it for GHL testing:** `https://your-deployment-url.com/iframe-diagnostic`
4. **Fix custom domain later** (separate issue from GHL embedding)

## Checking Deployment Status

### Railway:

```bash
railway status
railway logs
```

### Vercel:

```bash
vercel
vercel logs
```

## If Still Not Deployed

Deploy now:

### Railway:

```bash
# Push to GitHub (if connected)
git push origin main

# Or deploy directly
railway up
```

### Vercel:

```bash
vercel --prod
```

---

**Bottom Line:**
Don't wait for `app.topcoach.io` to work! Use your Railway/Vercel default domain to test GHL embedding NOW. The custom domain is a separate DNS configuration issue.
