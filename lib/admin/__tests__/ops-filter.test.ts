import { describe, expect, it } from "vitest";

import { MAX_OPS_TRAINERS, parseTrainerFilter } from "../ops-filter";

const A = "b1d1d0c5-8e5a-4067-8deb-1b0e82061be5";
const B = "2ac2c2ab-e69b-430e-b832-536e0f697bc3";

describe("parseTrainerFilter", () => {
  it("treats missing or empty as all trainers", () => {
    expect(parseTrainerFilter(null)).toEqual({ ok: true, ids: null });
    expect(parseTrainerFilter("")).toEqual({ ok: true, ids: null });
    expect(parseTrainerFilter(" , ,")).toEqual({ ok: true, ids: null });
  });

  it("parses, trims, lower-cases and dedupes uuids", () => {
    expect(parseTrainerFilter(` ${A.toUpperCase()} ,${B},${A}`)).toEqual({
      ok: true,
      ids: [A, B],
    });
  });

  it("rejects anything that is not a uuid", () => {
    expect(parseTrainerFilter(`${A},nope`).ok).toBe(false);
    expect(parseTrainerFilter("1").ok).toBe(false);
    expect(parseTrainerFilter(`${A}'); drop table x;--`).ok).toBe(false);
  });

  it("caps the number of trainers", () => {
    const many = Array.from(
      { length: MAX_OPS_TRAINERS + 1 },
      (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`
    ).join(",");

    expect(parseTrainerFilter(many).ok).toBe(false);
  });
});
