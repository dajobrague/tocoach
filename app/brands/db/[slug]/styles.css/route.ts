// Server-side CSS generation from database theme_json.
//
// Desde el inline del tema en el root layout (lib/theme/render-css.ts) esta
// ruta es la RED DE SEGURIDAD: el layout cae a este <link> cuando la
// generación inline falla, y cualquier consumidor externo del URL sigue
// funcionando. La generación vive compartida en lib/theme/render-css.ts.
import { NextRequest, NextResponse } from "next/server";

import { loadTenantContext } from "@/lib/tenant/loader";
import { generateThemeCSS, resolveTenantTheme } from "@/lib/theme/render-css";
import type { ThemeConfig } from "@/lib/theme/schema";
import { defaultTheme } from "@/lib/theme/schema";

// Load theme from database
async function loadThemeFromDatabase(host: string): Promise<ThemeConfig> {
  try {
    const tenantContext = await loadTenantContext(host);

    if (!tenantContext || tenantContext.status !== "active") {
      console.warn(
        `[CSS Gen DB] No active tenant for host: ${host}, using default theme`
      );

      return defaultTheme;
    }

    return resolveTenantTheme(tenantContext, host);
  } catch (error) {
    console.error(`[CSS Gen DB] Failed to load theme for host ${host}:`, error);

    return defaultTheme;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug: host } = await params;

  try {
    // Load theme configuration from database
    const theme = await loadThemeFromDatabase(host);

    // Generate CSS
    const css = generateThemeCSS(theme);

    const isDev = process.env.NODE_ENV !== "production";

    return new NextResponse(css, {
      headers: {
        "Content-Type": "text/css",
        // max-age corto: cuando el trainer guarda colores, los clientes
        // deben verlos en ~1 min, no hasta 1h despues (y el SWR de un dia
        // entero hacia que "guarde y no cambia nada" fuera la norma).
        // Generar este CSS es barato (lookup de tenant cacheado 60s).
        "Cache-Control": isDev
          ? "no-store"
          : "public, max-age=60, stale-while-revalidate=300",
        Vary: "Accept-Encoding",
      },
    });
  } catch (error) {
    console.error(`[CSS Gen DB] Error generating CSS for host ${host}:`, error);

    // Fallback to default theme CSS
    const defaultCSS = generateThemeCSS(defaultTheme);

    return new NextResponse(defaultCSS, {
      headers: {
        "Content-Type": "text/css",
        "Cache-Control": "public, max-age=300", // Shorter cache for fallback
      },
    });
  }
}
