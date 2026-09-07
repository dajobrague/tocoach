import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { createFolderRouteHandlers } from "@/lib/library/folder-routes";
import { FolderService } from "@/lib/library/folder-service";
import { guardRecipeRequest } from "@/lib/nutrition/recipes/recipe-request";

// GET /api/recipe-folders — the tenant's folder hierarchy (flat rows; the
// client builds the tree). POST creates a folder, optionally nested.
export const { GET, POST } = createFolderRouteHandlers({
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
