import type { RecipeFolder } from "../folder-tree";
import type { RecipeListItem } from "../recipe-query";

import { describe, expect, it } from "vitest";

import {
  filterByTags,
  folderNodes,
  folderPath,
  groupedSections,
  moveTargets,
  recipesInFolder,
  recipesOutsideFolders,
} from "../folder-tree";

function recipe(id: string, tags: string[]): RecipeListItem {
  return {
    id,
    name: `Receta ${id}`,
    status: "active",
    meal_type_tags: tags,
    kcal: 100,
    protein_g: 10,
    carbs_g: 10,
    fat_g: 5,
  };
}

function folder(
  id: string,
  name: string,
  parentId: string | null = null
): RecipeFolder {
  return { id, name, parent_id: parentId, position: 0 };
}

const FOLDERS: RecipeFolder[] = [
  folder("f1", "Desayunos"),
  folder("f2", "Dulces", "f1"),
  folder("f3", "Salados", "f1"),
  folder("f4", "Cenas"),
];

const RECIPES: RecipeListItem[] = [
  recipe("r1", ["Desayunos"]),
  recipe("r2", ["Dulces"]),
  recipe("r3", ["dulces", "Salados"]),
  recipe("r4", ["Cenas"]),
  recipe("r5", ["Verano"]),
  recipe("r6", []),
];

describe("folderNodes", () => {
  it("nests children under their parent", () => {
    const roots = folderNodes(FOLDERS, RECIPES, null);

    expect(roots.map((n) => n.folder.name)).toEqual(["Cenas", "Desayunos"]);
    const desayunos = roots.find((n) => n.folder.name === "Desayunos");

    expect(desayunos?.children.map((n) => n.folder.name)).toEqual([
      "Dulces",
      "Salados",
    ]);
  });

  it("counts DISTINCT subtree recipes (multi-tag recipes count once)", () => {
    const roots = folderNodes(FOLDERS, RECIPES, null);
    const desayunos = roots.find((n) => n.folder.name === "Desayunos");

    // r1 (Desayunos) + r2 (Dulces) + r3 (dulces+Salados, counted once) = 3.
    expect(desayunos?.itemCount).toBe(3);
  });

  it("matches tags case-insensitively", () => {
    const roots = folderNodes(FOLDERS, RECIPES, null);
    const desayunos = roots.find((n) => n.folder.name === "Desayunos");
    const dulces = desayunos?.children.find((n) => n.folder.name === "Dulces");

    // r2 ("Dulces") + r3 ("dulces") both match.
    expect(dulces?.itemCount).toBe(2);
  });
});

describe("recipesInFolder", () => {
  it("returns only direct members, not descendants'", () => {
    const inDesayunos = recipesInFolder(RECIPES, FOLDERS[0]!);

    expect(inDesayunos.map((r) => r.id)).toEqual(["r1"]);
  });
});

describe("recipesOutsideFolders", () => {
  it("returns recipes with no folder tag (plain tags are not folders)", () => {
    // r5 only carries "Verano", which is a tag but not a folder.
    expect(recipesOutsideFolders(RECIPES, FOLDERS).map((r) => r.id)).toEqual([
      "r5",
      "r6",
    ]);
  });
});

describe("filterByTags", () => {
  it("keeps recipes carrying EVERY tag, case-insensitively", () => {
    expect(filterByTags(RECIPES, ["DULCES"]).map((r) => r.id)).toEqual([
      "r2",
      "r3",
    ]);
    expect(
      filterByTags(RECIPES, ["dulces", "salados"]).map((r) => r.id)
    ).toEqual(["r3"]);
    expect(filterByTags(RECIPES, [])).toHaveLength(RECIPES.length);
  });

  it("composes with recipesInFolder as folder AND tags", () => {
    const library = [
      recipe("v1", ["Desayunos", "vegano"]),
      recipe("v2", ["Desayunos"]),
      recipe("v3", ["Cenas", "vegano"]),
    ];
    const veganBreakfasts = recipesInFolder(
      filterByTags(library, ["vegano"]),
      FOLDERS[0]!
    );

    expect(veganBreakfasts.map((r) => r.id)).toEqual(["v1"]);
  });
});

describe("folderPath", () => {
  it("builds the breadcrumb from root to the folder", () => {
    expect(folderPath(FOLDERS, "f2").map((f) => f.name)).toEqual([
      "Desayunos",
      "Dulces",
    ]);
  });
});

describe("groupedSections", () => {
  it("orders depth-first, then recipes outside every folder", () => {
    const sections = groupedSections(FOLDERS, RECIPES);

    expect(
      sections.map((s) => ({ label: s.label, depth: s.depth, kind: s.kind }))
    ).toEqual([
      { label: "Cenas", depth: 0, kind: "folder" },
      { label: "Desayunos", depth: 0, kind: "folder" },
      { label: "Dulces", depth: 1, kind: "folder" },
      { label: "Salados", depth: 1, kind: "folder" },
      { label: "Sin carpeta", depth: 0, kind: "untagged" },
    ]);
  });

  it("puts each recipe under every folder it belongs to", () => {
    const sections = groupedSections(FOLDERS, RECIPES);
    const dulces = sections.find((s) => s.label === "Dulces");
    const salados = sections.find((s) => s.label === "Salados");

    // r3 carries both tags → appears in both groups.
    expect(dulces?.items.map((r) => r.id)).toContain("r3");
    expect(salados?.items.map((r) => r.id)).toContain("r3");
  });

  it("skips folders whose subtree holds none of the given recipes", () => {
    const onlyCenas = RECIPES.filter((r) => r.id === "r4");
    const sections = groupedSections(FOLDERS, onlyCenas);

    expect(sections.map((s) => s.label)).toEqual(["Cenas"]);
  });

  it("closes with 'Sin carpeta' holding tag-only and untagged recipes", () => {
    const sections = groupedSections(FOLDERS, RECIPES);
    const last = sections[sections.length - 1];

    expect(last?.kind).toBe("untagged");
    // r5 ("Verano" is a plain tag, not a folder) + r6 (no tags).
    expect(last?.items.map((r) => r.id)).toEqual(["r5", "r6"]);
  });
});

describe("moveTargets", () => {
  it("excludes the folder itself and its whole subtree", () => {
    expect(moveTargets(FOLDERS, "f1").map((f) => f.name)).toEqual(["Cenas"]);
  });

  it("lets a leaf move anywhere else", () => {
    expect(moveTargets(FOLDERS, "f4").map((f) => f.name)).toEqual([
      "Desayunos",
      "Dulces",
      "Salados",
    ]);
  });
});
