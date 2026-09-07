import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { createFolderRouteHandlers } from "@/lib/library/folder-routes";
import { FolderService } from "@/lib/library/folder-service";
import { guardRecipeRequest } from "@/lib/nutrition/recipes/recipe-request";

// PATCH /api/recipe-folders/[folderId] — rename and/or move (parent_id;
// null = root, cycles rejected). DELETE removes the folder: subfolders and
// recipes float to the root.
export const { PATCH, DELETE } = createFolderRouteHandlers({
  guard: async () => {
    const guard = await guardRecipeRequest();

    return guard.ok
      ? { ok: true, tenantHost: guard.session.tenant_host }
      : guard;
  },
  createService: () =>
    new FolderService(createSupabaseClient(), { table: "recipe_folders" }),
  logTag: "[RecipeFolders]",
});
