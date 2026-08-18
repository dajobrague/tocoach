"use client";

import type { ThemeProviderProps } from "next-themes";

import { HeroUIProvider } from "@heroui/system";
import { ToastProvider } from "@heroui/toast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { useRouter } from "next/navigation";
import * as React from "react";

export interface ProvidersProps {
  children: React.ReactNode;
  themeProps?: ThemeProviderProps;
}

declare module "@react-types/shared" {
  interface RouterConfig {
    routerOptions: NonNullable<
      Parameters<ReturnType<typeof useRouter>["push"]>[1]
    >;
  }
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is "fresh" for 60 seconds — page transitions show cached
        // data instantly, and a silent background refetch kicks in once
        // the data is older than 1 minute.  This keeps trainer-made
        // changes visible within ~1 min without sacrificing speed.
        staleTime: 60 * 1000,
        // Keep unused cached data for 10 minutes before garbage-collecting.
        gcTime: 10 * 60 * 1000,
        // Refetch stale queries when the user returns to the browser tab
        // so data stays fresh without the user having to navigate.
        refetchOnWindowFocus: true,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

// Registra el bundle offline de iconos (los ~260 que usa el código) en
// Iconify apenas hidrata el cliente, vía import dinámico: el chunk queda
// FUERA del bundle crítico y, una vez cargado, los iconos renderizan sin
// tocar api.iconify.design (que hasta ahora era una dependencia de terceros
// en runtime para 200+ archivos). Los iconos que no estén en el bundle
// siguen resolviendo por la API como fallback. Regenerar con
// scripts/generate-icon-bundle.mjs cuando se añadan iconos nuevos.
let iconsRegistered = false;

function useOfflineIcons() {
  React.useEffect(() => {
    if (iconsRegistered) return;
    iconsRegistered = true;

    void Promise.all([
      import("@iconify/react"),
      import("@/lib/icons/offline-icons"),
    ])
      .then(([{ addCollection }, { offlineCollections }]) => {
        for (const collection of offlineCollections) {
          addCollection(collection);
        }
      })
      .catch((error) => {
        // Sin bundle no pasa nada grave: los iconos siguen llegando por la
        // API de Iconify como siempre.
        console.warn("[Icons] offline bundle failed to load:", error);
      });
  }, []);
}

function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always make a new query client
    return makeQueryClient();
  } else {
    // Browser: make a new query client if we don't already have one.
    if (!browserQueryClient) browserQueryClient = makeQueryClient();

    return browserQueryClient;
  }
}

export function Providers({ children, themeProps }: ProvidersProps) {
  const router = useRouter();
  const queryClient = getQueryClient();

  useOfflineIcons();

  return (
    <QueryClientProvider client={queryClient}>
      <HeroUIProvider navigate={router.push}>
        {/* Sin ToastProvider montado, TODOS los addToast() de la app eran
            no-ops silenciosos: ningún error de envío de formularios llegaba
            a verse ("mando enviar y no pasa nada"). La región de toasts usa
            z-[100] (sobre el z-50 de los modales), así que los toasts se ven
            incluso con un modal abierto. */}
        <ToastProvider />
        <NextThemesProvider {...themeProps}>{children}</NextThemesProvider>
      </HeroUIProvider>
    </QueryClientProvider>
  );
}
