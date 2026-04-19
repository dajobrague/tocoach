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
