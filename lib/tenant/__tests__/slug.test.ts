import { describe, expect, it } from "vitest";

import { slugFormatError, slugify } from "../slug";

describe("slugify", () => {
  it("strips accents and joins words with hyphens", () => {
    expect(slugify("José Peña")).toBe("jose-pena");
    expect(slugify("  Daniel   Muñoz--Coach ")).toBe("daniel-munoz-coach");
    expect(slugify("Ana & Co.")).toBe("ana-co");
  });

  it("never ends in a hyphen after truncation", () => {
    expect(slugify("a".repeat(29) + " b")).toBe("a".repeat(29));
  });
});

describe("slugFormatError", () => {
  it("accepts valid slugs", () => {
    expect(slugFormatError("jose-pena")).toBeNull();
    expect(slugFormatError("abc")).toBeNull();
  });

  it("rejects bad shapes and reserved routes", () => {
    expect(slugFormatError("ab")).not.toBeNull();
    expect(slugFormatError("-abc")).not.toBeNull();
    expect(slugFormatError("muñoz")).not.toBeNull();
    expect(slugFormatError("admin")).toBe("Esta dirección está reservada.");
  });
});
