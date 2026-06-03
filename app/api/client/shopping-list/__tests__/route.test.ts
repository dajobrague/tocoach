import type { ClientSession } from "@/lib/auth/client-session";
import type { MealCycleTree } from "@/lib/nutrition/cycles/meal-cycle-service";

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/client-session", () => ({ getClientSession: vi.fn() }));
vi.mock("@/lib/nutrition/feature-flag", () => ({
  isNutritionV2Enabled: vi.fn(),
}));
vi.mock("@/lib/tenant/loader", () => ({ loadTenantContext: vi.fn() }));
vi.mock("@/lib/clients/supabase-api", () => ({
  createSupabaseClient: vi.fn(() => ({})),
}));
vi.mock("@/lib/nutrition/cycles/client-cycle-reader", () => ({
  getActiveCycleTreeForClient: vi.fn(),
}));
vi.mock("@/lib/nutrition/cycles/option-selection", () => ({
  getClientSelections: vi.fn(),
}));

import { GET } from "../route";

import { getClientSession } from "@/lib/auth/client-session";
import { getActiveCycleTreeForClient } from "@/lib/nutrition/cycles/client-cycle-reader";
import { getClientSelections } from "@/lib/nutrition/cycles/option-selection";
import { isNutritionV2Enabled } from "@/lib/nutrition/feature-flag";
import { loadTenantContext } from "@/lib/tenant/loader";

const mockedSession = vi.mocked(getClientSession);
const mockedFlag = vi.mocked(isNutritionV2Enabled);
const mockedTenant = vi.mocked(loadTenantContext);
const mockedRead = vi.mocked(getActiveCycleTreeForClient);
const mockedSelections = vi.mocked(getClientSelections);

const CLIENT_SESSION: ClientSession = {
  client_id: "999000001",
  tenant_slug: "acme",
  email: "client@example.com",
  iat: 0,
  exp: 0,
};

const ZERO_TOTALS = {
  kcal: 0,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
  sugar_g: 0,
  fiber_g: 0,
  sat_fat_g: 0,
  sodium_mg: 0,
};

function req(query = "?from=2026-06-01&to=2026-06-07"): NextRequest {
  return new NextRequest(`http://localhost/api/client/shopping-list${query}`);
}

/** A 1-day cycle whose only slot has two options (optB is first by position). */
function tree(): MealCycleTree {
  return {
    id: "cycle-1",
    tenant_host: "acme.tenant",
    trainer_id: "trainer-1",
    client_id: 999000001,
    name: "Plan",
    duration_days: 1,
    start_date: "2026-06-01",
    status: "active",
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    slots: [
      {
        id: "slot-1",
        cycle_id: "cycle-1",
        tenant_host: "acme.tenant",
        day_index: 0,
        label: "Desayuno",
        position: 0,
        created_at: "2026-06-01T00:00:00Z",
        updated_at: "2026-06-01T00:00:00Z",
        options: [
          {
            id: "optA",
            slot_id: "slot-1",
            tenant_host: "acme.tenant",
            source_type: "recipe",
            source_ref_id: "r1",
            position: 1,
            created_at: "2026-06-01T00:00:00Z",
            updated_at: "2026-06-01T00:00:00Z",
            item_snapshot: {
              sourceType: "recipe",
              sourceRefId: "r1",
              name: "Pollo",
              steps: null,
              images: [],
              media: [],
              ingredients: [
                {
                  name: "Pollo",
                  quantity: 200,
                  unit: "g",
                  nutrientsPer100g: {},
                },
              ],
              totals: ZERO_TOTALS,
            },
          },
          {
            id: "optB",
            slot_id: "slot-1",
            tenant_host: "acme.tenant",
            source_type: "recipe",
            source_ref_id: "r2",
            position: 0,
            created_at: "2026-06-01T00:00:00Z",
            updated_at: "2026-06-01T00:00:00Z",
            item_snapshot: {
              sourceType: "recipe",
              sourceRefId: "r2",
              name: "Avena",
              steps: null,
              images: [],
              media: [],
              ingredients: [
                { name: "Oats", quantity: 50, unit: "g", nutrientsPer100g: {} },
                {
                  name: "Milk",
                  quantity: 200,
                  unit: "ml",
                  nutrientsPer100g: {},
                },
              ],
              totals: ZERO_TOTALS,
            },
          },
        ],
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedSession.mockResolvedValue(CLIENT_SESSION);
  mockedFlag.mockResolvedValue(true);
  mockedTenant.mockResolvedValue({
    host: "acme.tenant",
    slug: "acme",
  } as never);
  mockedRead.mockResolvedValue(null);
  mockedSelections.mockResolvedValue([]);
});

describe("GET /api/client/shopping-list — auth boundary", () => {
  it("returns 401 when unauthenticated", async () => {
    mockedSession.mockResolvedValue(null);

    const res = await GET(req());

    expect(res.status).toBe(401);
    expect(mockedRead).not.toHaveBeenCalled();
  });

  it("rejects a trainer token (no client_id) with 401", async () => {
    mockedSession.mockResolvedValue({
      trainer_id: "trainer-1",
      tenant_host: "acme.tenant",
      email: "t@example.com",
      iat: 0,
      exp: 0,
    } as unknown as ClientSession);

    const res = await GET(req());

    expect(res.status).toBe(401);
    expect(mockedRead).not.toHaveBeenCalled();
  });

  it("returns 404 when the nutrition-v2 flag is off (hides existence)", async () => {
    mockedFlag.mockResolvedValue(false);

    const res = await GET(req());

    expect(res.status).toBe(404);
    expect(mockedRead).not.toHaveBeenCalled();
  });
});

describe("GET /api/client/shopping-list — range validation", () => {
  it("returns 400 when `from` is missing", async () => {
    const res = await GET(req("?to=2026-06-07"));

    expect(res.status).toBe(400);
    expect(mockedRead).not.toHaveBeenCalled();
  });

  it("returns 400 when `to` is missing", async () => {
    const res = await GET(req("?from=2026-06-01"));

    expect(res.status).toBe(400);
    expect(mockedRead).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed date", async () => {
    const res = await GET(req("?from=2026-6-1&to=2026-06-07"));

    expect(res.status).toBe(400);
    expect(mockedRead).not.toHaveBeenCalled();
  });

  it("returns 400 for an impossible calendar date", async () => {
    const res = await GET(req("?from=2026-02-30&to=2026-03-05"));

    expect(res.status).toBe(400);
    expect(mockedRead).not.toHaveBeenCalled();
  });

  it("returns 400 when `from` is after `to`", async () => {
    const res = await GET(req("?from=2026-06-07&to=2026-06-01"));

    expect(res.status).toBe(400);
    expect(mockedRead).not.toHaveBeenCalled();
  });
});

describe("GET /api/client/shopping-list — aggregation", () => {
  it("returns a clean empty 200 when there is no active cycle", async () => {
    mockedRead.mockResolvedValue(null);

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.items).toEqual([]);
    expect(body.data.from).toBe("2026-06-01");
    expect(body.data.to).toBe("2026-06-07");
  });

  it("scopes strictly to the authed client's own id (never request-supplied)", async () => {
    mockedRead.mockResolvedValue(tree());

    const res = await GET(req("?from=2026-06-01&to=2026-06-01&clientId=42"));

    expect(res.status).toBe(200);
    expect(mockedRead).toHaveBeenCalledWith(expect.anything(), 999000001);
    expect(mockedRead).toHaveBeenCalledTimes(1);
  });

  it("merges the selected-or-first option's ingredients across the range", async () => {
    mockedRead.mockResolvedValue(tree());
    // No selection → first option by position (optB: Oats + Milk).
    const res = await GET(req("?from=2026-06-01&to=2026-06-03"));
    const body = await res.json();

    expect(res.status).toBe(200);
    // 3 days × optB → Oats 150g and Milk 600ml (units stay separate).
    expect(body.data.items).toEqual([
      { name: "Milk", unit: "ml", quantity: 600 },
      { name: "Oats", unit: "g", quantity: 150 },
    ]);
  });

  it("honours the client's selection over the first option", async () => {
    mockedRead.mockResolvedValue(tree());
    mockedSelections.mockResolvedValue([
      { slot_id: "slot-1", option_id: "optA" },
    ]);

    const res = await GET(req("?from=2026-06-01&to=2026-06-02"));
    const body = await res.json();

    // optA selected → Pollo 200g × 2 days = 400g.
    expect(body.data.items).toEqual([
      { name: "Pollo", unit: "g", quantity: 400 },
    ]);
  });
});
