# Iframe Embedding - Testing Checklist

## ✅ Implementation Complete

All code changes have been implemented to support iframe embedding in Go High Level.

## Local Testing (Do This Now)

### 1. Verify Test Page Loads

The test page should be open in your browser at:

```
http://localhost:3000/iframe-test.html
```

**Expected:** You should see a page with an iframe containing your app.

### 2. Check Browser Console

Open Developer Tools (F12) and check for errors:

**Good Signs ✅:**

- No "Refused to display" errors
- No "X-Frame-Options" errors
- No CSP violation errors

**Bad Signs ❌:**

- Any frame-related security errors
- Cookie warnings in console

### 3. Test Standalone Access

Open a new tab and go directly to:

```
http://localhost:3000
```

**Expected:** App should work exactly as before, no changes to functionality.

### 4. Test Authentication in Iframe

Back on the iframe test page:

1. If not logged in, try logging in through the iframe
2. Navigate between pages in the iframe
3. Verify session persists

**Expected:** Authentication should work seamlessly in the iframe.

### 5. Test Client Portal in Iframe

If you have a client slug set up (e.g., `testclient`), test the client portal:

```
http://localhost:3000/iframe-test.html
```

Then change the URL in the iframe controls to:

```
http://localhost:3000/your-client-slug
```

**Expected:** Client portal should load and authentication should work.

## Important Note About Localhost Testing

⚠️ **Cookie Limitations in Localhost:**

Some browsers may still block `sameSite: "none"` cookies in localhost because it's not using HTTPS. This is expected behavior.

**If authentication doesn't work in the iframe on localhost:**

- This is normal for development
- It WILL work in production with HTTPS
- You can test with a local HTTPS setup if needed (using ngrok or similar)

**The key test is:** Does the iframe load without security header errors? If yes, the implementation is correct.

## Production Testing Checklist

Once you deploy to production (with HTTPS):

### 1. Test Direct Access

✅ Navigate to your production URL directly
✅ Verify login works
✅ Verify all features work as before
✅ Check that sessions persist

### 2. Test Basic Iframe Embedding

Create a simple HTML file on any domain:

```html
<!DOCTYPE html>
<html>
  <body>
    <iframe
      src="https://your-production-url.com"
      width="100%"
      height="800px"
    ></iframe>
  </body>
</html>
```

✅ Verify iframe loads without errors
✅ Verify you can log in through the iframe
✅ Verify navigation works
✅ Verify sessions persist

### 3. Test in Go High Level

1. **Add Custom Menu Link:**

   - Log into Go High Level
   - Go to Settings → Custom Menu Links
   - Click "Add Custom Menu Link"
   - Name: "TopCoach" (or your preferred name)
   - Type: "Embedded Page (iFrame)"
   - URL: Your production URL
   - Icon: Choose an appropriate icon
   - Save

2. **Test Access:**

   - ✅ Click the custom menu link from GHL dashboard
   - ✅ Verify your app loads inside GHL
   - ✅ Verify login works
   - ✅ Navigate between different sections
   - ✅ Test trainer functionality
   - ✅ Test client portal (if applicable)

3. **Test Multiple Users:**
   - ✅ Have multiple trainers test from GHL
   - ✅ Verify each trainer sees their own data
   - ✅ Check that sessions don't interfere

### 4. Browser Compatibility Test

Test in multiple browsers:

- ✅ Chrome (desktop)
- ✅ Firefox (desktop)
- ✅ Safari (desktop)
- ✅ Edge (desktop)
- ✅ Mobile browsers (iOS Safari, Android Chrome)

## Verification Commands

### Check Security Headers in Production

```bash
curl -I https://your-production-url.com
```

**Look for:**

- ✅ `Content-Security-Policy: frame-ancestors *;`
- ✅ NO `X-Frame-Options` header (should be absent)

### Check Cookie Settings

In browser DevTools:

1. Go to Application → Cookies
2. Find `trainer-session` and `client-session` cookies
3. Verify properties:
   - ✅ `SameSite: None`
   - ✅ `Secure: true` (in production)
   - ✅ `HttpOnly: true`

## Troubleshooting Guide

### Problem: Iframe shows "Refused to display"

**Solution:**

- Check that `X-Frame-Options` is removed from headers
- Verify `Content-Security-Policy: frame-ancestors *;` is present
- Clear browser cache and try again

### Problem: Authentication doesn't work in iframe

**In Localhost:**

- Expected behavior - needs HTTPS
- Test in production instead

**In Production:**

- Verify cookies have `Secure: true`
- Check that site is using HTTPS
- Look for cookie errors in console
- Verify `sameSite: "none"` is set

### Problem: Works in some browsers but not others

**Solution:**

- Check browser's privacy/tracking settings
- Some browsers block all third-party cookies by default
- Advise users to allow cookies for your domain

### Problem: Session keeps expiring in iframe

**Possible Causes:**

- Browser blocking third-party cookies
- Cookie expiry too short
- CSRF issues

**Solution:**

- Check browser privacy settings
- Verify cookie `maxAge` is sufficient
- Look for cookie-related errors in console

## Success Criteria

Your implementation is successful when:

✅ App loads in iframe without security errors
✅ Direct access (standalone) works as before
✅ Authentication works in iframe (production)
✅ Sessions persist across page navigation
✅ All features work in both standalone and iframe modes
✅ Multiple browsers supported
✅ No console errors related to frames or cookies

## Optional Enhancements

After basic testing is complete, consider:

1. **CSRF Protection:**

   - Implement CSRF tokens using `lib/security/csrf.ts`
   - Add to API routes that modify data

2. **Restrict Domains:**

   - Update `frame-ancestors` to only allow specific domains
   - Prevents unauthorized embedding

3. **Analytics:**

   - Track iframe vs standalone usage
   - Monitor which domains are embedding your app

4. **User Experience:**
   - Detect iframe context and adjust UI if needed
   - Add messaging for unsupported browsers

## Files to Review

📄 **Implementation Files:**

- `next.config.js` - Security headers
- `lib/auth/session.ts` - Trainer cookies
- `lib/auth/client-session.ts` - Client cookies
- `middleware.ts` - Request handling

📄 **Documentation:**

- `IMPLEMENTATION_SUMMARY.md` - Overview
- `IFRAME_EMBEDDING.md` - Complete guide
- `TESTING_CHECKLIST.md` - This file

📄 **Utilities (Optional):**

- `lib/security/csrf.ts` - CSRF protection
- `public/iframe-test.html` - Test page

## Next Steps

1. ✅ **Complete local testing** (check items above)
2. ✅ **Deploy to production/staging**
3. ✅ **Test in production with HTTPS**
4. ✅ **Configure in Go High Level**
5. ✅ **Test with real users**
6. ⏹️ **Add CSRF protection** (optional)
7. ⏹️ **Monitor and optimize**

## Need Help?

Refer to:

- `IFRAME_EMBEDDING.md` for detailed documentation
- Browser DevTools console for error messages
- Network tab to inspect cookies and headers
- Go High Level documentation for their iframe requirements

---

**Status:** Ready for testing ✅
**Last Updated:** {{ current_date }}
