import type { SupabaseClient } from "@supabase/supabase-js";

import { describe, expect, it } from "vitest";

import { isNutritionV2Enabled } from "../feature-flag";

/** Minimal chainable stub of the Supabase query builder used by the accessor. */
function stubClient(result: { data: unknown; error: unknown }): SupabaseClient {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => result,
  };

  return { from: () => builder } as unknown as SupabaseClient;
}

describe("isNutritionV2Enabled", () => {
  it("returns true when the column is true", async () => {
    const client = stubClient({
      data: { nutrition_v2_enabled: true },
      error: null,
    });

    expect(await isNutritionV2Enabled("acme.tenant", client)).toBe(true);
  });

  it("returns false when the column is false", async () => {
    const client = stubClient({
      data: { nutrition_v2_enabled: false },
      error: null,
    });

    expect(await isNutritionV2Enabled("acme.tenant", client)).toBe(false);
  });

  it("returns false when the row is missing", async () => {
    const client = stubClient({ data: null, error: null });

    expect(await isNutritionV2Enabled("missing.tenant", client)).toBe(false);
  });

  it("returns false on a query error", async () => {
    const client = stubClient({
      data: null,
      error: { message: "column does not exist" },
    });

    expect(await isNutritionV2Enabled("acme.tenant", client)).toBe(false);
  });

  it("returns false when the column is absent or null", async () => {
    const client = stubClient({ data: {}, error: null });

    expect(await isNutritionV2Enabled("acme.tenant", client)).toBe(false);
  });
});
