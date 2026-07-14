import type { ClientSession } from "@/lib/auth/client-session";
import type { MealLogRow } from "@/lib/nutrition/logs/meal-log-service";

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
vi.mock("@/lib/nutrition/logs/meal-log-service", async (orig) => {
  const actual =
    await orig<typeof import("@/lib/nutrition/logs/meal-log-service")>();

  return { ...actual, setMealLog: vi.fn() };
});

import { POST } from "../route";

import { getClientSession } from "@/lib/auth/client-session";
import { isNutritionV2Enabled } from "@/lib/nutrition/feature-flag";
import { shiftYmd } from "@/lib/nutrition/logs/log-window";
import { setMealLog } from "@/lib/nutrition/logs/meal-log-service";
import { loadTenantContext } from "@/lib/tenant/loader";
import { toYmdInTimezone } from "@/lib/forms/chart-helpers";

const mockedSession = vi.mocked(getClientSession);
const mockedFlag = vi.mocked(isNutritionV2Enabled);
const mockedTenant = vi.mocked(loadTenantContext);
const mockedSet = vi.mocked(setMealLog);

const CLIENT_SESSION: ClientSession = {
  client_id: "999000001",
  tenant_slug: "acme",
  email: "client@example.com",
  iat: 0,
  exp: 0,
};

const SLOT_ID = "11111111-1111-4111-8111-111111111111";
const OPTION_ID = "22222222-2222-4222-8222-222222222222";
// Recent, always-in-window date so these auth/success tests don't age out of
// the 30-day log window (the window itself is covered by its own describe).
const RECENT = toYmdInTimezone(new Date(), "UTC");

function row(over: Partial<MealLogRow> = {}): MealLogRow {
  return {
    id: "log-1",
    tenant_host: "acme.tenant",
    client_id: 999000001,
    slot_id: SLOT_ID,
    option_id: null,
    log_date: "2026-06-03",
    status: "skipped",
    comment: null,
    photo_url: null,
    created_at: "2026-06-03T00:00:00Z",
    updated_at: "2026-06-03T00:00:00Z",
    ...over,
  };
}

function postReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/client/meal-logs", {
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
  mockedSet.mockResolvedValue(row());
});

describe("POST /api/client/meal-logs — auth boundary (§4.4)", () => {
  it("returns 401 when unauthenticated", async () => {
    mockedSession.mockResolvedValue(null);

    const res = await POST(
      postReq({ slot_id: SLOT_ID, log_date: "2026-06-03", status: "skipped" })
    );

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

    const res = await POST(
      postReq({ slot_id: SLOT_ID, log_date: "2026-06-03", status: "skipped" })
    );

    expect(res.status).toBe(401);
    expect(mockedSet).not.toHaveBeenCalled();
  });

  it("returns 404 when the nutrition-v2 flag is off", async () => {
    mockedFlag.mockResolvedValue(false);

    const res = await POST(
      postReq({ slot_id: SLOT_ID, log_date: "2026-06-03", status: "skipped" })
    );

    expect(res.status).toBe(404);
    expect(mockedSet).not.toHaveBeenCalled();
  });

  it("returns 400 on missing fields or an invalid status", async () => {
    expect(
      (await POST(postReq({ log_date: "2026-06-03", status: "skipped" })))
        .status
    ).toBe(400);
    expect(
      (await POST(postReq({ slot_id: SLOT_ID, status: "skipped" }))).status
    ).toBe(400);
    expect(
      (await POST(postReq({ slot_id: SLOT_ID, log_date: "2026-06-03" }))).status
    ).toBe(400);
    expect(
      (
        await POST(
          postReq({
            slot_id: SLOT_ID,
            log_date: "2026-06-03",
            status: "bogus",
          })
        )
      ).status
    ).toBe(400);
    expect(mockedSet).not.toHaveBeenCalled();
  });

  it("returns 404 when the slot is not in the client's own active cycle", async () => {
    mockedSet.mockResolvedValue(null);

    const res = await POST(
      postReq({ slot_id: SLOT_ID, log_date: RECENT, status: "skipped" })
    );

    expect(res.status).toBe(404);
  });

  it("logs eaten_planned with option/comment/photo under the session's own id", async () => {
    mockedSet.mockResolvedValue(
      row({ status: "eaten_planned", option_id: OPTION_ID })
    );

    const res = await POST(
      postReq({
        slot_id: SLOT_ID,
        log_date: RECENT,
        status: "eaten_planned",
        option_id: OPTION_ID,
        comment: "rico",
        photo_url: "https://cdn/meal.jpg",
      })
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(mockedSet).toHaveBeenCalledWith(expect.anything(), 999000001, {
      slotId: SLOT_ID,
      logDate: RECENT,
      status: "eaten_planned",
      optionId: OPTION_ID,
      comment: "rico",
      photoUrl: "https://cdn/meal.jpg",
    });
    expect(body.data.status).toBe("eaten_planned");
  });

  it("logs eaten_other and skipped (no option needed)", async () => {
    mockedSet.mockResolvedValue(row({ status: "eaten_other" }));
    expect(
      (
        await POST(
          postReq({
            slot_id: SLOT_ID,
            log_date: RECENT,
            status: "eaten_other",
          })
        )
      ).status
    ).toBe(201);

    mockedSet.mockResolvedValue(row({ status: "skipped" }));
    expect(
      (
        await POST(
          postReq({
            slot_id: SLOT_ID,
            log_date: RECENT,
            status: "skipped",
          })
        )
      ).status
    ).toBe(201);
  });
});

describe("POST /api/client/meal-logs — log-window guard", () => {
  const TZ = "UTC";
  const today = toYmdInTimezone(new Date(), TZ);

  function postWithTz(body: unknown, tz: string): NextRequest {
    return new NextRequest(
      `http://localhost/api/client/meal-logs?tz=${encodeURIComponent(tz)}`,
      {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
      }
    );
  }

  function log(logDate: string) {
    return { slot_id: SLOT_ID, log_date: logDate, status: "skipped" as const };
  }

  it("rejects a future log_date (400, no write)", async () => {
    const res = await POST(postReq(log(shiftYmd(today, 1))));

    expect(res.status).toBe(400);
    expect(mockedSet).not.toHaveBeenCalled();
  });

  it("rejects a log_date more than 30 days back (400, no write)", async () => {
    const res = await POST(postReq(log(shiftYmd(today, -31))));

    expect(res.status).toBe(400);
    expect(mockedSet).not.toHaveBeenCalled();
  });

  it("rejects a malformed log_date (400, no write)", async () => {
    const res = await POST(postReq(log("2026-13-40")));

    expect(res.status).toBe(400);
    expect(mockedSet).not.toHaveBeenCalled();
  });

  it("accepts today and yesterday (201)", async () => {
    expect((await POST(postReq(log(today)))).status).toBe(201);
    expect((await POST(postReq(log(shiftYmd(today, -1))))).status).toBe(201);
    expect((await POST(postReq(log(shiftYmd(today, -30))))).status).toBe(201);
  });

  it("threads tz: a date that is 'today' in the request tz is accepted", async () => {
    const tz = "Pacific/Auckland";
    const todayThere = toYmdInTimezone(new Date(), tz);

    const res = await POST(postWithTz(log(todayThere), tz));

    expect(res.status).toBe(201);
    expect(mockedSet).toHaveBeenCalled();
  });
});
