import { describe, expect, it } from "vitest";

import {
  resolveVisibleSections,
  sanitizeSections,
} from "../delivery-visibility";

const ALL = { plan: true, pdf: true, goals: true };
const NONE = { plan: false, pdf: false, goals: false };

describe("sanitizeSections", () => {
  it("keeps known sections in canonical order, deduped", () => {
    expect(sanitizeSections(["goals", "plan", "goals"])).toEqual([
      "plan",
      "goals",
    ]);
  });

  it("drops unknown values", () => {
    expect(sanitizeSections(["pdf", "everything", 3, null])).toEqual(["pdf"]);
  });

  it("normalizes empty/invalid input to null (Automático)", () => {
    expect(sanitizeSections([])).toBeNull();
    expect(sanitizeSections(["nope"])).toBeNull();
    expect(sanitizeSections("plan")).toBeNull();
    expect(sanitizeSections(null)).toBeNull();
    expect(sanitizeSections(undefined)).toBeNull();
  });
});

describe("resolveVisibleSections — explicit trainer choice", () => {
  it("shows exactly the chosen sections when they all have data", () => {
    expect(resolveVisibleSections(["pdf", "goals"], ALL)).toEqual([
      "pdf",
      "goals",
    ]);
  });

  it("drops chosen sections whose data is gone", () => {
    expect(
      resolveVisibleSections(["plan", "pdf"], { ...ALL, pdf: false })
    ).toEqual(["plan"]);
  });

  it("hides the plan when the trainer chose goals-only over an active plan", () => {
    expect(resolveVisibleSections(["goals"], ALL)).toEqual(["goals"]);
  });

  it("falls back to the automatic ladder when nothing chosen has data", () => {
    expect(
      resolveVisibleSections(["pdf"], { plan: false, pdf: false, goals: true })
    ).toEqual(["goals"]);
  });
});

describe("resolveVisibleSections — Automático (no choice)", () => {
  it("walks plan → pdf → goals and picks the first with data", () => {
    expect(resolveVisibleSections(null, ALL)).toEqual(["plan"]);
    expect(resolveVisibleSections(null, { ...ALL, plan: false })).toEqual([
      "pdf",
    ]);
    expect(
      resolveVisibleSections(null, { plan: false, pdf: false, goals: true })
    ).toEqual(["goals"]);
  });

  it("returns [] when nothing has data", () => {
    expect(resolveVisibleSections(null, NONE)).toEqual([]);
    expect(resolveVisibleSections(["plan"], NONE)).toEqual([]);
  });
});
