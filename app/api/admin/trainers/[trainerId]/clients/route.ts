// Admin endpoint: list clients belonging to a specific trainer.
import { NextRequest, NextResponse } from "next/server";

import { verifyAdminRequest } from "@/lib/auth/admin-auth";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { hasClientPassword } from "@/lib/auth/client-password";
import { fetchAll } from "@/lib/admin/fetch-all";
import {
  ACTIVITY_WEEKS,
  computeClientActivity,
} from "@/lib/admin/client-activity";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trainerId: string }> }
) {
  const { trainerId } = await params;
  const supabase = createSupabaseClient();
  const since = new Date(Date.now() - ACTIVITY_WEEKS * 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  // The DB is a transatlantic round trip away, so everything — including the
  // admin check — runs concurrently. Reads are side-effect free and nothing
  // is returned unless the check passes.
  // ponytail: rows are aggregated in JS (~5k for a 40-client trainer).
  // Move to a SQL view/RPC if a single trainer grows past ~100k log rows.
  const authP = verifyAdminRequest(request);
  const dataP = Promise.all([
    // clients.tenant holds the trainer's UUID (legacy column name).
    supabase
      .from("clients")
      .select(
        "id, email, name, last_name, status, last_login_at, sign_up_date, password, password_hash"
      )
      .eq("tenant", trainerId)
      .order("sign_up_date", { ascending: false }),
    // exercise_logs.trainer_id always matches the client's trainer (verified
    // on prod, 36k rows) — filtering on it avoids waiting for the client ids.
    fetchAll<{
      client_id: number;
      training_date: string | null;
      created_at: string;
    }>((from, to, withCount) =>
      supabase
        .from("exercise_logs")
        .select(
          "client_id, training_date, created_at",
          withCount ? { count: "exact" } : undefined
        )
        .eq("trainer_id", trainerId)
        .or(
          `training_date.gte.${since},and(training_date.is.null,created_at.gte.${since})`
        )
        .order("id")
        .range(from, to)
    ),
    fetchAll<{ client_id: number; form_type: string; created_at: string }>(
      (from, to, withCount) =>
        supabase
          .from("form_responses")
          .select(
            "client_id, form_type, created_at, clients!inner(tenant)",
            withCount ? { count: "exact" } : undefined
          )
          .eq("clients.tenant", trainerId)
          .gte("created_at", since)
          .order("id")
          .range(from, to)
    ),
  ]);

  // Don't leave a rejected promise unobserved if auth fails first.
  dataP.catch(() => undefined);

  const { isAdmin } = await authP;

  if (!isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const [{ data: clients, error }, logs, forms] = await dataP;

    if (error) throw error;

    const { activity, weeks } = computeClientActivity(
      logs.map((l) => ({
        client_id: l.client_id,
        day: l.training_date ?? l.created_at.slice(0, 10),
      })),
      forms
    );

    // Don't echo the password field — only whether one is set, so the admin
    // UI can show "needs password setup".
    const sanitized = (clients ?? []).map((c: any) => ({
      id: c.id,
      email: c.email,
      name: c.name,
      last_name: c.last_name,
      status: c.status,
      last_login_at: c.last_login_at,
      sign_up_date: c.sign_up_date,
      hasPassword: hasClientPassword(c),
      ...activity(c.id),
    }));

    return NextResponse.json({ clients: sanitized, weeks }, { status: 200 });
  } catch (error) {
    console.error("[AdminTrainerClients] Unexpected error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
