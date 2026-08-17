import { describe, expect, it } from "vitest";

import { normalizeProductUrl } from "../product-url";

describe("normalizeProductUrl", () => {
  it("keeps absolute http(s) URLs unchanged", () => {
    expect(normalizeProductUrl("https://tienda.com/x")).toBe(
      "https://tienda.com/x"
    );
    expect(normalizeProductUrl("http://tienda.com/x")).toBe(
      "http://tienda.com/x"
    );
    expect(normalizeProductUrl("HTTPS://tienda.com/x")).toBe(
      "HTTPS://tienda.com/x"
    );
  });

  it("prefixes https:// on scheme-less URLs", () => {
    expect(normalizeProductUrl("www.tienda.com/producto")).toBe(
      "https://www.tienda.com/producto"
    );
    expect(normalizeProductUrl("tienda.com")).toBe("https://tienda.com");
  });

  it("trims whitespace and returns empty for blank input", () => {
    expect(normalizeProductUrl("  www.tienda.com  ")).toBe(
      "https://www.tienda.com"
    );
    expect(normalizeProductUrl("   ")).toBe("");
  });
});
