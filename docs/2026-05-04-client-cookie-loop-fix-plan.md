# Client cookie loop fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch the `client-session` cookie from `SameSite=None` to `SameSite=Lax` so that new clients on Safari iOS / WhatsApp webview / Chrome with third-party cookies blocked can complete their first-time password setup without bouncing in the login loop.

**Architecture:** A single attribute change in `lib/auth/client-session.ts`. The Bearer/`localStorage`/`refresh-cookie` infrastructure stays in place as defense in depth. Add structured telemetry in middleware and login route to detect post-deploy whether the loop signature still occurs.

**Tech Stack:** Next.js 15 (App Router), Edge middleware, `jose` for JWT, Supabase auth tables. No test framework configured in the repo — verification is manual (DevTools simulation) plus production log telemetry.

**Spec:** `docs/2026-05-04-client-cookie-loop-fix-design.md`

---

## Pre-flight context (read before starting)

The bug:

- `lib/auth/client-session.ts:13-22` defines `COOKIE_OPTIONS` with `sameSite: isProduction ? "none" : "lax"`.
- Both `app/api/auth/client-login/route.ts` and `app/api/auth/setup-client-password/route.ts` issue cookies via `setClientSessionCookie`, which uses `COOKIE_OPTIONS`.
- `middleware.ts:200` reads the cookie via `verifyClientSessionFromRequest`. It does NOT consult `Authorization` headers (browsers don't send them on navigations).
- When the browser drops the `SameSite=None` cookie (Safari ITP, in-app webviews, Chrome third-party cookie deprecation), the user bounces login → dashboard → login. The 10-second `sessionStorage` cooldown in `components/client-login-form.tsx:25-44` halts the visible loop but the user cannot reach the dashboard.

The fix: change `sameSite` to `"lax"`. `Lax` cookies ride along on top-level GET navigations from any origin (including WhatsApp links), are first-party by definition, and are not subject to ITP or third-party cookie blocking.

The original `SameSite=None` was for iframe embedding (per the existing inline comment). Iframe embedding is not used in production and will not be supported (confirmed with product owner). No regression surface.

---

## Task 1: Apply the cookie attribute change

**Files:**

- Modify: `lib/auth/client-session.ts:13-22` (the `COOKIE_OPTIONS` constant and the comment above `sameSite`)

- [ ] **Step 1: Open the file and locate the constant**

Open `lib/auth/client-session.ts`. Confirm lines 13-22 currently look like:

```ts
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  // SameSite=None requires Secure flag — browsers silently reject the cookie
  // without it.  Use "lax" in development (localhost) and "none" in production
  // (needed for iframe embedding).
  sameSite: isProduction ? ("none" as const) : ("lax" as const),
  path: "/",
  maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
};
```

If they don't match, stop and re-read the spec — the codebase has changed since planning.

- [ ] **Step 2: Replace the comment block and the `sameSite` line**

Replace the three-line comment plus the `sameSite` line with:

```ts
  // Lax: sent on top-level GET navigations from any origin, including links
  // shared via WhatsApp, email, etc. Not affected by Safari ITP or Chrome's
  // third-party cookie deprecation because Lax cookies are first-party by
  // definition. Iframe embedding of the client portal is not supported; if
  // that requirement returns, revisit (likely Partitioned/CHIPS).
  sameSite: "lax" as const,
```

The `isProduction` variable is no longer used by this attribute, but it is still used by `secure: isProduction` two lines above — leave that unchanged. Do not remove the `isProduction` declaration at the top of the file.

- [ ] **Step 3: Verify nothing else in the file needs changes**

Search the file for any other reference to `sameSite` or `"none"`. There should be none. The cookie is set in exactly one place (`setClientSessionCookie`, which uses `COOKIE_OPTIONS`).

- [ ] **Step 4: Type-check**

Run: `npm run type-check`
Expected: no errors. If TypeScript complains about the literal type (`"lax" as const`), confirm that the syntax matches: `sameSite: "lax" as const,` — this preserves the literal type required by Next's cookie API.

- [ ] **Step 5: Lint**

Run: `npm run lint:check`
Expected: no errors related to this file. If the autofixer wants to reorder anything, run `npm run lint` to apply.

- [ ] **Step 6: Commit**

```bash
git add lib/auth/client-session.ts
git commit -m "fix(auth): use SameSite=Lax for client-session cookie

New clients accessing the portal via WhatsApp link in Safari/in-app webviews
were bouncing in the login loop because SameSite=None cookies are dropped
by ITP and third-party cookie blocking. Lax cookies are first-party by
definition and ride along on top-level navigations from any origin, so
they survive these contexts. Iframe embedding (the original reason for
None) is not supported."
```

---

## Task 2: Add loop-detection telemetry — middleware

**Files:**

- Modify: `middleware.ts:222-237` (the "no session at root" branch)
- Modify: `middleware.ts:242-256` (the "no session at protected route" branch)

- [ ] **Step 1: Locate the first redirect branch**

In `middleware.ts`, find the existing log line at lines 229-235:

```ts
console.log(
  `[Middleware:CLIENT] ${request.method} ${pathname} → /${slug}/login (guest)`,
  {
    slug,
    correlationId,
  }
);
```

- [ ] **Step 2: Add a structured loop-detection event before it**

Immediately before that `console.log`, add:

```ts
console.log(
  `[Middleware:CLIENT:LOOP] client_session_missing`,
  JSON.stringify({
    event: "client_session_missing",
    slug,
    pathname,
    correlationId,
    userAgent: request.headers.get("user-agent") || "unknown",
  })
);
```

Do NOT remove the existing `console.log` — keep it as a human-readable line. The new line is for grep-based aggregation.

- [ ] **Step 3: Locate the second redirect branch**

In `middleware.ts`, find the existing log around lines 247-253:

```ts
console.log(
  `[Middleware:CLIENT] ${request.method} ${pathname} → redirect to /${slug}/login (no session)`,
  {
    slug,
    correlationId,
  }
);
```

- [ ] **Step 4: Add the same structured event before it**

Immediately before that `console.log`, add:

```ts
console.log(
  `[Middleware:CLIENT:LOOP] client_session_missing`,
  JSON.stringify({
    event: "client_session_missing",
    slug,
    pathname,
    correlationId,
    userAgent: request.headers.get("user-agent") || "unknown",
  })
);
```

- [ ] **Step 5: Type-check + lint**

Run: `npm run type-check && npm run lint:check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add middleware.ts
git commit -m "chore(observability): log client_session_missing in middleware

Structured single-line JSON log emitted when the middleware redirects a
client to /login because the session cookie is absent. Enables
post-deploy verification that the SameSite=Lax fix eliminated the loop
signature in production logs."
```

---

## Task 3: Add loop-detection telemetry — login route

**Files:**

- Modify: `app/api/auth/client-login/route.ts:152-154` (just before the final `return finalResponse`)
- Modify: `app/api/auth/setup-client-password/route.ts:174-176` (just before the final `return finalResponse`)

- [ ] **Step 1: Open `app/api/auth/client-login/route.ts`**

Find the existing log around lines 152-154:

```ts
console.log(
  `[Client Login] Authenticated: ${client.email} for tenant: ${tenantSlug}`
);
```

- [ ] **Step 2: Add structured login-success event next to it**

Immediately after the existing `console.log` (still before `return finalResponse`), add:

```ts
console.log(
  `[Client Login:LOOP] client_login_success`,
  JSON.stringify({
    event: "client_login_success",
    clientId: String(client.id),
    tenantSlug,
    timestamp: Date.now(),
  })
);
```

- [ ] **Step 3: Open `app/api/auth/setup-client-password/route.ts`**

Find the existing log around lines 174-176:

```ts
console.log(
  `[Setup Password] Password set for client: ${client.email} in tenant: ${tenantSlug}`
);
```

- [ ] **Step 4: Add structured login-success event next to it**

Immediately after the existing `console.log`, add:

```ts
console.log(
  `[Client Login:LOOP] client_login_success`,
  JSON.stringify({
    event: "client_login_success",
    clientId: String(client.id),
    tenantSlug,
    timestamp: Date.now(),
    flow: "setup-password",
  })
);
```

The `flow: "setup-password"` field distinguishes registrations from regular logins in aggregation — registrations are the population most affected by the bug.

- [ ] **Step 5: Type-check + lint**

Run: `npm run type-check && npm run lint:check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/auth/client-login/route.ts app/api/auth/setup-client-password/route.ts
git commit -m "chore(observability): log client_login_success on login + setup-password

Structured event emitted on successful credential exchange. Together with
the [Middleware:CLIENT:LOOP] event, lets us reconstruct the loop signature
post-deploy: same userAgent/IP producing client_login_success followed
within ~30s by client_session_missing means the cookie was dropped on the
hop to /dashboard."
```

---

## Task 4: Local verification — reproduce the bug, then verify the fix

This task does NOT change code. It is the gate before deploying. Do not skip.

**Tools needed:** Chrome desktop with DevTools, current production URL (or staging if you have it), and credentials for any active tenant + client.

- [ ] **Step 1: Reproduce the bug against current production**

1. Open Chrome (regular window, not incognito).
2. DevTools (F12) → click the gear icon at top-right of DevTools panel → "Privacy and security" → enable "Block third-party cookies".
3. Navigate to `https://app.topcoach.io/<active-slug>/login`.
4. Walk through email + password (use a test client whose password is set).
5. Watch the Network tab. After the `/api/auth/client-login` POST you should see `Set-Cookie: client-session=...; SameSite=None; Secure; ...`.
6. After the navigation to `/dashboard`, the redirect bounces back to `/login` and the form re-renders after the "Verificando sesión..." spinner.
7. In DevTools → Application → Cookies → `app.topcoach.io`: confirm the `client-session` cookie is **absent** despite having been set in the response.

If you cannot reproduce the bug here, third-party cookie blocking might not be replicating ITP closely enough on this Chrome version. Try Safari macOS with "Prevent cross-site tracking" enabled instead. If still no reproduction, document what you observed and stop — deploying without reproducing is acceptable but the certainty drops.

- [ ] **Step 2: Stop dev / build the local app with the fix applied**

Confirm the changes from Tasks 1–3 are committed locally. Start dev: `npm run dev`. The dev server runs on `http://localhost:3000`.

- [ ] **Step 3: Verify the fix locally**

Note: `secure: isProduction` means the cookie will NOT have `Secure` on `http://localhost`. That is expected behavior in dev and not a concern — `SameSite=Lax` does not require `Secure`. The relevant assertion is the SameSite attribute.

1. In Chrome DevTools, keep "Block third-party cookies" enabled.
2. You will need a local tenant + client. If you don't have a local DB seeded, point your local app at the staging Supabase via env vars temporarily, OR use the existing reproduction steps against staging once Task 5 is done. If neither is convenient, skip this local step and rely on Task 5's staging verification.
3. Walk through the login flow on `localhost:3000`.
4. After the `/api/auth/client-login` POST, the `Set-Cookie` header now reads `SameSite=Lax`.
5. After navigation to `/dashboard`, the dashboard renders. Reload `/dashboard` — still logged in.
6. Application → Cookies: `client-session` is **present** with `SameSite: Lax`.

- [ ] **Step 4: Document the local result**

In a quick note (your terminal, a scratch file, or comment on the PR when you open it), record:

- "Bug reproduced on prod with third-party cookie blocking: yes/no"
- "Fix verified locally: yes/no"
- "Cookie attribute observed in DevTools: Lax / other"

This is your local certainty record before deploy.

---

## Task 5: Deploy to staging and verify

- [ ] **Step 1: Push the branch**

```bash
git push -u origin <branch-name>
```

- [ ] **Step 2: Open a PR with description**

Use the `gh` CLI:

```bash
gh pr create --title "fix(auth): SameSite=Lax for client-session cookie" --body "$(cat <<'EOF'
## Summary
- Switch the client-session cookie from SameSite=None to SameSite=Lax to fix the registration/login loop reported by clients accessing the portal via WhatsApp on Safari iOS and in-app webviews.
- Add structured logging in middleware + login routes so we can verify post-deploy that the loop signature is gone.

## Why
SameSite=None cookies are dropped by Safari ITP and Chrome's third-party cookie deprecation, especially on first visits where no user interaction history is established. The reporter (Pablo Carboneras) observes that the bug only affects new client registrations, and that incognito mode (fresh ITP state) works around it — both consistent with this root cause. Lax cookies are first-party and ship on top-level navigations regardless of origin, so they survive these contexts. Iframe embedding (the original reason for None) is not used.

## Risk
Single attribute change. Bearer/localStorage/refresh-cookie fallback stays in place. No path where Lax fails that None succeeded — the portal makes no cross-site writes and does not embed in iframes.

## Verification plan
- [x] Bug reproduced locally (Chrome with third-party cookie blocking)
- [x] Fix verified locally (cookie persists, dashboard reachable)
- [ ] Staging deploy — login + setup-password flow with third-party cookie blocking
- [ ] Production telemetry — `[Middleware:CLIENT:LOOP] client_session_missing` event count drops to ≈ 0 within 48h of deploy

Spec: `docs/2026-05-04-client-cookie-loop-fix-design.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Adjust the verification checkboxes to reflect what you actually completed in Task 4.

- [ ] **Step 3: Wait for staging deploy**

If staging auto-deploys from the PR branch, wait. Otherwise, follow the team's deploy procedure.

- [ ] **Step 4: Repeat the reproduction-then-verify cycle on staging**

Same Chrome with third-party cookie blocking, but pointing at the staging URL. The flow should complete cleanly. If it does not, revert the merge — the fix did not work, and the next iteration is to investigate the alternative hypothesis (service worker stale bundle, browser extension interference) raised in `docs/2026-05-04-client-cookie-loop-fix-design.md`.

---

## Task 6: Production deploy and 48-hour telemetry watch

- [ ] **Step 1: Merge the PR to main**

After staging verification, merge.

- [ ] **Step 2: Capture pre-deploy baseline (optional but recommended)**

Before the production deploy lands, grab 24h of Railway logs:

```bash
# Adjust to your team's log access tooling
railway logs --service <web> --since 24h | grep "Middleware:CLIENT" | wc -l
```

This is the rough order-of-magnitude baseline of "client redirected to login due to no session" events. After the fix this should drop sharply. (Until you can use the new `[Middleware:CLIENT:LOOP]` log specifically — the older `[Middleware:CLIENT]` log will give you a noisier proxy for the baseline.)

- [ ] **Step 3: Watch the loop-signature query for 48 hours**

After the deploy completes, run:

```bash
railway logs --service <web> --since 48h | grep "Middleware:CLIENT:LOOP" | wc -l
```

Expectation: count is far below the baseline from Step 2. A small residual is acceptable (private-browsing edge cases that fall through to the Bearer fallback). A count comparable to baseline means the fix did not work — open an incident, revert, and re-investigate.

- [ ] **Step 4: Declare done**

Once the 48-hour window passes with the loop signature near zero, the fix is verified. Update the PR description / Linear ticket / wherever the issue is tracked. Notify Pablo Carboneras that he can ask his three affected clients to retry the registration flow normally (no incognito needed).

---

## Rollback plan

If the staging or production verification step fails:

1. Revert the merge commit on `main`:
   ```bash
   git revert <merge-sha>
   git push origin main
   ```
2. The system returns to its current state. Bearer/localStorage fallback continues to operate as before.
3. Re-investigate from the spec's "Out of scope" section — the next likely candidates are service worker stale bundle (force-update via `next.config.js` cache headers), or the `Partitioned` attribute (CHIPS) for browsers that need both Lax behavior and explicit third-party isolation.

No data migration is involved. No client-side reset is required.
