import type { QuestionConfig } from "@/lib/forms/types";

import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { buildResponsesCsv, type ExportResponse } from "@/lib/forms/export-csv";
import {
  flattenQuestions,
  isFormType,
  isTemplateOnlyForm,
} from "@/lib/forms/types";

const PAGE = 1000;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/forms/export?form_type=checkins[&from=YYYY-MM-DD][&to=YYYY-MM-DD][&client_id=N]
 * Descarga en CSV las respuestas de un formulario de todos los clientes del
 * entrenador (o de uno, con client_id). Solo la cuenta del entrenador (son datos de salud).
 */
export async function GET(request: NextRequest) {
  const correlationId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const session = await getTrainerSession();

  if (!session) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 401 }
    );
  }

  const params = new URL(request.url).searchParams;
  const formType = params.get("form_type");
  const from = params.get("from");
  const to = params.get("to");
  const clientId = params.get("client_id");

  if (
    (clientId !== null && !/^\d+$/.test(clientId)) ||
    !formType ||
    !isFormType(formType) ||
    (from && !YMD.test(from)) ||
    (to && !YMD.test(to))
  ) {
    return NextResponse.json(
      { success: false, error: "Parámetros inválidos" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseClient();

  try {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("host")
      .eq("trainer_id", session.trainer_id)
      .single();

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    const responses: ExportResponse[] = [];

    for (let offset = 0; ; offset += PAGE) {
      let query = supabase
        .from("form_responses")
        .select("id, client_id, submitted_at, created_at, answers")
        .eq("tenant_host", tenant.host)
        .eq("form_type", formType)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + PAGE - 1);

      if (from) query = query.gte("response_date", from);
      if (to) query = query.lte("response_date", to);
      if (clientId) query = query.eq("client_id", Number(clientId));
      const { data, error } = await query;

      if (error) throw error;
      responses.push(...((data ?? []) as ExportResponse[]));
      if (!data || data.length < PAGE) break;
    }

    const clientIds = [...new Set(responses.map((r) => r.client_id))];

    // Orden de columnas: la plantilla del entrenador; luego preguntas que
    // solo existen en la copia de algún cliente (check-ins / hábitos).
    const { data: template } = await supabase
      .from("form_templates")
      .select("questions_config")
      .eq("tenant_host", tenant.host)
      .eq("form_type", formType)
      .maybeSingle();
    const questions: QuestionConfig[] = [];
    const seen = new Set<string>();
    const addAll = (config: unknown) => {
      if (!config) return;
      for (const q of flattenQuestions(config as QuestionConfig[])) {
        if (seen.has(q.id)) continue;
        seen.add(q.id);
        questions.push(q);
      }
    };

    addAll(template?.questions_config);

    const emailByClient = new Map<string, string>();

    for (let i = 0; i < clientIds.length; i += PAGE) {
      const ids = clientIds.slice(i, i + PAGE);
      const { data: clients } = await supabase
        .from("clients")
        .select("id, email")
        .eq("tenant", session.trainer_id)
        .in("id", ids);

      for (const c of clients ?? []) {
        if (c.email) emailByClient.set(String(c.id), c.email);
      }

      if (!isTemplateOnlyForm(formType)) {
        const { data: configs } = await supabase
          .from("client_form_configs")
          .select("questions_config")
          .eq("tenant_host", tenant.host)
          .eq("form_type", formType)
          .in("client_id", ids);

        for (const c of configs ?? []) addAll(c.questions_config);
      }
    }

    const csv = buildResponsesCsv(questions, responses, emailByClient);
    const today = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="respuestas-${formType}${clientId ? `-cliente-${clientId}` : ""}-${today}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    console.error("[forms/export]", { correlationId, err });

    return NextResponse.json(
      { success: false, error: "No se pudo generar la exportación" },
      { status: 500 }
    );
  }
}
