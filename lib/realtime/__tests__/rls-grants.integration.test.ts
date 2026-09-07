/**
 * Verifies the grant/policy state installed by
 * supabase/migrations/20260907120000_revoke_anon_table_access.sql against the
 * local stack, through PostgREST (the same RLS evaluation Realtime applies):
 *
 *   - the public anon key can no longer read tables or call the SECURITY
 *     DEFINER RPCs;
 *   - an app-signed `authenticated` token sees only its own tenant's rows in
 *     messages / notifications and nothing anywhere else.
 *
 * Needs `.env.test` with NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY and SUPABASE_JWT_SECRET (local values from
 * `supabase status -o env`).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SignJWT } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  ensureTestClient,
  ensureTestTenant,
  ensureTestTrainer,
  TEST_CLIENT_ID,
  TEST_TENANT_HOST,
  TEST_TRAINER_ID,
} from "@/lib/test/nutrition-test-db";
import { createSupabaseTestClient } from "@/lib/test/supabase-test-client";

const PERMISSION_DENIED = "42501";

const OTHER_TENANT_HOST = "rls-test-other.local";
const OTHER_CLIENT_ID = 999000002;

function env(name: string): string {
  const value = process.env[name];

  if (value === undefined || value.length === 0) {
    throw new Error(`Missing ${name} — load .env.test`);
  }

  return value;
}

interface Claims {
  kind: "trainer" | "client";
  user_id: string;
  tenant_host: string;
  tenant_slug: string;
}

async function signToken(
  claims: Claims,
  options: { withRole?: boolean } = {}
): Promise<string> {
  const { withRole = true } = options;
  const payload: Record<string, string> = { ...claims };

  if (withRole) payload.role = "authenticated";

  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.user_id)
    .setAudience("authenticated")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(new TextEncoder().encode(env("SUPABASE_JWT_SECRET")));
}

function anonClient(): SupabaseClient {
  return createClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

function tokenClient(token: string): SupabaseClient {
  return createClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    { accessToken: async () => token }
  );
}

const admin = createSupabaseTestClient();

let messageIds: string[] = [];
let notificationIds: string[] = [];

beforeAll(async () => {
  await ensureTestTenant(admin);
  await ensureTestTrainer(admin);
  await ensureTestClient(admin);

  const tenant = await admin.from("tenants").upsert(
    {
      host: OTHER_TENANT_HOST,
      slug: OTHER_TENANT_HOST,
      theme_slug: "default",
      status: "inactive",
    },
    { onConflict: "host" }
  );

  if (tenant.error) throw new Error(tenant.error.message);

  const client = await admin.from("clients").upsert(
    {
      id: OTHER_CLIENT_ID,
      name: "RLS Other Client",
      email: "rls-other@test",
    },
    { onConflict: "id" }
  );

  if (client.error) throw new Error(client.error.message);

  const messages = await admin
    .from("messages")
    .insert([
      {
        tenant_slug: TEST_TENANT_HOST,
        client_id: TEST_CLIENT_ID,
        sender_type: "trainer",
        sender_id: TEST_TRAINER_ID,
        sender_name: "Test Trainer",
        message: "tenant A message",
      },
      {
        tenant_slug: OTHER_TENANT_HOST,
        client_id: OTHER_CLIENT_ID,
        sender_type: "trainer",
        sender_id: "other-trainer",
        sender_name: "Other Trainer",
        message: "tenant B message",
      },
    ])
    .select("id");

  if (messages.error) throw new Error(messages.error.message);
  messageIds = (messages.data ?? []).map((row) => String(row.id));

  const notifications = await admin
    .from("notifications")
    .insert([
      {
        // chat-style row: slug in tenant_slug (== host for the test tenant)
        tenant_slug: TEST_TENANT_HOST,
        client_id: TEST_CLIENT_ID,
        trainer_id: TEST_TRAINER_ID,
        type: "message",
        title: "for client A",
        message: "hi",
        icon: "solar:chat-round-dots-bold",
        metadata: { audience: "client" },
      },
      {
        tenant_slug: OTHER_TENANT_HOST,
        client_id: OTHER_CLIENT_ID,
        type: "message",
        title: "for client B",
        message: "hi",
        icon: "solar:chat-round-dots-bold",
      },
    ])
    .select("id");

  if (notifications.error) throw new Error(notifications.error.message);
  notificationIds = (notifications.data ?? []).map((row) => String(row.id));
});

afterAll(async () => {
  if (messageIds.length > 0) {
    await admin.from("messages").delete().in("id", messageIds);
  }
  if (notificationIds.length > 0) {
    await admin.from("notifications").delete().in("id", notificationIds);
  }
  await admin.from("clients").delete().eq("id", OTHER_CLIENT_ID);
  await admin.from("tenants").delete().eq("host", OTHER_TENANT_HOST);
});

describe("anon key after the revoke migration", () => {
  it("cannot read clients", async () => {
    const { data, error } = await anonClient()
      .from("clients")
      .select("id")
      .limit(1);

    expect(data).toBeNull();
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it("cannot read messages", async () => {
    const { error } = await anonClient().from("messages").select("id").limit(1);

    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it("cannot write", async () => {
    const { error } = await anonClient()
      .from("client_goals")
      .insert({ client_id: TEST_CLIENT_ID });

    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it("cannot call the SECURITY DEFINER rpc", async () => {
    const { error } = await anonClient().rpc("get_trainer_deletion_impact", {
      trainer_uuid: TEST_TRAINER_ID,
    });

    expect(error?.code).toBe(PERMISSION_DENIED);
  });
});

describe("app-signed realtime token", () => {
  const trainerA: Claims = {
    kind: "trainer",
    user_id: TEST_TRAINER_ID,
    tenant_host: TEST_TENANT_HOST,
    tenant_slug: TEST_TENANT_HOST,
  };
  const clientA: Claims = {
    kind: "client",
    user_id: String(TEST_CLIENT_ID),
    tenant_host: TEST_TENANT_HOST,
    tenant_slug: TEST_TENANT_HOST,
  };

  it("trainer sees only messages of its own tenant", async () => {
    const supabase = tokenClient(await signToken(trainerA));
    const { data, error } = await supabase
      .from("messages")
      .select("tenant_slug")
      .in("id", messageIds);

    expect(error).toBeNull();
    expect(data).toEqual([{ tenant_slug: TEST_TENANT_HOST }]);
  });

  it("client sees only its own conversation", async () => {
    const supabase = tokenClient(await signToken(clientA));
    const { data } = await supabase
      .from("messages")
      .select("client_id")
      .in("id", messageIds);

    expect(data).toEqual([{ client_id: TEST_CLIENT_ID }]);

    const stranger = tokenClient(
      await signToken({ ...clientA, user_id: "424242" })
    );
    const strangerRows = await stranger
      .from("messages")
      .select("id")
      .in("id", messageIds);

    expect(strangerRows.data).toEqual([]);
  });

  it("a tenant-B trainer sees only tenant B (symmetric)", async () => {
    const supabase = tokenClient(
      await signToken({
        kind: "trainer",
        user_id: "other-trainer",
        tenant_host: OTHER_TENANT_HOST,
        tenant_slug: OTHER_TENANT_HOST,
      })
    );
    const { data, error } = await supabase
      .from("messages")
      .select("tenant_slug")
      .in("id", messageIds);

    expect(error).toBeNull();
    expect(data).toEqual([{ tenant_slug: OTHER_TENANT_HOST }]);
  });

  it("a tenant-A token gets nothing from tenant B even when filtering for it", async () => {
    const supabase = tokenClient(await signToken(trainerA));
    const { data, error } = await supabase
      .from("messages")
      .select("id")
      .eq("tenant_slug", OTHER_TENANT_HOST);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("client sees only its own notifications", async () => {
    const supabase = tokenClient(await signToken(clientA));
    const { data } = await supabase
      .from("notifications")
      .select("title")
      .in("id", notificationIds);

    expect(data).toEqual([{ title: "for client A" }]);
  });

  it("has no access to any other table", async () => {
    const supabase = tokenClient(await signToken(trainerA));
    const { error } = await supabase.from("clients").select("id").limit(1);

    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it("is treated as anon without the role claim", async () => {
    const supabase = tokenClient(
      await signToken(trainerA, { withRole: false })
    );
    const { error } = await supabase.from("messages").select("id").limit(1);

    expect(error?.code).toBe(PERMISSION_DENIED);
  });
});
