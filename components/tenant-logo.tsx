"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * Renders the tenant/brand logo using Next.js Image optimization.
 *
 * Resizes and optimizes the logo server-side, which fixes iOS Safari issues
 * where large PNGs fail to display (iOS limits PNG decoded size to 3-5
 * megapixels). Optimization produces smaller, mobile-friendly images.
 */
export function TenantLogo({
  src,
  alt,
  className = "",
  width = 80,
  height = 40,
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
}) {
  const [hasError, setHasError] = useState(false);

  if (hasError || !src) {
    return null;
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
