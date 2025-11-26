"use client";

import { useSearchParams } from "next/navigation";

// Available brand slugs
const AVAILABLE_BRANDS = ["default", "ironfit", "zen-coach"] as const;

type BrandSlug = (typeof AVAILABLE_BRANDS)[number];

function isValidBrandSlug(slug: string): slug is BrandSlug {
  return AVAILABLE_BRANDS.includes(slug as BrandSlug);
}

export function SimpleBrandSwitcher() {
  const searchParams = useSearchParams();
  const brandParam = searchParams.get("brand");
  const currentBrand =
    brandParam && isValidBrandSlug(brandParam) ? brandParam : "default";

  const brandNames: Record<BrandSlug, string> = {
    default: "TopCoach",
    ironfit: "IronFit",
    "zen-coach": "Zen Coach",
  };

  const switchBrand = (slug: BrandSlug) => {
    if (slug === currentBrand) return;

    // Navigate to new brand URL (full page reload for clean CSS loading)
    const url = new URL(window.location.href);

    url.searchParams.set("brand", slug);
    window.location.href = url.toString();
  };

  return (
    <div className="flex gap-2">
      {AVAILABLE_BRANDS.map((brand) => (
        <button
          key={brand}
          className={`
            px-3 py-1 rounded-md text-sm font-medium font-body transition-colors
            ${
              brand === currentBrand
                ? "bg-primary text-primary-foreground"
                : "bg-default-100 text-default-foreground hover:bg-default-200"
            }
          `}
          onClick={() => switchBrand(brand)}
        >
          {brandNames[brand]}
        </button>
      ))}
    </div>
  );
}
