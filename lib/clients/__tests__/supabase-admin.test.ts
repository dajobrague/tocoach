import { afterEach, describe, expect, it } from "vitest";

import { createSupabaseAdminClient } from "../supabase-admin";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("createSupabaseAdminClient", () => {
  it("throws when SUPABASE_SERVICE_ROLE_KEY is missing", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54421";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect(() => createSupabaseAdminClient()).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY/
    );
  });

  it("throws when the service key is blank", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54421";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "   ";

    expect(() => createSupabaseAdminClient()).toThrow();
  });

  it("builds a client when both vars are set", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54421";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

    const client = createSupabaseAdminClient();

    expect(typeof client.from).toBe("function");
  });
});
