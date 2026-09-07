import { filterByTags } from "./tags";

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
  /** Items whose folder_id is this folder or any descendant. */
  itemCount: number;
}

/** One section of the grouped list view, ordered depth-first so nested
 *  folders follow their parent. */
export interface FolderSection<T> {
  kind: "folder" | "root";
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

function subtreeIds(node: FolderNode): string[] {
  return [node.folder.id, ...node.children.flatMap(subtreeIds)];
}

/**
 * Folder logic bound to one item shape. An item is in exactly one folder
 * (`folder_id`) or at the root (null — or a folder the tenant no longer
 * has, which the FK sets to null server-side; the client tolerates the
 * stale id meanwhile). Tags are a separate axis: `tagsOf` only feeds the
 * "folder AND tags" filter.
 */
export function createFolderTree<
  T extends { id: string; folder_id: string | null },
>(tagsOf: (item: T) => readonly string[]) {
  /** The items directly in a folder (not its descendants'). */
  const itemsInFolder = (items: T[], folder: Folder): T[] =>
    items.filter((item) => item.folder_id === folder.id);

  /** Items outside every folder. */
  const itemsOutsideFolders = (items: T[], folders: Folder[]): T[] => {
    const known = new Set(folders.map((folder) => folder.id));

    return items.filter(
      (item) => item.folder_id === null || known.has(item.folder_id) === false
    );
  };

  /**
   * Build the folder tree for one level (`parentId`; null = root), with each
   * node's item count across its whole subtree.
   */
  const folderNodes = (
    folders: Folder[],
    items: T[],
    parentId: string | null
  ): FolderNode[] => {
    const byParent = groupByParent(folders);
    const build = (folder: Folder): FolderNode => {
      const children = (byParent.get(folder.id) ?? []).map(build);
      const ids = new Set(subtreeIds({ folder, children, itemCount: 0 }));
      const itemCount = items.filter(
        (item) => item.folder_id !== null && ids.has(item.folder_id)
      ).length;

      return { folder, children, itemCount };
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
   * Items outside every folder close the list as "Sin carpeta".
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
    const root = itemsOutsideFolders(items, folders);

    if (root.length > 0) {
      sections.push({
        kind: "root",
        label: "Sin carpeta",
        depth: 0,
        items: root,
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

export type FolderTree<T extends { id: string; folder_id: string | null }> =
  ReturnType<typeof createFolderTree<T>>;
