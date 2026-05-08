/**
 * GET  /api/charts/template — read trainer's chart template (lazy-creates).
 * PUT  /api/charts/template — replace the template's charts document.
 *
 * Auth: trainer-only (own row only).
 *
 * PUT enforces optimistic concurrency via `If-Match: <updated_at>` header.
 * On stale ETag returns 409 with the current `updated_at` so the client
 * can refetch and merge.
 *
 * Validation runs in two passes: structural (zod) for the fast 422 path,
 * then registry-aware (chart_type ↔ adapter dimensions) for the dimension
 * rule that needs the catalog/form-question context.
 */

import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { writeChartAudit } from "@/lib/charts/server/audit";
import { authorizeTrainerOnly } from "@/lib/charts/server/auth";
import { loadOrCreateTrainerTemplate } from "@/lib/charts/server/template-loader";
import { validateDocumentWithRegistry } from "@/lib/charts/registry";
import { chartsDocumentSchema } from "@/lib/charts/validation";

export async function GET(): Promise<NextResponse> {
  const auth = await authorizeTrainerOnly();

  if (!auth.ok) return auth.response;

  const supabase = createSupabaseClient();

  try {
    const tpl = await loadOrCreateTrainerTemplate(supabase, {
      tenantHost: auth.actor.tenantHost,
      trainerId: auth.actor.trainerId,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: tpl.id,
          charts: tpl.charts,
          auto_apply_to_new_clients: tpl.auto_apply_to_new_clients,
          updated_at: tpl.updated_at,
        },
      },
      { headers: { ETag: tpl.updated_at } }
    );
  } catch (err) {
    console.error("[charts/template GET]", err);

    return NextResponse.json(
      { success: false, error: "No se pudo cargar la plantilla" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const auth = await authorizeTrainerOnly();

  if (!auth.ok) return auth.response;

  // Parse and structurally validate the body.
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { success: false, error: "Body inválido" },
      { status: 400 }
    );
  }
  const parsed = chartsDocumentSchema.safeParse(body.charts);

  if (!parsed.success) {
    console.error(
      "[charts/template PUT] structural validation failed\n" +
        "Issues: " +
        JSON.stringify(parsed.error.issues, null, 2) +
        "\nBody.charts received: " +
        JSON.stringify(body.charts, null, 2)
    );

    return NextResponse.json(
      {
        success: false,
        error: "validation_failed",
        details: parsed.error.flatten(),
      },
      { status: 422 }
    );
  }

  // Adapter-aware second pass.
  const reg = validateDocumentWithRegistry(parsed.data.charts);

  if (!reg.valid) {
    console.error(
      "[charts/template PUT] adapter validation failed",
      JSON.stringify(reg.issues, null, 2)
    );

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
  const supabase = createSupabaseClient();

  try {
    // Load current to verify ETag and to capture before for audit.
    const current = await loadOrCreateTrainerTemplate(supabase, {
      tenantHost: auth.actor.tenantHost,
      trainerId: auth.actor.trainerId,
    });

    if (ifMatch && ifMatch !== current.updated_at) {
      return NextResponse.json(
        {
          success: false,
          error: "etag_conflict",
          current_updated_at: current.updated_at,
        },
        { status: 409 }
      );
    }

    // `loadOrCreateTrainerTemplate` returns a sentinel `{ id: "ephemeral", ... }`
    // when the trainer's session has no resolvable `tenant_host` (orphan
    // tenant). Updating WHERE id="ephemeral" would 500 with `22P02` because
    // the column is UUID. Refuse cleanly so the editor surfaces a real
    // error instead of a generic 500.
    if (current.id === "ephemeral") {
      console.error(
        `[charts/template PUT] ephemeral template — orphan trainer (trainer_id=${auth.actor.trainerId}, tenant_host=${JSON.stringify(auth.actor.tenantHost)}). Save refused.`
      );

      return NextResponse.json(
        {
          success: false,
          error: "tenant_unresolved",
          message:
            "Tu sesión no tiene un tenant válido. Cierra sesión y vuelve a entrar para reanudar los cambios.",
        },
        { status: 503 }
      );
    }

    // Determine whether the body wants to update the auto_apply flag.
    const autoApply =
      typeof body.auto_apply_to_new_clients === "boolean"
        ? body.auto_apply_to_new_clients
        : current.auto_apply_to_new_clients;

    const update = await supabase
      .from("trainer_chart_templates")
      .update({
        charts: parsed.data,
        auto_apply_to_new_clients: autoApply,
      })
      .eq("id", current.id)
      .select("id, charts, auto_apply_to_new_clients, updated_at")
      .single();

    if (update.error || !update.data) {
      console.error("[charts/template PUT] update error:", update.error);

      return NextResponse.json(
        { success: false, error: "No se pudo guardar la plantilla" },
        { status: 500 }
      );
    }

    // Best-effort audit (non-blocking on the response).
    void writeChartAudit(supabase, {
      tenantHost: auth.actor.tenantHost,
      actorUserId: auth.actor.trainerId,
      targetKind: "template",
      targetId: current.id,
      action: "save",
      before: current.charts,
      after: parsed.data,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: update.data.id,
          charts: update.data.charts,
          auto_apply_to_new_clients: update.data.auto_apply_to_new_clients,
          updated_at: update.data.updated_at,
        },
      },
      { headers: { ETag: update.data.updated_at } }
    );
  } catch (err) {
    console.error("[charts/template PUT]", err);

    return NextResponse.json(
      { success: false, error: "Error interno" },
      { status: 500 }
    );
  }
}
