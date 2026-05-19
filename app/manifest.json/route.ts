import { NextResponse } from "next/server";

import {
  TENANT_MANIFEST_ICON_SIZES,
  topcoachIconUrl,
} from "@/lib/tenant/icon-url";

export async function GET() {
  const icons = TENANT_MANIFEST_ICON_SIZES.map((size) => ({
    src: topcoachIconUrl(size),
    sizes: `${size}x${size}`,
    type: "image/png",
    purpose: "maskable any",
  }));

  const manifest = {
    name: "TopCoach - Personal Training Platform",
    short_name: "TopCoach",
    description: "Professional personal training management platform",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    orientation: "portrait-primary",
    scope: "/",
    icons,
    categories: ["health", "fitness", "productivity", "business"],
    lang: "en",
    dir: "ltr",
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
