// Server-side theme utilities
import { headers } from "next/headers";

// Available brand slugs
const AVAILABLE_BRANDS = ["default", "ironfit", "zen-coach"] as const;
export type BrandSlug = (typeof AVAILABLE_BRANDS)[number];

export function isValidBrandSlug(slug: string): slug is BrandSlug {
    return AVAILABLE_BRANDS.includes(slug as BrandSlug);
}

// Extract brand slug from server-side context
export async function getServerBrandSlug(): Promise<BrandSlug> {
    try {
        const headersList = await headers();
        const url = headersList.get("x-url") || headersList.get("referer") || "";

        // Check for query parameter ?brand=slug
        const urlObj = new URL(url.startsWith("http") ? url : `http://localhost${url}`);
        const brandParam = urlObj.searchParams.get("brand");

        if (brandParam && isValidBrandSlug(brandParam)) {
            return brandParam;
        }

        // Check for route pattern /b/slug
        const pathMatch = urlObj.pathname.match(/^\/b\/([^\/]+)/);
        if (pathMatch && pathMatch[1] && isValidBrandSlug(pathMatch[1])) {
            return pathMatch[1];
        }

        return "default";
    } catch (error) {
        console.warn("[Theme] Failed to extract brand slug from server context:", error);
        return "default";
    }
}

// Generate CSS link URL for a brand
export function getBrandCSSUrl(brandSlug: BrandSlug): string {
    return `/brands/${brandSlug}/styles.css`;
}

// Get brand assets URLs
export function getBrandAssetUrls(brandSlug: BrandSlug) {
    return {
        logo: `/brands/${brandSlug}/logo.svg`,
        banner: `/brands/${brandSlug}/banner.svg`,
    };
}
