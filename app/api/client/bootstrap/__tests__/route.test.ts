import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/client-session", () => ({
  getClientSession: vi.fn(),
  updateClientLastLogin: vi.fn(async () => undefined),
}));
vi.mock("@/lib/clients/supabase-api", () => ({
  createSupabaseClient: vi.fn(),
}));

import { GET } from "../route";

import {
  getClientSession,
  updateClientLastLogin,
} from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

const HOUR = 60 * 60 * 1000;

function supabaseStub(lastLoginAt: string | null, portalLocked = false) {
  const rows: Record<string, unknown> = {
    tenants: { logo_url: "", theme_json: {}, trainer_id: null },
    clients: {
      id: 42,
      name: "Ana",
      last_name: "Ruiz",
      profile_picture_url: null,
      last_login_at: lastLoginAt,
      portal_locked: portalLocked,
    },
  };

  return {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: rows[table] ?? null, error: null }),
        }),
      }),
    }),
  };
}

describe("GET /api/client/bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getClientSession).mockResolvedValue({
      client_id: "42",
      tenant_slug: "coach",
      email: "ana@example.test",
      full_name: "Ana Ruiz",
      iat: 0,
      exp: 0,
    } as never);
  });

  it("stamps last access when the last stamp is older than an hour", async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(
      supabaseStub(new Date(Date.now() - 2 * 24 * HOUR).toISOString()) as never
    );

    const res = await GET(
      new NextRequest("http://localhost/api/client/bootstrap")
    );

    expect(res.status).toBe(200);
    expect(updateClientLastLogin).toHaveBeenCalledWith("42");
  });

  it("tells the app when the trainer has not unlocked the plan yet", async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(
      supabaseStub(new Date().toISOString(), true) as never
    );
    const locked = await GET(
      new NextRequest("http://localhost/api/client/bootstrap")
    );

    expect((await locked.json()).data.portalLocked).toBe(true);

    vi.mocked(createSupabaseClient).mockReturnValue(
      supabaseStub(new Date().toISOString()) as never
    );
    const open = await GET(
      new NextRequest("http://localhost/api/client/bootstrap")
    );

    expect((await open.json()).data.portalLocked).toBe(false);
  });

  it("stamps last access when the client has never logged in", async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(
      supabaseStub(null) as never
    );

    await GET(new NextRequest("http://localhost/api/client/bootstrap"));

    expect(updateClientLastLogin).toHaveBeenCalledWith("42");
  });

  it("does not re-stamp within the hour", async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(
      supabaseStub(new Date(Date.now() - 5 * 60 * 1000).toISOString()) as never
    );

    await GET(new NextRequest("http://localhost/api/client/bootstrap"));

    expect(updateClientLastLogin).not.toHaveBeenCalled();
  });
});
