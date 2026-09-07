import { filterByTags, hasTag } from "./tags";

/** A folders-table row (recipe_folders, program_folders) as the API returns it. */
export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  position: number;
}

/** A folder card ready to render: its subtree item count included. */
export interface FolderNode {
  folder: Folder;
  children: FolderNode[];
  /** DISTINCT items tagged with this folder's tag or any descendant's. */
  itemCount: number;
}

/** One section of the grouped list view, ordered depth-first so nested
 *  folders follow their parent. */
export interface FolderSection<T> {
  kind: "folder" | "untagged";
  /** Display heading ("Desayunos", "Sin carpeta"). */
  label: string;
  depth: number;
  items: T[];
}

/** Breadcrumb chain from the root to `folderId` (inclusive). */
export function folderPath(folders: Folder[], folderId: string): Folder[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const path: Folder[] = [];
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
export function moveTargets(folders: Folder[], folderId: string): Folder[] {
  const byParent = groupByParent(folders);
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

function groupByParent(folders: Folder[]): Map<string | null, Folder[]> {
  const byParent = new Map<string | null, Folder[]>();

  for (const folder of folders) {
    const list = byParent.get(folder.parent_id) ?? [];

    list.push(folder);
    byParent.set(folder.parent_id, list);
  }

  return byParent;
}

function subtreeTags(folder: Folder, children: FolderNode[]): string[] {
  return [
    folder.name,
    ...children.flatMap((child) => subtreeTags(child.folder, child.children)),
  ];
}

/**
 * Folder logic bound to one item shape. A folder IS a tag: an item belongs
 * by carrying the folder's name in `tagsOf(item)` (case-insensitive), and
 * only the hierarchy lives in the folders table. Plain tags are NOT folders
 * (Sep 2 call, JC): items tagged only with those live at the root.
 */
export function createFolderTree<T extends { id: string }>(
  tagsOf: (item: T) => readonly string[]
) {
  /** The items directly in a folder (tagged with ITS tag, not descendants'). */
  const itemsInFolder = (items: T[], folder: Folder): T[] =>
    items.filter((item) => hasTag(tagsOf(item), folder.name));

  /** Items outside every folder: none of their tags is a folder name. */
  const itemsOutsideFolders = (items: T[], folders: Folder[]): T[] =>
    items.filter(
      (item) =>
        folders.some((folder) => hasTag(tagsOf(item), folder.name)) === false
    );

  /**
   * Build the folder tree for one level (`parentId`; null = root), with each
   * node's DISTINCT item count across its whole subtree — an item tagged
   * with two tags of the same subtree counts once.
   */
  const folderNodes = (
    folders: Folder[],
    items: T[],
    parentId: string | null
  ): FolderNode[] => {
    const byParent = groupByParent(folders);
    const build = (folder: Folder): FolderNode => {
      const children = (byParent.get(folder.id) ?? []).map(build);
      const tags = subtreeTags(folder, children);
      const matched = new Set<string>();

      for (const item of items) {
        if (tags.some((tag) => hasTag(tagsOf(item), tag))) matched.add(item.id);
      }

      return { folder, children, itemCount: matched.size };
    };

    return (byParent.get(parentId) ?? [])
      .map(build)
      .sort(
        (a, b) =>
          a.folder.position - b.folder.position ||
          a.folder.name.localeCompare(b.folder.name)
      );
  };

  /**
   * Flatten the folder tree into grouped-list sections (depth-first, parents
   * before children). A folder appears only when its subtree holds at least
   * one of the given items, so filters/search never leave hollow headings.
   * Items with several folder tags appear under each of their folders, and
   * items outside every folder close the list as "Sin carpeta".
   */
  const groupedSections = (
    folders: Folder[],
    items: T[]
  ): FolderSection<T>[] => {
    const walk = (nodes: FolderNode[], depth: number): FolderSection<T>[] =>
      nodes.flatMap((node) => {
        if (node.itemCount === 0) return [];

        return [
          {
            kind: "folder" as const,
            label: node.folder.name,
            depth,
            items: itemsInFolder(items, node.folder),
          },
          ...walk(node.children, depth + 1),
        ];
      });

    const sections = walk(folderNodes(folders, items, null), 0);
    const untagged = itemsOutsideFolders(items, folders);

    if (untagged.length > 0) {
      sections.push({
        kind: "untagged",
        label: "Sin carpeta",
        depth: 0,
        items: untagged,
      });
    }

    return sections;
  };

  return {
    folderNodes,
    itemsInFolder,
    itemsOutsideFolders,
    groupedSections,
    filterByTags: (items: T[], tags: string[]) =>
      filterByTags(items, tags, tagsOf),
    folderPath,
    moveTargets,
  };
}

export type FolderTree<T extends { id: string }> = ReturnType<
  typeof createFolderTree<T>
>;
