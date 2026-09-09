import { describe, expect, it } from "vitest";

import { filterByTags, hasTag, tagSuggestions } from "../tags";

/** Training-shaped item: exercises and program templates carry `tags`. */
interface Tagged {
  id: string;
  tags: string[];
}

const tagsOf = (item: Tagged) => item.tags;

const EXERCISES: Tagged[] = [
  { id: "press", tags: ["Pectoral", "barra", "empuje"] },
  { id: "aperturas", tags: ["pectoral", "mancuernas"] },
  { id: "sentadilla", tags: ["Pierna", "Barra"] },
  { id: "burpee", tags: [] },
];

describe("hasTag", () => {
  it("compares case- and whitespace-insensitively", () => {
    expect(hasTag(["Pectoral "], "pectoral")).toBe(true);
    expect(hasTag(["pierna"], "Pectoral")).toBe(false);
  });
});

describe("filterByTags (JC: home client with barbell + dumbbells)", () => {
  it("keeps items carrying EVERY tag (AND), case-insensitively", () => {
    expect(
      filterByTags(EXERCISES, ["pectoral", "barra"], tagsOf).map((e) => e.id)
    ).toEqual(["press"]);
    expect(
      filterByTags(EXERCISES, ["PECTORAL"], tagsOf).map((e) => e.id)
    ).toEqual(["press", "aperturas"]);
  });

  it("no tags = no filter", () => {
    expect(filterByTags(EXERCISES, [], tagsOf)).toHaveLength(EXERCISES.length);
  });

  it("items without tags never match a tag filter", () => {
    expect(
      filterByTags(EXERCISES, ["barra"], tagsOf).map((e) => e.id)
    ).not.toContain("burpee");
  });
});

describe("tagSuggestions (over the registry)", () => {
  const registry = ["barra", "empuje", "mancuernas", "Pectoral", "Pierna"];

  it("offers matches minus selected; a new name is what Enter would create", () => {
    expect(tagSuggestions(registry, ["barra"], "bar")).toEqual({
      matches: [],
      create: "bar",
    });
    expect(tagSuggestions(registry, [], "P").matches).toEqual([
      "empuje",
      "Pectoral",
      "Pierna",
    ]);
    expect(tagSuggestions(registry, [], "pectoral").create).toBeNull();
    expect(tagSuggestions(registry, ["Pierna"], "pierna").create).toBeNull();
  });
});
