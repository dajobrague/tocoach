# PWA Tenant Icon Personalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace placeholder PWA icons with branded ones — TopCoach mark for trainer/root paths, dynamically composed tenant logo + surface color for client paths.

**Architecture:** A new Node-runtime route `app/api/icons/[slug]/[size].png/route.ts` uses `sharp` to composite the tenant's logo onto their chosen surface color, with a 70% safe-zone for maskable compatibility. The client `manifest.json` and `<link rel="apple-touch-icon">` reference content-versioned URLs (`?v={hash}`) so logo or background changes invalidate the CDN automatically. Trainer/root paths get a one-shot static-PNG regeneration from a provided WebP source.

**Tech Stack:** Next.js 15 App Router · Node runtime · `sharp` (new dep) · existing `loadTenantContext` for tenant lookup · existing `crypto.createHash` for the version hash · no test framework — verification is type-check + build + a dev-server smoke script + manual home-screen install.

**Reference:** Spec at `docs/superpowers/specs/2026-05-19-pwa-tenant-icons-design.md`.

---

## File Structure

**Create:**

- `lib/tenant/icon-url.ts` — Pure helper. Exports `iconVersion(logoUrl, surfaceColor)` and `tenantIconUrl(slug, size, version)`. One responsibility: turn tenant inputs into a deterministic, versioned URL string. Shared by both the manifest route and `app/layout.tsx`. Target <60 lines.
- `app/api/icons/[slug]/[size].png/route.ts` — The dynamic icon endpoint. Node runtime. Loads tenant, fetches logo, composites with `sharp`, falls back to the static default on any failure. Target <200 lines.
- `scripts/generate-topcoach-icons.mjs` — One-shot script: reads `public/brands/topcoach/mark.webp`, writes the 9 PNG sizes into `public/icons/`. Not run on build — invoked manually when the source mark changes. Target <80 lines.
- `public/brands/topcoach/mark.webp` — Canonical TopCoach mark source (the WebP the user provided, currently staged at `docs/superpowers/specs/topcoach-mark-source.webp`).
- `scripts/smoke-test-tenant-icons.mjs` — Dev-server smoke test: hits the endpoint for known fixtures and asserts PNG output. Used in Task 9 for verification.

**Modify:**

- `app/[slug]/manifest.json/route.ts` — Build the icons array from the helper, with `?v={hash}` per entry.
- `app/layout.tsx` — In `generateMetadata`, when a tenant slug is present, compute the dynamic apple-touch-icon URL using the same helper (reusing the already-loaded `tenantContext`).
- `public/icons/icon-72x72.png` — Replaced via the script.
- `public/icons/icon-96x96.png` — Replaced via the script.
- `public/icons/icon-128x128.png` — Replaced via the script.
- `public/icons/icon-144x144.png` — Replaced via the script.
- `public/icons/icon-152x152.png` — Replaced via the script.
- `public/icons/icon-180x180.png` — Replaced via the script.
- `public/icons/icon-192x192.png` — Replaced via the script.
- `public/icons/icon-384x384.png` — Replaced via the script.
- `public/icons/icon-512x512.png` — Replaced via the script.
- `package.json` — Add `sharp` to `dependencies`.

**Do not touch:**

- `app/trainer/manifest.json/route.ts` — Already correctly references `/icons/icon-*.png`; will look correct once those files are real.
- `/public/manifest.json` — Same.
- `middleware.ts` — `/api/*` is already excluded.
- `public/sw.js` — Out of scope. The icon endpoint is HTTP-cached, not SW-cached.

---

## Task 1: Add `sharp` dependency

**Files:**

- Modify: `package.json`

`sharp` is required by the icon endpoint (Task 6) and the static-icon script (Task 4). Add it first so subsequent tasks can `import sharp from "sharp"` without lint/type-check breaking.

- [ ] **Step 1: Install sharp**

Run: `npm install sharp`

Expected: `sharp` appears in `dependencies` of `package.json`, `package-lock.json` updates. The install builds the native binary for the local platform.

- [ ] **Step 2: Verify install**

Run: `node -e "console.log(require('sharp').versions.sharp)"`

Expected: A version string is printed (e.g. `0.33.x`). No errors.

- [ ] **Step 3: Type-check**

Run: `npm run type-check`

Expected: PASS (no new errors — `sharp` ships its own types).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add sharp for PWA icon composition"
```

---

## Task 2: Pure helper — `lib/tenant/icon-url.ts`

**Files:**

- Create: `lib/tenant/icon-url.ts`

A small, pure module that the manifest route and the layout share. Centralizes the version hash so the two callers can never drift.

- [ ] **Step 1: Write the helper**

```ts
// lib/tenant/icon-url.ts
import { createHash } from "crypto";

/**
 * The PNG sizes emitted in the per-tenant manifest icons array.
 * 180 is intentionally absent — it's iOS-only and is set via
 * <link rel="apple-touch-icon"> in app/layout.tsx, not the manifest.
 */
export const TENANT_MANIFEST_ICON_SIZES = [
  72, 96, 128, 144, 152, 192, 384, 512,
] as const;

export type TenantIconSize = (typeof TENANT_MANIFEST_ICON_SIZES)[number];

/**
 * Sizes the dynamic endpoint will serve. Includes 180 (iOS apple-touch-icon).
 * Used for path-param validation in the route handler.
 */
export const TENANT_ICON_SERVED_SIZES = [
  72, 96, 128, 144, 152, 180, 192, 384, 512,
] as const;

export type ServedIconSize = (typeof TENANT_ICON_SERVED_SIZES)[number];

export function isServedIconSize(n: number): n is ServedIconSize {
  return (TENANT_ICON_SERVED_SIZES as readonly number[]).includes(n);
}

/**
 * Deterministic version hash that changes when any input to icon
 * rendering changes. Embedded as ?v=... in icon URLs to drive
 * CDN cache invalidation when a trainer updates their logo or
 * surface color.
 */
export function iconVersion(
  logoUrl: string | null | undefined,
  surfaceColor: string | null | undefined
): string {
  const inputs = `${logoUrl ?? "none"}|${surfaceColor ?? "none"}`;

  return createHash("sha1").update(inputs).digest("hex").slice(0, 10);
}

export function tenantIconUrl(
  slug: string,
  size: ServedIconSize,
  version: string
): string {
  return `/api/icons/${slug}/${size}.png?v=${version}`;
}

/**
 * Extracts the canvas background color from a tenant's theme_json.
 * Falls back to white when absent or invalid.
 */
export function resolveSurfaceColor(
  themeJson: { colors?: { surface?: { 1?: string } } } | null | undefined
): string {
  const candidate = themeJson?.colors?.surface?.["1"];
  if (typeof candidate === "string" && /^#[0-9a-fA-F]{3,8}$/.test(candidate)) {
    return candidate;
  }

  return "#ffffff";
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`

Expected: PASS.

- [ ] **Step 3: Lint**

Run: `npm run lint`

Expected: PASS (autofix runs; no warnings introduced).

- [ ] **Step 4: Commit**

```bash
git add lib/tenant/icon-url.ts
git commit -m "feat(tenant): add icon-url helper for dynamic PWA icons"
```

---

## Task 3: Stage the TopCoach mark source

**Files:**

- Create: `public/brands/topcoach/mark.webp` (copied from `docs/superpowers/specs/topcoach-mark-source.webp`)

The user-provided WebP becomes the canonical brand mark. It lives under `public/brands/topcoach/` so the upcoming script reads it from a stable path.

- [ ] **Step 1: Create the topcoach brand directory**

Run: `mkdir -p public/brands/topcoach`

Expected: The directory exists.

- [ ] **Step 2: Copy the source mark**

Run: `cp docs/superpowers/specs/topcoach-mark-source.webp public/brands/topcoach/mark.webp`

Expected: `public/brands/topcoach/mark.webp` exists, identical to the source.

- [ ] **Step 3: Verify size and format**

Run: `file public/brands/topcoach/mark.webp`

Expected: Output mentions `Web/P image` (sharp can read it).

- [ ] **Step 4: Commit**

```bash
git add public/brands/topcoach/mark.webp
git commit -m "feat(brand): add canonical TopCoach mark source"
```

---

## Task 4: Static-icon generation script

**Files:**

- Create: `scripts/generate-topcoach-icons.mjs`

Reads `public/brands/topcoach/mark.webp`, writes the 9 PNG sizes into `public/icons/`. Run manually when the source changes. The script is verbose and self-contained so future engineers don't need to read this plan to use it.

- [ ] **Step 1: Write the script**

```js
// scripts/generate-topcoach-icons.mjs
//
// Regenerates the static TopCoach PNG icons from the canonical WebP mark.
// Run when public/brands/topcoach/mark.webp changes.
//
// Usage: node scripts/generate-topcoach-icons.mjs
//
// Output: public/icons/icon-{size}x{size}.png for sizes
//   72, 96, 128, 144, 152, 180, 192, 384, 512.
//
// The mark is rendered onto a transparent canvas at the target dimension
// using fit:"contain" so non-square sources letterbox without crop.
// (The provided mark is already square with built-in background; this
// is defensive in case the source is ever swapped.)

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SOURCE = join(ROOT, "public/brands/topcoach/mark.webp");
const OUT_DIR = join(ROOT, "public/icons");
const SIZES = [72, 96, 128, 144, 152, 180, 192, 384, 512];

async function main() {
  const source = await readFile(SOURCE);
  await mkdir(OUT_DIR, { recursive: true });

  for (const size of SIZES) {
    const out = join(OUT_DIR, `icon-${size}x${size}.png`);
    const buffer = await sharp(source)
      .resize(size, size, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ compressionLevel: 9 })
      .toBuffer();
    await writeFile(out, buffer);
    console.log(`✓ wrote ${out} (${buffer.length} bytes)`);
  }

  console.log(`\nDone. Regenerated ${SIZES.length} icons.`);
}

main().catch((err) => {
  console.error("Failed to generate icons:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Lint the script**

Run: `npm run lint -- scripts/generate-topcoach-icons.mjs`

Expected: PASS.

- [ ] **Step 3: Commit the script (without running it yet)**

```bash
git add scripts/generate-topcoach-icons.mjs
git commit -m "feat(scripts): add TopCoach static-icon regeneration script"
```

---

## Task 5: Generate and commit the static icons

**Files:**

- Modify: `public/icons/icon-72x72.png` through `icon-512x512.png` (9 files)

Run the script from Task 4 and commit the resulting PNGs. Separating this from Task 4 keeps the script commit clean of binary churn.

- [ ] **Step 1: Run the generator**

Run: `node scripts/generate-topcoach-icons.mjs`

Expected: 9 lines like `✓ wrote .../icon-72x72.png (NNNN bytes)` then `Done. Regenerated 9 icons.`

- [ ] **Step 2: Visually verify two sizes**

Open `public/icons/icon-72x72.png` and `public/icons/icon-512x512.png` (e.g. `open public/icons/icon-512x512.png` on macOS).

Expected: The TopCoach black-background white-arrow mark, sharp at 512px and recognizable at 72px. No placeholder Next.js arrow.

- [ ] **Step 3: Commit**

```bash
git add public/icons/icon-*.png
git commit -m "feat(brand): regenerate static TopCoach PWA icons"
```

---

## Task 6: Dynamic icon endpoint

**Files:**

- Create: `app/api/icons/[slug]/[size].png/route.ts`

The full endpoint, including the default-icon fallback path. One file, single responsibility, easy to review.

- [ ] **Step 1: Write the route**

```ts
// app/api/icons/[slug]/[size].png/route.ts
//
// Dynamic PWA icon endpoint. Composites a tenant's uploaded logo onto
// their chosen surface color, returning a PNG at the requested size.
//
// Behavior:
//   - Validates size against an allowlist.
//   - Loads the tenant via loadTenantContext(slug).
//   - Fetches logo_url bytes (3s timeout, 4MB cap).
//   - Composites with sharp inside a 70% safe-zone (works for both
//     "maskable" and "any" manifest purposes).
//   - On any failure path, falls back to the corresponding static
//     /public/icons/icon-{size}x{size}.png so installs never break.
//
// Caching:
//   - Dynamic success: public, max-age=31536000, immutable.
//     URL is content-versioned via ?v=... so this is safe.
//   - Default fallback: public, max-age=300. Short so an outage
//     doesn't burn defaults into the CDN for everyone.

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";

import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

import { isServedIconSize, resolveSurfaceColor } from "@/lib/tenant/icon-url";
import { loadTenantContext } from "@/lib/tenant/loader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOGO_FETCH_TIMEOUT_MS = 3000;
const LOGO_MAX_BYTES = 4 * 1024 * 1024;
const SAFE_ZONE_RATIO = 0.7;

const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";
const FALLBACK_CACHE = "public, max-age=300";

function correlationId(): string {
  return `icons-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function serveDefault(
  size: number,
  cid: string,
  reason: string
): Promise<NextResponse> {
  const file = join(
    process.cwd(),
    "public",
    "icons",
    `icon-${size}x${size}.png`
  );
  try {
    const stats = await stat(file);
    console.warn(`[Icons] Serving default for size ${size} (${reason})`, {
      correlationId: cid,
    });

    // Stream so we don't buffer the file into memory.
    const stream = createReadStream(file);
    return new NextResponse(stream as unknown as ReadableStream, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(stats.size),
        "Cache-Control": FALLBACK_CACHE,
        "X-TopCoach-Icon-Source": "default",
      },
    });
  } catch (err) {
    console.error(`[Icons] Default icon missing at ${file}`, {
      correlationId: cid,
      error: (err as Error).message,
    });
    return new NextResponse("Icon unavailable", { status: 500 });
  }
}

async function fetchLogoBytes(
  url: string,
  cid: string
): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(LOGO_FETCH_TIMEOUT_MS),
      redirect: "follow",
    });
    if (!res.ok) {
      console.warn(`[Icons] logo fetch HTTP ${res.status} ${url}`, {
        correlationId: cid,
      });
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > LOGO_MAX_BYTES) {
      console.warn(
        `[Icons] logo exceeds max bytes: ${buf.length} > ${LOGO_MAX_BYTES}`,
        { correlationId: cid }
      );
      return null;
    }
    return buf;
  } catch (err) {
    console.warn(`[Icons] logo fetch failed for ${url}`, {
      correlationId: cid,
      error: (err as Error).message,
    });
    return null;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; size: string }> }
): Promise<NextResponse> {
  const cid = correlationId();
  const { slug, size: rawSize } = await params;

  // Strip the trailing ".png" the route path embeds.
  const match = /^(\d+)\.png$/.exec(rawSize);
  if (!match) {
    return new NextResponse("Invalid size", { status: 400 });
  }
  const size = Number(match[1]);
  if (!isServedIconSize(size)) {
    return new NextResponse("Unsupported size", { status: 400 });
  }

  let tenant;
  try {
    tenant = await loadTenantContext(slug);
  } catch (err) {
    console.warn(`[Icons] tenant load failed for ${slug}`, {
      correlationId: cid,
      error: (err as Error).message,
    });
    return serveDefault(size, cid, "tenant-load-error");
  }

  if (!tenant) {
    return serveDefault(size, cid, "tenant-not-found");
  }

  const logoUrl = tenant.logo_url?.trim() ?? "";
  if (!logoUrl) {
    return serveDefault(size, cid, "no-logo");
  }

  const logo = await fetchLogoBytes(logoUrl, cid);
  if (!logo) {
    return serveDefault(size, cid, "logo-fetch-failed");
  }

  const surface = resolveSurfaceColor(tenant.theme_json);
  const inner = Math.round(size * SAFE_ZONE_RATIO);

  try {
    const resizedLogo = await sharp(logo)
      .resize(inner, inner, { fit: "inside" })
      .toBuffer();

    const png = await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: surface,
      },
    })
      .composite([{ input: resizedLogo, gravity: "center" }])
      .png({ compressionLevel: 9 })
      .withMetadata({})
      .toBuffer();

    return new NextResponse(png, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(png.length),
        "Cache-Control": IMMUTABLE_CACHE,
        "X-TopCoach-Icon-Source": "dynamic",
      },
    });
  } catch (err) {
    console.error(`[Icons] sharp composition failed for ${slug}/${size}`, {
      correlationId: cid,
      error: (err as Error).message,
    });
    return serveDefault(size, cid, "sharp-error");
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`

Expected: PASS.

- [ ] **Step 3: Lint**

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/api/icons/\[slug\]/\[size\].png/route.ts
git commit -m "feat(pwa): add dynamic per-tenant icon endpoint"
```

---

## Task 7: Wire the client manifest

**Files:**

- Modify: `app/[slug]/manifest.json/route.ts`

Replace the hardcoded icons array with one built from the helper. Read the surface color from `theme_json` so the version hash captures background changes too.

- [ ] **Step 1: Read the current file**

Open `app/[slug]/manifest.json/route.ts` and locate the `icons:` array (currently 8 entries pointing at `/icons/icon-{size}x{size}.png`).

- [ ] **Step 2: Replace the icons array**

Replace the entire `icons: [ ... ]` array with helper-driven generation. The full updated file is below — replace the existing one:

```ts
// app/[slug]/manifest.json/route.ts
import { NextRequest, NextResponse } from "next/server";

import {
  TENANT_MANIFEST_ICON_SIZES,
  iconVersion,
  resolveSurfaceColor,
  tenantIconUrl,
} from "@/lib/tenant/icon-url";
import { loadTenantContext } from "@/lib/tenant/loader";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let appName = "TopCoach";
  let shortName = "TopCoach";
  let logoUrl = "";
  let surfaceColor = "#ffffff";

  try {
    const tenantContext = await loadTenantContext(slug);

    if (tenantContext) {
      appName =
        tenantContext.theme_json?.meta?.name || tenantContext.slug || appName;
      shortName = appName;
      logoUrl = tenantContext.logo_url ?? "";
      surfaceColor = resolveSurfaceColor(tenantContext.theme_json);
    }
  } catch {
    // Fall back to defaults
  }

  const version = iconVersion(logoUrl, surfaceColor);

  const icons = TENANT_MANIFEST_ICON_SIZES.map((size) => ({
    src: tenantIconUrl(slug, size, version),
    sizes: `${size}x${size}`,
    type: "image/png",
    purpose: "maskable any",
  }));

  const manifest = {
    id: `https://app.topcoach.io/${slug}`,
    name: `${appName} - Coaching App`,
    short_name: shortName,
    description: `${appName} - Plataforma de coaching personal`,
    start_url: `/${slug}`,
    scope: `/${slug}`,
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    orientation: "any",
    icons,
    categories: ["health", "fitness", "productivity"],
    lang: "es",
    dir: "ltr",
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`

Expected: PASS.

- [ ] **Step 4: Lint**

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/\[slug\]/manifest.json/route.ts
git commit -m "feat(pwa): use dynamic icon URLs in client manifest"
```

---

## Task 8: Wire the apple-touch-icon in layout.tsx

**Files:**

- Modify: `app/layout.tsx`

iOS doesn't read the manifest icons array. We must set `<link rel="apple-touch-icon">` per-page in the `<head>`. `generateMetadata` already loads `tenantContext` for the page title, so we reuse it.

- [ ] **Step 1: Add the icon-url import**

In `app/layout.tsx`, add to the existing imports (alongside `loadTenantContext`):

```ts
import {
  iconVersion,
  resolveSurfaceColor,
  tenantIconUrl,
} from "@/lib/tenant/icon-url";
```

- [ ] **Step 2: Refactor generateMetadata to reuse tenantContext**

Currently `generateMetadata` calls `loadTenantContext(tenantSlug)` only when computing the page title, and the result goes out of scope. Hoist it so we can also use `logo_url` and `theme_json`. Replace the existing `generateMetadata` function (lines ~38–93) with:

```ts
export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const tenantSlug = headersList.get("x-tenant-slug") || "";
  const pathname = headersList.get("x-pathname") || "";

  let pageTitle = siteConfig.name;
  let appleIcon = "/icons/icon-180x180.png"; // TopCoach default

  if (pathname.startsWith("/admin")) {
    pageTitle = "TopCoach Admin";
  } else if (pathname.startsWith("/trainer")) {
    pageTitle = "TopCoach Trainer Dashboard";
  } else if (tenantSlug) {
    try {
      const tenantContext = await loadTenantContext(tenantSlug);

      if (tenantContext) {
        const tenantName =
          tenantContext.theme_json?.meta?.name || tenantContext.slug;

        pageTitle = `${tenantName} - TopCoach App`;

        const logoUrl = tenantContext.logo_url ?? "";

        if (logoUrl) {
          const surface = resolveSurfaceColor(tenantContext.theme_json);
          const version = iconVersion(logoUrl, surface);

          appleIcon = tenantIconUrl(tenantSlug, 180, version);
        }
      }
    } catch (error) {
      pageTitle = `${tenantSlug} - TopCoach App`;
    }
  }

  const manifestUrl = tenantSlug
    ? `/${tenantSlug}/manifest.json`
    : pathname.startsWith("/trainer")
      ? "/trainer/manifest.json"
      : "/manifest.json";

  return {
    title: pageTitle,
    description: siteConfig.description,
    manifest: manifestUrl,
    icons: {
      icon: "/favicon.ico",
      apple: appleIcon,
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: pageTitle,
    },
    other: {
      "mobile-web-app-capable": "yes",
    },
  };
}
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`

Expected: PASS.

- [ ] **Step 4: Lint**

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx
git commit -m "feat(pwa): set dynamic apple-touch-icon per tenant"
```

---

## Task 9: Smoke-test script

**Files:**

- Create: `scripts/smoke-test-tenant-icons.mjs`

Boots against a running dev server and exercises the endpoint's main paths. Not run on CI — invoked manually during development and before merge.

- [ ] **Step 1: Write the script**

```js
// scripts/smoke-test-tenant-icons.mjs
//
// Manual smoke test for the dynamic PWA icon endpoint.
// Requires the dev server running on PORT (default 3000).
//
// Usage:
//   npm run dev          # in one terminal
//   node scripts/smoke-test-tenant-icons.mjs <slug>
//
// What it checks:
//   1. /api/icons/<slug>/192.png?v=test → PNG bytes, dynamic header
//   2. /api/icons/<slug>/180.png?v=test → PNG bytes (apple-touch-icon size)
//   3. /api/icons/<slug>/999.png?v=test → 400 (unsupported size)
//   4. /api/icons/<slug>/192.txt → 400 (bad extension)
//   5. /api/icons/__definitely_not_a_tenant__/192.png → default header
//
// Exit code is non-zero if any check fails.

const PORT = process.env.PORT ?? "3000";
const HOST = `http://localhost:${PORT}`;

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: node scripts/smoke-test-tenant-icons.mjs <slug>");
  process.exit(2);
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

async function expect(label, fn) {
  try {
    await fn();
    console.log(`✓ ${label}`);
  } catch (err) {
    console.error(`✗ ${label}: ${err.message}`);
    process.exitCode = 1;
  }
}

async function getBytes(url) {
  const res = await fetch(url);
  return { res, body: Buffer.from(await res.arrayBuffer()) };
}

await expect("dynamic 192 PNG returns image bytes", async () => {
  const { res, body } = await getBytes(`${HOST}/api/icons/${slug}/192.png?v=t`);
  if (res.status !== 200) throw new Error(`status ${res.status}`);
  if (res.headers.get("content-type") !== "image/png")
    throw new Error(`content-type ${res.headers.get("content-type")}`);
  if (!body.subarray(0, 4).equals(PNG_MAGIC))
    throw new Error("not a PNG (magic bytes)");
});

await expect("dynamic 180 PNG (apple-touch-icon size)", async () => {
  const { res, body } = await getBytes(`${HOST}/api/icons/${slug}/180.png?v=t`);
  if (res.status !== 200) throw new Error(`status ${res.status}`);
  if (!body.subarray(0, 4).equals(PNG_MAGIC)) throw new Error("not a PNG");
});

await expect("999 → 400", async () => {
  const res = await fetch(`${HOST}/api/icons/${slug}/999.png?v=t`);
  if (res.status !== 400) throw new Error(`expected 400, got ${res.status}`);
});

await expect("bad extension → 400", async () => {
  const res = await fetch(`${HOST}/api/icons/${slug}/192.txt`);
  if (res.status !== 400) throw new Error(`expected 400, got ${res.status}`);
});

await expect("unknown tenant → falls back", async () => {
  const { res, body } = await getBytes(
    `${HOST}/api/icons/__definitely_not_a_tenant__/192.png?v=t`
  );
  if (res.status !== 200) throw new Error(`status ${res.status}`);
  if (res.headers.get("x-topcoach-icon-source") !== "default")
    throw new Error(
      `source header ${res.headers.get("x-topcoach-icon-source")}`
    );
  if (!body.subarray(0, 4).equals(PNG_MAGIC)) throw new Error("not a PNG");
});

if (process.exitCode) {
  console.error("\nSome checks failed.");
} else {
  console.log("\nAll smoke checks passed.");
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint -- scripts/smoke-test-tenant-icons.mjs`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add scripts/smoke-test-tenant-icons.mjs
git commit -m "chore(scripts): add smoke test for dynamic icon endpoint"
```

---

## Task 10: Local end-to-end verification

**Files:** None modified.

Manual verification against a running dev server. Catches anything the type-check and unit-level checks can't.

- [ ] **Step 1: Identify a real tenant slug for testing**

Pick a tenant slug from the local Supabase that has `logo_url` set. If unsure, run this query against the database (via Supabase dashboard or `psql`):

```sql
SELECT slug, logo_url
FROM tenants
WHERE status = 'active' AND logo_url IS NOT NULL
LIMIT 5;
```

Pick one slug and note it (referred to as `<slug>` below).

- [ ] **Step 2: Start the dev server**

Run: `npm run dev`

Expected: Server boots on http://localhost:3000.

- [ ] **Step 3: Run the smoke script**

In another terminal, run: `node scripts/smoke-test-tenant-icons.mjs <slug>`

Expected: 5 `✓` lines, "All smoke checks passed."

- [ ] **Step 4: Manually inspect the rendered icon**

Open in browser: `http://localhost:3000/api/icons/<slug>/512.png?v=t`

Expected: A 512×512 PNG showing the tenant's logo centered on the tenant's surface color background, with visible padding around the logo (the 70% safe zone). Not the default TopCoach mark.

- [ ] **Step 5: Verify the manifest output**

Open in browser: `http://localhost:3000/<slug>/manifest.json`

Expected: JSON with an `icons` array of 8 entries, each `src` matching the pattern `/api/icons/<slug>/<size>.png?v=<10-char-hex>`. The same hex appears on all 8 entries.

- [ ] **Step 6: Verify the apple-touch-icon link in HTML**

Open in browser: `http://localhost:3000/<slug>` and view source (or curl + grep).

Run: `curl -s "http://localhost:3000/<slug>" | grep apple-touch-icon`

Expected: A line like `<link rel="apple-touch-icon" href="/api/icons/<slug>/180.png?v=<hex>"/>` (or equivalent React-rendered form).

- [ ] **Step 7: Verify trainer route falls back to TopCoach default**

Run: `curl -s "http://localhost:3000/trainer/login" | grep apple-touch-icon`

Expected: `<link rel="apple-touch-icon" href="/icons/icon-180x180.png"/>` (the static path).

- [ ] **Step 8: Verify trainer manifest serves correctly**

Open in browser: `http://localhost:3000/trainer/manifest.json`

Expected: JSON with icons pointing at `/icons/icon-*.png` (unchanged from before).

- [ ] **Step 9: Stop the dev server**

In the terminal running `npm run dev`, press Ctrl+C.

- [ ] **Step 10: Build verification**

Run: `npm run build`

Expected: Build completes. The new `/api/icons/[slug]/[size].png/route.ts` appears in the route list as a dynamic route. No errors.

---

## Task 11: Mobile install verification (manual)

**Files:** None modified. This is a checklist, not a code change. Skip steps for platforms you can't test physically and note them in the PR.

The point of this whole project is what shows up on the home screen. The dev-server checks cannot verify that; only an actual install can.

- [ ] **Step 1: Deploy to a preview environment**

If using Vercel, push the branch and use the preview URL. Otherwise, ensure the change is reachable from a real phone (e.g. expose dev server via ngrok or run on a LAN-accessible host).

- [ ] **Step 2: Android Chrome install**

On an Android device:

1. Open Chrome to `<preview-url>/<slug>` (a tenant client portal).
2. Three-dot menu → "Add to Home screen" or "Install app".
3. Confirm.

Expected: Home-screen icon shows the tenant's logo on their surface color, with safe-zone padding, masked into whatever shape the launcher uses (no clipping of the logo).

- [ ] **Step 3: iOS Safari install**

On an iPhone:

1. Open Safari to `<preview-url>/<slug>`.
2. Share button → "Add to Home Screen".
3. Confirm.

Expected: Home-screen icon shows the tenant's logo on their surface color. No clipping. The default rounded-square iOS mask is applied.

- [ ] **Step 4: Trainer app install (Android)**

On Android Chrome, open `<preview-url>/trainer/login` and install.

Expected: Home-screen icon shows the TopCoach black-background white-arrow mark — the same one that now lives at `public/icons/icon-*.png`.

- [ ] **Step 5: Trainer app install (iOS)**

Same as above on iOS.

Expected: TopCoach mark, not a placeholder.

- [ ] **Step 6: Record results in the PR description**

For each of the four installs (Android client, iOS client, Android trainer, iOS trainer), note: tested ✓ / not tested. Include a phone screenshot of at least one Android and one iOS install if possible.

---

## Task 12: PR cleanup

**Files:** None modified beyond what's already committed.

- [ ] **Step 1: Review the commit history**

Run: `git log --oneline origin/main..HEAD`

Expected: A clean sequence of small, scoped commits (roughly 1 per task: chore(deps), feat(tenant), feat(brand), feat(scripts), feat(brand)/regenerate, feat(pwa)/endpoint, feat(pwa)/manifest, feat(pwa)/apple-touch, chore(scripts)/smoke).

- [ ] **Step 2: Final type-check + lint + build**

Run: `npm run type-check && npm run lint:check && npm run build`

Expected: All PASS.

- [ ] **Step 3: Push the branch**

Run: `git push -u origin HEAD`

Expected: Branch published.

- [ ] **Step 4: Open the PR**

Use the title `feat(pwa): personalize PWA icons per tenant + ship TopCoach branded defaults`.

PR body must include:

```markdown
## Summary

- Dynamic per-tenant PWA icons composited from `tenants.logo_url` and
  `theme_json.colors.surface.1`, served from
  `/api/icons/[slug]/[size].png?v={hash}`.
- TopCoach branded static icons replace the Next.js placeholder PNGs
  for trainer/root paths.
- iOS apple-touch-icon set dynamically per tenant via
  `generateMetadata` in `app/layout.tsx`.

## Test plan

- [x] `npm run type-check`
- [x] `npm run lint:check`
- [x] `npm run build`
- [x] `node scripts/smoke-test-tenant-icons.mjs <slug>` → all checks pass
- [ ] Android Chrome install of `/<slug>` (tester to fill)
- [ ] iOS Safari install of `/<slug>` (tester to fill)
- [ ] Android Chrome install of `/trainer/login` (tester to fill)
- [ ] iOS Safari install of `/trainer/login` (tester to fill)

## Notes

- Existing iOS installs will keep showing the placeholder until users
  remove + re-add — iOS doesn't refresh apple-touch-icon after install.
  Trainers will communicate this to clients out-of-band.
- Android WebAPK installs auto-refresh icons via Chrome's periodic
  manifest re-fetch, typically within ~24h.
```

---

## Self-Review Notes

**Spec coverage:**

- Goals 1–5 → Tasks 6 (endpoint), 5 (static icons), 7+8 (manifest+layout), 2 (version hash), 6 (fallback path). ✓
- Non-goals → No tasks. ✓
- Architecture diagram → Tasks 2, 6, 7, 8 collectively. ✓
- Dynamic endpoint spec (path, runtime, params, algorithm, headers, fallback) → Task 6 includes all of it. ✓
- "Why 70% safe zone" → Task 6, `SAFE_ZONE_RATIO = 0.7`. ✓
- Library choice (`sharp`) → Task 1. ✓
- Version hash with logo + surface inputs → Task 2 (`iconVersion`). ✓
- Manifest changes → Task 7. ✓
- iOS apple-touch-icon → Task 8. ✓
- Static TopCoach icons → Tasks 3, 4, 5. ✓
- Edge cases (no logo, fetch fail, bad size, etc.) → Task 6 (each branch in the route). ✓
- Security (timeout, byte cap, allowlist) → Task 6. ✓
- Testing strategy (no formal framework; smoke + manual) → Tasks 9, 10, 11. ✓
- Files touched list → Matches "File Structure" section above. ✓
- Rollout (additive, no flag) → Task 12 PR body. ✓
- Propagation table (Android auto-refresh, iOS stuck) → Task 12 PR notes. ✓

**Placeholder scan:** No TBDs. No "implement appropriate X" phrases. Each code-modifying step includes the actual code.

**Type consistency:**

- Helper exports `iconVersion(logoUrl, surface)` and `tenantIconUrl(slug, size, version)` and `resolveSurfaceColor(themeJson)` — used identically in Tasks 7 and 8 (manifest and layout).
- `isServedIconSize` and the `ServedIconSize` type — used in Task 6's path-param validation.
- `TENANT_MANIFEST_ICON_SIZES` (8 sizes, no 180) is consumed by Task 7; `TENANT_ICON_SERVED_SIZES` (9 sizes, includes 180) is consumed by Task 6. Different lists, intentionally.
- `loadTenantContext` and `TenantContext.theme_json` field shape match what's used in `app/layout.tsx` and `app/[slug]/manifest.json/route.ts` today.

No gaps.
