import type { RecipeListItem } from "./recipe-query";

import { createFolderTree } from "../library/folder-tree";

export type {
  Folder as RecipeFolder,
  FolderNode,
  FolderSection as RecipeSection,
} from "../library/folder-tree";

/** Recipe folders: a recipe belongs by carrying the folder's name in
 *  meal_type_tags (see features/trainer/library/folder-tree.ts). */
const tree = createFolderTree<RecipeListItem>(
  (recipe) => recipe.meal_type_tags
);

export const {
  folderNodes,
  itemsInFolder: recipesInFolder,
  itemsOutsideFolders: recipesOutsideFolders,
  groupedSections,
  filterByTags,
  folderPath,
  moveTargets,
} = tree;
