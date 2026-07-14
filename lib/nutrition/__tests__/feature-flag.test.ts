import type { SupabaseClient } from "@supabase/supabase-js";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  isNutritionV2Enabled,
  isNutritionV2TrainerEnabled,
} from "../feature-flag";

/** Minimal chainable stub of the Supabase query builder used by the accessor. */
function stubClient(result: { data: unknown; error: unknown }): SupabaseClient {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => result,
  };

  return { from: () => builder } as unknown as SupabaseClient;
}

describe("isNutritionV2Enabled — non-production", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns true in development without querying", async () => {
    vi.stubEnv("NODE_ENV", "development");

    // A client that throws if touched — proves no DB query happens.
    const trap = {
      from: () => {
        throw new Error("should not query in development");
      },
    } as unknown as SupabaseClient;

    expect(await isNutritionV2Enabled("acme.tenant", trap)).toBe(true);
  });
});

describe("isNutritionV2Enabled — production path", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

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

describe("isNutritionV2TrainerEnabled — production path", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is true when only the trainer flag is set (prepare phase)", async () => {
    const client = stubClient({
      data: { nutrition_v2_enabled: false, nutrition_v2_trainer_enabled: true },
      error: null,
    });

    expect(await isNutritionV2TrainerEnabled("acme.tenant", client)).toBe(true);
  });

  it("is true for a fully-flipped tenant (client flag implies trainer tools)", async () => {
    const client = stubClient({
      data: { nutrition_v2_enabled: true, nutrition_v2_trainer_enabled: false },
      error: null,
    });

    expect(await isNutritionV2TrainerEnabled("acme.tenant", client)).toBe(true);
  });

  it("is false when both flags are off", async () => {
    const client = stubClient({
      data: {
        nutrition_v2_enabled: false,
        nutrition_v2_trainer_enabled: false,
      },
      error: null,
    });

    expect(await isNutritionV2TrainerEnabled("acme.tenant", client)).toBe(
      false
    );
  });

  it("fails closed on a query error or missing tenant", async () => {
    expect(
      await isNutritionV2TrainerEnabled(
        "acme.tenant",
        stubClient({ data: null, error: { message: "boom" } })
      )
    ).toBe(false);
    expect(
      await isNutritionV2TrainerEnabled(
        "acme.tenant",
        stubClient({ data: null, error: null })
      )
    ).toBe(false);
  });
});

describe("isNutritionV2TrainerEnabled — non-production", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns true in development without querying", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const trap = {
      from: () => {
        throw new Error("should not query in development");
      },
    } as unknown as SupabaseClient;

    expect(await isNutritionV2TrainerEnabled("acme.tenant", trap)).toBe(true);
  });
});
