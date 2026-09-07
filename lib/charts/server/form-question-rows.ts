import type { FormTemplateRow } from "@/lib/charts/registry";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Every form definition whose questions can feed a chart: the tenant's
 * active `form_templates` PLUS each client's own `client_form_configs`
 * (questions a trainer adds to one client's form live only there). Both
 * tables share the `form_type` + `questions_config` shape the registry reads;
 * the registry dedupes by `form_type:question_id`, so a question present in
 * many client configs lists once.
 *
 * `error` is set only when the template query fails (callers fail-open on
 * it, as before). A client-config failure degrades to templates only.
 */
export async function loadFormQuestionRows(
  supabase: SupabaseClient,
  tenantHost: string
): Promise<{ rows: FormTemplateRow[]; error: string | null }> {
  const [templates, clientConfigs] = await Promise.all([
    supabase
      .from("form_templates")
      .select("form_type, questions_config")
      .eq("tenant_host", tenantHost)
      .eq("is_active", true),
    // ponytail: loads every client config of the tenant (clients × 2 rows of
    // JSONB); paginate or index per question if picker latency shows up.
    supabase
      .from("client_form_configs")
      .select("form_type, questions_config")
      .eq("tenant_host", tenantHost),
  ]);

  if (templates.error) {
    return { rows: [], error: templates.error.message };
  }

  if (clientConfigs.error) {
    console.warn(
      `[charts] client_form_configs lookup tenant=${tenantHost}: ${clientConfigs.error.message}. Listing template questions only.`
    );
  }

  return {
    rows: [
      ...((templates.data ?? []) as FormTemplateRow[]),
      ...((clientConfigs.data ?? []) as FormTemplateRow[]),
    ],
    error: null,
  };
}
