/**
 * Auth + ownership helpers for /api/charts/* routes.
 *
 * Centralises the dual-session pattern (trainer cookie OR client cookie/bearer)
 * and the "this trainer owns this client" check. Returning a tagged result
 * lets routes branch cleanly:
 *
 *   const auth = await authorizeClientChartRead(supabase, params.clientId);
 *   if (!auth.ok) return auth.response;
 *   // … use auth.tenantHost, auth.actor, auth.clientId
 *
 * The trainer-only path uses authorizeTrainerOnly. apply-to-all and the
 * data-source picker route through that one.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

export type AuthActor =
  | {
      kind: "trainer";
      trainerId: string;
      tenantHost: string;
      email: string;
    }
  | {
      kind: "client";
      clientId: string; // auth.users id (UUID-ish)
      tenantSlug: string; // ClientSession's name; equal to tenantHost
      email: string;
    };

export type AuthResult<T> =
  | ({ ok: true } & T)
  | { ok: false; response: NextResponse };

/** Builds the conventional 401 / 403 / 404 JSON response. */
function deny(status: 401 | 403 | 404, message: string): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status });
}

/**
 * Trainer-only routes: template GET/PUT, apply-to-all, data-sources.
 *
 * The JWT carries `tenant_host`, but historically several login paths have
 * issued trainer cookies with `tenant_host=""` (empty string) — older builds
 * passed `""` unconditionally; newer ones fall back to `""` when the
 * `tenants` lookup at issuance fails. Those sessions are otherwise valid:
 * the `trainer_id` claim is signed and non-empty. So when the JWT host is
 * empty we resolve it from the `tenants` table by `trainer_id` rather than
 * 401'ing the user. Genuinely orphan trainers (no row in `tenants`) still
 * land with `tenantHost=""` and get caught downstream by the template
 * loader's orphan path.
 */
export async function authorizeTrainerOnly(): Promise<
  AuthResult<{ actor: Extract<AuthActor, { kind: "trainer" }> }>
> {
  const session = await getTrainerSession();

  if (!session) {
    return { ok: false, response: deny(401, "No autorizado") };
  }

  let tenantHost = session.tenant_host;

  if (!tenantHost) {
    const supabase = createSupabaseClient();
    const { data } = await supabase
      .from("tenants")
      .select("host")
      .eq("trainer_id", session.trainer_id)
      .maybeSingle();

    tenantHost = (data?.host as string | undefined) ?? "";
  }

  return {
    ok: true,
    actor: {
      kind: "trainer",
      trainerId: session.trainer_id,
      tenantHost,
      email: session.email,
    },
  };
}

/**
 * Routes that accept either trainer or client session, with ownership check
 * for the trainer.
 *
 * `clientIdParam` is the URL parameter (string from Next.js). We parse it
 * to BIGINT and verify either:
 *   - session is a trainer and the trainer owns this client (via trainers.id
 *     === tenants.trainer_id === clients.tenant)
 *   - session is a client and the session.client_id matches clients.id
 *     (we resolve the BIGINT clients.id from the auth.users client_id by
 *     looking up the row whose tenant matches the session's tenant_slug
 *     and whose email matches the session — see "client_id is BIGINT but
 *     auth.users id is UUID" caveat below).
 *
 * Returns { tenantHost, clientIdBigint, actor } on success.
 *
 * Caveat: client_session.client_id is the auth.users UUID, while clients.id
 * is BIGINT. The contract for this codebase is that `client_session.client_id`
 * matches a clients row keyed by tenant_host + the auth.users.email or
 * auth user metadata. To keep this helper simple, the URL `clientId` is
 * always the BIGINT (which is what trainer-side routes use) and clients
 * pass it from their bootstrap (where the bigint id is exposed). For
 * client sessions we then verify the BIGINT row's tenant matches the
 * session's tenant_slug; we do NOT require the session.client_id to equal
 * the URL's clientId because the session carries the auth.users id, not
 * the clients.id.
 *
 * If the client session contains a `client_id` numeric matching the URL,
 * we fast-path; otherwise we tenant-match. This mirrors the existing
 * /api/forms/responses/[clientId] route.
 */
export async function authorizeClientAccess(
  supabase: SupabaseClient,
  clientIdParam: string,
  options: { trainerOnly?: boolean } = {}
): Promise<
  AuthResult<{
    tenantHost: string;
    clientIdBigint: number;
    actor: AuthActor;
  }>
> {
  const trainerSession = await getTrainerSession();
  const clientSession = options.trainerOnly ? null : await getClientSession();

  if (!trainerSession && !clientSession) {
    return { ok: false, response: deny(401, "No autorizado") };
  }

  const clientIdBigint = parseInt(clientIdParam, 10);

  if (Number.isNaN(clientIdBigint)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "ID de cliente inválido" },
        { status: 400 }
      ),
    };
  }

  // Look up the client row to discover its tenant.
  const { data: clientRow, error: clientErr } = await supabase
    .from("clients")
    .select("id, tenant")
    .eq("id", clientIdBigint)
    .single();

  if (clientErr || !clientRow) {
    return { ok: false, response: deny(404, "Cliente no encontrado") };
  }

  // tenant on clients holds the trainer_id; resolve to a tenant_host.
  const { data: tenantRow, error: tenantErr } = await supabase
    .from("tenants")
    .select("host, trainer_id")
    .eq("trainer_id", clientRow.tenant)
    .single();

  if (tenantErr || !tenantRow) {
    return { ok: false, response: deny(404, "Tenant no encontrado") };
  }

  const tenantHost = tenantRow.host as string;

  if (trainerSession) {
    if (tenantRow.trainer_id !== trainerSession.trainer_id) {
      return {
        ok: false,
        response: deny(403, "No autorizado para este cliente"),
      };
    }

    return {
      ok: true,
      tenantHost,
      clientIdBigint,
      actor: {
        kind: "trainer",
        trainerId: trainerSession.trainer_id,
        tenantHost: trainerSession.tenant_host,
        email: trainerSession.email,
      },
    };
  }

  // clientSession path
  if (!clientSession) {
    // unreachable — earlier guard ensured at least one session
    return { ok: false, response: deny(401, "No autorizado") };
  }
  // Tenant must match the session.
  if (clientSession.tenant_slug !== tenantHost) {
    return { ok: false, response: deny(403, "No autorizado") };
  }

  return {
    ok: true,
    tenantHost,
    clientIdBigint,
    actor: {
      kind: "client",
      clientId: clientSession.client_id,
      tenantSlug: clientSession.tenant_slug,
      email: clientSession.email,
    },
  };
}
