import type { MealCycleRow } from "@/lib/nutrition/cycles/meal-cycle-service";
import type { OverrideRow } from "@/lib/nutrition/cycles/override-types";

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/clients/supabase-api", () => ({
  createSupabaseClient: vi.fn(() => ({})),
}));
vi.mock("@/lib/nutrition/recipes/recipe-request", async () => {
  const { NextResponse } = await import("next/server");

  return {
    guardRecipeRequest: vi.fn(),
    recipeNotFound: () =>
      NextResponse.json(
        { success: false, error: "No encontrado" },
        {
          status: 404,
        }
      ),
    errorMessage: (error: unknown) =>
      error instanceof Error ? error.message : String(error),
  };
});
vi.mock("@/lib/nutrition/cycles/override-guard", () => ({
  resolveOwnedCycle: vi.fn(),
}));
vi.mock("@/lib/nutrition/cycles/override-service", () => ({
  OverrideService: vi.fn(),
}));

import { POST } from "../route";

import { resolveOwnedCycle } from "@/lib/nutrition/cycles/override-guard";
import { OverrideService } from "@/lib/nutrition/cycles/override-service";
import { guardRecipeRequest } from "@/lib/nutrition/recipes/recipe-request";

const mockedGuard = vi.mocked(guardRecipeRequest);
const mockedResolve = vi.mocked(resolveOwnedCycle);
const MockedService = vi.mocked(OverrideService);

const SESSION = {
  trainer_id: "trainer-1",
  tenant_host: "acme.tenant",
} as never;

const CYCLE: MealCycleRow = {
  id: "cycle-1",
  tenant_host: "acme.tenant",
  trainer_id: "trainer-1",
  client_id: 7,
  name: "Plan",
  duration_days: 3,
  start_date: "2026-06-01",
  status: "active",
  day_targets: {},
  day_names: {},
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:00Z",
};

const ctx = { params: Promise.resolve({ id: "cycle-1" }) };

function body(payload: unknown): NextRequest {
  return new NextRequest("http://localhost/api/meal-cycles/cycle-1/overrides", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

const VALID_NOTE = {
  overrideType: "note",
  scope: "single_day",
  anchorDate: "2026-06-03",
  noteText: "Bebe agua",
};

function mockCreate(impl: (...args: unknown[]) => unknown) {
  // A regular function (not an arrow) so `new OverrideService()` works.
  MockedService.mockImplementation(function () {
    return { create: vi.fn(impl) } as unknown as OverrideService;
  } as unknown as () => OverrideService);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedGuard.mockResolvedValue({
    ok: true,
    session: SESSION,
    correlationId: "test",
  });
  mockedResolve.mockResolvedValue(CYCLE);
  mockCreate(
    async (_tenant: unknown, input: unknown) =>
      ({
        id: "ov-1",
        ...(input as object),
      }) as OverrideRow
  );
});

describe("POST /api/meal-cycles/[id]/overrides — boundaries", () => {
  it("propagates the guard's 401 when unauthenticated", async () => {
    const { NextResponse } = await import("next/server");

    mockedGuard.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ success: false }, { status: 401 }),
    });

    const res = await POST(body(VALID_NOTE), ctx);

    expect(res.status).toBe(401);
    expect(mockedResolve).not.toHaveBeenCalled();
  });

  it("propagates the guard's 404 when the flag is off", async () => {
    const { NextResponse } = await import("next/server");

    mockedGuard.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ success: false }, { status: 404 }),
    });

    const res = await POST(body(VALID_NOTE), ctx);

    expect(res.status).toBe(404);
  });

  it("returns 404 when the trainer does not own the cycle (no write)", async () => {
    mockedResolve.mockResolvedValue(null);
    const createSpy = vi.fn();

    MockedService.mockImplementation(function () {
      return { create: createSpy } as unknown as OverrideService;
    } as unknown as () => OverrideService);

    const res = await POST(body(VALID_NOTE), ctx);

    expect(res.status).toBe(404);
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid body", async () => {
    const res = await POST(
      body({ overrideType: "note", scope: "single_day", anchorDate: "x" }),
      ctx
    );

    expect(res.status).toBe(400);
  });

  it("returns 404 when the swap source isn't found (service → null)", async () => {
    mockCreate(async () => null);

    const res = await POST(
      body({
        overrideType: "swap",
        scope: "single_day",
        anchorDate: "2026-06-03",
        slotId: "slot-1",
        swapSourceType: "recipe",
        swapSourceRefId: "missing",
      }),
      ctx
    );

    expect(res.status).toBe(404);
  });

  it("creates a valid note (201) scoped to the session tenant", async () => {
    const res = await POST(body(VALID_NOTE), ctx);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.data.overrideType).toBe("note");
    expect(json.data.cycleId).toBe("cycle-1");
  });
});
