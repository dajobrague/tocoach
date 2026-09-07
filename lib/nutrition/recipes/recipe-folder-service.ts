import type { SupabaseClient } from "@supabase/supabase-js";

import { FolderService } from "@/lib/library/folder-service";

export type { FolderRow as RecipeFolderRow } from "@/lib/library/folder-service";
export {
  FolderConflictError as RecipeFolderConflictError,
  FolderValidationError as RecipeFolderValidationError,
} from "@/lib/library/folder-service";

/** Recipe folders: hierarchy in `recipe_folders`, membership on
 *  `recipes.meal_type_tags` (a folder IS a tag). */
export class RecipeFolderService extends FolderService {
  constructor(client: SupabaseClient) {
    super(client, { table: "recipe_folders", retagRpc: "replace_recipe_tag" });
  }
}
