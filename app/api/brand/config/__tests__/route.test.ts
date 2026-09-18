import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getTrainerSession: vi.fn() }));
vi.mock("@/lib/clients/supabase-api", () => ({
  createSupabaseClient: vi.fn(),
}));
vi.mock("@/lib/tenant/loader", () => ({ clearTenantCache: vi.fn() }));

import { GET, PATCH } from "../route";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

const THEME = {
  meta: {
    name: "Fuerza Vital",
    logoText: "Fuerza Vital",
    description: "Fuerza Vital - Plataforma de Coaching",
    domain: "fuerzavital",
    version: "1.0.0",
  },
  logo: { text: "Fuerza Vital", size: "medium", position: "left" },
  colors: { brand: "#0E3158", surface: { "1": "#ffffff", "2": "#f8fafc" } },
  fonts: { heading: "Poppins", body: "Poppins" },
};

type UpdatePayload = { theme_json: typeof THEME };

function supabaseStub() {
  const update = vi.fn((_payload: UpdatePayload) => ({
    eq: async () => ({ error: null }),
  }));
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: {
              theme_json: THEME,
              host: "fuerzavital",
              slug: "fuerzavital",
            },
            error: null,
          }),
        }),
      }),
      update,
    }),
  };

  return { client, update };
}

function patch(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/brand/config", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("GET /api/brand/config", () => {
  it("resolves the logo past a persisted blob: preview (what clients see)", async () => {
    const real =
      "https://x.supabase.co/storage/v1/object/public/trainer-logos/t/logo.png";

    vi.mocked(getTrainerSession).mockResolvedValue({
      trainer_id: "t-1",
      tenant_host: "joangarcia",
      email: "j@example.test",
      full_name: "Joan",
      iat: 0,
      exp: 0,
    } as never);
    vi.mocked(createSupabaseClient).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: {
                slug: "joangarcia",
                host: "joangarcia",
                theme_slug: "default",
                logo_url: "blob:https://app.topcoach.io/39d5e669",
                theme_json: { assets: { logo: "blob:x" }, logo: { url: real } },
              },
              error: null,
            }),
          }),
        }),
      }),
    } as never);

    const res = await GET(new NextRequest("http://localhost/api/brand/config"));

    expect(res.status).toBe(200);
    expect((await res.json()).logo_url).toBe(real);
  });
});

describe("PATCH /api/brand/config", () => {
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

  it("brand_name renames the platform everywhere the old name lives in theme_json", async () => {
    const stub = supabaseStub();

    vi.mocked(createSupabaseClient).mockReturnValue(stub.client as never);

    const res = await PATCH(patch({ brand_name: "  Fuerte de Nuevo " }));

    expect(res.status).toBe(200);
    expect(stub.update).toHaveBeenCalledTimes(1);

    const payload = stub.update.mock.calls[0]?.[0];

    expect(payload?.theme_json.meta.name).toBe("Fuerte de Nuevo");
    expect(payload?.theme_json.meta.logoText).toBe("Fuerte de Nuevo");
    expect(payload?.theme_json.meta.description).toBe(
      "Fuerte de Nuevo - Plataforma de Coaching"
    );
    expect(payload?.theme_json.logo.text).toBe("Fuerte de Nuevo");
    expect(payload?.theme_json.meta.domain).toBe("fuerzavital");
  });

  it("ignores an empty brand_name", async () => {
    const stub = supabaseStub();

    vi.mocked(createSupabaseClient).mockReturnValue(stub.client as never);

    const res = await PATCH(patch({ brand_name: "   " }));

    expect(res.status).toBe(200);

    const payload = stub.update.mock.calls[0]?.[0];

    expect(payload?.theme_json.meta.name).toBe("Fuerza Vital");
  });
});
