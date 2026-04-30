/**
 * POST /api/charts/template/apply-to-all
 *
 * Resets every client of this trainer to the template by DELETING all
 * client_chart_configs override rows in the trainer's tenant.
 *
 * Why DELETE rather than overwrite: see spec §6.4.1. The absence of an
 * override row is what makes a client track the template live. If we
 * wrote a row for every client they'd all be "customized" forevermore
 * and template edits would no longer propagate.
 *
 * Auth: trainer-only.
 * Audit: one row per affected client (with before_charts of each deleted
 *        snapshot) so support can manually restore an individual override.
 */

import type { ChartsDocument } from "@/lib/charts/types";

import { NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { writeApplyToAllAudit } from "@/lib/charts/server/audit";
import { authorizeTrainerOnly } from "@/lib/charts/server/auth";

export async function POST(): Promise<NextResponse> {
  const auth = await authorizeTrainerOnly();

  if (!auth.ok) return auth.response;

  const supabase = createSupabaseClient();

  try {
    // 1) Discover client BIGINT ids that this trainer owns.
    //    `clients.tenant` references trainers.id (existing pattern).
    const { data: clientRows, error: clientsErr } = await supabase
      .from("clients")
      .select("id")
      .eq("tenant", auth.actor.trainerId);

    if (clientsErr) {
      console.error("[charts/apply-to-all] clients lookup:", clientsErr);

      return NextResponse.json(
        { success: false, error: "No se pudieron listar los clientes" },
        { status: 500 }
      );
    }
    const clientIds = (clientRows ?? []).map((r) => r.id as number);

    if (clientIds.length === 0) {
      return NextResponse.json(
        { success: true, data: { affected: 0 } },
        { status: 200 }
      );
    }

    // 2) Read current overrides (for audit).
    const { data: existing } = await supabase
      .from("client_chart_configs")
      .select("client_id, charts")
      .eq("tenant_host", auth.actor.tenantHost)
      .in("client_id", clientIds);

    const beforeByClient = new Map<number, ChartsDocument | null>();

    for (const r of existing ?? []) {
      beforeByClient.set(r.client_id as number, r.charts as ChartsDocument);
    }

    // 3) Delete the overrides.
    const { error: delErr, count } = await supabase
      .from("client_chart_configs")
      .delete({ count: "exact" })
      .eq("tenant_host", auth.actor.tenantHost)
      .in("client_id", clientIds);

    if (delErr) {
      console.error("[charts/apply-to-all] delete:", delErr);

      return NextResponse.json(
        { success: false, error: "No se pudieron resetear los overrides" },
        { status: 500 }
      );
    }

    // 4) Best-effort audit (one row per affected client).
    const affected = (existing ?? []).map((r) => ({
      clientIdBigint: r.client_id as number,
      before: (r.charts as ChartsDocument) ?? null,
    }));

    void writeApplyToAllAudit(
      supabase,
      {
        tenantHost: auth.actor.tenantHost,
        actorUserId: auth.actor.trainerId,
      },
      affected
    );

    return NextResponse.json({
      success: true,
      data: { affected: count ?? affected.length },
    });
  } catch (err) {
    console.error("[charts/apply-to-all]", err);

    return NextResponse.json(
      { success: false, error: "Error interno" },
      { status: 500 }
    );
  }
}
