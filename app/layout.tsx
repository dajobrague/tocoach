import "@/styles/globals.css";
import { Metadata, Viewport } from "next";
import { Link } from "@heroui/link";
import clsx from "clsx";

import { Providers } from "./providers";

import { siteConfig } from "@/config/site";
import { fontSans } from "@/config/fonts";
import { Navbar } from "@/components/navbar";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { ThemeProvider } from "@/components/theme-provider";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning lang="en">
      <head />
      <body
        className={clsx(
          "min-h-screen text-foreground bg-background font-sans antialiased",
          fontSans.variable
        )}
      >
        <ThemeProvider>
          <Providers themeProps={{ attribute: "class", defaultTheme: "light" }}>
            <div className="mobile-frame">
              <div className="safe-area-top relative flex flex-col min-h-screen">
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
            <ServiceWorkerRegistration />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
