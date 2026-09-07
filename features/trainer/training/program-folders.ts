"use client";

import { createFolderHooks } from "../library/use-folders";

export const programFolderHooks = createFolderHooks({
  baseUrl: "/api/program-folders",
  queryKey: ["program-folders"],
  // Renames retag templates server-side, so the templates list must refetch.
  invalidateKeys: [["templates"]],
});

export const { useFolders: useProgramFolders } = programFolderHooks;
