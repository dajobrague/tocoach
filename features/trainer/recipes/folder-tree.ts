import type { RecipeListItem } from "./recipe-query";

/** A recipe_folders row as the API returns it. */
export interface RecipeFolder {
  id: string;
  name: string;
  parent_id: string | null;
  position: number;
}

/** A folder card ready to render: its subtree recipe count included. */
export interface FolderNode {
  folder: RecipeFolder;
  children: FolderNode[];
  /** DISTINCT recipes tagged with this folder's tag or any descendant's. */
  recipeCount: number;
}

const norm = (value: string) => value.trim().toLowerCase();

/** Case-insensitive "recipe carries this tag". */
function hasTag(recipe: RecipeListItem, tag: string): boolean {
  const wanted = norm(tag);

  return recipe.meal_type_tags.some((t) => norm(t) === wanted);
}

/**
 * Build the folder tree for one level (`parentId`; null = root), with each
 * node's DISTINCT recipe count across its whole subtree — a recipe tagged
 * with two tags of the same subtree counts once.
 */
export function folderNodes(
  folders: RecipeFolder[],
  recipes: RecipeListItem[],
  parentId: string | null
): FolderNode[] {
  const byParent = new Map<string | null, RecipeFolder[]>();

  for (const folder of folders) {
    const key = folder.parent_id;
    const list = byParent.get(key) ?? [];

    list.push(folder);
    byParent.set(key, list);
  }

  const build = (folder: RecipeFolder): FolderNode => {
    const children = (byParent.get(folder.id) ?? []).map(build);
    const tags = subtreeTags(folder, children);
    const matched = new Set<string>();

    for (const recipe of recipes) {
      if (tags.some((tag) => hasTag(recipe, tag))) matched.add(recipe.id);
    }

    return { folder, children, recipeCount: matched.size };
  };

  return (byParent.get(parentId) ?? [])
    .map(build)
    .sort(
      (a, b) =>
        a.folder.position - b.folder.position ||
        a.folder.name.localeCompare(b.folder.name)
    );
}

function subtreeTags(folder: RecipeFolder, children: FolderNode[]): string[] {
  return [
    folder.name,
    ...children.flatMap((child) => subtreeTags(child.folder, child.children)),
  ];
}

/** The recipes directly in a folder (tagged with ITS tag, not descendants'). */
export function recipesInFolder(
  recipes: RecipeListItem[],
  folder: RecipeFolder
): RecipeListItem[] {
  return recipes.filter((recipe) => hasTag(recipe, folder.name));
}

/**
 * Tags used by recipes that no folder claims (case-insensitive): they render
 * as flat, auto-generated folder cards so nothing the trainer tagged ever
 * disappears from the folder view.
 */
export function looseTags(
  recipes: RecipeListItem[],
  folders: RecipeFolder[]
): { tag: string; count: number }[] {
  const claimed = new Set(folders.map((folder) => norm(folder.name)));
  const counts = new Map<string, { tag: string; count: number }>();

  for (const recipe of recipes) {
    for (const tag of recipe.meal_type_tags) {
      const key = norm(tag);

      if (key.length === 0 || claimed.has(key)) continue;
      const entry = counts.get(key);

      if (entry === undefined) {
        counts.set(key, { tag, count: 1 });
      } else {
        entry.count += 1;
      }
    }
  }

  return [...counts.values()].sort((a, b) => a.tag.localeCompare(b.tag));
}

/** Recipes with no tags at all (the "Sin clasificar" card). */
export function untaggedRecipes(recipes: RecipeListItem[]): RecipeListItem[] {
  return recipes.filter(
    (recipe) =>
      recipe.meal_type_tags.filter((tag) => norm(tag).length > 0).length === 0
  );
}

/** Breadcrumb chain from the root to `folderId` (inclusive). */
export function folderPath(
  folders: RecipeFolder[],
  folderId: string
): RecipeFolder[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const path: RecipeFolder[] = [];
  let current = byId.get(folderId);
  let hops = 0;

  while (current !== undefined && hops < 100) {
    path.unshift(current);
    current =
      current.parent_id !== null ? byId.get(current.parent_id) : undefined;
    hops += 1;
  }

  return path;
}

/** Folders that can host `folderId` (everything but itself + its subtree). */
export function moveTargets(
  folders: RecipeFolder[],
  folderId: string
): RecipeFolder[] {
  const byParent = new Map<string | null, RecipeFolder[]>();

  for (const folder of folders) {
    const list = byParent.get(folder.parent_id) ?? [];

    list.push(folder);
    byParent.set(folder.parent_id, list);
  }

  const excluded = new Set<string>([folderId]);
  const walk = (id: string) => {
    for (const child of byParent.get(id) ?? []) {
      excluded.add(child.id);
      walk(child.id);
    }
  };

  walk(folderId);

  return folders.filter((folder) => excluded.has(folder.id) === false);
}
