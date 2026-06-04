import type { NutritionMetrics } from "@/lib/nutrition/admin/nutrition-metrics";

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/admin-auth", () => ({ verifyAdminRequest: vi.fn() }));
vi.mock("@/lib/clients/supabase-admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({})),
}));
vi.mock("@/lib/nutrition/admin/nutrition-metrics", () => ({
  computeNutritionMetrics: vi.fn(),
}));

import { GET } from "../route";

import { verifyAdminRequest } from "@/lib/auth/admin-auth";
import { computeNutritionMetrics } from "@/lib/nutrition/admin/nutrition-metrics";

const mockedAuth = vi.mocked(verifyAdminRequest);
const mockedCompute = vi.mocked(computeNutritionMetrics);

const SAMPLE: NutritionMetrics = {
  generatedAt: "2026-06-03T12:00:00.000Z",
  windowWeeks: 12,
  adoption: { enabledCount: 5, usingCount: 3 },
  library: {
    totalRecipes: 42,
    activeTrainerCount: 4,
    avgRecipesPerActiveTrainer: 10.5,
    distribution: [
      { label: "1–5", trainers: 1 },
      { label: "6–20", trainers: 2 },
      { label: "21+", trainers: 1 },
    ],
  },
  logging: {
    weeks: [{ weekStart: "2026-06-01", logs: 8, distinctClients: 3 }],
    totalLogs: 8,
    distinctClients: 3,
  },
  complaints: {
    available: false,
    series: [],
    note: "Sin fuente de datos de quejas todavía — próximamente.",
  },
};

function req(): NextRequest {
  return new NextRequest("http://localhost/api/admin/nutrition-metrics");
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedAuth.mockResolvedValue({ isAdmin: true, adminId: "admin-1" });
  mockedCompute.mockResolvedValue(SAMPLE);
});

describe("GET /api/admin/nutrition-metrics — admin auth boundary", () => {
  it("rejects an unauthenticated / non-admin request with 401", async () => {
    mockedAuth.mockResolvedValue({ isAdmin: false, adminId: null });

    const res = await GET(req());

    expect(res.status).toBe(401);
    expect(mockedCompute).not.toHaveBeenCalled();
  });

  it("rejects a trainer/client token (verifies but not an admin) with 401", async () => {
    // verifyAdminRequest returns isAdmin:false for a non-admin subject.
    mockedAuth.mockResolvedValue({ isAdmin: false, adminId: null });

    const res = await GET(req());

    expect(res.status).toBe(401);
    expect(mockedCompute).not.toHaveBeenCalled();
  });

  it("returns 200 with the four signals for an admin", async () => {
    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockedCompute).toHaveBeenCalledTimes(1);

    const { data } = body;

    expect(data.adoption).toEqual({ enabledCount: 5, usingCount: 3 });
    expect(data.library.totalRecipes).toBe(42);
    expect(data.logging.weeks).toHaveLength(1);
    // The complaint hook is an explicit, unfabricated stub.
    expect(data.complaints.available).toBe(false);
    expect(data.complaints.series).toEqual([]);
  });

  it("returns 500 when the metrics query throws", async () => {
    mockedCompute.mockRejectedValue(new Error("db down"));

    const res = await GET(req());

    expect(res.status).toBe(500);
  });
});
