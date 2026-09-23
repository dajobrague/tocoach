import "server-only";

// Marca del entrenador para la tarjeta de sesión: nombre, color y logo como
// data URI PNG (Satori no pinta webp y no debe salir a internet por su
// cuenta). Best-effort: sin logo → iniciales.

import sharp from "sharp";

import { resolveTenantLogoUrl } from "@/lib/tenant/logo";
import { fetchLogoBytes, logoUrlIsAllowed } from "@/lib/tenant/logo-bytes";

export interface ShareCardBranding {
  trainerName: string;
  brandColor: string | null;
  logoSrc: string | null;
}

export async function loadShareCardBranding(
  tenant: { logo_url?: unknown; theme_json?: unknown } | null,
  correlationId: string
): Promise<ShareCardBranding> {
  const theme = (tenant?.theme_json ?? {}) as Record<string, any>;
  const trainerName =
    typeof theme.meta?.name === "string" && theme.meta.name.trim().length > 0
      ? theme.meta.name.trim()
      : "Tu entrenador";
  const brand = theme.colors?.brand;
  const brandColor =
    typeof brand === "string" && /^#[0-9a-f]{6}$/i.test(brand) ? brand : null;

  let logoSrc: string | null = null;
  const logoUrl = resolveTenantLogoUrl(tenant?.logo_url, theme);

  if (logoUrl && logoUrlIsAllowed(logoUrl)) {
    const bytes = await fetchLogoBytes(logoUrl, correlationId);

    if (bytes) {
      try {
        const png = await sharp(bytes)
          .resize(220, 220, { fit: "inside", withoutEnlargement: true })
          .png()
          .toBuffer();

        logoSrc = `data:image/png;base64,${png.toString("base64")}`;
      } catch (error) {
        console.warn("[Share Card] logo convert failed:", {
          correlationId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return { trainerName, brandColor, logoSrc };
}
