import type { Folder } from "../folder-tree";

import { describe, expect, it } from "vitest";

import { createFolderTree } from "../folder-tree";

/** Program-template shape: `programs.tags` is nullable in the DB. */
interface Template {
  id: string;
  name: string;
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

const FOLDERS: Folder[] = [
  folder("f1", "Hombre"),
  folder("f2", "Tres días", "f1"),
  folder("f3", "Mujer"),
];

const TEMPLATES: Template[] = [
  { id: "t1", name: "Full body", tags: ["hombre", "full body"] },
  { id: "t2", name: "Torso/pierna", tags: ["Tres días", "torso", "pierna"] },
  { id: "t3", name: "Glúteo", tags: ["Mujer", "cuatro días"] },
  { id: "t4", name: "Sin etiquetas", tags: null },
  { id: "t5", name: "Solo etiqueta", tags: ["full body"] },
];

describe("createFolderTree (program templates)", () => {
  it("counts DISTINCT subtree items, case-insensitively", () => {
    const roots = tree.folderNodes(FOLDERS, TEMPLATES, null);
    const hombre = roots.find((node) => node.folder.name === "Hombre");

    // t1 (hombre) + t2 (Tres días, nested) = 2.
    expect(hombre?.itemCount).toBe(2);
    expect(hombre?.children.map((node) => node.folder.name)).toEqual([
      "Tres días",
    ]);
  });

  it("tags that are not folders leave the template at the root", () => {
    expect(
      tree.itemsOutsideFolders(TEMPLATES, FOLDERS).map((t) => t.id)
    ).toEqual(["t4", "t5"]);
  });

  it("filters by tag inside a folder (folder AND tags)", () => {
    const hombre = FOLDERS[0]!;
    const inFolder = tree.itemsInFolder(
      tree.filterByTags(TEMPLATES, ["full body"]),
      hombre
    );

    expect(inFolder.map((t) => t.id)).toEqual(["t1"]);
  });

  it("groups depth-first and closes with 'Sin carpeta'", () => {
    expect(
      tree
        .groupedSections(FOLDERS, TEMPLATES)
        .map((section) => `${section.depth}:${section.label}`)
    ).toEqual(["0:Hombre", "1:Tres días", "0:Mujer", "0:Sin carpeta"]);
  });
});
