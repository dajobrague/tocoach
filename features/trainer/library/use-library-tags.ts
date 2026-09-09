"use client";

import type {
  LibraryTagKind,
  LibraryTagRow,
  LibraryTagUsage,
} from "@/lib/library/tag-service";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getJson, sendJson } from "./fetch-json";

export type { LibraryTagKind } from "@/lib/library/tag-service";

const BASE_URL = "/api/library-tags";

export const libraryTagsKey = (kind: LibraryTagKind) => ["library-tags", kind];

/** Item lists to refetch after a rename/remove (their arrays changed). */
const ITEM_KEYS: Record<LibraryTagKind, string[][]> = {
  recipe: [["recipes"], ["recipe"]],
  program: [["templates"]],
  exercise: [["trainer", "exercise-library"]],
};

/** The tenant's tag registry for one library, with usage counts. */
export function useLibraryTags(kind: LibraryTagKind) {
  return useQuery<LibraryTagUsage[]>({
    queryKey: libraryTagsKey(kind),
    queryFn: () => getJson<LibraryTagUsage[]>(`${BASE_URL}?kind=${kind}`),
    staleTime: 60_000,
  });
}

/** Registry names for pickers and filters; [] while loading or on error
 *  (tags are a convenience, never a blocker). */
export function useLibraryTagNames(kind: LibraryTagKind): string[] {
  const query = useLibraryTags(kind);

  return query.data?.map((tag) => tag.name) ?? [];
}

export function useLibraryTagMutations(kind: LibraryTagKind) {
  const qc = useQueryClient();
  const invalidateRegistry = () =>
    qc.invalidateQueries({ queryKey: libraryTagsKey(kind) });
  const invalidateItems = () => {
    for (const key of ITEM_KEYS[kind]) qc.invalidateQueries({ queryKey: key });
  };

  const createM = useMutation({
    mutationFn: (name: string) =>
      sendJson<LibraryTagRow>(BASE_URL, "POST", { kind, name }),
    onSuccess: invalidateRegistry,
  });
  const renameM = useMutation({
    mutationFn: (input: { tagId: string; name: string }) =>
      sendJson<LibraryTagRow>(`${BASE_URL}/${input.tagId}`, "PATCH", {
        name: input.name,
      }),
    onSuccess: () => {
      invalidateRegistry();
      invalidateItems();
    },
  });
  const removeM = useMutation({
    mutationFn: (tagId: string) =>
      sendJson<unknown>(`${BASE_URL}/${tagId}`, "DELETE"),
    onSuccess: () => {
      invalidateRegistry();
      invalidateItems();
    },
  });

  return { createM, renameM, removeM };
}
