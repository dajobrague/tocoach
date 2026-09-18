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
import { clearTenantCache } from "@/lib/tenant/loader";

const session = {
  trainer_id: "t-1",
  tenant_host: "fuerzavital",
  email: "v@example.test",
  full_name: "Valentín",
  iat: 0,
  exp: 0,
};

type RpcResult = {
  data?: unknown;
  error?: { code?: string; message?: string } | null;
};

function supabaseStub(opts: {
  tenant: { host: string; slug: string } | null;
  rpc?: RpcResult;
}) {
  const rpc = vi.fn(
    async (): Promise<RpcResult> =>
      opts.rpc ?? { data: { repointed: 3, tables: {} }, error: null }
  );
  const insert = vi.fn(async () => ({ error: null }));
  const update = vi.fn(() => ({ eq: async () => ({ error: null }) }));
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
      insert,
      update,
    }),
    rpc,
  };

  return { client, rpc, insert, update };
}

function post(domain: string) {
  return new NextRequest("http://localhost/api/setup/save-domain", {
    method: "POST",
    body: JSON.stringify({ domain }),
  });
}

describe("POST /api/setup/save-domain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTrainerSession).mockResolvedValue(session as never);
  });

  it("renames an existing tenant through rename_tenant and refreshes cookie + caches", async () => {
    const stub = supabaseStub({
      tenant: { host: "fuerzavital", slug: "fuerzavital" },
    });

    vi.mocked(createSupabaseClient).mockReturnValue(stub.client as never);

    const res = await POST(post("FuerteDeNuevo "));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.domain).toBe("fuertedenuevo");
    expect(stub.rpc).toHaveBeenCalledWith("rename_tenant", {
      p_old_host: "fuerzavital",
      p_new_host: "fuertedenuevo",
    });
    expect(stub.insert).not.toHaveBeenCalled();
    expect(setSessionCookie).toHaveBeenCalledWith(
      expect.anything(),
      "t-1",
      "fuertedenuevo",
      "v@example.test",
      "Valentín"
    );
    expect(clearTenantCache).toHaveBeenCalledWith("fuerzavital");
    expect(clearTenantCache).toHaveBeenCalledWith("fuertedenuevo");
  });

  it("maps unique_violation from rename_tenant to 409", async () => {
    const stub = supabaseStub({
      tenant: { host: "fuerzavital", slug: "fuerzavital" },
      rpc: { data: null, error: { code: "23505", message: "en uso" } },
    });

    vi.mocked(createSupabaseClient).mockReturnValue(stub.client as never);

    const res = await POST(post("tomado"));

    expect(res.status).toBe(409);
    expect(setSessionCookie).not.toHaveBeenCalled();
  });

  it("maps invalid slug from rename_tenant to 400", async () => {
    const stub = supabaseStub({
      tenant: { host: "fuerzavital", slug: "fuerzavital" },
      rpc: { data: null, error: { code: "22023", message: "inválido" } },
    });

    vi.mocked(createSupabaseClient).mockReturnValue(stub.client as never);

    const res = await POST(post("x"));

    expect(res.status).toBe(400);
  });

  it("is a no-op when the slug does not change", async () => {
    const stub = supabaseStub({
      tenant: { host: "fuertedenuevo", slug: "fuertedenuevo" },
    });

    vi.mocked(createSupabaseClient).mockReturnValue(stub.client as never);

    const res = await POST(post("fuertedenuevo"));

    expect(res.status).toBe(200);
    expect(stub.rpc).not.toHaveBeenCalled();
    expect(stub.insert).not.toHaveBeenCalled();
  });

  it("creates the tenant when the trainer has none yet", async () => {
    const stub = supabaseStub({ tenant: null });

    vi.mocked(createSupabaseClient).mockReturnValue(stub.client as never);

    const res = await POST(post("nuevo-coach"));

    expect(res.status).toBe(200);
    expect(stub.insert).toHaveBeenCalledTimes(1);
    expect(stub.rpc).not.toHaveBeenCalled();
    expect(setSessionCookie).toHaveBeenCalledWith(
      expect.anything(),
      "t-1",
      "nuevo-coach",
      "v@example.test",
      "Valentín"
    );
  });
});
