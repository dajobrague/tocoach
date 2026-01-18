# Railway Deployment Troubleshooting Guide

## Issue: Build Fails with Minimal Logs

### Symptoms

```
Initialization
(00:02)
Build › Build image
(00:03)
Failed to build an image. Please check the build logs for more details.
```

Logs only show:

```
scheduling build on Metal builder "builder-xxxxx"
```

### Common Causes & Solutions

## 1. Missing Environment Variables (Most Common)

Railway needs environment variables configured **BEFORE** the build starts, not after.

### ✅ Solution:

1. Go to your Railway project dashboard
2. Click on your service
3. Go to **Variables** tab
4. Add these **required** variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://ydqhndnvrkvycnkaghro.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
ENCRYPTION_KEY=your_32_char_encryption_key_here
JWT_SECRET=your_jwt_secret_here
NEXT_PUBLIC_APP_DOMAIN=${{RAILWAY_PUBLIC_DOMAIN}}
```

**Important:** Use `${{RAILWAY_PUBLIC_DOMAIN}}` for the domain - Railway will auto-populate this with your actual domain.

4. After adding variables, trigger a new deployment:
   - Click **Deploy** → **Redeploy**

---

## 2. Railway Service Configuration

### ✅ Solution:

Ensure your Railway service is properly configured:

1. **Build Settings:**

   - Builder: Dockerfile
   - Dockerfile Path: `Dockerfile`
   - Root Directory: `/` (default)

2. **Deploy Settings:**
   - Start Command: `node server.js` (should be auto-detected from railway.json)
   - Port: Railway auto-detects from Dockerfile (3000)

---

## 3. Git Repository Issues

### ✅ Solution:

Make sure your latest changes are pushed to GitHub:

```bash
git add .
git commit -m "fix: update Railway deployment config"
git push origin main
```

Railway only builds from committed code in your repository.

---

## 4. Docker Build Context Too Large

### Check Build Context Size:

```bash
docker build --no-cache -t test-build .
```

If this takes too long locally, Railway will timeout.

### ✅ Solution:

Verify `.dockerignore` excludes unnecessary files:

```
node_modules
.next
.git
*.log
```

---

## 5. Standalone Build Configuration

### Verify next.config.js:

The `output: 'standalone'` option must be present:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // ... other config
};
```

**This is already configured in your project ✅**

---

## Step-by-Step Deployment Checklist

### Before Deploying:

- [ ] All environment variables added to Railway
- [ ] Latest code committed and pushed to GitHub
- [ ] `output: 'standalone'` in next.config.js
- [ ] `.dockerignore` properly configured
- [ ] `railway.json` present in root directory

### Deploy Process:

1. **Push changes to GitHub:**

   ```bash
   git add .
   git commit -m "fix: Railway deployment configuration"
   git push origin main
   ```

2. **In Railway Dashboard:**

   - Navigate to your project
   - Click on the service
   - Go to **Deployments** tab
   - Click **Deploy** → **Redeploy**
   - Watch the build logs in real-time

3. **Verify Deployment:**
   - Check build logs for any errors
   - Once deployed, visit: `https://your-app.railway.app/api/health`
   - Should return: `{"status":"ok",...}`

---

## Testing Build Locally (Before Railway)

Test your Docker build locally to catch issues early:

```bash
# Build the image
docker build -t top-coach-test \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://ydqhndnvrkvycnkaghro.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key \
  --build-arg ENCRYPTION_KEY=your_key \
  --build-arg JWT_SECRET=your_secret \
  --build-arg NEXT_PUBLIC_APP_DOMAIN=localhost:3000 \
  .

# Run the container
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=https://ydqhndnvrkvycnkaghro.supabase.co \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key \
  -e ENCRYPTION_KEY=your_key \
  -e JWT_SECRET=your_secret \
  -e NEXT_PUBLIC_APP_DOMAIN=localhost:3000 \
  top-coach-test

# Test health endpoint
curl http://localhost:3000/api/health
```

If this works locally, it should work on Railway.

---

## Viewing Detailed Build Logs

1. **Railway Dashboard:**

   - Go to your service
   - Click on **Deployments** tab
   - Click on the failing deployment
   - View full build logs

2. **Railway CLI:**
   ```bash
   railway logs --deployment
   ```

---

## Common Error Messages

### "failed to solve with frontend dockerfile.v0"

- **Cause:** Dockerfile syntax error or missing files
- **Solution:** Review Dockerfile, ensure all COPY commands reference existing files

### "Build failed with exit code 137"

- **Cause:** Out of memory during build
- **Solution:** Railway's builder has memory limits. Optimize your build process or upgrade plan

### "Cannot find module 'next/dist/server/next-server'"

- **Cause:** Standalone build not properly configured
- **Solution:** Verify `output: 'standalone'` in next.config.js and rebuild

---

## Getting Help

If you're still stuck:

1. **Check Railway Status:** https://status.railway.app/
2. **Railway Discord:** https://discord.gg/railway
3. **Review full build logs** in Railway dashboard
4. **Test Docker build locally** first

---

## Quick Fix Checklist

Try these in order:

1. ✅ Add all environment variables in Railway dashboard
2. ✅ Commit and push latest changes to GitHub
3. ✅ Trigger manual redeploy in Railway
4. ✅ Check build logs for specific errors
5. ✅ Test Docker build locally if still failing
6. ✅ Verify next.config.js has `output: 'standalone'`
7. ✅ Check Railway service settings (Dockerfile path, etc.)

---

## Additional Resources

- [Railway Dockerfile Deployment](https://docs.railway.app/deploy/dockerfiles)
- [Next.js Standalone Output](https://nextjs.org/docs/advanced-features/output-file-tracing)
- [Railway Environment Variables](https://docs.railway.app/develop/variables)
