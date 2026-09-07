"use client";

import type { Folder } from "./folder-tree";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getJson, sendJson } from "./fetch-json";

export interface FolderHooksConfig {
  /** REST base, e.g. "/api/recipe-folders" (GET/POST; PATCH/DELETE on /[id]). */
  baseUrl: string;
  queryKey: string[];
  /** Item lists to refetch after a mutation: deleting a folder floats its
   *  items to the root (FK ON DELETE SET NULL). */
  invalidateKeys: string[][];
}

/**
 * react-query hooks for one folders endpoint. Each library binds its own
 * (`createFolderHooks({ baseUrl: "/api/program-folders", ... })`) so the
 * folder browser stays shared while caches stay separate.
 */
export function createFolderHooks(config: FolderHooksConfig) {
  const fetchFolders = (): Promise<Folder[]> =>
    getJson<Folder[]>(config.baseUrl);

  function useFolders() {
    return useQuery<Folder[]>({
      queryKey: config.queryKey,
      queryFn: fetchFolders,
    });
  }

  function useFolderMutations() {
    const qc = useQueryClient();
    const invalidate = () => {
      qc.invalidateQueries({ queryKey: config.queryKey });
      for (const key of config.invalidateKeys) {
        qc.invalidateQueries({ queryKey: key });
      }
    };

    const createM = useMutation({
      mutationFn: (input: { name: string; parentId: string | null }) =>
        sendJson<Folder>(config.baseUrl, "POST", {
          name: input.name,
          parent_id: input.parentId,
        }),
      onSuccess: invalidate,
    });
    const renameM = useMutation({
      mutationFn: (input: { folderId: string; name: string }) =>
        sendJson<Folder>(`${config.baseUrl}/${input.folderId}`, "PATCH", {
          name: input.name,
        }),
      onSuccess: invalidate,
    });
    const moveM = useMutation({
      mutationFn: (input: { folderId: string; parentId: string | null }) =>
        sendJson<Folder>(`${config.baseUrl}/${input.folderId}`, "PATCH", {
          parent_id: input.parentId,
        }),
      onSuccess: invalidate,
    });
    const deleteM = useMutation({
      mutationFn: (folderId: string) =>
        sendJson<unknown>(`${config.baseUrl}/${folderId}`, "DELETE"),
      onSuccess: invalidate,
    });

    return { createM, renameM, moveM, deleteM };
  }

  return { useFolders, useFolderMutations };
}

export type FolderHooks = ReturnType<typeof createFolderHooks>;
