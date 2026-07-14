import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { RecipeService } from "../recipe-service";

import {
  TEST_TENANT_HOST,
  TEST_TRAINER_ID,
  cleanNutritionTestData,
  ensureTestTenant,
  ensureTestTrainer,
} from "@/lib/test/nutrition-test-db";
import { createSupabaseTestClient } from "@/lib/test/supabase-test-client";

const OTHER_TENANT = "some-other-tenant.invalid";

const client = createSupabaseTestClient();
const service = new RecipeService(client);

async function setFlag(value: boolean): Promise<void> {
  const { error } = await client
    .from("tenants")
    .update({ nutrition_v2_enabled: value })
    .eq("host", TEST_TENANT_HOST);

  if (error !== null) {
    throw new Error(`setFlag failed: ${error.message}`);
  }
}

describe("RecipeService (integration, local DB)", () => {
  beforeAll(async () => {
    await ensureTestTenant(client);
    await ensureTestTrainer(client);
    await setFlag(true);
  });

  afterEach(async () => {
    await cleanNutritionTestData(client);
  });

  afterAll(async () => {
    await cleanNutritionTestData(client);
    await setFlag(false);

    const { data } = await client
      .from("recipes")
      .select("id")
      .eq("tenant_host", TEST_TENANT_HOST);

    expect(data ?? []).toHaveLength(0);
  });

  it("supports create → list → getById → update → archive, tenant-scoped", async () => {
    const created = await service.create(TEST_TENANT_HOST, TEST_TRAINER_ID, {
      name: "Test Recipe",
      description: "a test recipe",
      mealTypeTags: ["lunch"],
    });

    expect(created.name).toBe("Test Recipe");
    expect(created.status).toBe("draft");
    expect(created.meal_type_tags).toEqual(["lunch"]);

    const id = created.id;

    // list (and tag filter) sees it for the owning tenant.
    const list = await service.list(TEST_TENANT_HOST, {});

    expect(list.some((r) => r.id === id)).toBe(true);

    const byTag = await service.list(TEST_TENANT_HOST, { mealType: "lunch" });

    expect(byTag.some((r) => r.id === id)).toBe(true);

    // Another tenant can never see it.
    const otherList = await service.list(OTHER_TENANT, {});

    expect(otherList.some((r) => r.id === id)).toBe(false);
    expect(await service.getById(OTHER_TENANT, id)).toBeNull();

    // getById for the owner returns it.
    const got = await service.getById(TEST_TENANT_HOST, id);

    expect(got?.id).toBe(id);

    // update is tenant-scoped.
    const updated = await service.update(TEST_TENANT_HOST, id, {
      name: "Updated Recipe",
      status: "active",
    });

    expect(updated?.name).toBe("Updated Recipe");
    expect(updated?.status).toBe("active");

    // Cross-tenant update is a no-op and never mutates the row.
    const crossUpdate = await service.update(OTHER_TENANT, id, {
      name: "Hacked",
    });

    expect(crossUpdate).toBeNull();

    const stillOwned = await service.getById(TEST_TENANT_HOST, id);

    expect(stillOwned?.name).toBe("Updated Recipe");

    // archive soft-deletes (status only); cross-tenant archive is a no-op.
    expect(await service.archive(OTHER_TENANT, id)).toBeNull();

    const archived = await service.archive(TEST_TENANT_HOST, id);

    expect(archived?.status).toBe("archived");
  });

  it("rejects an empty name on create", async () => {
    await expect(
      service.create(TEST_TENANT_HOST, TEST_TRAINER_ID, { name: "   " })
    ).rejects.toThrow(/name is required/i);
  });
});
