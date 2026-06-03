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
import { toYmdInTimezone } from "@/lib/forms/chart-helpers";

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

function mealCycleReq(tz?: string): NextRequest {
  const qs = tz === undefined ? "" : `?tz=${encodeURIComponent(tz)}`;

  return new NextRequest(`http://localhost/api/client/meal-cycle${qs}`);
}

function tree(): MealCycleTree {
  return {
    id: "cycle-1",
    tenant_host: "acme.tenant",
    trainer_id: "trainer-1",
    client_id: 999000001,
    name: "Plan",
    duration_days: 3,
    start_date: "2026-06-01",
    status: "active",
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    slots: [],
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

describe("GET /api/client/meal-cycle — auth boundary (§4.4)", () => {
  it("returns 401 when unauthenticated", async () => {
    mockedSession.mockResolvedValue(null);

    const res = await GET(mealCycleReq());

    expect(res.status).toBe(401);
    expect(mockedRead).not.toHaveBeenCalled();
  });

  it("rejects a trainer token (no client_id) with 401", async () => {
    // A trainer JWT verifies (same secret) but carries trainer_id, not client_id.
    mockedSession.mockResolvedValue({
      trainer_id: "trainer-1",
      tenant_host: "acme.tenant",
      email: "t@example.com",
      iat: 0,
      exp: 0,
    } as unknown as ClientSession);

    const res = await GET(mealCycleReq());

    expect(res.status).toBe(401);
    expect(mockedRead).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric client_id with 401", async () => {
    mockedSession.mockResolvedValue({
      ...CLIENT_SESSION,
      client_id: "not-a-number",
    });

    const res = await GET(mealCycleReq());

    expect(res.status).toBe(401);
    expect(mockedRead).not.toHaveBeenCalled();
  });

  it("returns 404 when the nutrition-v2 flag is off (hides existence)", async () => {
    mockedFlag.mockResolvedValue(false);

    const res = await GET(mealCycleReq());

    expect(res.status).toBe(404);
    expect(mockedRead).not.toHaveBeenCalled();
  });

  it("scopes strictly to the authed client's own id (never request-supplied)", async () => {
    mockedRead.mockResolvedValue(tree());

    const res = await GET(mealCycleReq());
    const body = await res.json();

    expect(res.status).toBe(200);
    // The only id the route may use is the session's — coerced to a number.
    expect(mockedRead).toHaveBeenCalledWith(expect.anything(), 999000001);
    expect(mockedRead).toHaveBeenCalledTimes(1);
    expect(body.success).toBe(true);
    expect(body.data.cycle.id).toBe("cycle-1");
    expect(body.data.position.started).toBe(true);
  });

  it("returns a clean empty result (200) when there is no active cycle", async () => {
    mockedRead.mockResolvedValue(null);

    const res = await GET(mealCycleReq());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.cycle).toBeNull();
    expect(body.data.position).toBeNull();
    expect(body.data.days).toEqual([]);
    expect(typeof body.data.today).toBe("string");
  });

  it("computes 'today' in the tz from the ?tz= query param", async () => {
    const res = await GET(mealCycleReq("Pacific/Auckland"));
    const body = await res.json();

    // The route resolves "today" in the requested tz (same instant the test
    // observes), proving the param is read and threaded — not hard-coded UTC.
    expect(body.data.today).toBe(
      toYmdInTimezone(new Date(), "Pacific/Auckland")
    );
  });

  it("defaults 'today' to UTC when no tz is supplied", async () => {
    const res = await GET(mealCycleReq());
    const body = await res.json();

    expect(body.data.today).toBe(toYmdInTimezone(new Date(), "UTC"));
  });
});
