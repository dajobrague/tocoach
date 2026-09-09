/**
 * GET /api/charts/data-sources
 *
 * Returns the catalog adapters PLUS one form-question adapter per numeric
 * question the trainer has defined — in `form_templates.questions_config` or
 * in any client's `client_form_configs` (per-client custom questions).
 * Catalog wins on id collision.
 *
 * Auth: trainer-only.
 *
 * Response shape: a flat array of `ChartDataSource` metadata, in the order
 * the picker should display them.
 */

import { NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { listAvailableSources } from "@/lib/charts/registry";
import { authorizeTrainerOnly } from "@/lib/charts/server/auth";
import { loadFormQuestionRows } from "@/lib/charts/server/form-question-rows";

export async function GET(): Promise<NextResponse> {
  const auth = await authorizeTrainerOnly();

  if (!auth.ok) return auth.response;

  const supabase = createSupabaseClient();

  try {
    const { rows, error } = await loadFormQuestionRows(
      supabase,
      auth.actor.tenantHost
    );

    if (error !== null) {
      console.error("[charts/data-sources] form_templates lookup:", error);

      return NextResponse.json(
        { success: false, error: "No se pudieron cargar las plantillas" },
        { status: 500 }
      );
    }

    const adapters = listAvailableSources(rows);

    return NextResponse.json({
      success: true,
      data: adapters.map((a) => a.metadata),
    });
  } catch (err) {
    console.error("[charts/data-sources]", err);

    return NextResponse.json(
      { success: false, error: "Error interno" },
      { status: 500 }
    );
  }
}
