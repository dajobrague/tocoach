import { describe, expect, it } from "vitest";

import {
  MAX_TAG_LENGTH,
  MAX_TAGS,
  parseTagParams,
  parseTags,
} from "../parse-tags";

describe("parseTags", () => {
  it("returns undefined when the field is absent (leave the column alone)", () => {
    expect(parseTags(undefined)).toBeUndefined();
  });

  it("trims, drops blanks and keeps one spelling per tag (first wins)", () => {
    expect(parseTags([" Pectoral ", "", "pectoral", "barra"])).toEqual({
      ok: true,
      tags: ["Pectoral", "barra"],
    });
  });

  it("rejects non-arrays and non-string entries", () => {
    expect(parseTags("pectoral")?.ok).toBe(false);
    expect(parseTags(["ok", 3])?.ok).toBe(false);
  });

  it("rejects over-long tags and over-long lists", () => {
    expect(parseTags(["x".repeat(MAX_TAG_LENGTH + 1)])?.ok).toBe(false);
    expect(
      parseTags(Array.from({ length: MAX_TAGS + 1 }, (_, i) => `t${i}`))?.ok
    ).toBe(false);
    expect(parseTags(["x".repeat(MAX_TAG_LENGTH)])?.ok).toBe(true);
  });
});

describe("parseTagParams", () => {
  it("reads repeated ?tag= values, trimmed and non-empty", () => {
    const params = new URLSearchParams("tag=pectoral&tag=%20barra%20&tag=");

    expect(parseTagParams(params)).toEqual(["pectoral", "barra"]);
  });
});
