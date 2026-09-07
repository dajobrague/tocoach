"use client";

import { createFolderHooks } from "../library/use-folders";

export const recipeFolderHooks = createFolderHooks({
  baseUrl: "/api/recipe-folders",
  queryKey: ["recipe-folders"],
  // Renames retag recipes server-side, so recipe lists must refetch too.
  invalidateKeys: [["recipes"]],
});

export const { useFolders: useRecipeFolders, useFolderMutations } =
  recipeFolderHooks;
