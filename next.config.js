const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin workspace root when multiple lockfiles exist (e.g. parent ~/package-lock.json).
  outputFileTracingRoot: path.join(__dirname),

  // Production optimizations
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",

  // Temporarily disable type checking during build for faster deployment
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Image optimization
  images: {
    domains: ["ydqhndnvrkvycnkaghro.supabase.co"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },

  // Security headers
  async headers() {
    return [
      // Service worker must NEVER be cached at the HTTP layer. If a CDN or
      // browser caches `/sw.js`, `registration.update()` compares against
      // a stale copy and never detects new deploys — clients get pinned to
      // an old service worker (and therefore old bundle cache) for up to
      // 24h, the SW spec's hard cap. Forcing no-store here, combined with
      // `updateViaCache: "none"` on the register() call, guarantees that
      // every update() check hits origin and sees fresh bytes.
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // X-Frame-Options removed to allow iframe embedding
          // Note: frame-ancestors directive omitted to allow all domains
          // This is more reliable than using wildcards due to browser bugs
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
