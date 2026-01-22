# Go High Level Embedding Troubleshooting Guide

## Current Status

✅ **Fixed in Latest Commit:**

- Removed X-Frame-Options header that was blocking embedding
- Removed CSP frame-ancestors directive (more reliable than wildcard for cross-browser support)
- Changed cookies to `sameSite: "none"` for cross-origin support

## Critical Issue: Why It Works Locally But Not in GHL

### The Problem

Your app loads in the local HTML test because both are on `localhost`. However, GHL is a **cross-origin** iframe embedding, which has stricter requirements:

1. **HTTPS is REQUIRED** - `sameSite: "none"` cookies only work over HTTPS
2. **Browser Privacy Settings** - Some browsers block all third-party cookies
3. **Production vs Development** - Localhost behavior is different from production

## Step-by-Step Diagnostic Process

### Step 1: Verify You're Testing in PRODUCTION

**⚠️ CRITICAL: You MUST test in production with HTTPS, not localhost**

```bash
# Your production URL should be:
https://your-domain.com
# NOT:
http://localhost:3000
```

**Why:** Browsers allow `sameSite: "none"` cookies ONLY over HTTPS in cross-origin contexts.

### Step 2: Use the Diagnostic Tool

1. Deploy to production
2. Open this URL in your browser directly:
   ```
   https://your-production-url.com/iframe-diagnostic
   ```
3. Note all the green checkmarks

4. Now add it to GHL and open the same URL in GHL iframe:

   ```
   GHL Settings → Custom Menu Links → Add iframe with:
   https://your-production-url.com/iframe-diagnostic
   ```

5. **Compare the results:** Look specifically at:
   - "Running in iframe?" should be ✅ Yes
   - "Protocol" should be `https:`
   - "Cookies Enabled" should be ✅ Yes (CRITICAL!)

### Step 3: Check Browser Console

When the iframe loads in GHL:

1. Right-click inside the GHL window
2. Select "Inspect" or "Inspect Element"
3. Go to Console tab
4. Look for errors mentioning:
   - "Refused to display"
   - "X-Frame-Options"
   - "Content-Security-Policy"
   - "Cookie" or "SameSite"
   - "Mixed Content"

**Common Errors and Solutions:**

| Error Message                                                                    | Cause                                  | Solution                              |
| -------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------- |
| "Refused to display in a frame because it set 'X-Frame-Options' to 'SAMEORIGIN'" | Old code still deployed                | Redeploy with latest changes          |
| "Cookie has been rejected because it is in a cross-site context"                 | Not using HTTPS or secure flag missing | Ensure production uses HTTPS          |
| "Mixed Content" warnings                                                         | Loading HTTP resources on HTTPS page   | Check all assets use HTTPS            |
| Blank page, no errors                                                            | CSP or other blocking                  | Check Network tab for failed requests |

### Step 4: Test Cookie Setting

Open browser DevTools in GHL iframe:

1. Go to Application tab → Cookies
2. Look for `trainer-session` and `client-session` cookies
3. Check properties:
   - ✅ `SameSite: None`
   - ✅ `Secure: true`
   - ✅ `HttpOnly: true`

**If cookies are missing:**

- Not HTTPS
- Browser blocking third-party cookies
- Cookie settings incorrect

### Step 5: Network Tab Analysis

1. Open DevTools → Network tab
2. Reload the iframe
3. Check:
   - Are requests being made?
   - What status codes? (200 = good, 4xx/5xx = error)
   - Check Response Headers for `Content-Security-Policy` and `X-Frame-Options`

## Common Issues & Solutions

### Issue 1: "It loads but I can't login"

**Cause:** Cookies are blocked

**Solution:**

1. Verify HTTPS is being used
2. Check browser privacy settings
3. Try different browser (Chrome, Firefox, Safari)
4. Check diagnostic page shows "Cookies Enabled: ✅ Yes"

### Issue 2: "Blank page in GHL"

**Possible Causes:**

- Headers still blocking (check console)
- JavaScript error (check console)
- CORS issue (check network tab)
- Mixed content (check console)

**Solution:**

1. Check browser console for errors
2. Verify production deployment completed
3. Clear browser cache
4. Try different GHL account/browser

### Issue 3: "Works in Chrome but not Firefox/Safari"

**Cause:** Different browsers have different privacy settings

**Solution:**

1. Safari: Check "Prevent cross-site tracking" is off
2. Firefox: Check "Enhanced Tracking Protection" is off
3. Advise users to adjust privacy settings
4. Consider alternative authentication methods

### Issue 4: "Headers are correct but still won't load"

**Possible Causes:**

- GHL-specific restrictions
- Your domain might be blocked by GHL
- Network/firewall issues

**Solution:**

1. Test embedding in other platforms (not just GHL)
2. Contact GHL support to check if your domain is blocked
3. Use diagnostic tool to gather information

## Testing Checklist

Before contacting support, verify:

- [ ] Testing in PRODUCTION (not localhost)
- [ ] Production URL uses HTTPS
- [ ] Deployed latest code changes
- [ ] Browser cache cleared
- [ ] Diagnostic page shows cookies enabled
- [ ] Browser console shows no errors
- [ ] Tested in multiple browsers
- [ ] Tested standalone (non-iframe) access works

## GHL-Specific Configuration

### Correct GHL Setup

1. **Location:** Settings → Custom Menu Links
2. **Click:** "Add Custom Menu Link"
3. **Configure:**

   - Name: "TopCoach" (or your choice)
   - Type: **"Embedded Page (iFrame)"** ← CRITICAL
   - URL: Your production HTTPS URL
   - Icon: Choose any icon
   - Position: Choose where to display

4. **Save** and click the link from GHL sidebar

### Alternative: Open in New Tab

If iframe embedding continues to fail, you can use GHL's "Open in New Tab" option as a workaround:

1. In Custom Menu Links, select "New Browser Tab" instead of "Embedded Page"
2. This bypasses all iframe restrictions
3. User experience: Opens your app in a new browser tab

## Production Deployment Requirements

### Environment Variables

Ensure these are set in production:

```bash
NODE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
JWT_SECRET=your-secret-key
```

### Verification After Deployment

```bash
# Check headers are correct
curl -I https://your-production-url.com

# Should see:
# - NO "X-Frame-Options" header
# - NO "Content-Security-Policy: frame-ancestors" directive (or it allows all)

# Should NOT see:
# - X-Frame-Options: SAMEORIGIN
# - X-Frame-Options: DENY
```

## Browser-Specific Issues

### Chrome

- Generally works best with `sameSite: "none"`
- May warn about third-party cookies being phased out

### Safari

- Strictest about third-party cookies
- May block even with correct settings
- Users need to disable "Prevent cross-site tracking"

### Firefox

- May have issues with CSP wildcards
- Our current solution (omitting directive) works better

### Edge

- Similar to Chrome
- Usually works well

## What to Send to Support

If you need help, provide:

1. **Screenshots** of:

   - GHL custom menu link configuration
   - Browser console errors
   - Diagnostic page results (both standalone and in iframe)
   - Network tab showing headers

2. **Information:**

   - Your production URL
   - Which browser/version
   - Whether standalone access works
   - Whether local HTML test works

3. **Test Results:**
   - Diagnostic page output when accessed directly
   - Diagnostic page output when in GHL iframe
   - Console errors from both contexts

## Next Steps

1. **Deploy to production** if you haven't already
2. **Access diagnostic page** at `/iframe-diagnostic`
3. **Test in GHL** using production HTTPS URL
4. **Review diagnostic results** and console errors
5. **Follow troubleshooting steps** based on specific errors

## Quick Wins to Try

- [ ] Ensure using HTTPS production URL (not localhost)
- [ ] Clear all browser cache and cookies
- [ ] Try in Chrome incognito mode
- [ ] Test with diagnostic tool first
- [ ] Check GHL iframe is using correct URL format
- [ ] Verify latest code is deployed
- [ ] Try accessing standalone first to verify app works

## Still Not Working?

If after all these steps it still doesn't work:

1. Check if https://iframetester.com can load your site in an iframe
2. Contact Go High Level support - they may have restrictions
3. Consider using "Open in New Tab" option as workaround
4. Verify your production environment is correctly configured

---

**Remember:** The #1 issue is testing in localhost instead of production with HTTPS!
