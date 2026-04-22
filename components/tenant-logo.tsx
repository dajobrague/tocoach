"use client";

import { Icon } from "@iconify/react";
import Image from "next/image";
import { useEffect, useState } from "react";

/**
 * Renders the tenant/brand logo using Next.js Image optimization.
 *
 * Resizes and optimizes the logo server-side, which fixes iOS Safari issues
 * where large PNGs fail to display (iOS limits PNG decoded size to 3-5
 * megapixels). Optimization produces smaller, mobile-friendly images.
 *
 * Shows a fallback icon when the image fails to load or src is empty.
 */
export function TenantLogo({
  src,
  alt,
  className = "",
  width = 80,
  height = 40,
  priority = false,
  showFallback = true,
}: {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  showFallback?: boolean;
}) {
  const [hasError, setHasError] = useState(false);

  // Reset error state when src changes
  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (hasError || !src) {
    if (!showFallback) return null;

    return (
      <div
        className="bg-primary/10 rounded-lg flex items-center justify-center"
        style={{ width: height, height: height }}
      >
        <Icon
          className="text-primary"
          icon="solar:dumbbell-bold"
          width={height * 0.5}
        />
      </div>
    );
  }

  return (
    <Image
      alt={alt}
      className={className}
      height={height}
      priority={priority}
      quality={90}
      sizes="(max-width: 768px) 80px, 80px"
      src={src}
      width={width}
      onError={() => setHasError(true)}
    />
  );
}
