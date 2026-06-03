import type { TrainerSession } from "@/lib/auth/session";

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ getTrainerSession: vi.fn() }));
vi.mock("@/lib/nutrition/feature-flag", () => ({
  isNutritionV2Enabled: vi.fn(),
}));
vi.mock("@/lib/clients/supabase-api", () => ({
  createSupabaseClient: vi.fn(() => ({})),
}));
vi.mock("@/lib/nutrition/logs/adherence-service", () => ({
  getClientAdherence: vi.fn(),
}));

import { GET } from "../route";

import { getTrainerSession } from "@/lib/auth/session";
import { getClientAdherence } from "@/lib/nutrition/logs/adherence-service";
import { isNutritionV2Enabled } from "@/lib/nutrition/feature-flag";

const mockedSession = vi.mocked(getTrainerSession);
const mockedFlag = vi.mocked(isNutritionV2Enabled);
const mockedAdherence = vi.mocked(getClientAdherence);

const SESSION: TrainerSession = {
  trainer_id: "trainer-1",
  tenant_host: "acme.tenant",
  email: "t@example.com",
  iat: 0,
  exp: 0,
};

const ctx = (clientId = "999000001") => ({
  params: Promise.resolve({ clientId }),
});

function getReq(qs = "?from=2026-06-01&to=2026-06-07"): NextRequest {
  return new NextRequest(
    `http://localhost/api/clients/999000001/adherence${qs}`
  );
}

const REPORT = {
  from: "2026-06-01",
  to: "2026-06-07",
  totals: { planned: 7, logged: 3, engagementPct: 43, adherencePct: 29 },
  statusBreakdown: { eaten_planned: 2, eaten_other: 1, skipped: 0 },
  days: [],
  weeks: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedSession.mockResolvedValue(SESSION);
  mockedFlag.mockResolvedValue(true);
  mockedAdherence.mockResolvedValue(REPORT);
});

describe("GET /api/clients/[clientId]/adherence — trainer ownership boundary", () => {
  it("returns 401 when unauthenticated", async () => {
    mockedSession.mockResolvedValue(null);

    const res = await GET(getReq(), ctx());

    expect(res.status).toBe(401);
    expect(mockedAdherence).not.toHaveBeenCalled();
  });

  it("returns 404 when the nutrition-v2 flag is off", async () => {
    mockedFlag.mockResolvedValue(false);

    const res = await GET(getReq(), ctx());

    expect(res.status).toBe(404);
    expect(mockedAdherence).not.toHaveBeenCalled();
  });

  it("returns 400 when from/to are missing or malformed", async () => {
    expect((await GET(getReq(""), ctx())).status).toBe(400);
    expect((await GET(getReq("?from=2026-06-01"), ctx())).status).toBe(400);
    expect((await GET(getReq("?from=nope&to=bad"), ctx())).status).toBe(400);
    expect(mockedAdherence).not.toHaveBeenCalled();
  });

  it("returns 404 when the trainer does not own the client", async () => {
    mockedAdherence.mockResolvedValue(null);

    const res = await GET(getReq(), ctx());

    expect(res.status).toBe(404);
  });

  it("scopes to the session trainer + path client and returns the report", async () => {
    const res = await GET(getReq(), ctx("999000001"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockedAdherence).toHaveBeenCalledWith(expect.anything(), {
      trainerId: "trainer-1",
      clientId: 999000001,
      from: "2026-06-01",
      to: "2026-06-07",
    });
    expect(body.data.totals.engagementPct).toBe(43);
    expect(body.data.totals.adherencePct).toBe(29);
  });
});
