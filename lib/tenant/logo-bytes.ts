import "server-only";

// Descarga del logo del tenant para componer imágenes en el servidor (icono
// PWA, tarjeta de sesión). Solo el host de Supabase Storage: el logo_url lo
// escribe el trainer y sin allowlist sería un SSRF.

const LOGO_FETCH_TIMEOUT_MS = 3000;
// Defensive cap. The upload route at app/api/setup/upload-logo enforces
// a 2MB limit on writes; this is a 2x safety margin in case that ever
// drifts or a stored URL points at something larger.
const LOGO_MAX_BYTES = 4 * 1024 * 1024;

export function logoUrlIsAllowed(rawUrl: string): boolean {
  const allowedHost = (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
    } catch {
      return "";
    }
  })();

  if (!allowedHost) return false;

  try {
    const parsed = new URL(rawUrl);

    if (parsed.protocol !== "https:") return false;

    // Allow exact match or any subdomain of the Supabase project host.
    return (
      parsed.hostname === allowedHost ||
      parsed.hostname.endsWith(`.${allowedHost}`)
    );
  } catch {
    return false;
  }
}

export async function fetchLogoBytes(
  url: string,
  cid: string
): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(LOGO_FETCH_TIMEOUT_MS),
      redirect: "follow",
    });

    if (!res.ok) {
      console.warn(`[Logo] logo fetch HTTP ${res.status} ${url}`, {
        correlationId: cid,
      });

      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());

    if (buf.length > LOGO_MAX_BYTES) {
      console.warn(
        `[Logo] logo exceeds max bytes: ${buf.length} > ${LOGO_MAX_BYTES}`,
        { correlationId: cid }
      );

      return null;
    }

    return buf;
  } catch (err) {
    console.warn(`[Logo] logo fetch failed for ${url}`, {
      correlationId: cid,
      error: (err as Error).message,
    });

    return null;
  }
}
