import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({
  getTrainerSession: vi.fn(),
  setSessionCookie: vi.fn(),
}));
vi.mock("@/lib/clients/supabase-api", () => ({
  createSupabaseClient: vi.fn(),
}));
vi.mock("@/lib/tenant/loader", () => ({ clearTenantCache: vi.fn() }));

import { POST } from "../route";

import { getTrainerSession, setSessionCookie } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

const THEME = {
  meta: { name: "X" },
  fonts: {},
  colors: {},
  radius: {},
  shadow: {},
};

function supabaseStub(opts: {
  tenant: { host: string; slug: string } | null;
  rpcError?: { code?: string; message?: string } | null;
}) {
  const rpc = vi.fn(async () => ({
    data: opts.rpcError ? null : { repointed: 1, tables: {} },
    error: opts.rpcError ?? null,
  }));
  const saved = { host: "fuertedenuevo", slug: "fuertedenuevo" };
  const update = vi.fn(() => ({
    eq: () =>
      Object.assign(Promise.resolve({ data: null, error: null }), {
        select: () => ({ single: async () => ({ data: saved, error: null }) }),
      }),
  }));
  const client = {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: table === "tenants" ? opts.tenant : null,
            error: null,
          }),
        }),
      }),
      update,
      insert: vi.fn(() => ({
        select: () => ({ single: async () => ({ data: saved, error: null }) }),
      })),
    }),
    rpc,
  };

  return { client, rpc, update };
}

function post(domain: string) {
  return new NextRequest("http://localhost/api/setup/save-configuration", {
    method: "POST",
    body: JSON.stringify({ domain, themeJson: THEME }),
  });
}

describe("POST /api/setup/save-configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTrainerSession).mockResolvedValue({
      trainer_id: "t-1",
      tenant_host: "fuerzavital",
      email: "v@example.test",
      full_name: "Valentín",
      iat: 0,
      exp: 0,
    } as never);
  });

  it("renames through rename_tenant when the slug changes, then saves the theme", async () => {
    const stub = supabaseStub({
      tenant: { host: "fuerzavital", slug: "fuerzavital" },
    });

    vi.mocked(createSupabaseClient).mockReturnValue(stub.client as never);

    const res = await POST(post("fuertedenuevo"));

    expect(res.status).toBe(200);
    expect(stub.rpc).toHaveBeenCalledWith("rename_tenant", {
      p_old_host: "fuerzavital",
      p_new_host: "fuertedenuevo",
    });
    expect(stub.update).toHaveBeenCalled();
    expect(setSessionCookie).toHaveBeenCalledWith(
      expect.anything(),
      "t-1",
      "fuertedenuevo",
      "v@example.test",
      "Valentín"
    );
  });

  it("does not rename when the slug is unchanged", async () => {
    const stub = supabaseStub({
      tenant: { host: "fuertedenuevo", slug: "fuertedenuevo" },
    });

    vi.mocked(createSupabaseClient).mockReturnValue(stub.client as never);

    const res = await POST(post("fuertedenuevo"));

    expect(res.status).toBe(200);
    expect(stub.rpc).not.toHaveBeenCalled();
  });

  it("stops with 409 when the new slug is taken", async () => {
    const stub = supabaseStub({
      tenant: { host: "fuerzavital", slug: "fuerzavital" },
      rpcError: { code: "23505" },
    });

    vi.mocked(createSupabaseClient).mockReturnValue(stub.client as never);

    const res = await POST(post("tomado"));

    expect(res.status).toBe(409);
    expect(stub.update).not.toHaveBeenCalled();
    expect(setSessionCookie).not.toHaveBeenCalled();
  });
});
