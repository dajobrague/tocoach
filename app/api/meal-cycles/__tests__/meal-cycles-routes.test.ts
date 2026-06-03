import type { TrainerSession } from "@/lib/auth/session";

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted service-method mocks for the vi.mock factories.
const cycleMocks = vi.hoisted(() => ({
  create: vi.fn(),
  list: vi.fn(),
  getByIdWithTree: vi.fn(),
  update: vi.fn(),
  addSlot: vi.fn(),
  updateSlot: vi.fn(),
  deleteSlot: vi.fn(),
}));
const optionMocks = vi.hoisted(() => ({
  addRecipeOption: vi.fn(),
  addFoodOption: vi.fn(),
  updateOption: vi.fn(),
  deleteOption: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getTrainerSession: vi.fn() }));
vi.mock("@/lib/nutrition/feature-flag", () => ({
  isNutritionV2Enabled: vi.fn(),
}));
vi.mock("@/lib/clients/supabase-api", () => ({
  createSupabaseClient: vi.fn(() => ({})),
}));
// Keep the real error classes (routes use instanceof); stub only the service.
vi.mock("@/lib/nutrition/cycles/meal-cycle-service", async (orig) => {
  const actual =
    await orig<typeof import("@/lib/nutrition/cycles/meal-cycle-service")>();

  return {
    ...actual,
    MealCycleService: vi.fn(function MealCycleServiceStub() {
      return cycleMocks;
    }),
  };
});
vi.mock("@/lib/nutrition/cycles/meal-slot-option-service", async (orig) => {
  const actual =
    await orig<
      typeof import("@/lib/nutrition/cycles/meal-slot-option-service")
    >();

  return {
    ...actual,
    MealSlotOptionService: vi.fn(function MealSlotOptionServiceStub() {
      return optionMocks;
    }),
  };
});

import { GET as listGET, POST as createPOST } from "../route";
import { GET as treeGET, PATCH as cyclePATCH } from "../[id]/route";
import { POST as slotPOST } from "../[id]/slots/route";
import {
  DELETE as slotDELETE,
  PATCH as slotPATCH,
} from "../[id]/slots/[slotId]/route";
import { POST as optionPOST } from "../[id]/slots/[slotId]/options/route";
import {
  DELETE as optionDELETE,
  PATCH as optionPATCH,
} from "../[id]/slots/[slotId]/options/[optionId]/route";

import { getTrainerSession } from "@/lib/auth/session";
import {
  ActiveCycleConflictError,
  MealCycleValidationError,
} from "@/lib/nutrition/cycles/meal-cycle-service";
import { isNutritionV2Enabled } from "@/lib/nutrition/feature-flag";

const mockedSession = vi.mocked(getTrainerSession);
const mockedFlag = vi.mocked(isNutritionV2Enabled);

const SESSION: TrainerSession = {
  trainer_id: "trainer-1",
  tenant_host: "acme.tenant",
  email: "t@example.com",
  iat: 0,
  exp: 0,
};

function jsonReq(body: unknown, method = "POST"): NextRequest {
  return new NextRequest("http://localhost/api/meal-cycles", {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function getReq(qs = ""): NextRequest {
  return new NextRequest(`http://localhost/api/meal-cycles${qs}`);
}

const cycleCtx = (id = "c1") => ({ params: Promise.resolve({ id }) });
const slotCtx = (id = "c1", slotId = "s1") => ({
  params: Promise.resolve({ id, slotId }),
});
const optionCtx = (id = "c1", slotId = "s1", optionId = "o1") => ({
  params: Promise.resolve({ id, slotId, optionId }),
});

beforeEach(() => {
  vi.clearAllMocks();
  mockedSession.mockResolvedValue(SESSION);
  mockedFlag.mockResolvedValue(true);
});

describe("meal-cycles routes — auth + flag gate", () => {
  it("list returns 401 when unauthenticated", async () => {
    mockedSession.mockResolvedValue(null);

    const res = await listGET(getReq());

    expect(res.status).toBe(401);
    expect(cycleMocks.list).not.toHaveBeenCalled();
  });

  it("create returns 404 when the flag is off", async () => {
    mockedFlag.mockResolvedValue(false);

    const res = await createPOST(jsonReq({ name: "X" }));

    expect(res.status).toBe(404);
    expect(cycleMocks.create).not.toHaveBeenCalled();
  });

  it("add option returns 401 when unauthenticated", async () => {
    mockedSession.mockResolvedValue(null);

    const res = await optionPOST(
      jsonReq({ source_type: "recipe", recipe_id: "r1" }),
      slotCtx()
    );

    expect(res.status).toBe(401);
    expect(optionMocks.addRecipeOption).not.toHaveBeenCalled();
  });
});

describe("POST /api/meal-cycles (create)", () => {
  it("creates a draft (201) scoped to the authed trainer", async () => {
    cycleMocks.create.mockResolvedValue({ id: "c1", status: "draft" });

    const res = await createPOST(
      jsonReq({ name: "Ciclo", duration_days: 7, client_id: 42 })
    );

    expect(res.status).toBe(201);
    expect(cycleMocks.create).toHaveBeenCalledWith("acme.tenant", {
      trainerId: "trainer-1",
      clientId: 42,
      name: "Ciclo",
      durationDays: 7,
      status: "draft",
    });
  });

  it("returns 400 when the body is invalid", async () => {
    const res = await createPOST(jsonReq({ duration_days: 7, client_id: 42 }));

    expect(res.status).toBe(400);
    expect(cycleMocks.create).not.toHaveBeenCalled();
  });
});

describe("GET /api/meal-cycles (list)", () => {
  it("passes the clientId filter through", async () => {
    cycleMocks.list.mockResolvedValue([]);

    const res = await listGET(getReq("?clientId=42"));

    expect(res.status).toBe(200);
    expect(cycleMocks.list).toHaveBeenCalledWith("acme.tenant", {
      clientId: 42,
    });
  });
});

describe("GET /api/meal-cycles/[id] (tree)", () => {
  it("returns the tree (200)", async () => {
    cycleMocks.getByIdWithTree.mockResolvedValue({ id: "c1", slots: [] });

    const res = await treeGET(getReq(), cycleCtx());

    expect(res.status).toBe(200);
  });

  it("returns 404 when not found / another tenant's cycle", async () => {
    cycleMocks.getByIdWithTree.mockResolvedValue(null);

    const res = await treeGET(getReq(), cycleCtx());

    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/meal-cycles/[id] (update / activate / archive)", () => {
  it("updates (200)", async () => {
    cycleMocks.update.mockResolvedValue({ id: "c1", status: "archived" });

    const res = await cyclePATCH(
      jsonReq({ status: "archived" }, "PATCH"),
      cycleCtx()
    );

    expect(res.status).toBe(200);
    expect(cycleMocks.update).toHaveBeenCalledWith("acme.tenant", "c1", {
      status: "archived",
    });
  });

  it("returns 409 when activating conflicts with an active cycle", async () => {
    cycleMocks.update.mockRejectedValue(
      new ActiveCycleConflictError("conflict")
    );

    const res = await cyclePATCH(
      jsonReq({ status: "active" }, "PATCH"),
      cycleCtx()
    );

    expect(res.status).toBe(409);
  });

  it("returns 404 when the cycle is not found", async () => {
    cycleMocks.update.mockResolvedValue(null);

    const res = await cyclePATCH(
      jsonReq({ status: "active" }, "PATCH"),
      cycleCtx()
    );

    expect(res.status).toBe(404);
  });

  it("returns 400 when the body has no valid changes", async () => {
    const res = await cyclePATCH(
      jsonReq({ status: "bogus" }, "PATCH"),
      cycleCtx()
    );

    expect(res.status).toBe(400);
    expect(cycleMocks.update).not.toHaveBeenCalled();
  });
});

describe("POST /api/meal-cycles/[id]/slots (add slot)", () => {
  it("adds a slot (201)", async () => {
    cycleMocks.addSlot.mockResolvedValue({ id: "s1", day_index: 0 });

    const res = await slotPOST(
      jsonReq({ day_index: 0, label: "Desayuno" }),
      cycleCtx()
    );

    expect(res.status).toBe(201);
    expect(cycleMocks.addSlot).toHaveBeenCalledWith("acme.tenant", "c1", {
      dayIndex: 0,
      label: "Desayuno",
    });
  });

  it("returns 400 for an out-of-range day_index (service rejects, no row)", async () => {
    cycleMocks.addSlot.mockRejectedValue(
      new MealCycleValidationError("dayIndex must be within 0..2")
    );

    const res = await slotPOST(jsonReq({ day_index: 3 }), cycleCtx());

    expect(res.status).toBe(400);
  });

  it("returns 400 when day_index is missing/invalid", async () => {
    const res = await slotPOST(jsonReq({ label: "x" }), cycleCtx());

    expect(res.status).toBe(400);
    expect(cycleMocks.addSlot).not.toHaveBeenCalled();
  });

  it("returns 404 when the cycle is not found / another tenant's", async () => {
    cycleMocks.addSlot.mockResolvedValue(null);

    const res = await slotPOST(jsonReq({ day_index: 0 }), cycleCtx());

    expect(res.status).toBe(404);
  });
});

describe("slot reorder / delete", () => {
  it("reorders a slot (200)", async () => {
    cycleMocks.updateSlot.mockResolvedValue({ id: "s1", position: 2 });

    const res = await slotPATCH(jsonReq({ position: 2 }, "PATCH"), slotCtx());

    expect(res.status).toBe(200);
    expect(cycleMocks.updateSlot).toHaveBeenCalledWith("acme.tenant", "s1", {
      position: 2,
    });
  });

  it("reorder returns 404 when the slot is not found", async () => {
    cycleMocks.updateSlot.mockResolvedValue(null);

    const res = await slotPATCH(jsonReq({ position: 2 }, "PATCH"), slotCtx());

    expect(res.status).toBe(404);
  });

  it("deletes a slot (200)", async () => {
    cycleMocks.deleteSlot.mockResolvedValue({ id: "s1" });

    const res = await slotDELETE(getReq(), slotCtx());

    expect(res.status).toBe(200);
  });

  it("delete returns 404 when not found / another tenant's", async () => {
    cycleMocks.deleteSlot.mockResolvedValue(null);

    const res = await slotDELETE(getReq(), slotCtx());

    expect(res.status).toBe(404);
  });
});

describe("POST options (snapshot-on-add wiring)", () => {
  it("adds a recipe option via the snapshot service (201)", async () => {
    optionMocks.addRecipeOption.mockResolvedValue({
      id: "o1",
      item_snapshot: { sourceType: "recipe" },
    });

    const res = await optionPOST(
      jsonReq({ source_type: "recipe", recipe_id: "r1" }),
      slotCtx()
    );

    expect(res.status).toBe(201);
    // Delegates to the freeze-at-add-time service path.
    expect(optionMocks.addRecipeOption).toHaveBeenCalledWith(
      "acme.tenant",
      "s1",
      "r1"
    );
    expect(optionMocks.addFoodOption).not.toHaveBeenCalled();
  });

  it("adds a food option via the snapshot service (201)", async () => {
    optionMocks.addFoodOption.mockResolvedValue({ id: "o2" });

    const res = await optionPOST(
      jsonReq({ source_type: "food", ingredient_id: "i1", quantity: 120 }),
      slotCtx()
    );

    expect(res.status).toBe(201);
    expect(optionMocks.addFoodOption).toHaveBeenCalledWith(
      "acme.tenant",
      "s1",
      "i1",
      120
    );
  });

  it("returns 400 for an invalid source_type", async () => {
    const res = await optionPOST(jsonReq({ source_type: "x" }), slotCtx());

    expect(res.status).toBe(400);
    expect(optionMocks.addRecipeOption).not.toHaveBeenCalled();
  });

  it("returns 404 when the slot/source is not found (cross-tenant safe)", async () => {
    optionMocks.addRecipeOption.mockResolvedValue(null);

    const res = await optionPOST(
      jsonReq({ source_type: "recipe", recipe_id: "r1" }),
      slotCtx()
    );

    expect(res.status).toBe(404);
  });
});

describe("option reorder / delete", () => {
  it("reorders an option (200)", async () => {
    optionMocks.updateOption.mockResolvedValue({ id: "o1", position: 5 });

    const res = await optionPATCH(
      jsonReq({ position: 5 }, "PATCH"),
      optionCtx()
    );

    expect(res.status).toBe(200);
    expect(optionMocks.updateOption).toHaveBeenCalledWith("acme.tenant", "o1", {
      position: 5,
    });
  });

  it("reorder returns 404 when not found", async () => {
    optionMocks.updateOption.mockResolvedValue(null);

    const res = await optionPATCH(
      jsonReq({ position: 5 }, "PATCH"),
      optionCtx()
    );

    expect(res.status).toBe(404);
  });

  it("deletes an option (200)", async () => {
    optionMocks.deleteOption.mockResolvedValue({ id: "o1" });

    const res = await optionDELETE(getReq(), optionCtx());

    expect(res.status).toBe(200);
  });

  it("delete returns 404 when not found / another tenant's", async () => {
    optionMocks.deleteOption.mockResolvedValue(null);

    const res = await optionDELETE(getReq(), optionCtx());

    expect(res.status).toBe(404);
  });
});
