"use client";

import { usePathname } from "next/navigation";

import { flattenLeaves, type TrainerNavSection } from "./nav-items";

/**
 * Returns the key of the nav leaf whose `href` is the longest prefix match
 * of the current pathname. Empty string when nothing matches.
 */
export function useActiveKey(sections?: TrainerNavSection[]): string {
  const pathname = usePathname() ?? "";
  const leaves = flattenLeaves(sections);

  let bestKey = "";
  let bestLen = -1;

  for (const item of leaves) {
    const href = item.href ?? "";

    if (
      href &&
      (pathname === href || pathname.startsWith(`${href}/`)) &&
      href.length > bestLen
    ) {
      bestLen = href.length;
      bestKey = item.key;
    }
  }

  return bestKey;
}
