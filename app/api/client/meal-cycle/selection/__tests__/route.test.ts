import type { ClientSession } from "@/lib/auth/client-session";

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
vi.mock("@/lib/nutrition/cycles/option-selection", () => ({
  setClientSelection: vi.fn(),
}));

import { POST } from "../route";

import { getClientSession } from "@/lib/auth/client-session";
import { setClientSelection } from "@/lib/nutrition/cycles/option-selection";
import { isNutritionV2Enabled } from "@/lib/nutrition/feature-flag";
import { loadTenantContext } from "@/lib/tenant/loader";

const mockedSession = vi.mocked(getClientSession);
const mockedFlag = vi.mocked(isNutritionV2Enabled);
const mockedTenant = vi.mocked(loadTenantContext);
const mockedSet = vi.mocked(setClientSelection);

const CLIENT_SESSION: ClientSession = {
  client_id: "999000001",
  tenant_slug: "acme",
  email: "client@example.com",
  iat: 0,
  exp: 0,
};

const SLOT_ID = "11111111-1111-4111-8111-111111111111";
const OPTION_ID = "22222222-2222-4222-8222-222222222222";

function postReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/client/meal-cycle/selection", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedSession.mockResolvedValue(CLIENT_SESSION);
  mockedFlag.mockResolvedValue(true);
  mockedTenant.mockResolvedValue({
    host: "acme.tenant",
    slug: "acme",
  } as never);
  mockedSet.mockResolvedValue({
    id: "sel-1",
    tenant_host: "acme.tenant",
    client_id: 999000001,
    slot_id: SLOT_ID,
    option_id: OPTION_ID,
    created_at: "2026-06-03T00:00:00Z",
    updated_at: "2026-06-03T00:00:00Z",
  });
});

describe("POST /api/client/meal-cycle/selection — auth boundary (§4.4)", () => {
  it("returns 401 when unauthenticated", async () => {
    mockedSession.mockResolvedValue(null);

    const res = await POST(postReq({ slotId: SLOT_ID, optionId: OPTION_ID }));

    expect(res.status).toBe(401);
    expect(mockedSet).not.toHaveBeenCalled();
  });

  it("rejects a trainer token (no client_id) with 401", async () => {
    mockedSession.mockResolvedValue({
      trainer_id: "trainer-1",
      tenant_host: "acme.tenant",
      email: "t@example.com",
      iat: 0,
      exp: 0,
    } as unknown as ClientSession);

    const res = await POST(postReq({ slotId: SLOT_ID, optionId: OPTION_ID }));

    expect(res.status).toBe(401);
    expect(mockedSet).not.toHaveBeenCalled();
  });

  it("returns 404 when the nutrition-v2 flag is off", async () => {
    mockedFlag.mockResolvedValue(false);

    const res = await POST(postReq({ slotId: SLOT_ID, optionId: OPTION_ID }));

    expect(res.status).toBe(404);
    expect(mockedSet).not.toHaveBeenCalled();
  });

  it("returns 400 when slotId or optionId is missing", async () => {
    expect((await POST(postReq({ slotId: SLOT_ID }))).status).toBe(400);
    expect((await POST(postReq({ optionId: OPTION_ID }))).status).toBe(400);
    expect((await POST(postReq({}))).status).toBe(400);
    expect(mockedSet).not.toHaveBeenCalled();
  });

  it("returns 404 when the slot is not in the client's own active cycle", async () => {
    mockedSet.mockResolvedValue(null);

    const res = await POST(postReq({ slotId: SLOT_ID, optionId: OPTION_ID }));

    expect(res.status).toBe(404);
  });

  it("persists with the authed client's own id (never request-supplied)", async () => {
    const res = await POST(postReq({ slotId: SLOT_ID, optionId: OPTION_ID }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockedSet).toHaveBeenCalledWith(
      expect.anything(),
      999000001,
      SLOT_ID,
      OPTION_ID
    );
    expect(body.success).toBe(true);
    expect(body.data.option_id).toBe(OPTION_ID);
  });
});
