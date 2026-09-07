import { describe, expect, it } from "vitest";

import { buildRecipesQuery } from "../recipe-query";

describe("buildRecipesQuery", () => {
  it("returns an empty string when no filters are set", () => {
    expect(buildRecipesQuery({})).toBe("");
  });

  it("maps query -> q, status -> status, each tag -> a repeated tag", () => {
    const qs = buildRecipesQuery({
      query: "oats",
      status: "active",
      tags: ["lunch", "vegan"],
    });

    expect(qs).toContain("q=oats");
    expect(qs).toContain("status=active");
    expect(qs).toContain("tag=lunch&tag=vegan");
    expect(qs.startsWith("?")).toBe(true);
  });

  it("trims and omits blank query and tags", () => {
    expect(buildRecipesQuery({ query: "   " })).toBe("");
    expect(buildRecipesQuery({ tags: ["  "] })).toBe("");
    expect(buildRecipesQuery({ query: "  soup  " })).toBe("?q=soup");
  });

  it("url-encodes values", () => {
    expect(buildRecipesQuery({ query: "a b&c" })).toBe("?q=a+b%26c");
  });
});
