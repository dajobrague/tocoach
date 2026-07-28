import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/clients/supabase-api", () => ({
  createSupabaseClient: vi.fn(() => ({})),
}));
// No importOriginal: the real module pulls in auth/session → JWT_SECRET,
// which is absent in the test environment.
vi.mock("@/lib/nutrition/recipes/recipe-request", () => ({
  guardRecipeRequest: vi.fn(),
  errorMessage: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
}));
vi.mock("@/lib/nutrition/delivery-visibility", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getClientNutritionVisibility: vi.fn(),
  setClientNutritionVisibility: vi.fn(),
}));

import { GET, PUT } from "../route";

import {
  getClientNutritionVisibility,
  setClientNutritionVisibility,
} from "@/lib/nutrition/delivery-visibility";
import { guardRecipeRequest } from "@/lib/nutrition/recipes/recipe-request";

const mockedGuard = vi.mocked(guardRecipeRequest);
const mockedGet = vi.mocked(getClientNutritionVisibility);
const mockedSet = vi.mocked(setClientNutritionVisibility);

const OK_GUARD = {
  ok: true as const,
  correlationId: "req-test",
  session: { tenant_host: "acme.tenant" },
} as Awaited<ReturnType<typeof guardRecipeRequest>>;

function getReq(query = "?clientId=7"): NextRequest {
  return new NextRequest(`http://localhost/api/nutrition/visibility${query}`);
}

function putReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/nutrition/visibility", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedGuard.mockResolvedValue(OK_GUARD);
  mockedGet.mockResolvedValue(null);
  mockedSet.mockResolvedValue();
});

describe("GET /api/nutrition/visibility", () => {
  it("returns the guard's response when not authorized", async () => {
    mockedGuard.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ success: false }, { status: 404 }),
    } as Awaited<ReturnType<typeof guardRecipeRequest>>);

    const res = await GET(getReq());

    expect(res.status).toBe(404);
    expect(mockedGet).not.toHaveBeenCalled();
  });

  it("rejects a missing/invalid clientId", async () => {
    expect((await GET(getReq("?clientId=abc"))).status).toBe(400);
    expect((await GET(getReq(""))).status).toBe(400);
    expect(mockedGet).not.toHaveBeenCalled();
  });

  it("returns the saved choice scoped to the session tenant", async () => {
    mockedGet.mockResolvedValue(["goals", "pdf"]);

    const res = await GET(getReq("?clientId=7"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual({ sections: ["goals", "pdf"] });
    expect(mockedGet).toHaveBeenCalledWith(expect.anything(), "acme.tenant", 7);
  });
});

describe("PUT /api/nutrition/visibility", () => {
  it("saves a valid subset in canonical order", async () => {
    const res = await PUT(putReq({ clientId: 7, sections: ["goals", "plan"] }));

    expect(res.status).toBe(200);
    expect(mockedSet).toHaveBeenCalledWith(
      expect.anything(),
      "acme.tenant",
      7,
      ["plan", "goals"]
    );
  });

  it("null and [] both mean Automático (row removed)", async () => {
    expect((await PUT(putReq({ clientId: 7, sections: null }))).status).toBe(
      200
    );
    expect((await PUT(putReq({ clientId: 7, sections: [] }))).status).toBe(200);
    expect(mockedSet).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      "acme.tenant",
      7,
      null
    );
    expect(mockedSet).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      "acme.tenant",
      7,
      null
    );
  });

  it("rejects unknown section values", async () => {
    const res = await PUT(putReq({ clientId: 7, sections: ["everything"] }));

    expect(res.status).toBe(400);
    expect(mockedSet).not.toHaveBeenCalled();
  });

  it("rejects an invalid clientId", async () => {
    const res = await PUT(putReq({ clientId: "x", sections: ["plan"] }));

    expect(res.status).toBe(400);
    expect(mockedSet).not.toHaveBeenCalled();
  });
});
