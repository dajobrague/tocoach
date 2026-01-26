# 🚨 CRITICAL: Testing Instructions After Deployment

## ⚠️ MUST READ BEFORE TESTING

The session leakage bug has been fixed, but you MUST follow these steps EXACTLY or you will still see the wrong user issue!

## Why You Saw the Wrong User

The bug was caused by **Supabase sessions stored in your browser's localStorage**. When coachjoseca@gmail.com tried to log in, the system found YOUR old session (brachod@me.com) in localStorage and used it instead.

## 🧹 Step 1: Clean Your Browser (CRITICAL!)

**YOU MUST DO THIS BEFORE ANY TESTING:**

### Option A: Use Incognito/Private Window (RECOMMENDED)

1. Close ALL browser windows
2. Open a NEW Incognito/Private window
3. Go to your app URL
4. Test from there

### Option B: Clear Everything Manually

1. Open Chrome DevTools (F12)
2. Go to **Application** tab
3. On the left, click **Storage**
4. Click **"Clear site data"** button
5. Close and reopen the browser

### Option C: Clear Specific Data

```
Open Chrome DevTools (F12) → Application tab:

1. Local Storage → Click your domain → Click "Clear All" button
2. Session Storage → Click your domain → Click "Clear All" button
3. Cookies → Right-click your domain → "Clear"
4. Close DevTools and refresh page (Cmd+Shift+R / Ctrl+Shift+R)
```

## 🧪 Step 2: Test After Deployment

### Test 1: Clean First-Time Login (Critical)

**Setup:**

1. ✅ Deployment completed
2. ✅ Browser cleaned (see Step 1)
3. ✅ Delete trainer: coachjoseca@gmail.com from database
4. ✅ Recreate trainer: coachjoseca@gmail.com in admin panel

**Test Steps:**

1. Open INCOGNITO/PRIVATE browser window
2. Go to `/trainer/login`
3. Enter email: `coachjoseca@gmail.com`
4. Click "Continuar"
5. You should see: "¡Hola Jose Carlos de Francisco!"
6. Enter NEW password (e.g., "TestPassword123!")
7. Click "Configurar contraseña"

**Expected Result:**

- ✅ No errors
- ✅ Redirects to `/trainer/dashboard`
- ✅ Dashboard shows "Jose Carlos de Francisco" (NOT brachod@me.com)
- ✅ Check top-right corner - should show correct user name/email

**Check Browser Console:**
You should see logs like:

```
[TrainerLogin] First login detected for: coachjoseca@gmail.com
[TrainerLogin] Successfully authenticated user: coachjoseca@gmail.com ID: [uuid]
[TrainerLogin] Password updated successfully
[TrainerLogin] Supabase session cleared
[TrainerLogin] JWT session created, redirecting to dashboard
```

### Test 2: Verify No Cross-Contamination

**Setup:**

1. ✅ Test 1 passed
2. ✅ Open SECOND incognito window (don't close first)

**Test Steps:**

1. In SECOND window, go to `/trainer/login`
2. Login as different trainer (e.g., brachod@me.com)
3. Verify you see YOUR data (not Jose Carlos's data)

**Expected Result:**

- ✅ Each window shows correct user
- ✅ No cross-contamination

### Test 3: Logout and Re-login

**Test Steps:**

1. In first window (coachjoseca@gmail.com), logout
2. Login again with NEW password
3. Verify you see correct data

**Expected Result:**

- ✅ Login works with new password
- ✅ Correct user data displayed

## 🔍 If It STILL Shows Wrong User

### Diagnostic Steps:

**1. Verify Browser Was Actually Cleaned**

```javascript
// Open browser console (F12) and run:
console.log(localStorage);
console.log(sessionStorage);
// Should be empty or not contain Supabase data
```

**2. Check Network Tab**

- Open DevTools → Network tab
- Clear network log
- Try login again
- Check the `/api/auth/login` response
- It should return the CORRECT user's data

**3. Check Cookies**

```
DevTools → Application → Cookies → Your domain
Look for: "trainer-session" cookie
Click it and copy the value
Go to: https://jwt.io
Paste the token
Check the "trainer_id" and "email" fields - they should match the user you're logging in as
```

**4. Server Logs**
If you have access to server logs, check for:

```
[TrainerLogin] Authenticated user: [email]
[Session] Cookie set: ... userId: [uuid]
```

## 🚨 Emergency Rollback (If Needed)

If the fix doesn't work and you need to rollback:

```bash
# Rollback to previous commit
git revert HEAD
git push origin main

# Then immediately investigate why it didn't work
```

## ✅ Success Criteria

- ✅ Users can set password on first login
- ✅ Each user sees ONLY their own data
- ✅ No cross-user session contamination
- ✅ Logout/login works correctly
- ✅ Multiple users can use same browser (different sessions)

## 📋 Post-Testing Checklist

After all tests pass:

- [ ] Document any issues found
- [ ] Update team on fix status
- [ ] Monitor for any user-reported issues
- [ ] Schedule security audit for next week
- [ ] Review similar authentication flows in codebase

## 📞 Support

If you encounter issues:

1. Take screenshot of browser console
2. Export Network tab HAR file
3. Check `SECURITY_FIX_SESSION_LEAKAGE.md` for technical details
4. Contact development team immediately

---

**Remember: ALWAYS test in clean incognito window first!**
