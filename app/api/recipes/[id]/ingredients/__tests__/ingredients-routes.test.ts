import type { TrainerSession } from "@/lib/auth/session";

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { listMock, addMock, updateMock, removeMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  addMock: vi.fn(),
  updateMock: vi.fn(),
  removeMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getTrainerSession: vi.fn() }));
vi.mock("@/lib/nutrition/feature-flag", () => ({
  isNutritionV2Enabled: vi.fn(),
  isNutritionV2TrainerEnabled: vi.fn(),
}));
vi.mock("@/lib/clients/supabase-api", () => ({
  createSupabaseClient: vi.fn(() => ({})),
}));
vi.mock("@/lib/nutrition/recipes/recipe-ingredient-service", () => {
  class RecipeIngredientValidationError extends Error {}

  return {
    RecipeIngredientValidationError,
    RecipeIngredientService: vi.fn(function RecipeIngredientServiceStub() {
      return {
        list: listMock,
        add: addMock,
        update: updateMock,
        remove: removeMock,
      };
    }),
  };
});

import { GET as listGET, POST as addPOST } from "../route";
import {
  DELETE as removeDELETE,
  PATCH as updatePATCH,
} from "../[ingredientId]/route";

import { getTrainerSession } from "@/lib/auth/session";
import { isNutritionV2TrainerEnabled } from "@/lib/nutrition/feature-flag";

const mockedSession = vi.mocked(getTrainerSession);
const mockedFlag = vi.mocked(isNutritionV2TrainerEnabled);

const SESSION: TrainerSession = {
  trainer_id: "trainer-1",
  tenant_host: "acme.tenant",
  email: "trainer@example.com",
  iat: 0,
  exp: 0,
};

const sampleRow = { id: "ri1", recipe_id: "r1", name_snapshot: "Oats" };

function req(path: string, method = "GET", body?: unknown): NextRequest {
  const init: {
    method: string;
    body?: string;
    headers?: Record<string, string>;
  } = { method };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "content-type": "application/json" };
  }

  return new NextRequest(`http://localhost${path}`, init);
}

function listArgs() {
  return [
    req("/api/recipes/r1/ingredients"),
    { params: Promise.resolve({ id: "r1" }) },
  ] as const;
}

function addArgs(body: unknown) {
  return [
    req("/api/recipes/r1/ingredients", "POST", body),
    { params: Promise.resolve({ id: "r1" }) },
  ] as const;
}

function rowArgs(method: string, body?: unknown) {
  return [
    req("/api/recipes/r1/ingredients/ri1", method, body),
    { params: Promise.resolve({ id: "r1", ingredientId: "ri1" }) },
  ] as const;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedSession.mockResolvedValue(SESSION);
  mockedFlag.mockResolvedValue(true);
});

describe("recipe ingredients — gate", () => {
  it("returns 401 when unauthenticated", async () => {
    mockedSession.mockResolvedValue(null);

    const res = await listGET(...listArgs());

    expect(res.status).toBe(401);
    expect(listMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the flag is off", async () => {
    mockedFlag.mockResolvedValue(false);

    const res = await listGET(...listArgs());

    expect(res.status).toBe(404);
    expect(listMock).not.toHaveBeenCalled();
  });
});

describe("GET ingredients", () => {
  it("returns 200 with the lines", async () => {
    listMock.mockResolvedValue([sampleRow]);

    const res = await listGET(...listArgs());

    expect(res.status).toBe(200);

    const body = await res.json();

    expect(body).toEqual({ success: true, data: [sampleRow] });
    expect(listMock).toHaveBeenCalledWith("acme.tenant", "r1");
  });

  it("returns 404 when the recipe is not the tenant's", async () => {
    listMock.mockResolvedValue(null);

    const res = await listGET(...listArgs());

    expect(res.status).toBe(404);
  });
});

describe("POST add ingredient", () => {
  it("returns 201 and passes the tenant + recipe id", async () => {
    addMock.mockResolvedValue(sampleRow);

    const res = await addPOST(...addArgs({ name: "Oats", quantity: 50 }));

    expect(res.status).toBe(201);
    expect(addMock).toHaveBeenCalledWith(
      "acme.tenant",
      "r1",
      expect.objectContaining({ name: "Oats", quantity: 50 })
    );
  });

  it("returns 400 when quantity is missing", async () => {
    const res = await addPOST(...addArgs({ name: "Oats" }));

    expect(res.status).toBe(400);
    expect(addMock).not.toHaveBeenCalled();
  });

  it("returns 400 when free-text name is missing", async () => {
    const res = await addPOST(...addArgs({ quantity: 50 }));

    expect(res.status).toBe(400);
    expect(addMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the recipe belongs to another tenant", async () => {
    addMock.mockResolvedValue(null);

    const res = await addPOST(...addArgs({ name: "Oats", quantity: 50 }));

    expect(res.status).toBe(404);
  });
});

describe("PATCH update ingredient", () => {
  it("returns 200 on success", async () => {
    updateMock.mockResolvedValue({ ...sampleRow, quantity: 100 });

    const res = await updatePATCH(...rowArgs("PATCH", { quantity: 100 }));

    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith(
      "acme.tenant",
      "r1",
      "ri1",
      expect.objectContaining({ quantity: 100 })
    );
  });

  it("returns 404 when the row/recipe is not found", async () => {
    updateMock.mockResolvedValue(null);

    const res = await updatePATCH(...rowArgs("PATCH", { quantity: 100 }));

    expect(res.status).toBe(404);
  });
});

describe("DELETE remove ingredient", () => {
  it("returns 200 on success", async () => {
    removeMock.mockResolvedValue(sampleRow);

    const res = await removeDELETE(...rowArgs("DELETE"));

    expect(res.status).toBe(200);
    expect(removeMock).toHaveBeenCalledWith("acme.tenant", "r1", "ri1");
  });

  it("returns 404 when the row/recipe is not found", async () => {
    removeMock.mockResolvedValue(null);

    const res = await removeDELETE(...rowArgs("DELETE"));

    expect(res.status).toBe(404);
  });
});
