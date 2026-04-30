/**
 * GET /api/charts/data-sources
 *
 * Returns the catalog adapters PLUS one form-question adapter per numeric
 * question the trainer has defined (in `form_templates.questions_config`).
 * Catalog wins on id collision.
 *
 * Auth: trainer-only.
 *
 * Response shape: a flat array of `ChartDataSource` metadata, in the order
 * the picker should display them.
 */

import { NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { authorizeTrainerOnly } from "@/lib/charts/server/auth";
import {
  listAvailableSources,
  type FormTemplateRow,
} from "@/lib/charts/registry";

export async function GET(): Promise<NextResponse> {
  const auth = await authorizeTrainerOnly();

  if (!auth.ok) return auth.response;

  const supabase = createSupabaseClient();

  try {
    const { data, error } = await supabase
      .from("form_templates")
      .select("form_type, questions_config")
      .eq("tenant_host", auth.actor.tenantHost);

    if (error) {
      console.error("[charts/data-sources] form_templates lookup:", error);

      return NextResponse.json(
        { success: false, error: "No se pudieron cargar las plantillas" },
        { status: 500 }
      );
    }

    const templates = (data ?? []) as FormTemplateRow[];
    const adapters = listAvailableSources(templates);

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
