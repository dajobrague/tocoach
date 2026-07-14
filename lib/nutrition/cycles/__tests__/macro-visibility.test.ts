import { describe, expect, it } from "vitest";

import { shouldShowMacrosToClient } from "../macro-visibility";

describe("shouldShowMacrosToClient", () => {
  it("defaults to showing macros (no per-client setting exists yet)", () => {
    // This slice deliberately does NOT add a schema field; the single gate
    // returns the default. When the real "show macros to client" setting lands,
    // this is the one place that changes — see macro-visibility.ts.
    expect(shouldShowMacrosToClient()).toBe(true);
  });
});
