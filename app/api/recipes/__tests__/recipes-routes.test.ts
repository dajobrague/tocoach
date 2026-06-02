import type { TrainerSession } from "@/lib/auth/session";

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted RecipeService method mocks so the vi.mock factory can reference them.
const { createMock, getByIdMock, listMock, updateMock, archiveMock } =
  vi.hoisted(() => ({
    createMock: vi.fn(),
    getByIdMock: vi.fn(),
    listMock: vi.fn(),
    updateMock: vi.fn(),
    archiveMock: vi.fn(),
  }));

vi.mock("@/lib/auth/session", () => ({ getTrainerSession: vi.fn() }));
vi.mock("@/lib/nutrition/feature-flag", () => ({
  isNutritionV2Enabled: vi.fn(),
}));
vi.mock("@/lib/clients/supabase-api", () => ({
  createSupabaseClient: vi.fn(() => ({})),
}));
vi.mock("@/lib/nutrition/recipes/recipe-service", () => ({
  RecipeService: vi.fn(function RecipeServiceStub() {
    return {
      create: createMock,
      getById: getByIdMock,
      list: listMock,
      update: updateMock,
      archive: archiveMock,
    };
  }),
}));

import { GET as listGET, POST as createPOST } from "../route";
import {
  DELETE as archiveDELETE,
  GET as getGET,
  PATCH as updatePATCH,
} from "../[id]/route";

import { getTrainerSession } from "@/lib/auth/session";
import { isNutritionV2Enabled } from "@/lib/nutrition/feature-flag";

const mockedSession = vi.mocked(getTrainerSession);
const mockedFlag = vi.mocked(isNutritionV2Enabled);

const SESSION: TrainerSession = {
  trainer_id: "trainer-1",
  tenant_host: "acme.tenant",
  email: "trainer@example.com",
  iat: 0,
  exp: 0,
};

const sampleRecipe = { id: "r1", tenant_host: "acme.tenant", name: "Soup" };

function listReq(qs = ""): NextRequest {
  return new NextRequest(`http://localhost/api/recipes${qs}`);
}

function postReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/recipes", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function idArgs(id: string, method: string, body?: unknown) {
  const init: {
    method: string;
    body?: string;
    headers?: Record<string, string>;
  } = { method };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "content-type": "application/json" };
  }

  return [
    new NextRequest(`http://localhost/api/recipes/${id}`, init),
    { params: Promise.resolve({ id }) },
  ] as const;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedSession.mockResolvedValue(SESSION);
  mockedFlag.mockResolvedValue(true);
});

describe("recipes routes — auth + flag gate", () => {
  it("list returns 401 when unauthenticated", async () => {
    mockedSession.mockResolvedValue(null);

    const res = await listGET(listReq());

    expect(res.status).toBe(401);
    expect(listMock).not.toHaveBeenCalled();
  });

  it("list returns 404 when the flag is off (hides existence)", async () => {
    mockedFlag.mockResolvedValue(false);

    const res = await listGET(listReq());

    expect(res.status).toBe(404);
    expect(listMock).not.toHaveBeenCalled();
  });

  it("create returns 404 when the flag is off", async () => {
    mockedFlag.mockResolvedValue(false);

    const res = await createPOST(postReq({ name: "X" }));

    expect(res.status).toBe(404);
    expect(createMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/recipes", () => {
  it("creates and returns 201, passing the session tenant + trainer", async () => {
    createMock.mockResolvedValue(sampleRecipe);

    const res = await createPOST(
      postReq({ name: "Soup", meal_type_tags: ["lunch"] })
    );

    expect(res.status).toBe(201);

    const body = await res.json();

    expect(body).toEqual({ success: true, data: sampleRecipe });
    expect(createMock).toHaveBeenCalledWith(
      "acme.tenant",
      "trainer-1",
      expect.objectContaining({ name: "Soup", mealTypeTags: ["lunch"] })
    );
  });

  it("returns 400 when name is missing", async () => {
    const res = await createPOST(postReq({ description: "no name" }));

    expect(res.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("returns 400 when name is blank", async () => {
    const res = await createPOST(postReq({ name: "   " }));

    expect(res.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/recipes", () => {
  it("returns 200 with the service results", async () => {
    listMock.mockResolvedValue([sampleRecipe]);

    const res = await listGET(listReq("?status=active&tag=lunch&q=so"));

    expect(res.status).toBe(200);

    const body = await res.json();

    expect(body).toEqual({ success: true, data: [sampleRecipe] });
    expect(listMock).toHaveBeenCalledWith("acme.tenant", {
      status: "active",
      mealType: "lunch",
      query: "so",
    });
  });
});

describe("GET /api/recipes/[id]", () => {
  it("returns 200 when found", async () => {
    getByIdMock.mockResolvedValue(sampleRecipe);

    const res = await getGET(...idArgs("r1", "GET"));

    expect(res.status).toBe(200);
    expect(getByIdMock).toHaveBeenCalledWith("acme.tenant", "r1");
  });

  it("returns 404 when not found", async () => {
    getByIdMock.mockResolvedValue(null);

    const res = await getGET(...idArgs("missing", "GET"));

    expect(res.status).toBe(404);
  });

  it("returns 404 for another tenant's recipe (service returns null)", async () => {
    // Cross-tenant access can't match the tenant_host filter → null → 404.
    getByIdMock.mockResolvedValue(null);

    const res = await getGET(...idArgs("other-tenant-recipe", "GET"));

    expect(res.status).toBe(404);
    expect(getByIdMock).toHaveBeenCalledWith(
      "acme.tenant",
      "other-tenant-recipe"
    );
  });
});

describe("PATCH /api/recipes/[id]", () => {
  it("returns 200 with the updated recipe", async () => {
    updateMock.mockResolvedValue({ ...sampleRecipe, name: "Stew" });

    const res = await updatePATCH(...idArgs("r1", "PATCH", { name: "Stew" }));

    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith(
      "acme.tenant",
      "r1",
      expect.objectContaining({ name: "Stew" })
    );
  });

  it("returns 404 when the recipe does not exist", async () => {
    updateMock.mockResolvedValue(null);

    const res = await updatePATCH(...idArgs("missing", "PATCH", { name: "X" }));

    expect(res.status).toBe(404);
  });

  it("returns 400 when name is blanked", async () => {
    const res = await updatePATCH(...idArgs("r1", "PATCH", { name: "  " }));

    expect(res.status).toBe(400);
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/recipes/[id]", () => {
  it("archives and returns 200 with status archived", async () => {
    archiveMock.mockResolvedValue({ ...sampleRecipe, status: "archived" });

    const res = await archiveDELETE(...idArgs("r1", "DELETE"));

    expect(res.status).toBe(200);

    const body = await res.json();

    expect(body.data.status).toBe("archived");
    expect(archiveMock).toHaveBeenCalledWith("acme.tenant", "r1");
  });

  it("returns 404 when the recipe does not exist", async () => {
    archiveMock.mockResolvedValue(null);

    const res = await archiveDELETE(...idArgs("missing", "DELETE"));

    expect(res.status).toBe(404);
  });
});
