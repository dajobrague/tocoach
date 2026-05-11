/**
 * GET    /api/charts/clients/[clientId] — effective config (override OR template).
 * PUT    /api/charts/clients/[clientId] — save per-client override (If-Match).
 * DELETE /api/charts/clients/[clientId] — reset to template (delete row).
 *
 * Auth:
 *   GET    — trainer (must own client) OR client (must be self)
 *   PUT    — trainer-only (must own client)
 *   DELETE — trainer-only (must own client)
 */

import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { writeChartAudit } from "@/lib/charts/server/audit";
import { authorizeClientAccess } from "@/lib/charts/server/auth";
import {
  loadClientChartConfig,
  loadEffectiveClientCharts,
} from "@/lib/charts/server/template-loader";
import { filterChartsForAudience } from "@/lib/charts/server/visibility";
import { validateDocumentWithRegistry } from "@/lib/charts/registry";
import { chartsDocumentSchema } from "@/lib/charts/validation";

async function resolveClientTrainerId(
  supabase: ReturnType<typeof createSupabaseClient>,
  clientIdBigint: number
): Promise<string | null> {
  const { data, error } = await supabase
    .from("clients")
    .select("tenant")
    .eq("id", clientIdBigint)
    .single();

  if (error || !data) return null;

  return data.tenant as string;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
): Promise<NextResponse> {
  const supabase = createSupabaseClient();
  const { clientId } = await params;
  const auth = await authorizeClientAccess(supabase, clientId);

  if (!auth.ok) return auth.response;

  const trainerId = await resolveClientTrainerId(supabase, auth.clientIdBigint);

  if (!trainerId) {
    return NextResponse.json(
      { success: false, error: "Trainer no encontrado para el cliente" },
      { status: 404 }
    );
  }

  try {
    const effective = await loadEffectiveClientCharts(supabase, {
      tenantHost: auth.tenantHost,
      clientIdBigint: auth.clientIdBigint,
      clientTrainerId: trainerId,
    });

    // Drop trainer-only charts when the caller is a client session.
    // Trainers always see the full doc (they own the config).
    const visibleCharts = filterChartsForAudience(
      effective.charts,
      auth.actor.kind
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          source: effective.source,
          charts: visibleCharts,
          updated_at: effective.updated_at,
        },
      },
      { headers: { ETag: effective.updated_at } }
    );
  } catch (err) {
    console.error("[charts/clients GET]", err);

    return NextResponse.json(
      { success: false, error: "No se pudo cargar la configuración" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
): Promise<NextResponse> {
  const supabase = createSupabaseClient();
  const { clientId } = await params;
  const auth = await authorizeClientAccess(supabase, clientId, {
    trainerOnly: true,
  });

  if (!auth.ok) return auth.response;
  if (auth.actor.kind !== "trainer") {
    return NextResponse.json(
      { success: false, error: "Solo un trainer puede modificar gráficas" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { success: false, error: "Body inválido" },
      { status: 400 }
    );
  }
  const parsed = chartsDocumentSchema.safeParse(body.charts);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: "validation_failed",
        details: parsed.error.flatten(),
      },
      { status: 422 }
    );
  }
  const reg = validateDocumentWithRegistry(parsed.data.charts);

  if (!reg.valid) {
    return NextResponse.json(
      {
        success: false,
        error: "validation_failed",
        details: {
          issues: reg.issues.map((i) => ({ path: i.path, message: i.message })),
        },
      },
      { status: 422 }
    );
  }

  const ifMatch = request.headers.get("if-match");

  try {
    const existing = await loadClientChartConfig(supabase, {
      tenantHost: auth.tenantHost,
      clientIdBigint: auth.clientIdBigint,
    });

    if (ifMatch && existing && ifMatch !== existing.updated_at) {
      return NextResponse.json(
        {
          success: false,
          error: "etag_conflict",
          current_updated_at: existing.updated_at,
        },
        { status: 409 }
      );
    }

    const upsertRes = await supabase
      .from("client_chart_configs")
      .upsert(
        {
          tenant_host: auth.tenantHost,
          client_id: auth.clientIdBigint,
          charts: parsed.data,
        },
        { onConflict: "tenant_host,client_id" }
      )
      .select("id, charts, updated_at")
      .single();

    if (upsertRes.error || !upsertRes.data) {
      console.error("[charts/clients PUT] upsert:", upsertRes.error);

      return NextResponse.json(
        { success: false, error: "No se pudo guardar el override" },
        { status: 500 }
      );
    }

    void writeChartAudit(supabase, {
      tenantHost: auth.tenantHost,
      actorUserId: auth.actor.trainerId,
      targetKind: "client",
      targetId: String(auth.clientIdBigint),
      action: "save",
      before: existing?.charts ?? null,
      after: parsed.data,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: upsertRes.data.id,
          charts: upsertRes.data.charts,
          updated_at: upsertRes.data.updated_at,
        },
      },
      { headers: { ETag: upsertRes.data.updated_at } }
    );
  } catch (err) {
    console.error("[charts/clients PUT]", err);

    return NextResponse.json(
      { success: false, error: "Error interno" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
): Promise<NextResponse> {
  const supabase = createSupabaseClient();
  const { clientId } = await params;
  const auth = await authorizeClientAccess(supabase, clientId, {
    trainerOnly: true,
  });

  if (!auth.ok) return auth.response;
  if (auth.actor.kind !== "trainer") {
    return NextResponse.json(
      { success: false, error: "Solo un trainer puede resetear gráficas" },
      { status: 403 }
    );
  }

  try {
    const existing = await loadClientChartConfig(supabase, {
      tenantHost: auth.tenantHost,
      clientIdBigint: auth.clientIdBigint,
    });

    if (!existing) {
      // Already inheriting the template; idempotent success.
      return NextResponse.json({ success: true, data: { deleted: false } });
    }

    const { error } = await supabase
      .from("client_chart_configs")
      .delete()
      .eq("tenant_host", auth.tenantHost)
      .eq("client_id", auth.clientIdBigint);

    if (error) {
      console.error("[charts/clients DELETE]", error);

      return NextResponse.json(
        { success: false, error: "No se pudo resetear el override" },
        { status: 500 }
      );
    }

    void writeChartAudit(supabase, {
      tenantHost: auth.tenantHost,
      actorUserId: auth.actor.trainerId,
      targetKind: "client",
      targetId: String(auth.clientIdBigint),
      action: "reset_to_template",
      before: existing.charts,
      after: null,
    });

    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch (err) {
    console.error("[charts/clients DELETE]", err);

    return NextResponse.json(
      { success: false, error: "Error interno" },
      { status: 500 }
    );
  }
}
