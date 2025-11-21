import "@/styles/globals.css";
import { Link } from "@heroui/link";
import clsx from "clsx";
import { Metadata, Viewport } from "next";
import { headers } from "next/headers";

import { Providers } from "./providers";

import { MaintenanceScreen } from "@/components/maintenance-screen";
import { Navbar } from "@/components/navbar";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { TenantProvider } from "@/components/tenant-provider";
import { fontSans } from "@/config/fonts";
import { siteConfig } from "@/config/site";
import { getSafeThemeSlug } from "@/lib/tenant/fallbacks";
import { loadTenantContext } from "@/lib/tenant/loader";
import { toClientSafe, type ClientTenantInfo } from "@/lib/tenant/types";

// Function to check if the current route should not have a navbar
function isNoNavbarRoute(pathname: string): boolean {
  // Trainer pages should not have the public navbar (they have their own navigation)
  const trainerRoutes = [
    "/trainer/login",
    "/trainer/register",
    "/trainer/forgot-password",
    "/trainer/reset-password",
    "/trainer/dashboard",
  ];

  return (
    trainerRoutes.some((route) => pathname.startsWith(route)) ||
    pathname === "/"
  );
}

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  description: siteConfig.description,
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/icon-192x192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: siteConfig.name,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get tenant context from slug or fallback to legacy brand slug
  const headersList = await headers();
  const tenantSlug = headersList.get("x-tenant-slug") || "";
  const correlationId = headersList.get("x-correlation-id") || "unknown";

  // Get current pathname to check if navbar should be hidden
  const pathname = headersList.get("x-pathname") || "";
  const hideNavbar = isNoNavbarRoute(pathname);

  // Check if this is a client slug route (no navbar needed)
  const isClientRoute = Boolean(tenantSlug);

  let themeSlug = "default";
  let useDatabaseTheme = false;
  let tenantInfo: ClientTenantInfo | null = null;
  let isMaintenanceMode = false;

  // Try slug-based tenant resolution first
  if (tenantSlug) {
    try {
      const tenantContext = await loadTenantContext(tenantSlug);

      if (tenantContext) {
        if (tenantContext.status === "active") {
          themeSlug = tenantContext.theme_slug;
          useDatabaseTheme = true;
          tenantInfo = toClientSafe(tenantContext);
          console.log(
            `[Layout] Using tenant theme: ${themeSlug} for slug: ${tenantSlug}`,
            { correlationId }
          );
        } else if (tenantContext.status === "inactive") {
          // Maintenance mode - still load theme for branding but show maintenance screen
          themeSlug = tenantContext.theme_slug;
          useDatabaseTheme = true;
          tenantInfo = toClientSafe(tenantContext);
          isMaintenanceMode = true;
          console.warn(
            `[Layout] Tenant ${tenantSlug} is inactive - maintenance mode`,
            { correlationId }
          );
        }
      } else {
        console.warn(
          `[Layout] No tenant found for slug: ${tenantSlug}, using default theme`,
          { correlationId }
        );
      }
    } catch (error) {
      console.error(
        `[Layout] Tenant resolution failed for slug: ${tenantSlug}`,
        {
          error: error instanceof Error ? error.message : "Unknown error",
          correlationId,
        }
      );
    }
  }

  // Fallback to legacy brand slug from query param/route
  if (themeSlug === "default" && !useDatabaseTheme) {
    const legacyBrandSlug = headersList.get("x-brand-slug");

    if (legacyBrandSlug) {
      themeSlug = legacyBrandSlug;
      console.log(`[Layout] Using legacy brand slug: ${themeSlug}`, {
        correlationId,
      });
    }
  }

  // Choose CSS URL based on source
  let brandCSSUrl: string;

  if (useDatabaseTheme) {
    brandCSSUrl = `/brands/db/${tenantSlug}/styles.css`;
  } else {
    // Validate theme exists and get safe theme slug for file-based themes
    const safeThemeSlug = await getSafeThemeSlug(themeSlug, {
      host: tenantSlug,
      correlationId,
    });

    brandCSSUrl = `/brands/${safeThemeSlug}/styles.css`;
  }

  return (
    <html suppressHydrationWarning lang="en">
      <head>
        <link href="https://fonts.googleapis.com" rel="preconnect" />
        <link
          crossOrigin="anonymous"
          href="https://fonts.gstatic.com"
          rel="preconnect"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&family=Playfair+Display:wght@400;500;600;700&family=Lato:wght@300;400;700&family=Roboto+Slab:wght@400;700&family=Open+Sans:wght@300;400;600;700&display=swap"
          rel="stylesheet"
        />
        <link href={brandCSSUrl} rel="stylesheet" />
      </head>
      <body
        className={clsx(
          "min-h-screen text-foreground bg-background font-sans antialiased",
          fontSans.variable
        )}
      >
        <Providers
          themeProps={{
            attribute: "class",
            defaultTheme: "light",
            forcedTheme: "light",
          }}
        >
          <TenantProvider tenant={tenantInfo}>
            {isMaintenanceMode ? (
              <MaintenanceScreen
                maintenanceReason={tenantInfo?.maintenance_reason || ""}
                maintenanceUntil={tenantInfo?.maintenance_until || ""}
                tenantName={
                  tenantInfo?.theme_json?.meta?.name ||
                  tenantInfo?.slug ||
                  "TopCoach"
                }
                tenantSlug={tenantInfo?.slug || "default"}
              />
            ) : hideNavbar || isClientRoute ? (
              // Auth pages or client subdomain pages without navbar - full page layout
              <div className="min-h-screen w-full">{children}</div>
            ) : (
              // Regular trainer pages with navbar
              <div className="mobile-frame">
                <div className="safe-area-top relative flex flex-col min-h-screen max-w-6xl mx-auto">
                  <Navbar />
                  <main className="flex-grow px-4 pt-16 pb-4">{children}</main>
                  <footer className="safe-area-bottom w-full flex items-center justify-center py-3 text-secondary">
                    <Link
                      isExternal
                      className="flex items-center gap-1 text-current opacity-60 hover:opacity-100 transition-opacity"
                      href="https://heroui.com?utm_source=next-app-template"
                      title="heroui.com homepage"
                    >
                      <span className="text-xs">Powered by</span>
                      <p className="text-xs font-medium">HeroUI</p>
                    </Link>
                  </footer>
                </div>
              </div>
            )}
            <ServiceWorkerRegistration />
          </TenantProvider>
        </Providers>
      </body>
    </html>
  );
}
