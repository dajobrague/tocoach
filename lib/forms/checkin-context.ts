import type { CheckInSchedule } from "./types";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  fetchCheckinsTemplateDefaultSchedule,
  resolveCheckInScheduleForApi,
} from "./schedule-validation";

export interface CheckInResponseRef {
  id: string;
  submitted_at: string;
  reviewed_at: string | null;
}

export interface CheckInContext {
  /** Horario efectivo: el del cliente → su plantilla → la del entrenador. */
  schedule: CheckInSchedule;
  /** Respuestas de check-in desde `sinceIso`, sin ordenar. */
  responses: CheckInResponseRef[];
}

/**
 * Horario efectivo y respuestas recientes de check-in de varios clientes de
 * un tenant, en tres consultas. Siempre filtra por `tenantHost`.
 *
 * ponytail: `app/api/clients/list/route.ts` resuelve lo mismo en línea; pasar
 * esa ruta a esta función cuando se toque.
 */
export async function loadCheckInContext(
  supabase: SupabaseClient,
  tenantHost: string,
  clientIds: number[],
  sinceIso: string
): Promise<Map<number, CheckInContext>> {
  const out = new Map<number, CheckInContext>();

  if (clientIds.length === 0) return out;

  const [tenantDefault, configs, responses] = await Promise.all([
    fetchCheckinsTemplateDefaultSchedule(supabase, tenantHost, null),
    supabase
      .from("client_form_configs")
      .select("client_id, schedule, template_id")
      .eq("tenant_host", tenantHost)
      .eq("form_type", "checkins")
      .in("client_id", clientIds),
    supabase
      .from("form_responses")
      .select("id, client_id, submitted_at, reviewed_at")
      .eq("tenant_host", tenantHost)
      .eq("form_type", "checkins")
      .in("client_id", clientIds)
      .gte("submitted_at", sinceIso)
      .not("submitted_at", "is", null),
  ]);

  const configById = new Map<
    number,
    { schedule: unknown; template_id: string | null }
  >();

  for (const row of configs.data ?? []) {
    configById.set(row.client_id as number, {
      schedule: row.schedule,
      template_id: (row.template_id as string | null) ?? null,
    });
  }

  const templateIds = [
    ...new Set(
      [...configById.values()]
        .map((c) => c.template_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const templateDefaults = new Map<string, unknown>();

  if (templateIds.length > 0) {
    const { data } = await supabase
      .from("form_templates")
      .select("id, default_schedule")
      .eq("tenant_host", tenantHost)
      .eq("form_type", "checkins")
      .in("id", templateIds);

    for (const t of data ?? []) {
      if (t.id) templateDefaults.set(String(t.id), t.default_schedule);
    }
  }

  const byClient = new Map<number, CheckInResponseRef[]>();

  for (const r of responses.data ?? []) {
    const list = byClient.get(r.client_id as number) ?? [];

    list.push({
      id: String(r.id),
      submitted_at: r.submitted_at as string,
      reviewed_at: (r.reviewed_at as string | null) ?? null,
    });
    byClient.set(r.client_id as number, list);
  }

  for (const id of clientIds) {
    const config = configById.get(id);
    const templateDefault = config?.template_id
      ? (templateDefaults.get(config.template_id) ?? tenantDefault)
      : tenantDefault;

    out.set(id, {
      schedule: resolveCheckInScheduleForApi(
        config?.schedule ?? null,
        templateDefault
      ).schedule,
      responses: byClient.get(id) ?? [],
    });
  }

  return out;
}
