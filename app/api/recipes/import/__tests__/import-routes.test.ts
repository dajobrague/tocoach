import type { TrainerSession } from "@/lib/auth/session";

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted RecipeImportService method mocks for the vi.mock factory.
const { previewMock, approveMock } = vi.hoisted(() => ({
  previewMock: vi.fn(),
  approveMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getTrainerSession: vi.fn() }));
vi.mock("@/lib/nutrition/feature-flag", () => ({
  isNutritionV2Enabled: vi.fn(),
  isNutritionV2TrainerEnabled: vi.fn(),
}));
vi.mock("@/lib/clients/supabase-api", () => ({
  createSupabaseClient: vi.fn(() => ({})),
}));
vi.mock("@/lib/nutrition/import", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/nutrition/import")>();

  return {
    ...actual,
    RecipeImportService: vi.fn(function RecipeImportServiceStub() {
      return { preview: previewMock, approve: approveMock };
    }),
  };
});

import { GET as previewGET } from "../preview/route";
import { POST as approvePOST } from "../approve/route";

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

function approveReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/recipes/import/approve", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedSession.mockResolvedValue(SESSION);
  mockedFlag.mockResolvedValue(true);
});

describe("import preview route — auth + flag gate", () => {
  it("returns 401 when unauthenticated", async () => {
    mockedSession.mockResolvedValue(null);

    const res = await previewGET();

    expect(res.status).toBe(401);
    expect(previewMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the flag is off (hides existence)", async () => {
    mockedFlag.mockResolvedValue(false);

    const res = await previewGET();

    expect(res.status).toBe(404);
    expect(previewMock).not.toHaveBeenCalled();
  });

  it("returns candidates for the authed tenant", async () => {
    previewMock.mockResolvedValue([
      { legacyOptionId: "o1", name: "X", ingredients: [] },
    ]);

    const res = await previewGET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(previewMock).toHaveBeenCalledWith("acme.tenant");
  });
});

describe("import approve route — auth, flag, validation", () => {
  it("returns 401 when unauthenticated", async () => {
    mockedSession.mockResolvedValue(null);

    const res = await approvePOST(approveReq({ optionIds: ["o1"] }));

    expect(res.status).toBe(401);
    expect(approveMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the flag is off", async () => {
    mockedFlag.mockResolvedValue(false);

    const res = await approvePOST(approveReq({ optionIds: ["o1"] }));

    expect(res.status).toBe(404);
    expect(approveMock).not.toHaveBeenCalled();
  });

  it("returns 400 when optionIds is missing", async () => {
    const res = await approvePOST(approveReq({}));

    expect(res.status).toBe(400);
    expect(approveMock).not.toHaveBeenCalled();
  });

  it("returns 400 when optionIds is empty", async () => {
    const res = await approvePOST(approveReq({ optionIds: [] }));

    expect(res.status).toBe(400);
    expect(approveMock).not.toHaveBeenCalled();
  });

  it("imports approved options and returns the result (201)", async () => {
    approveMock.mockResolvedValue({
      created: [{ legacyOptionId: "o1", recipeId: "r1", name: "X" }],
      skipped: [],
    });

    const res = await approvePOST(approveReq({ optionIds: ["o1", "o1", " "] }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.data.created).toHaveLength(1);
    // Deduped + trimmed by the parser before reaching the service.
    expect(approveMock).toHaveBeenCalledWith("acme.tenant", "trainer-1", [
      "o1",
    ]);
  });
});
