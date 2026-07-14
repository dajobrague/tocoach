import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { MealCycleService } from "../../cycles/meal-cycle-service";
import { getClientAdherence } from "../adherence-service";
import { setMealLog } from "../meal-log-service";

import {
  TEST_TENANT_HOST,
  TEST_TRAINER_ID,
  cleanNutritionTestData,
  ensureTestTenant,
  ensureTestTrainer,
} from "@/lib/test/nutrition-test-db";
import { createSupabaseTestClient } from "@/lib/test/supabase-test-client";

const OTHER_TRAINER_ID = "00000000-0000-4000-a000-0000000000ff";

const db = createSupabaseTestClient();
const cycles = new MealCycleService(db);

let clientId: number;

async function seedOwnedClient(): Promise<number> {
  // tenant = the trainer's id is how clients are owned (clients.tenant FK).
  const { data, error } = await db
    .from("clients")
    .insert({
      name: "Adherence Test Client",
      email: "adh@nutrition-v2-test.local",
      tenant: TEST_TRAINER_ID,
    })
    .select("id")
    .single();

  if (error !== null) {
    throw new Error(`seedOwnedClient failed: ${error.message}`);
  }

  return (data as { id: number }).id;
}

/** Active 2-day cycle: day 0 has 2 slots, day 1 has 1. Returns a day-0 slot id. */
async function seedActiveCycle(): Promise<string> {
  const cycle = await cycles.create(TEST_TENANT_HOST, {
    trainerId: TEST_TRAINER_ID,
    clientId,
    name: "Ciclo adherencia",
    durationDays: 2,
    startDate: "2026-06-01",
  });
  const slot0a = await cycles.addSlot(TEST_TENANT_HOST, cycle.id, {
    dayIndex: 0,
  });

  await cycles.addSlot(TEST_TENANT_HOST, cycle.id, { dayIndex: 0 });
  await cycles.addSlot(TEST_TENANT_HOST, cycle.id, { dayIndex: 1 });
  await cycles.update(TEST_TENANT_HOST, cycle.id, { status: "active" });

  return slot0a!.id;
}

describe("getClientAdherence (integration, local DB)", () => {
  beforeAll(async () => {
    await ensureTestTenant(db);
    await ensureTestTrainer(db);
    clientId = await seedOwnedClient();
  });

  afterEach(async () => {
    await cleanNutritionTestData(db);
  });

  afterAll(async () => {
    await cleanNutritionTestData(db);
    await db.from("clients").delete().eq("id", clientId);
  });

  it("aggregates planned (from the cycle) vs logged over the range", async () => {
    const slot = await seedActiveCycle();

    await setMealLog(db, clientId, {
      slotId: slot,
      logDate: "2026-06-01",
      status: "eaten_planned",
    });

    const result = await getClientAdherence(db, {
      trainerId: TEST_TRAINER_ID,
      clientId,
      from: "2026-06-01",
      to: "2026-06-02",
    });

    // Day 0 has 2 planned slots, day 1 has 1 → 3 planned; 1 eaten_planned log.
    expect(result?.report.totals).toEqual({
      planned: 3,
      logged: 1,
      engagementPct: 33,
      adherencePct: 33,
    });
    expect(result?.report.statusBreakdown.eaten_planned).toBe(1);
    expect(result?.report.days).toHaveLength(2);
    expect(result?.report.days[0]).toEqual({
      date: "2026-06-01",
      planned: 2,
      logged: 1,
      engagementPct: 50,
      adherencePct: 50,
    });
    // The raw logs are returned too, for the trainer to see photos + comments.
    expect(result?.logs).toHaveLength(1);
    expect(result?.logs[0]?.status).toBe("eaten_planned");
  });

  it("rejects a trainer who does not own the client (ownership → null)", async () => {
    await seedActiveCycle();

    expect(
      await getClientAdherence(db, {
        trainerId: OTHER_TRAINER_ID,
        clientId,
        from: "2026-06-01",
        to: "2026-06-02",
      })
    ).toBeNull();
  });

  it("returns an all-zero-planned report when the client has no active cycle", async () => {
    const result = await getClientAdherence(db, {
      trainerId: TEST_TRAINER_ID,
      clientId,
      from: "2026-06-01",
      to: "2026-06-02",
    });

    expect(result?.report.totals).toEqual({
      planned: 0,
      logged: 0,
      engagementPct: 0,
      adherencePct: 0,
    });
  });
});
