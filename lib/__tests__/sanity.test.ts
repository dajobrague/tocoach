import { describe, expect, it } from "vitest";

describe("test harness sanity", () => {
  it("performs basic arithmetic", () => {
    expect(1 + 1).toBe(2);
  });
});
