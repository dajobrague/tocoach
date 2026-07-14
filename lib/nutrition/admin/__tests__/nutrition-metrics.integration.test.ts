import type { WeeklyLogBucket } from "../metrics-helpers";
import type { NutritionMetrics } from "../nutrition-metrics";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { MealCycleService } from "../../cycles/meal-cycle-service";
import { computeNutritionMetrics } from "../nutrition-metrics";

import { RecipeService } from "@/lib/nutrition/recipes/recipe-service";
import {
  TEST_CLIENT_ID,
  TEST_TENANT_HOST,
  TEST_TRAINER_ID,
  cleanNutritionTestData,
  ensureTestClient,
  ensureTestTenant,
  ensureTestTrainer,
  removeTestClient,
} from "@/lib/test/nutrition-test-db";
import { createSupabaseTestClient } from "@/lib/test/supabase-test-client";

/**
 * Cross-tenant metrics run platform-wide, so the local DB may hold unrelated
 * rows. We assert the DELTA the seeded data introduces (baseline → after),
 * which is robust to pre-existing data while still exercising the real
 * service-role query end-to-end.
 */

const db = createSupabaseTestClient();
const recipes = new RecipeService(db);
const cycles = new MealCycleService(db);

// Fixed anchor so the weekly window is deterministic. 2026-06-03 is a Wednesday
// → its week starts Monday 2026-06-01; the prior week starts 2026-05-25.
const NOW = new Date("2026-06-03T12:00:00.000Z");
const WEEKS = 12;
const WEEK_THIS = "2026-06-01";
const WEEK_PRIOR = "2026-05-25";
const SEEDED_RECIPES = 3; // lands in the "1–5" distribution bucket

function weekOf(metrics: NutritionMetrics, weekStart: string): WeeklyLogBucket {
  const bucket = metrics.logging.weeks.find((w) => w.weekStart === weekStart);

  if (bucket === undefined) {
    throw new Error(`week ${weekStart} not in the metrics window`);
  }

  return bucket;
}

function bucket(metrics: NutritionMetrics, label: string): number {
  return (
    metrics.library.distribution.find((b) => b.label === label)?.trainers ?? 0
  );
}

async function setFlag(enabled: boolean): Promise<void> {
  const { error } = await db
    .from("tenants")
    .update({ nutrition_v2_enabled: enabled })
    .eq("host", TEST_TENANT_HOST);

  if (error !== null) {
    throw new Error(`setFlag failed: ${error.message}`);
  }
}

describe("computeNutritionMetrics (integration, local DB)", () => {
  beforeAll(async () => {
    await ensureTestTenant(db);
    await ensureTestTrainer(db);
    await ensureTestClient(db);
  });

  beforeEach(async () => {
    await cleanNutritionTestData(db);
    await setFlag(false);
  });

  afterAll(async () => {
    await cleanNutritionTestData(db);
    await setFlag(false);
    await removeTestClient(db);
  });

  it("reflects seeded adoption, library depth and weekly logging as deltas", async () => {
    // Baseline with the test tenant flag OFF and no test nutrition data.
    const before = await computeNutritionMetrics(db, {
      now: NOW,
      weeks: WEEKS,
    });

    // --- Seed: enable the flag, add recipes, a cycle, and meal logs. ---
    await setFlag(true);

    for (let i = 0; i < SEEDED_RECIPES; i++) {
      await recipes.create(TEST_TENANT_HOST, TEST_TRAINER_ID, {
        name: `Metrics recipe ${i}`,
      });
    }

    const cycle = await cycles.create(TEST_TENANT_HOST, {
      trainerId: TEST_TRAINER_ID,
      clientId: TEST_CLIENT_ID,
      name: "Metrics cycle",
      durationDays: 1,
    });
    const slot = await cycles.addSlot(TEST_TENANT_HOST, cycle.id, {
      dayIndex: 0,
      label: "Desayuno",
    });

    // Two logs in the current week, one in the prior week (same client).
    const { error: logError } = await db.from("meal_logs").insert([
      {
        tenant_host: TEST_TENANT_HOST,
        client_id: TEST_CLIENT_ID,
        slot_id: slot!.id,
        log_date: "2026-06-01",
        status: "eaten_planned",
      },
      {
        tenant_host: TEST_TENANT_HOST,
        client_id: TEST_CLIENT_ID,
        slot_id: slot!.id,
        log_date: "2026-06-02",
        status: "eaten_planned",
      },
      {
        tenant_host: TEST_TENANT_HOST,
        client_id: TEST_CLIENT_ID,
        slot_id: slot!.id,
        log_date: "2026-05-26",
        status: "skipped",
      },
    ]);

    expect(logError).toBeNull();

    const after = await computeNutritionMetrics(db, { now: NOW, weeks: WEEKS });

    // --- Adoption: the test trainer is now both enabled and using. ---
    expect(after.adoption.enabledCount - before.adoption.enabledCount).toBe(1);
    expect(after.adoption.usingCount - before.adoption.usingCount).toBe(1);

    // --- Library depth: +3 recipes, +1 active trainer, +1 in the 1–5 band. ---
    expect(after.library.totalRecipes - before.library.totalRecipes).toBe(
      SEEDED_RECIPES
    );
    expect(
      after.library.activeTrainerCount - before.library.activeTrainerCount
    ).toBe(1);
    expect(bucket(after, "1–5") - bucket(before, "1–5")).toBe(1);
    expect(bucket(after, "6–20") - bucket(before, "6–20")).toBe(0);
    expect(bucket(after, "21+") - bucket(before, "21+")).toBe(0);

    // --- Logging: 2 logs land this week, 1 the prior week; +1 client each. ---
    expect(weekOf(after, WEEK_THIS).logs - weekOf(before, WEEK_THIS).logs).toBe(
      2
    );
    expect(
      weekOf(after, WEEK_THIS).distinctClients -
        weekOf(before, WEEK_THIS).distinctClients
    ).toBe(1);
    expect(
      weekOf(after, WEEK_PRIOR).logs - weekOf(before, WEEK_PRIOR).logs
    ).toBe(1);
    expect(after.logging.totalLogs - before.logging.totalLogs).toBe(3);
    expect(after.logging.distinctClients - before.logging.distinctClients).toBe(
      1
    );

    // --- Complaint hook is an explicit, unfabricated stub. ---
    expect(after.complaints.available).toBe(false);
    expect(after.complaints.series).toEqual([]);
    expect(after.complaints.note.length).toBeGreaterThan(0);
  });

  it("window has exactly `weeks` buckets, oldest→newest", async () => {
    const metrics = await computeNutritionMetrics(db, {
      now: NOW,
      weeks: WEEKS,
    });

    expect(metrics.logging.weeks).toHaveLength(WEEKS);
    expect(metrics.logging.weeks[WEEKS - 1]?.weekStart).toBe(WEEK_THIS);
    expect(metrics.windowWeeks).toBe(WEEKS);
  });
});
