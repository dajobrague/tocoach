import { jwtVerify } from "jose";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ getTrainerSession: vi.fn() }));
vi.mock("@/lib/auth/client-session", () => ({ getClientSession: vi.fn() }));
vi.mock("@/lib/clients/supabase-admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

import { GET } from "../route";

import { getClientSession } from "@/lib/auth/client-session";
import { resetRealtimeSelfCheckForTests } from "@/lib/auth/realtime-token";
import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/clients/supabase-admin";

const SECRET = "test-realtime-secret-with-at-least-32-characters";
const SECRET_BYTES = new TextEncoder().encode(SECRET);

const mockedTrainer = vi.mocked(getTrainerSession);
const mockedClient = vi.mocked(getClientSession);
const mockedAdmin = vi.mocked(createSupabaseAdminClient);

// tenants lookup: host <-> slug for one tenant, nothing for the rest.
const TENANT = { host: "coach.example.test", slug: "coach-slug" };

function adminStub() {
  return {
    from: () => ({
      select: () => ({
        eq: (column: string, value: string) => ({
          maybeSingle: async () => {
            const hit =
              (column === "host" && value === TENANT.host) ||
              (column === "slug" && value === TENANT.slug);

            return { data: hit ? TENANT : null, error: null };
          },
        }),
      }),
    }),
  };
}

function req(kind?: string): NextRequest {
  const url = new URL("http://localhost/api/realtime/token");

  if (kind !== undefined) url.searchParams.set("kind", kind);

  return new NextRequest(url);
}

const clientSession = {
  client_id: "42",
  tenant_slug: TENANT.slug,
  email: "c@x",
  iat: 0,
  exp: 0,
};

const trainerSession = {
  trainer_id: "11111111-1111-4111-8111-111111111111",
  tenant_host: TENANT.host,
  email: "t@x",
  iat: 0,
  exp: 0,
};

// Self-check target: PostgREST root. 200 = secret accepted.
const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));

beforeEach(() => {
  vi.clearAllMocks();
  resetRealtimeSelfCheckForTests();
  vi.stubGlobal("fetch", fetchMock);
  process.env.SUPABASE_JWT_SECRET = SECRET;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54421";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  mockedAdmin.mockReturnValue(adminStub() as never);
  mockedTrainer.mockResolvedValue(null);
  mockedClient.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.SUPABASE_JWT_SECRET;
});

async function flushSelfCheck(): Promise<void> {
  // The route fires the check without awaiting it.
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("GET /api/realtime/token", () => {
  it("returns 500 with a clear message when SUPABASE_JWT_SECRET is not set (no JWT_SECRET fallback)", async () => {
    delete process.env.SUPABASE_JWT_SECRET;
    process.env.JWT_SECRET = "the-app-secret-must-not-be-used-here";
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const res = await GET(req("trainer"));
    const body = (await res.json()) as { error: string };

    expect(res.status).toBe(500);
    expect(body.error).toMatch(/SUPABASE_JWT_SECRET/);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringMatching(
        /Falta SUPABASE_JWT_SECRET.*Realtime desactivado.*correlationId=req-/
      )
    );
    expect(mockedTrainer).not.toHaveBeenCalled();
    delete process.env.JWT_SECRET;
  });

  it("returns 400 for a missing or unknown kind", async () => {
    expect((await GET(req())).status).toBe(400);
    expect((await GET(req("admin"))).status).toBe(400);
  });

  it("returns 401 without a session of the requested kind", async () => {
    // A client session must not satisfy a trainer token request.
    mockedClient.mockResolvedValue(clientSession);

    const res = await GET(req("trainer"));

    expect(res.status).toBe(401);
    expect(mockedClient).not.toHaveBeenCalled();
  });

  it("returns 401 for a trainer whose tenant host is unknown", async () => {
    mockedTrainer.mockResolvedValue({
      ...trainerSession,
      tenant_host: "nobody.example.test",
    });

    expect((await GET(req("trainer"))).status).toBe(401);
  });

  it("mints an authenticated token with trainer claims (host + resolved slug)", async () => {
    mockedTrainer.mockResolvedValue(trainerSession);

    const res = await GET(req("trainer"));
    const body = (await res.json()) as { token: string; expiresAt: number };

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");

    const { payload } = await jwtVerify(body.token, SECRET_BYTES, {
      audience: "authenticated",
    });

    expect(payload).toMatchObject({
      role: "authenticated",
      kind: "trainer",
      sub: trainerSession.trainer_id,
      user_id: trainerSession.trainer_id,
      tenant_host: TENANT.host,
      tenant_slug: TENANT.slug,
    });
    expect(payload.exp).toBe(body.expiresAt);
    expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(15 * 60);
  });

  it("mints an authenticated token with client claims (slug + resolved host)", async () => {
    mockedClient.mockResolvedValue(clientSession);

    const res = await GET(req("client"));
    const body = (await res.json()) as { token: string };

    expect(res.status).toBe(200);
    expect(mockedTrainer).not.toHaveBeenCalled();

    const { payload } = await jwtVerify(body.token, SECRET_BYTES);

    expect(payload).toMatchObject({
      role: "authenticated",
      kind: "client",
      sub: "42",
      user_id: "42",
      tenant_host: TENANT.host,
      tenant_slug: TENANT.slug,
    });
  });

  it("signs with SUPABASE_JWT_SECRET, not any other key", async () => {
    mockedClient.mockResolvedValue(clientSession);

    const body = (await (await GET(req("client"))).json()) as { token: string };

    await expect(
      jwtVerify(body.token, new TextEncoder().encode("some-other-secret-xx"))
    ).rejects.toThrow();
  });

  it("self-checks the secret against /rest/v1/ once per process, with the minted token", async () => {
    mockedClient.mockResolvedValue(clientSession);
    const consoleLog = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined);

    const first = (await (await GET(req("client"))).json()) as {
      token: string;
    };

    await GET(req("client"));
    await flushSelfCheck();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const headers = init.headers as Record<string, string>;

    expect(url).toBe("http://127.0.0.1:54421/rest/v1/");
    expect(headers.apikey).toBe("anon-key");
    expect(headers.Authorization).toBe(`Bearer ${first.token}`);
    expect(consoleLog).toHaveBeenCalledWith(
      expect.stringMatching(/self-check ok/)
    );
  });

  it("logs a loud error when Supabase rejects the token (wrong secret) but still returns it", async () => {
    mockedClient.mockResolvedValue(clientSession);
    fetchMock.mockResolvedValueOnce(new Response("", { status: 401 }));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const res = await GET(req("client"));

    await flushSelfCheck();

    expect(res.status).toBe(200);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringMatching(
        /req-.*no coincide con el JWT secret del proyecto\. Realtime no funcionará\./
      )
    );
  });
});
