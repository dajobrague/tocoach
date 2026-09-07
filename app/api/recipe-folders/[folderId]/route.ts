import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { createFolderRouteHandlers } from "@/lib/library/folder-routes";
import { RecipeFolderService } from "@/lib/nutrition/recipes/recipe-folder-service";
import { guardRecipeRequest } from "@/lib/nutrition/recipes/recipe-request";

// PATCH /api/recipe-folders/[folderId] — rename (bulk-retags recipes) and/or
// move (parent_id; null = root, cycles rejected). DELETE removes the folder
// only: children float to the root and recipes keep the tag.
export const { PATCH, DELETE } = createFolderRouteHandlers({
  guard: async () => {
    const guard = await guardRecipeRequest();

    return guard.ok
      ? { ok: true, tenantHost: guard.session.tenant_host }
      : guard;
  },
  createService: () => new RecipeFolderService(createSupabaseClient()),
  logTag: "[RecipeFolders]",
});
