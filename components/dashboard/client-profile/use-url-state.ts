"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import {
  applyParams,
  patchWithChildrenCleared,
  readEnumParam,
  readStringParam,
  type ParamPatch,
} from "./url-state-helpers";

type HistoryMode = "push" | "replace";

/**
 * Low-level access to the profile URL's query params. `setParams` writes the
 * current pathname with the patched query, defaulting to `replace` (no history
 * entry). Pass `{ history: "push" }` for modal opens so Back closes them.
 */
export function useUrlParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParams = useCallback(
    (patch: ParamPatch, opts?: { history?: HistoryMode }) => {
      const search = applyParams(
        new URLSearchParams(searchParams.toString()),
        patch
      );
      const url = search ? `${pathname}?${search}` : pathname;

      if (opts?.history === "push") {
        router.push(url, { scroll: false });
      } else {
        router.replace(url, { scroll: false });
      }
    },
    [router, pathname, searchParams]
  );

  return { searchParams, setParams };
}

/**
 * Bind an enum/selection param to the URL. Reads with a whitelist fallback;
 * writes with `replace` and clear any child params the key owns.
 */
export function useUrlEnum<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T
): [T, (next: T) => void] {
  const { searchParams, setParams } = useUrlParams();
  const value = readEnumParam(searchParams, key, allowed, fallback);
  const setValue = useCallback(
    (next: T) =>
      setParams(patchWithChildrenCleared(key, next), { history: "replace" }),
    [setParams, key]
  );

  return [value, setValue];
}

/**
 * Bind the single `modal` param (+ optional `modalId`) to the URL. Opening
 * pushes one history entry (Back closes the modal); closing replaces it so no
 * extra entry accumulates.
 */
export function useModalParam(): {
  modal: string | null;
  modalId: string | null;
  openModal: (name: string, id?: string) => void;
  closeModal: () => void;
} {
  const { searchParams, setParams } = useUrlParams();
  const modal = readStringParam(searchParams, "modal");
  const modalId = readStringParam(searchParams, "modalId");

  const openModal = useCallback(
    (name: string, id?: string) =>
      setParams({ modal: name, modalId: id ?? null }, { history: "push" }),
    [setParams]
  );
  const closeModal = useCallback(
    () => setParams({ modal: null, modalId: null }, { history: "replace" }),
    [setParams]
  );

  return { modal, modalId, openModal, closeModal };
}
