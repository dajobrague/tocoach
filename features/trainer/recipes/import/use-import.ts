"use client";

import type { ImportResult, RecipeCandidate } from "./import-api";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { approveImport, fetchImportCandidates } from "./import-api";

/** Read-only legacy import candidates for the authed trainer. */
export function useImportCandidates() {
  return useQuery<RecipeCandidate[]>({
    queryKey: ["import-candidates"],
    queryFn: fetchImportCandidates,
  });
}

/**
 * Approve + import the selected legacy options. On success the recipe library
 * and the candidate list are invalidated so the newly created recipes show up.
 */
export function useApproveImport() {
  const client = useQueryClient();

  return useMutation<ImportResult, Error, string[]>({
    mutationFn: (optionIds: string[]) => approveImport(optionIds),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["recipes"] });
      client.invalidateQueries({ queryKey: ["import-candidates"] });
    },
  });
}
