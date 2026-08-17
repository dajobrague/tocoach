import type { RecipeFolder } from "../folder-tree";
import type { RecipeListItem } from "../recipe-query";

import { describe, expect, it } from "vitest";

import {
  folderNodes,
  folderPath,
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
