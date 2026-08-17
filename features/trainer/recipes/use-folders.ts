"use client";

import type { RecipeFolder } from "./folder-tree";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const FOLDERS_KEY = ["recipe-folders"];
const BASE = "/api/recipe-folders";

async function readEnvelope<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);

  if (response.ok === false || data?.success !== true) {
    throw new Error(data?.error ?? "Error de red");
  }

  return data.data as T;
}

async function fetchFolders(): Promise<RecipeFolder[]> {
  return fetch(BASE, { credentials: "same-origin", cache: "no-store" }).then(
    readEnvelope<RecipeFolder[]>
  );
}

function sendJson<T>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: Record<string, unknown>
): Promise<T> {
  return fetch(url, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }).then(readEnvelope<T>);
}

export function useRecipeFolders() {
  return useQuery<RecipeFolder[]>({
    queryKey: FOLDERS_KEY,
    queryFn: fetchFolders,
  });
}

export function useFolderMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: FOLDERS_KEY });
    // Renames retag recipes server-side, so recipe lists must refetch too.
    qc.invalidateQueries({ queryKey: ["recipes"] });
  };

  const createM = useMutation({
    mutationFn: (input: { name: string; parentId: string | null }) =>
      sendJson<RecipeFolder>(BASE, "POST", {
        name: input.name,
        parent_id: input.parentId,
      }),
    onSuccess: invalidate,
  });
  const renameM = useMutation({
    mutationFn: (input: { folderId: string; name: string }) =>
      sendJson<RecipeFolder>(`${BASE}/${input.folderId}`, "PATCH", {
        name: input.name,
      }),
    onSuccess: invalidate,
  });
  const moveM = useMutation({
    mutationFn: (input: { folderId: string; parentId: string | null }) =>
      sendJson<RecipeFolder>(`${BASE}/${input.folderId}`, "PATCH", {
        parent_id: input.parentId,
      }),
    onSuccess: invalidate,
  });
  const deleteM = useMutation({
    mutationFn: (folderId: string) =>
      sendJson<unknown>(`${BASE}/${folderId}`, "DELETE"),
    onSuccess: invalidate,
  });

  return { createM, renameM, moveM, deleteM };
}
