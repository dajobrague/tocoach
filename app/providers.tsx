"use client";

import type { ThemeProviderProps } from "next-themes";

import { HeroUIProvider } from "@heroui/system";
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

  return (
    <QueryClientProvider client={queryClient}>
      <HeroUIProvider navigate={router.push}>
        <NextThemesProvider {...themeProps}>{children}</NextThemesProvider>
      </HeroUIProvider>
    </QueryClientProvider>
  );
}
