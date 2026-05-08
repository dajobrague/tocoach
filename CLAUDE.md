# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Next.js dev server with Turbopack
npm run build        # next build, then copy-standalone (see "Standalone build" below)
npm run start        # Start production build (next start, NOT the standalone server)
npm run lint         # ESLint with --fix
npm run lint:check   # ESLint without --fix (CI-style)
npm run format       # Prettier write
npm run format:check # Prettier check
npm run type-check   # tsc --noEmit (REQUIRED — see below)
```

Node `>=20.17.0` is required (see `.node-version` and `package.json#engines`). Husky + lint-staged run ESLint and Prettier on commit; commitlint enforces Conventional Commits.

**`build` does not type-check or lint.** `next.config.js` sets `typescript.ignoreBuildErrors: true` and `eslint.ignoreDuringBuilds: true` so deploys aren't blocked. Always run `npm run type-check` and `npm run lint:check` yourself before claiming work is done.

### Standalone build deploy

`build` runs `next build` then `copy-standalone`, which copies `.next/static` and `public/` into `.next/standalone/`. The Railway `Procfile` then runs `node .next/standalone/server.js`. If you change static assets or anything in `public/` and verify against the standalone output, you must rerun `build` (not just `next build`) — the copy step is what makes those files reachable.

## Architecture

TopCoach is a multi-tenant SaaS for fitness trainers. **One Next.js 15 app (App Router) serves three audiences**, distinguished by URL shape:

| Audience                 | URL pattern                 | Code location  | Cookie                                                                  |
| ------------------------ | --------------------------- | -------------- | ----------------------------------------------------------------------- |
| Trainers (tenant owners) | `app.topcoach.io/trainer/*` | `app/trainer/` | `trainer-session` (JWT, 7d, SameSite=Lax)                               |
| Platform admins          | `app.topcoach.io/admin/*`   | `app/admin/`   | `admin-session`                                                         |
| Clients (end users)      | `app.topcoach.io/[slug]/*`  | `app/[slug]/`  | `client-session` (JWT, 30d, SameSite=None in prod for iframe embedding) |

The first path segment of any request that isn't `trainer`/`admin`/`api`/`auth`/`brands`/etc. is treated as a **tenant slug**, validated by `middleware.ts` against the `tenants` table (60s in-memory cache). Adding a new top-level public route requires extending the excluded-routes list in `middleware.ts:54`.

Public marketing pages (`/about`, `/blog`, `/docs`, `/pricing`) live under the `app/(public)/` route group.

### Auth model — two parallel JWT systems

Trainers and clients have **separate JWT cookies** signed with the same `JWT_SECRET` but different cookie names, lifetimes, and SameSite settings. They are not interchangeable.

- `lib/auth/session.ts` — trainer (and admin) sessions, SameSite=Lax.
- `lib/auth/client-session.ts` — client sessions. SameSite=None in production because the client portal can be embedded in iframes; Safari ITP / third-party-cookie blocking means the same JWT is also accepted via `Authorization: Bearer` header as a fallback. Both transports carry the **same signed JWT** — when changing the payload shape, update both cookie and header verification paths.

The middleware enforces tenant scoping by comparing `session.tenant_slug` to the URL slug and redirects on mismatch (`middleware.ts:258`). Trainer auth is **not** enforced in middleware — trainer routes do their own checks via `getTrainerSession()`.

### Tenant resolution

- `lib/tenant/loader.ts` — server-only tenant metadata loader, 60s cache. **Never import from a client component.**
- `lib/tenant/api-protection.ts#withTenantProtection` — wrap API route handlers that need an active tenant. Returns 404 for unknown hosts, 503 for inactive tenants.
- `components/tenant-provider.tsx` — client-side `useTenant()` / `useTenantSlug()`. The provider receives a sanitized `ClientTenantInfo` (no secrets).

Historical note: the `host` parameter in `lib/tenant/loader.ts` is named for the legacy host-based architecture but actually receives **slug** values now (`loader.ts:50`).

### Data layer — 100% Supabase

Airtable was fully removed in October 2025 (see `docs/architecture/auth-adr-v2.md`). Both trainers and clients are rows in `auth.users` with profile rows in `trainer_profiles` / `client_profiles` and a `trainer_clients` join table. Tenant isolation is enforced by **RLS policies**, not application code — when adding a new table, add migrations under `supabase/migrations/` (numbered, sequential) and write RLS policies that filter on `tenant_host` / `tenant_slug`.

The middleware uses the anon key with a fresh `createClient` call (no session persistence). Server code should prefer the anon key + RLS over the service role key; the service role bypasses RLS and is only justified for true admin operations (e.g. trainer password reset).

### Service worker caching trap

`public/sw.js` controls bundle caching for the PWA. `next.config.js` forces `Cache-Control: no-store` on `/sw.js` and the registration uses `updateViaCache: "none"` (`components/service-worker-registration.tsx`). This is **load-bearing** — without it, browsers/CDNs pin clients to a stale service worker for up to 24h (the SW spec's hard cap) and they never see new deploys. Don't relax these headers.

### Cron sidecar

`cron-service/` is a separate Node process (deployed alongside the web app) that pings `PUT /api/forms/notifications/create` hourly + at 08:00 daily. The Next.js app exposes cron endpoints under `app/api/cron/*`; `GET /api/cron/cleanup-otps` requires the `CRON_SECRET` shared secret (Bearer / `x-cron-secret` header / `?secret=` query).

## Code organization

- `app/` — App Router routes. Three top-level audience trees (`trainer/`, `admin/`, `[slug]/`) plus `api/` and `(public)/`.
- `features/` — feature-scoped code (auth, billing, calendar, dashboard, exercises, meetings, sessions). Use barrel `index.ts` exports.
- `components/` — shared components, organized by audience (`trainer/`, `client-dashboard/`, `admin/`, `dashboard/`, `setup-wizard/`, `ui/`, `kibo-ui/`).
- `lib/` — server-side utilities: `auth/`, `tenant/`, `security/` (encryption, OTP, CSRF), `services/`, `clients/`, `validations/`.
- `config/` — `app.ts`, `site.ts`, `fonts.ts` (HeroUI / Tailwind theme entry points).
- `supabase/migrations/` — numbered SQL migrations (~80 files). Don't reorder.
- `docs/` — architecture (`auth-adr-v2.md`, `security-baseline.md`), development (`conventions.md`, `logging-and-errors.md`, `environment-strategy.md`).

Path aliases (`tsconfig.json`): `@/*`, `@/components/*`, `@/lib/*`, `@/features/*`, `@/types/*`, `@/config/*`, `@/styles/*`.

## TypeScript strictness

`tsconfig.json` enables the strict suite _plus_ `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. Array/record indexing returns `T | undefined`, and `{ x?: string }` is **not** assignable to `{ x?: string | undefined }`. Don't paper over these with `!` — narrow or default explicitly.

## Conventions worth knowing

- **Conventional Commits** required (`feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`, `revert`). Subject ≤100 chars, no terminal period, not sentence-case.
- **ESLint** enforces `import/order` with `newlines-between: always`, `react/jsx-sort-props` (callbacks last, shorthand first, reserved first), and `padding-line-between-statements` (blank line before `return`, blank line after a `const/let/var` block). The autofixer handles all of these — running `npm run lint` saves time.
- **HeroUI v2** + Tailwind v4 is the UI stack; many `@heroui/*` packages are pinned individually in `package.json`. Bumping one in isolation often breaks peer-dep alignment.
- **Logging**: `console.log` is allowed but warned. Production code logs include a `correlationId` for request tracing — when adding a new server boundary, generate and propagate one (`req-${Date.now()}-${Math.random().toString(36).slice(2)}` is the established pattern).

## Things to be careful with

- **`_investigate-*.mjs` / `_tmp_*.mjs`** at repo root are throwaway investigation scripts. Don't commit or import from them.
- **`supabase/migrations/`** has duplicate `002_*` filenames historically — don't be alarmed, but follow the numeric sequence when adding new ones.
- The `tenants` table query in `middleware.ts` filters on `status = 'active'`. Marking a tenant inactive will 404 every client URL on that slug — confirm with the user before flipping that flag.
