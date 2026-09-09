import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSupabaseAdminClient } from "../supabase-admin";

const ORIGINAL_ENV = { ...process.env };
const SERVICE_KEY = "service-role-key";

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54421";
  process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

describe("createSupabaseAdminClient", () => {
  it("throws when SUPABASE_SERVICE_ROLE_KEY is missing", () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect(() => createSupabaseAdminClient()).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY/
    );
  });

  it("throws when the service key is blank", () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "   ";

    expect(() => createSupabaseAdminClient()).toThrow();
  });

  it("builds a client when both vars are set", () => {
    expect(typeof createSupabaseAdminClient().from).toBe("function");
  });

  /**
   * The most important line of the RLS hardening: routes such as
   * /api/auth/login call auth.signInWithPassword() and then .from() on the
   * same client. supabase-js keeps that GoTrue session in memory and would
   * send the user's JWT (role `authenticated`, which has no grants) unless
   * the factory pins Authorization to the service role in global.headers
   * (@supabase/supabase-js dist/main/lib/fetch.js: an Authorization header
   * already present wins over the in-memory access token).
   */
  it("keeps sending the service role to PostgREST after a sign-in on the same client", async () => {
    const userToken = await new SignJWT({ role: "authenticated" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("11111111-1111-4111-8111-111111111111")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("gotrue-secret-for-this-test-only"));

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = String(input);

        if (url.includes("/auth/v1/token")) {
          return new Response(
            JSON.stringify({
              access_token: userToken,
              token_type: "bearer",
              expires_in: 3600,
              refresh_token: "refresh",
              user: {
                id: "11111111-1111-4111-8111-111111111111",
                aud: "authenticated",
                email: "t@x",
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }

        return new Response("[]", {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = createSupabaseAdminClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: "t@x",
      password: "pw",
    });

    expect(error).toBeNull();
    expect(data.session?.access_token).toBe(userToken);

    await client.from("trainers").select("id");

    const restCall = fetchMock.mock.calls.find(([input]) =>
      String(input).includes("/rest/v1/trainers")
    );

    expect(restCall).toBeDefined();

    const headers = new Headers(restCall?.[1]?.headers);

    expect(headers.get("Authorization")).toBe(`Bearer ${SERVICE_KEY}`);
    expect(headers.get("apikey")).toBe(SERVICE_KEY);
  });
});
