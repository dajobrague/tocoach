import type { Folder } from "../folder-tree";

import { describe, expect, it } from "vitest";

import { createFolderTree, folderPath, moveTargets } from "../folder-tree";

/** Program-template shape: `programs.tags` is nullable in the DB. */
interface Template {
  id: string;
  name: string;
  folder_id: string | null;
  tags: string[] | null;
}

const tree = createFolderTree<Template>((template) => template.tags ?? []);

function folder(
  id: string,
  name: string,
  parentId: string | null = null
): Folder {
  return { id, name, parent_id: parentId, position: 0 };
}

function template(
  id: string,
  folderId: string | null,
  tags: string[] | null = []
): Template {
  return { id, name: `Plantilla ${id}`, folder_id: folderId, tags };
}

const FOLDERS: Folder[] = [
  folder("f1", "Hombre"),
  folder("f2", "Tres días", "f1"),
  folder("f3", "Mujer"),
];

const TEMPLATES: Template[] = [
  template("t1", "f1", ["full body"]),
  template("t2", "f2", ["torso", "pierna"]),
  template("t3", "f3", ["cuatro días"]),
  template("t4", null, null),
  // A tag named like a folder is still just a tag: t5 stays at the root.
  template("t5", null, ["Hombre", "full body"]),
  // Folder deleted elsewhere (stale id in the cache) → treated as root.
  template("t6", "gone", []),
];

describe("createFolderTree (folder_id membership)", () => {
  it("counts items across the subtree and nests children", () => {
    const roots = tree.folderNodes(FOLDERS, TEMPLATES, null);
    const hombre = roots.find((node) => node.folder.name === "Hombre");

    // t1 (Hombre) + t2 (Tres días, nested) = 2; t5's tag doesn't count.
    expect(hombre?.itemCount).toBe(2);
    expect(hombre?.children.map((node) => node.folder.name)).toEqual([
      "Tres días",
    ]);
    expect(roots.map((node) => node.folder.name)).toEqual(["Hombre", "Mujer"]);
  });

  it("direct members only, never descendants'", () => {
    expect(tree.itemsInFolder(TEMPLATES, FOLDERS[0]!).map((t) => t.id)).toEqual(
      ["t1"]
    );
  });

  it("root = null folder_id or a folder that no longer exists", () => {
    expect(
      tree.itemsOutsideFolders(TEMPLATES, FOLDERS).map((t) => t.id)
    ).toEqual(["t4", "t5", "t6"]);
  });

  it("filters by tag inside a folder (folder AND tags)", () => {
    const inFolder = tree.itemsInFolder(
      tree.filterByTags(TEMPLATES, ["full body"]),
      FOLDERS[0]!
    );

    expect(inFolder.map((t) => t.id)).toEqual(["t1"]);
  });

  it("groups depth-first, skips empty subtrees, closes with 'Sin carpeta'", () => {
    expect(
      tree
        .groupedSections(FOLDERS, TEMPLATES)
        .map((section) => `${section.depth}:${section.kind}:${section.label}`)
    ).toEqual([
      "0:folder:Hombre",
      "1:folder:Tres días",
      "0:folder:Mujer",
      "0:root:Sin carpeta",
    ]);
    expect(
      tree
        .groupedSections(FOLDERS, [template("x", "f3")])
        .map((section) => section.label)
    ).toEqual(["Mujer"]);
  });
});

describe("folderPath / moveTargets", () => {
  it("builds the breadcrumb and excludes a folder's own subtree", () => {
    expect(folderPath(FOLDERS, "f2").map((f) => f.name)).toEqual([
      "Hombre",
      "Tres días",
    ]);
    expect(moveTargets(FOLDERS, "f1").map((f) => f.name)).toEqual(["Mujer"]);
  });
});
