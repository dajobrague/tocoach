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
 * Recipes outside every folder: none of their tags is a folder name. Plain
 * tags ("vegano") are NOT folders (Sep 2 call, JC), so a recipe tagged only
 * with those lives at the root like an untagged one.
 */
export function recipesOutsideFolders(
  recipes: RecipeListItem[],
  folders: RecipeFolder[]
): RecipeListItem[] {
  return recipes.filter(
    (recipe) => folders.some((folder) => hasTag(recipe, folder.name)) === false
  );
}

/** Recipes carrying EVERY given tag (case-insensitive); no tags = no filter.
 *  Composes with `recipesInFolder` as "folder AND tags" in the folder view. */
export function filterByTags(
  recipes: RecipeListItem[],
  tags: string[]
): RecipeListItem[] {
  return recipes.filter((recipe) => tags.every((tag) => hasTag(recipe, tag)));
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

/** One section of the grouped list view, ordered depth-first so nested
 *  folders follow their parent. */
export interface RecipeSection {
  kind: "folder" | "untagged";
  /** Display heading ("Desayunos", "Sin carpeta"). */
  label: string;
  depth: number;
  recipes: RecipeListItem[];
}

/**
 * Flatten the folder tree into grouped-list sections (depth-first, parents
 * before children). A folder appears only when its subtree holds at least
 * one of the given recipes, so filters/search never leave hollow headings.
 * Recipes with several folder tags appear under each of their folders, and
 * recipes outside every folder close the list as "Sin carpeta".
 */
export function groupedSections(
  folders: RecipeFolder[],
  recipes: RecipeListItem[]
): RecipeSection[] {
  const walk = (nodes: FolderNode[], depth: number): RecipeSection[] =>
    nodes.flatMap((node) => {
      if (node.recipeCount === 0) return [];
      const direct = recipesInFolder(recipes, node.folder);

      return [
        {
          kind: "folder" as const,
          label: node.folder.name,
          depth,
          recipes: direct,
        },
        ...walk(node.children, depth + 1),
      ];
    });

  const sections = walk(folderNodes(folders, recipes, null), 0);
  const untagged = recipesOutsideFolders(recipes, folders);

  if (untagged.length > 0) {
    sections.push({
      kind: "untagged",
      label: "Sin carpeta",
      depth: 0,
      recipes: untagged,
    });
  }

  return sections;
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
