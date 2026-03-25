import { NextRequest, NextResponse } from "next/server";

import { loadTenantContext } from "@/lib/tenant/loader";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let appName = "TopCoach";
  let shortName = "TopCoach";

  try {
    const tenantContext = await loadTenantContext(slug);

    if (tenantContext) {
      appName =
        tenantContext.theme_json?.meta?.name || tenantContext.slug || appName;
      shortName = appName;
    }
  } catch {
    // Fall back to defaults
  }

  const manifest = {
    name: `${appName} - Coaching App`,
    short_name: shortName,
    description: `${appName} - Plataforma de coaching personal`,
    start_url: `/${slug}`,
    scope: `/${slug}`,
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/icon-72x72.png",
        sizes: "72x72",
        type: "image/png",
        purpose: "maskable any",
      },
      {
        src: "/icons/icon-96x96.png",
        sizes: "96x96",
        type: "image/png",
        purpose: "maskable any",
      },
      {
        src: "/icons/icon-128x128.png",
        sizes: "128x128",
        type: "image/png",
        purpose: "maskable any",
      },
      {
        src: "/icons/icon-144x144.png",
        sizes: "144x144",
        type: "image/png",
        purpose: "maskable any",
      },
      {
        src: "/icons/icon-152x152.png",
        sizes: "152x152",
        type: "image/png",
        purpose: "maskable any",
      },
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable any",
      },
      {
        src: "/icons/icon-384x384.png",
        sizes: "384x384",
        type: "image/png",
        purpose: "maskable any",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable any",
      },
    ],
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
