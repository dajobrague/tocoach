import type { TrainerSession } from "@/lib/auth/session";
import type { FoodResult } from "@/lib/nutrition/food-source/types";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Hoisted mock fns so the vi.mock factory below can reference them.
const { searchMock, getByBarcodeMock, maybeSingleMock } = vi.hoisted(() => ({
  searchMock: vi.fn(),
  getByBarcodeMock: vi.fn(),
  maybeSingleMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getTrainerSession: vi.fn() }));
vi.mock("@/lib/clients/supabase-api", () => ({
  // Chainable stub for the tenant `features` lookup the search route performs.
  createSupabaseClient: vi.fn(() => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }),
    }),
  })),
}));
vi.mock("@/lib/nutrition/food-source/food-lookup-service", () => ({
  // A function expression (not an arrow) so `new FoodLookupService(...)` works;
  // returning an object makes `new` yield our stub with the mocked methods.
  FoodLookupService: vi.fn(function FoodLookupServiceStub() {
    return { search: searchMock, getByBarcode: getByBarcodeMock };
  }),
}));

import { GET as barcodeGET } from "../barcode/[code]/route";
import { GET as searchGET } from "../search/route";

import { getTrainerSession } from "@/lib/auth/session";

const mockedGetSession = vi.mocked(getTrainerSession);

const SESSION: TrainerSession = {
  trainer_id: "trainer-1",
  tenant_host: "acme.tenant",
  email: "trainer@example.com",
  iat: 0,
  exp: 0,
};

const sampleResult: FoodResult = {
  source: "off",
  sourceRef: "off:1",
  name: "Oats",
  defaultUnit: "g",
  nutrientsPer100g: {
    kcal: 389,
    protein_g: 16.9,
    carbs_g: 66.3,
    fat_g: 6.9,
    sugar_g: 0,
    fiber_g: 10.6,
    sat_fat_g: 1.2,
    sodium_mg: 2,
  },
};

function searchRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/foods/search${query}`);
}

function barcodeArgs(code: string) {
  return [
    new NextRequest(`http://localhost/api/foods/barcode/${code}`),
    { params: Promise.resolve({ code }) },
  ] as const;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: tenant has no configured market → falls back to Spain.
  maybeSingleMock.mockResolvedValue({ data: { features: {} } });
});

describe("GET /api/foods/search", () => {
  it("returns 401 when unauthenticated", async () => {
    mockedGetSession.mockResolvedValue(null);

    const res = await searchGET(searchRequest("?q=oats"));

    expect(res.status).toBe(401);
    expect(searchMock).not.toHaveBeenCalled();
  });

  it("returns 400 when q is missing", async () => {
    mockedGetSession.mockResolvedValue(SESSION);

    const res = await searchGET(searchRequest(""));

    expect(res.status).toBe(400);
    expect(searchMock).not.toHaveBeenCalled();
  });

  it("returns 200 with the service results and passes session tenantHost", async () => {
    mockedGetSession.mockResolvedValue(SESSION);
    searchMock.mockResolvedValue([sampleResult]);

    const res = await searchGET(searchRequest("?q=oats&locale=es"));

    expect(res.status).toBe(200);

    const body = await res.json();

    expect(body).toEqual({ success: true, data: [sampleResult] });
    // No configured market → country defaults to Spain; no brand → undefined.
    expect(searchMock).toHaveBeenCalledWith(
      "acme.tenant",
      "oats",
      "es",
      "spain",
      undefined
    );
  });

  it("scopes search to the tenant's configured market", async () => {
    mockedGetSession.mockResolvedValue(SESSION);
    maybeSingleMock.mockResolvedValue({
      data: { features: { food_market: "spain" } },
    });
    searchMock.mockResolvedValue([sampleResult]);

    await searchGET(searchRequest("?q=oats&locale=es"));

    expect(searchMock).toHaveBeenCalledWith(
      "acme.tenant",
      "oats",
      "es",
      "spain",
      undefined
    );
  });

  it("passes the brand filter to the service", async () => {
    mockedGetSession.mockResolvedValue(SESSION);
    searchMock.mockResolvedValue([sampleResult]);

    await searchGET(searchRequest("?q=oats&locale=es&brand=hacendado"));

    expect(searchMock).toHaveBeenCalledWith(
      "acme.tenant",
      "oats",
      "es",
      "spain",
      "hacendado"
    );
  });

  it("falls back to the Spain default when the tenant lookup fails", async () => {
    mockedGetSession.mockResolvedValue(SESSION);
    maybeSingleMock.mockRejectedValue(new Error("db down"));
    searchMock.mockResolvedValue([sampleResult]);

    const res = await searchGET(searchRequest("?q=oats&locale=es"));

    expect(res.status).toBe(200);
    expect(searchMock).toHaveBeenCalledWith(
      "acme.tenant",
      "oats",
      "es",
      "spain",
      undefined
    );
  });
});

describe("GET /api/foods/barcode/[code]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockedGetSession.mockResolvedValue(null);

    const res = await barcodeGET(...barcodeArgs("123"));

    expect(res.status).toBe(401);
    expect(getByBarcodeMock).not.toHaveBeenCalled();
  });

  it("returns 200 with the result and passes session tenantHost", async () => {
    mockedGetSession.mockResolvedValue(SESSION);
    getByBarcodeMock.mockResolvedValue(sampleResult);

    const res = await barcodeGET(...barcodeArgs("123"));

    expect(res.status).toBe(200);

    const body = await res.json();

    expect(body).toEqual({ success: true, data: sampleResult });
    expect(getByBarcodeMock).toHaveBeenCalledWith("acme.tenant", "123");
  });

  it("returns 404 when the service returns null", async () => {
    mockedGetSession.mockResolvedValue(SESSION);
    getByBarcodeMock.mockResolvedValue(null);

    const res = await barcodeGET(...barcodeArgs("000"));

    expect(res.status).toBe(404);
  });
});
