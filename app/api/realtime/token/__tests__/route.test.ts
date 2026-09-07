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

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUPABASE_JWT_SECRET = SECRET;
  mockedAdmin.mockReturnValue(adminStub() as never);
  mockedTrainer.mockResolvedValue(null);
  mockedClient.mockResolvedValue(null);
});

afterEach(() => {
  delete process.env.SUPABASE_JWT_SECRET;
});

describe("GET /api/realtime/token", () => {
  it("returns 503 when SUPABASE_JWT_SECRET is not configured", async () => {
    delete process.env.SUPABASE_JWT_SECRET;

    const res = await GET(req("trainer"));

    expect(res.status).toBe(503);
    expect(mockedTrainer).not.toHaveBeenCalled();
  });

  it("returns 400 for a missing or unknown kind", async () => {
    expect((await GET(req())).status).toBe(400);
    expect((await GET(req("admin"))).status).toBe(400);
  });

  it("returns 401 without a session of the requested kind", async () => {
    // A client session must not satisfy a trainer token request.
    mockedClient.mockResolvedValue({
      client_id: "42",
      tenant_slug: TENANT.slug,
      email: "c@x",
      iat: 0,
      exp: 0,
    });

    const res = await GET(req("trainer"));

    expect(res.status).toBe(401);
    expect(mockedClient).not.toHaveBeenCalled();
  });

  it("returns 401 for a trainer whose tenant host is unknown", async () => {
    mockedTrainer.mockResolvedValue({
      trainer_id: "t-1",
      tenant_host: "nobody.example.test",
      email: "t@x",
      iat: 0,
      exp: 0,
    });

    expect((await GET(req("trainer"))).status).toBe(401);
  });

  it("mints an authenticated token with trainer claims (host + resolved slug)", async () => {
    mockedTrainer.mockResolvedValue({
      trainer_id: "11111111-1111-4111-8111-111111111111",
      tenant_host: TENANT.host,
      email: "t@x",
      iat: 0,
      exp: 0,
    });

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
      sub: "11111111-1111-4111-8111-111111111111",
      user_id: "11111111-1111-4111-8111-111111111111",
      tenant_host: TENANT.host,
      tenant_slug: TENANT.slug,
    });
    expect(payload.exp).toBe(body.expiresAt);

    const ttl = (payload.exp ?? 0) - (payload.iat ?? 0);

    expect(ttl).toBe(15 * 60);
  });

  it("mints an authenticated token with client claims (slug + resolved host)", async () => {
    mockedClient.mockResolvedValue({
      client_id: "42",
      tenant_slug: TENANT.slug,
      email: "c@x",
      iat: 0,
      exp: 0,
    });

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
    mockedClient.mockResolvedValue({
      client_id: "42",
      tenant_slug: TENANT.slug,
      email: "c@x",
      iat: 0,
      exp: 0,
    });

    const body = (await (await GET(req("client"))).json()) as { token: string };

    await expect(
      jwtVerify(body.token, new TextEncoder().encode("some-other-secret-xx"))
    ).rejects.toThrow();
  });
});
