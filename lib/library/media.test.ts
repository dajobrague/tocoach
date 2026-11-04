import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MAX_SLUGS, parseMediaQuery } from "./media";

describe("parseMediaQuery", () => {
  it("accepts a valid sex and de-duplicated slugs", () => {
    expect(parseMediaQuery("male", "bench-press,bench-press,clean")).toEqual({
      sex: "male",
      slugs: ["bench-press", "clean"],
    });
  });

  it("defaults to male when no sex is given", () => {
    expect(parseMediaQuery(null, "clean")).toEqual({
      sex: "male",
      slugs: ["clean"],
    });
  });

  it("rejects bad sex, empty, path tricks and bulk requests", () => {
    expect(parseMediaQuery("other", "clean")).toBeNull();
    expect(parseMediaQuery("male", "")).toBeNull();
    expect(parseMediaQuery("male", null)).toBeNull();
    expect(parseMediaQuery("male", "../clean")).toBeNull();
    expect(parseMediaQuery("male", "Clean")).toBeNull();
    const many = Array.from({ length: MAX_SLUGS + 1 }, (_, i) => `s${i}`);

    expect(parseMediaQuery("female", many.join(","))).toBeNull();
  });
});
