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
