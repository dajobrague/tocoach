import type { NextRequest } from "next/server";

import { APP_CONFIG } from "@/config/app";

// In the Railway standalone build, `request.nextUrl.origin` resolves to the
// internal bind address (e.g. `http://0.0.0.0:8080`) instead of the public
// origin, so any URL we hand back to the browser (impersonation links,
// emails, etc.) ends up broken.
//
// Resolution order:
//   1. x-forwarded-* headers (Railway / any reverse proxy sets these).
//   2. Host header (covers dev / direct requests).
//   3. APP_CONFIG fallback (last-resort hardcoded prod domain).
export function getPublicOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const host = forwardedHost ?? request.headers.get("host");

  if (host) {
    const proto =
      forwardedProto ??
      (host.startsWith("localhost") || host.startsWith("127.")
        ? "http"
        : "https");

    return `${proto}://${host}`;
  }

  const fallbackHost = APP_CONFIG.getDomain();
  const fallbackProto = APP_CONFIG.isDevelopment() ? "http" : "https";

  return `${fallbackProto}://${fallbackHost}`;
}
