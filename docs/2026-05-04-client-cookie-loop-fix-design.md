# Client login loop — `SameSite=Lax` fix

**Date:** 2026-05-04
**Owner:** David Bracho
**Status:** Approved for implementation

## Problem

A reported subset of clients cannot log in to the client portal: they enter a valid password, get redirected to `/[slug]/dashboard`, and immediately bounce back to `/[slug]/login`. The frontend's anti-loop guard (10 s cooldown in `sessionStorage`) prevents an infinite reload, but the user experience is "no me deja entrar" — the form re-appears, retrying produces the same outcome.

### Root cause

The client session cookie is configured with `SameSite=None; Secure; HttpOnly` (`lib/auth/client-session.ts:19`). This combination puts the cookie in the "third-party cookie" category for browser policy purposes, even when the user is interacting with the site as first-party. As a result it is silently dropped in several real-world contexts that match how clients access the portal:

- Safari iOS / macOS with ITP active (default) — drops `SameSite=None` cookies for domains the browser hasn't classified as first-party through user interaction history.
- WhatsApp / Instagram / Facebook in-app webviews — block third-party cookies by default; this is the dominant access path because trainers share portal links via WhatsApp.
- Chrome with third-party cookies blocked (rollout in progress as part of Privacy Sandbox) — same outcome.

When the cookie is dropped, the next navigation to `/[slug]/dashboard` arrives at the middleware (`middleware.ts:200`) without a `client-session` cookie. The middleware only consults the cookie — it does not accept `Authorization: Bearer` headers because browsers do not send those on top-level navigations. The user is redirected to login, the login page detects the JWT in `localStorage`, calls `/api/auth/refresh-cookie`, the server re-issues the cookie, the browser drops it again, and the loop continues until the 10 s anti-loop guard halts it.

The Bearer fallback infrastructure (`lib/auth/client-token-storage.ts`, `/api/auth/refresh-cookie`) was built to mitigate this scenario but cannot fully close the gap because navigations cannot carry Authorization headers.

### Why `SameSite=Lax` resolves this

`SameSite=Lax` cookies are sent on top-level GET navigations regardless of the referring origin. Tapping a WhatsApp link opens the portal as a top-level navigation, which means the cookie ships in first-party context. ITP and the third-party-cookie deprecation in Chrome do not apply to first-party cookies. This is the standard remediation pattern documented by Mozilla, Google, and Apple for "users on Safari / in-app browsers cannot stay logged in."

The original justification for `SameSite=None` was iframe embedding (per the inline comment at `lib/auth/client-session.ts:19`). The product owner has confirmed that no trainer embeds the client portal in an iframe and that this use case will not be supported. With that constraint removed, `Lax` is strictly better.

## Goal

Eliminate the login loop for clients on Safari iOS / macOS, in-app webviews, and Chrome with third-party cookies blocked, with verifiable evidence that the bug is gone in production.

## Non-goals

- Iframe embedding support. If this becomes a requirement later, revisit (likely candidates: `Partitioned` attribute + first-party-only fallback). Out of scope now.
- Removing the Bearer / `localStorage` / `refresh-cookie` fallback. It stays as defense in depth for edge cases (private browsing, corporate antivirus stripping cookies, etc.). No change to that code.
- Changing the trainer or admin session cookies. Those use `SameSite=Lax` already and are unaffected.

## Design

Three changes — one to fix the bug, one to verify the fix in production, one to make the bug locally reproducible for the engineer who deploys it.

### 1. Cookie attribute change (the fix)

**File:** `lib/auth/client-session.ts`

In `COOKIE_OPTIONS` (line 13), change:

```ts
sameSite: isProduction ? ("none" as const) : ("lax" as const),
```

to:

```ts
sameSite: "lax" as const,
```

Update the inline comment to reflect the new rationale: `Lax` is sent on top-level navigations from external links (WhatsApp, email), and is unaffected by Safari ITP and Chrome third-party-cookie deprecation. Iframe embedding is no longer supported.

`Secure: true` in production stays. `HttpOnly: true` stays. `Path: "/"` stays. `Max-Age: 30 days` stays. The `domain` attribute stays unset (host-only cookie).

No other file needs to change for the fix itself — `setClientSessionCookie` is the single point where the cookie is issued, and `verifyClientSessionFromRequest` reads it by name regardless of attributes.

### 2. Loop-detection telemetry (the verification)

**File:** `middleware.ts`

Add a structured log line in the "no session" redirect branches (around lines 222 and 242) that emits a single keyed event when a client is bounced to login. The log line must include:

- `correlationId` (already in scope)
- `slug`
- `pathname`
- `event: "client_session_missing"`
- `userAgent` (from `request.headers.get("user-agent")`)

This is a passive log — no behavior change. The format must be greppable in Railway logs (single-line JSON, prefixed `[Middleware:CLIENT:LOOP]`).

A second log line goes in `app/api/auth/client-login/route.ts` after a successful login, with `event: "client_login_success"`, `clientId`, and `correlationId`. Both events together let us reconstruct the loop signature: same `clientId` (or same `userAgent` + IP) producing `client_login_success` followed by one or more `client_session_missing` within 30 seconds.

We do not need a separate metrics pipeline. The signal is observable by `grep`-ing 24 h of Railway logs with a small script (which we'll write as part of implementation, not productionize).

### 3. Local reproduction recipe (the pre-deploy verification)

**File:** `docs/2026-05-04-client-cookie-loop-fix-design.md` (this file) — appendix below.

A documented procedure the engineer follows to reproduce the bug against the current code, then re-runs against the fix to confirm it resolves. This is the certainty-without-affected-user mechanism. See _Verification_ below.

## Verification

The fix is considered "done" only after all of these pass:

1. **Local before/after with simulated third-party-cookie blocking.**
   - Open Chrome → DevTools → Settings (F1) → Privacy and security → enable "Block third-party cookies."
   - Visit current production URL, complete login. Confirm the loop is reproduced (form re-appears after ~10 s with "Verificando sesión...").
   - Apply fix locally (`npm run dev` against local DB or against staging Supabase).
   - Repeat the same steps with third-party-cookie blocking still on. Confirm login completes and the dashboard is reachable across reloads.
2. **Staging deploy + real-client test.**
   - Deploy fix to staging.
   - Either: ask the affected trainer to have one of his complaining clients log in to the staging URL.
   - Or: borrow / use an iPhone with Safari, share the staging link via WhatsApp, tap from WhatsApp, complete login, confirm dashboard loads.
3. **Production telemetry.**
   - Capture a 7-day baseline of `client_session_missing` events occurring within 30 s of `client_login_success` for the same `clientId` (or proxy: same `userAgent` within same minute).
   - Deploy fix.
   - 48 h after deploy, the same query should return ≈ 0. A small residual is acceptable (private-browsing edge cases hitting the existing Bearer fallback path); a count comparable to baseline means the fix did not work and we roll back.

The combination of (1) and (2) gives causal certainty before the deploy. (3) gives population-level certainty after.

## Risk and rollback

- **Risk profile:** very low. Single attribute change on a single cookie. The Bearer fallback infrastructure remains in place.
- **Regression surface:** `SameSite=Lax` cookies are not sent on cross-site POST/PUT/DELETE or in iframe contexts. The portal makes no cross-site writes (all API calls are same-site `fetch`s to `/api/...`), and iframe embedding is not supported. There is no path on which `Lax` fails where `None` succeeded.
- **Existing sessions:** users with currently-valid `SameSite=None` cookies retain them until natural expiry (max 30 days). They keep working — `Lax` and `None` cookies are both readable by the server, only the new attribute affects when the browser sends them. Re-login issues the new attribute.
- **Rollback:** revert the one-line change. No data migration. No client-side state to reset.

## Out of scope (explicitly)

- Adding `Partitioned` attribute (CHIPS).
- Adding Bearer-token support to middleware via query param or fragment.
- Removing the `localStorage` Bearer fallback or `refresh-cookie` endpoint.
- Refactoring protected pages to client-side-rendered shells.
- Trainer or admin session cookies.

If this fix does not resolve the production telemetry signal at the verification step, the next iteration would consider these. They are not pre-emptively warranted.

## Files touched

| File                                               | Change                                                          |
| -------------------------------------------------- | --------------------------------------------------------------- |
| `lib/auth/client-session.ts`                       | `sameSite` attribute and inline comment                         |
| `middleware.ts`                                    | Add `client_session_missing` log lines in two redirect branches |
| `app/api/auth/client-login/route.ts`               | Add `client_login_success` log line                             |
| `docs/2026-05-04-client-cookie-loop-fix-design.md` | This document                                                   |

## Appendix — Local reproduction recipe

### Reproduce the bug (current code)

1. Stop any local dev server.
2. Open Chrome (regular window, not incognito).
3. DevTools → Settings (F1) → Privacy and security → "Block third-party cookies": **ON**.
4. Visit `https://app.topcoach.io/<slug-of-any-active-tenant>/login`.
5. Complete login with valid credentials.
6. Observed: brief redirect to `/dashboard`, then bounce back to `/login`. After ~10 s, form re-appears with no error. Re-submitting password produces the same loop.
7. Confirm in DevTools → Application → Cookies → `app.topcoach.io`: the `client-session` cookie is **not present** despite the `Set-Cookie` header on the login response (visible in Network tab). This is the dropped-cookie evidence.

### Verify the fix (after change applied)

1. Apply the `sameSite: "lax"` change locally.
2. `npm run dev`.
3. Same Chrome with third-party-cookie blocking still on.
4. Repeat steps 4–6 above against `localhost:3000` (or whatever local URL).
5. Expected: login completes, dashboard renders, the cookie **is present** in Application → Cookies, with `SameSite: Lax`. Reloading `/dashboard` keeps the user logged in.

If the cookie does NOT appear after the fix, do not deploy. Re-investigate.
