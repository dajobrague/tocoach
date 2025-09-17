"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

import { ThemeConfig } from "@/lib/theme/schema";
import {
  BrandSlug,
  getBrandSlugFromUrl,
  applyTheme,
  getCurrentTheme,
} from "@/lib/theme/loader";

interface ThemeContextValue {
  theme: ThemeConfig | null;
  brandSlug: BrandSlug;
  isLoading: boolean;
  switchBrand: (slug: BrandSlug) => Promise<void>;
  availableBrands: BrandSlug[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
}

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<ThemeConfig | null>(null);
  const [brandSlug, setBrandSlug] = useState<BrandSlug>("default");
  const [isLoading, setIsLoading] = useState(true);

  // Initialize theme from URL
  useEffect(() => {
    const initialBrandSlug = getBrandSlugFromUrl();

    setBrandSlug(initialBrandSlug);
    loadTheme(initialBrandSlug);
  }, []);

  // Listen for URL changes (for SPA navigation)
  useEffect(() => {
    const handleLocationChange = () => {
      const newBrandSlug = getBrandSlugFromUrl();

      if (newBrandSlug !== brandSlug) {
        setBrandSlug(newBrandSlug);
        loadTheme(newBrandSlug);
      }
    };

    // Listen for popstate (back/forward buttons)
    window.addEventListener("popstate", handleLocationChange);

    // Listen for pushstate/replacestate (programmatic navigation)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      originalPushState.apply(history, args);
      handleLocationChange();
    };

    history.replaceState = function (...args) {
      originalReplaceState.apply(history, args);
      handleLocationChange();
    };

    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }, [brandSlug]);

  const loadTheme = async (slug: BrandSlug) => {
    setIsLoading(true);
    try {
      // Check if theme is already loaded
      const cachedTheme = getCurrentTheme(slug);

      if (cachedTheme) {
        setTheme(cachedTheme);
        setIsLoading(false);

        return;
      }

      const loadedTheme = await applyTheme(slug);

      setTheme(loadedTheme);
    } catch (error) {
      console.error("Failed to load theme:", error);
      // Fallback to default theme
      if (slug !== "default") {
        const defaultTheme = await applyTheme("default");

        setTheme(defaultTheme);
        setBrandSlug("default");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const switchBrand = async (slug: BrandSlug) => {
    if (slug === brandSlug) return;

    setBrandSlug(slug);
    await loadTheme(slug);

    // Update URL without page reload
    const url = new URL(window.location.href);

    url.searchParams.set("brand", slug);
    history.pushState({}, "", url.toString());
  };

  const contextValue: ThemeContextValue = {
    theme,
    brandSlug,
    isLoading,
    switchBrand,
    availableBrands: ["default", "ironfit", "zen-coach"],
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

// Brand switcher component
export function BrandSwitcher() {
  const { brandSlug, switchBrand, availableBrands, isLoading } = useTheme();

  const brandNames: Record<BrandSlug, string> = {
    default: "TopCoach",
    ironfit: "IronFit",
    "zen-coach": "Zen Coach",
  };

  return (
    <div className="flex gap-2">
      {availableBrands.map((brand) => (
        <button
          key={brand}
          className={`
            px-3 py-1 rounded-md text-sm font-medium transition-colors
            ${
              brand === brandSlug
                ? "bg-[var(--color-brand)] text-white"
                : "bg-[var(--color-surface-2)] text-[var(--color-text-primary)] hover:bg-[var(--color-fill)]"
            }
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
          disabled={isLoading}
          onClick={() => switchBrand(brand)}
        >
          {brandNames[brand]}
        </button>
      ))}
    </div>
  );
}

// Hook to get brand assets
export function useBrandAssets() {
  const { theme } = useTheme();

  return {
    logo: theme?.assets?.logo || "/brands/default/logo.svg",
    banner: theme?.assets?.banner || "/brands/default/banner.svg",
  };
}
