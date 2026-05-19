# PWA Tenant Icon Personalization — Design

**Date:** 2026-05-19
**Status:** Draft for review
**Author:** Brainstorming session

---

## Problem

When clients install the TopCoach PWA to their home screen, the icon they see is a Next.js placeholder (black background, white arrow). What they (and the trainers paying for the white-label experience) expect:

- **Client app installs** (`app.topcoach.io/[slug]/*`) → tenant's personalized logo on the home-screen icon.
- **Trainer app installs** (`app.topcoach.io/trainer/*`) → TopCoach brand icon.
- **Root marketing installs** (`app.topcoach.io/`) → TopCoach brand icon.

The wiring for per-audience manifests already exists, but every manifest currently points at the same static placeholder PNGs, and the iOS `apple-touch-icon` is hardcoded in `app/layout.tsx`. None of the existing code uses `tenants.logo_url`.

## Goals

1. Client PWA icons show the tenant's logo, centered on a clean background.
2. Trainer/root PWA icons show the TopCoach brand mark.
3. Works on both Android (manifest icons) and iOS (apple-touch-icon link).
4. Trainers updating their logo causes new installs to pick up the new icon automatically — no manual cache invalidation needed.
5. Falls back gracefully when a tenant has no logo or the logo fails to fetch — the install never breaks.

## Non-goals

- Updating already-installed PWA icons. iOS captures the icon at install time and never refreshes; Android refreshes opportunistically. Document the platform behavior and accept it.
- Per-page icon variation. One icon per audience tier.
- Trainer-side icon editor / preview UI. Trainers upload one logo via the existing setup wizard; this design consumes it.
- Dark-mode icon variants. The icon canvas uses the tenant's chosen surface color regardless of OS theme.
- Contrast detection / automatic recoloring of logos.

---

## Architecture

```
    ┌──────────────────────────────┐         ┌──────────────────────────────┐
    │  app/[slug]/manifest.json    │         │  app/layout.tsx <head>       │
    │  (icons array)               │         │  (apple-touch-icon link)     │
    └──────────────┬───────────────┘         └──────────────┬───────────────┘
                   │  references                            │
                   └─────────────────┬──────────────────────┘
                                     ▼
            ┌──────────────────────────────────────────────────┐
            │   GET /api/icons/[slug]/[size].png?v={hash}      │
            │   - Node runtime (sharp)                         │
            │   - public, CDN-cached forever (content-versioned URL) │
            └─────────────┬────────────────────────────────────┘
                          ▼
            ┌──────────────────────────────────┐
            │ 1. validate size (allowlist)     │
            │ 2. loadTenantContext(slug)       │
            │ 3. fetch logo_url bytes (timeout)│
            │ 4. read surface color from theme │
            │ 5. sharp(): canvas → composite   │
            │ 6. return PNG                    │
            │                                  │
            │  fallback at any failure:        │
            │  serve TopCoach default icon     │
            │  for the requested size          │
            └──────────────────────────────────┘
```

### Audience routing

| Audience       | URL pattern          | Manifest                             | Icon source                                     |
| -------------- | -------------------- | ------------------------------------ | ----------------------------------------------- |
| Trainer app    | `/trainer/*`         | `app/trainer/manifest.json/route.ts` | Static `/icons/icon-*.png` (TopCoach branded)   |
| Root marketing | `/` and `(public)/*` | `/public/manifest.json`              | Same static `/icons/icon-*.png`                 |
| Client app     | `/[slug]/*`          | `app/[slug]/manifest.json/route.ts`  | Dynamic `/api/icons/[slug]/{size}.png?v={hash}` |

The trainer/root paths are a content swap. The client path needs the dynamic endpoint.

---

## The dynamic endpoint

**Route:** `app/api/icons/[slug]/[size].png/route.ts`

**Runtime:** Node (`export const runtime = "nodejs"`) — `sharp` requires it.

**Path params:**

- `slug`: tenant slug, validated by `loadTenantContext`.
- `size`: must match `^(\d+)\.png$`. The number must be in the allowlist `{72, 96, 128, 144, 152, 180, 192, 384, 512}`. Any other value → 400.

**Query params:**

- `v`: cache-busting version string. Ignored by the handler but required in the manifest output so that logo/surface changes get a new URL.

**Algorithm:**

1. Validate `size` against the allowlist.
2. `tenant = await loadTenantContext(slug)` — if null, fall through to the TopCoach default icon for that size.
3. Resolve canvas color: `surface = tenant.theme_json?.colors?.surface?.1 ?? "#ffffff"`. Normalize to a hex `sharp` understands.
4. Resolve logo source: `logo_url = tenant.logo_url`. If empty → default icon fallback.
5. Fetch logo bytes:
   - `fetch(logo_url, { signal: AbortSignal.timeout(3000) })`
   - If status != 200 or fetch throws → default icon fallback. Log warning with correlation ID.
   - Cap downloaded bytes at 4MB (defensive — `tenants.logo_url` is constrained to ≤2MB by the upload route but we don't trust the URL).
6. Composite with `sharp`:
   - Create `sharp` canvas `{ create: { width: size, height: size, channels: 4, background: surface } }`.
   - Compute inner safe-zone box: `inner = Math.round(size * 0.7)`. (See "Why 70%" below.)
   - Resize the logo with `fit: "inside"`, `width: inner`, `height: inner` — letterboxes inside the safe zone, never crops.
   - Composite the resized logo centered on the canvas (`gravity: "center"`).
   - Output PNG with no metadata: `.png({ compressionLevel: 9 }).withMetadata(false)`.
7. Respond with the PNG buffer.

**Response headers:**

- `Content-Type: image/png`
- `Cache-Control: public, max-age=31536000, immutable` — safe because the URL is content-versioned. Old logos remain at old URLs until they fall out of cache; new logos get a new URL.
- `X-TopCoach-Icon-Source: dynamic | default` — debugging only.

**Default-icon fallback path:** Read the corresponding pre-baked `/public/icons/icon-{size}x{size}.png` from disk and stream it with the same headers but `Cache-Control: public, max-age=300` (short — defaults shouldn't burn into the CDN if they're masking an outage).

### Why 70% safe zone

Android maskable icons can be cropped into circles, squircles, rounded rects, or teardrops. The W3C spec defines an 80%-diameter safe zone (everything outside may be cropped). 70% gives a 5% margin on top of that, ensuring even the most aggressive launcher masks don't clip the logo. iOS doesn't mask, but the same padding makes the icon look correctly proportioned next to native iOS app icons (which use ~80% of their tile for content).

This lets us serve the same image as both `maskable` and `any` purposes in the manifest (`purpose: "maskable any"`).

### Library choice — `sharp`

Adds the `sharp` native dependency (~7MB compiled). Chosen over `next/og` `ImageResponse` because:

- We're compositing raster sources, not rendering JSX-to-image.
- `sharp`'s `fit: "inside"` and `composite` are exactly the primitives this needs.
- SVG rasterization via `sharp` is mature and predictable.
- Vercel Node functions support it natively (no special config).

---

## Cache invalidation — the version hash

The manifest needs to embed a stable, deterministic version string in each icon URL that changes when _any_ input to icon rendering changes.

**Inputs that affect the rendered image:**

- `tenant.logo_url` (logo content + the `?v=` already on it from the upload route)
- `tenant.theme_json.colors.surface.1` (background color)

**Algorithm:**

```
hashInputs = `${logo_url ?? "none"}|${surface_color ?? "none"}`
v = sha1(hashInputs).slice(0, 10)
```

The upload route already appends `?v=${Date.now()}` to `logo_url`, so any logo re-upload changes the string and thus the hash. Brand color changes flow in via `theme_json`. Either change → new hash → new manifest URLs → new CDN cache entries.

The hash is computed once per request when the manifest is served (it's a string hash, sub-millisecond). The endpoint handler ignores `v` entirely — it just exists to bust caches.

---

## Manifest changes

### `app/[slug]/manifest.json/route.ts`

Replace the hardcoded icons array with a generated one:

```ts
const SIZES = [72, 96, 128, 144, 152, 192, 384, 512] as const;

const surface = tenantContext?.theme_json?.colors?.surface?.["1"] ?? "#ffffff";
const logoUrl = tenantContext?.logo_url ?? "";
const v = sha1(`${logoUrl}|${surface}`).slice(0, 10);

const icons = SIZES.map((size) => ({
  src: `/api/icons/${slug}/${size}.png?v=${v}`,
  sizes: `${size}x${size}`,
  type: "image/png",
  purpose: "maskable any",
}));
```

Note: 180 is dropped from the manifest icons list (it's iOS-specific, used only as `apple-touch-icon` — Android ignores it).

The `theme_color` and `background_color` in the manifest itself should also pull from `theme_json` while we're here — they affect the splash screen and OS-level chrome. But that's adjacent; flag it in the implementation plan as a follow-up if scope creeps.

### `app/trainer/manifest.json/route.ts` and `/public/manifest.json`

No structural changes. They continue to point at `/icons/icon-*.png`. The contents of those files change (see "Static TopCoach icons" below).

---

## iOS apple-touch-icon — `app/layout.tsx`

This is the load-bearing piece for iOS clients. iOS Safari does **not** read the manifest's icons array when "Add to Home Screen" is invoked — it reads `<link rel="apple-touch-icon">` from the page's `<head>`.

`generateMetadata` currently hardcodes:

```ts
icons: { icon: "/favicon.ico", apple: "/icons/icon-180x180.png" }
```

Change to:

```ts
let appleIcon = "/icons/icon-180x180.png"; // TopCoach default

if (tenantSlug) {
  // tenantContext is already loaded above for pageTitle — reuse it
  const surface = tenantContext?.theme_json?.colors?.surface?.["1"] ?? "#ffffff";
  const logoUrl = tenantContext?.logo_url ?? "";
  if (logoUrl) {
    const v = sha1(`${logoUrl}|${surface}`).slice(0, 10);
    appleIcon = `/api/icons/${tenantSlug}/180.png?v=${v}`;
  }
}

return {
  ...
  icons: { icon: "/favicon.ico", apple: appleIcon },
  ...
};
```

`generateMetadata` already calls `loadTenantContext(tenantSlug)` for the page title — we reuse that result, no extra DB hit.

The trainer branch (`pathname.startsWith("/trainer")`) keeps the default `/icons/icon-180x180.png`.

A small helper, e.g. `lib/tenant/icon-url.ts`, centralizes the `(logoUrl, surface) → versionedUrl` logic so both the manifest route and the layout call the same function. Keeps the hash logic in one place.

---

## Static TopCoach icons

The user provided a 500×500 WebP TopCoach mark (black background, white double-arrow glyph). It needs to be:

1. Stored as the canonical source at `/public/brands/topcoach/mark.webp` (or similar).
2. Rasterized to PNG at all 9 sizes: 72, 96, 128, 144, 152, 180, 192, 384, 512.
3. Output committed to `/public/icons/icon-{size}x{size}.png`, replacing the current placeholders.

Done once via a script (`scripts/generate-topcoach-icons.mjs`) that runs locally / on demand — not on every build. The implementation plan covers this. The script uses the same `sharp` dependency.

Already-installed PWAs running off the old placeholder icon won't refresh until the user removes and re-adds — same platform limitation as tenant logo updates. No code workaround.

---

## Edge cases

| Case                                                   | Behavior                                                                                                                         |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Tenant doesn't exist (404 slug)                        | Default TopCoach icon, 5-min cache                                                                                               |
| Tenant exists, `logo_url` empty                        | Default TopCoach icon, 5-min cache                                                                                               |
| `logo_url` set but fetch fails / times out             | Default icon, 5-min cache, log warning with correlation ID                                                                       |
| `logo_url` returns non-image content / corrupted bytes | `sharp` throws → caught → default icon, 5-min cache, log error                                                                   |
| `size` not in allowlist                                | 400 Bad Request                                                                                                                  |
| Logo SVG with no viewBox                               | `sharp` rasterizes at the resize dimensions; fine                                                                                |
| Logo larger than 4MB downloaded                        | Abort + default icon (defensive — upload route caps at 2MB)                                                                      |
| Brand surface color is dark + logo has dark elements   | Out of scope; render as-is. Bad combinations look bad — that's a trainer responsibility                                          |
| Trainer changes logo after client installed PWA        | Client keeps the cached icon until they remove + re-add. Document this in trainer settings UI as a future task                   |
| Logo is non-square (e.g. wide wordmark)                | Letterboxed inside the 70% safe zone, never cropped. May look small — acceptable; trainers can re-upload a square mark if needed |

---

## Security considerations

- `slug` flows through `loadTenantContext`, which already normalizes and validates via the DB.
- `size` is allowlisted — no arbitrary integer reaches `sharp`.
- `logo_url` is fetched from an arbitrary URL stored in the DB. The upload route writes only Supabase Storage URLs, but to be safe the endpoint should:
  - Use a 3-second timeout.
  - Cap downloaded bytes at 4MB.
  - Not follow redirects across hosts (or limit to one redirect within the same host).
  - Not pass through error bodies — opaque "default icon" fallback only.
- No user-controlled content is rendered as HTML or text — `sharp` produces a raster image. Safe surface.
- The endpoint is public (no auth) — same as the manifest itself. PWA icons are public by definition.

---

## Performance characteristics

- **Cache miss cost:** ~50–150ms — fetch logo (~50ms warm), `sharp` resize + composite (~30–80ms at 512px), serialize PNG (~10ms).
- **Cache hit cost:** Zero — served from Vercel's CDN edge.
- **Expected miss rate:** Very low. Each tenant has 8 manifest icons × however-many unique installs the CDN regions see. After the first install per region per logo version, all subsequent installs hit cache. A logo update creates a new wave of misses (8 sizes × N CDN regions).
- **Concurrency on cold cache:** Multiple parallel installs of the same tenant after a logo change → multiple parallel regen requests. Acceptable; the work is small and stateless. No request coalescing needed.

---

## Testing strategy

- **Unit:** Hash function (deterministic, stable across runs), size allowlist validation, surface color normalization, default-icon fallback path.
- **Integration:** Hit `/api/icons/{slug}/192.png` for a tenant with a logo, with an empty `logo_url`, with a 404 logo URL — assert PNG output and correct Cache-Control header in each case.
- **Visual smoke:** Generate icons for 2–3 representative tenants (light logo on light bg, dark logo on dark bg, wide wordmark logo) and eyeball them. Adding a snapshot/golden-file test for visual regression is out of scope for v1.
- **Manual platform check:** Install on Android (Chrome) and iOS (Safari) at least once per audience tier before shipping. iOS apple-touch-icon picks the right URL? Android manifest icons render correctly? Maskable safe zone holds across launcher mask shapes?

---

## Files touched

**New:**

- `app/api/icons/[slug]/[size].png/route.ts` — the dynamic endpoint
- `lib/tenant/icon-url.ts` — version hash + URL builder helper
- `scripts/generate-topcoach-icons.mjs` — one-shot script for static TopCoach icons
- `public/brands/topcoach/mark.webp` — canonical source mark

**Modified:**

- `app/[slug]/manifest.json/route.ts` — emit dynamic icon URLs
- `app/layout.tsx` — dynamic `apple-touch-icon` per audience, reuse loaded tenant context
- `public/icons/icon-{72,96,128,144,152,180,192,384,512}.png` — replaced via script
- `package.json` — add `sharp` dependency

**Unchanged but reviewed:**

- `app/trainer/manifest.json/route.ts` — no change (already correctly points at static icons; will look correct once those icons are real)
- `/public/manifest.json` — no change (same reason)
- `middleware.ts` — `/api/*` is already in the excluded routes list, no changes needed
- `public/sw.js` — out of scope; we deliberately don't cache icon endpoints in the service worker (let HTTP caching handle it)

---

## Open questions deferred to follow-up

1. Should manifest `theme_color` / `background_color` also pull from `theme_json`? (Affects splash screen + status bar.) Adjacent improvement, not blocking.
2. Should trainer settings show a preview of "this is what your icon will look like"? Nice UX, separate feature.
3. Should we add a server-side luminance check that warns trainers if their logo will have poor contrast on their chosen surface color? Quality-of-life, separate feature.
4. Eventually: pre-bake all 8 sizes to Supabase Storage at upload time, eliminating the runtime cost entirely. Not needed at current scale; revisit if the endpoint shows up in performance budgets.

---

## Rollout

1. Merge static TopCoach icon replacement first (low risk — purely content swap, trainer/root paths look correct immediately).
2. Merge dynamic endpoint + manifest/layout changes (client paths now pick up tenant logos).
3. No feature flag — the change is purely additive (new endpoint + content swap of existing static files). Rollback = revert.

### Icon propagation to existing installs

| Install type                                       | Behavior on rollout                                                                                    | Timing                             |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| Brand-new install (any platform)                   | Sees new icon                                                                                          | Immediate                          |
| Existing Android Chrome install (WebAPK)           | Chrome's periodic manifest re-fetch detects new icon URLs and regenerates the home-screen shortcut     | Automatic, typically ~24h          |
| Existing desktop PWA install (Chrome/Edge)         | Same manifest refresh mechanism                                                                        | Automatic, ~1–2 days               |
| Existing iOS Safari install ("Add to Home Screen") | iOS captures the icon at install time and never re-fetches; no manifest field or API can force refresh | Stuck until user removes + re-adds |

Trainers will communicate the iOS limitation to their clients out-of-band. No in-app refresh banner ships in v1.
