import type { RecipeFolder } from "../folder-tree";
import type { RecipeListItem } from "../recipe-query";

import { describe, expect, it } from "vitest";

import {
  folderNodes,
  folderPath,
  groupedSections,
  looseTags,
  moveTargets,
  recipesInFolder,
  untaggedRecipes,
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
    expect(desayunos?.recipeCount).toBe(3);
  });

  it("matches tags case-insensitively", () => {
    const roots = folderNodes(FOLDERS, RECIPES, null);
    const desayunos = roots.find((n) => n.folder.name === "Desayunos");
    const dulces = desayunos?.children.find((n) => n.folder.name === "Dulces");

    // r2 ("Dulces") + r3 ("dulces") both match.
    expect(dulces?.recipeCount).toBe(2);
  });
});

describe("recipesInFolder", () => {
  it("returns only direct members, not descendants'", () => {
    const inDesayunos = recipesInFolder(RECIPES, FOLDERS[0]!);

    expect(inDesayunos.map((r) => r.id)).toEqual(["r1"]);
  });
});

describe("looseTags", () => {
  it("lists tags no folder claims, with counts", () => {
    expect(looseTags(RECIPES, FOLDERS)).toEqual([{ tag: "Verano", count: 1 }]);
  });
});

describe("untaggedRecipes", () => {
  it("returns recipes without any tag", () => {
    expect(untaggedRecipes(RECIPES).map((r) => r.id)).toEqual(["r6"]);
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
  it("orders depth-first, then loose tags, then untagged", () => {
    const sections = groupedSections(FOLDERS, RECIPES);

    expect(
      sections.map((s) => ({ label: s.label, depth: s.depth, kind: s.kind }))
    ).toEqual([
      { label: "Cenas", depth: 0, kind: "folder" },
      { label: "Desayunos", depth: 0, kind: "folder" },
      { label: "Dulces", depth: 1, kind: "folder" },
      { label: "Salados", depth: 1, kind: "folder" },
      { label: "Verano", depth: 0, kind: "loose" },
      { label: "Sin carpeta", depth: 0, kind: "untagged" },
    ]);
  });

  it("puts each recipe under every folder it belongs to", () => {
    const sections = groupedSections(FOLDERS, RECIPES);
    const dulces = sections.find((s) => s.label === "Dulces");
    const salados = sections.find((s) => s.label === "Salados");

    // r3 carries both tags → appears in both groups.
    expect(dulces?.recipes.map((r) => r.id)).toContain("r3");
    expect(salados?.recipes.map((r) => r.id)).toContain("r3");
  });

  it("skips folders whose subtree holds none of the given recipes", () => {
    const onlyCenas = RECIPES.filter((r) => r.id === "r4");
    const sections = groupedSections(FOLDERS, onlyCenas);

    expect(sections.map((s) => s.label)).toEqual(["Cenas"]);
  });

  it("closes with the untagged section when untagged recipes exist", () => {
    const sections = groupedSections(FOLDERS, RECIPES);
    const last = sections[sections.length - 1];

    expect(last?.kind).toBe("untagged");
    expect(last?.recipes.map((r) => r.id)).toEqual(["r6"]);
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
