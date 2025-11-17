"use client";

import { useSearchParams } from "next/navigation";

// Available brand slugs
const AVAILABLE_BRANDS = ["default", "ironfit", "zen-coach"] as const;
type BrandSlug = (typeof AVAILABLE_BRANDS)[number];

function isValidBrandSlug(slug: string): slug is BrandSlug {
    return AVAILABLE_BRANDS.includes(slug as BrandSlug);
}

export function BrandLogo() {
    const searchParams = useSearchParams();
    const brandParam = searchParams.get("brand");
    const brandSlug = brandParam && isValidBrandSlug(brandParam) ? brandParam : "default";
    const logoSrc = `/brands/${brandSlug}/logo.svg`;

    return (
        <img
            alt="Brand Logo"
            className="h-8 w-auto"
            src={logoSrc}
        />
    );
}
