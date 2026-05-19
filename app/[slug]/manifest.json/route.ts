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
