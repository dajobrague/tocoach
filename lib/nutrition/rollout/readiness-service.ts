import type { ClientDietPdf } from "@/lib/nutrition/diet-fallback";
import type { NutritionGoals } from "@/lib/nutrition/goals/client-goals-service";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Per-client readiness for the V1→V2 nutrition rollout (the wizard's
 * "Revisa tus clientes" step): for every client of the tenant, what their
 * Nutrición page will show the moment `nutrition_v2_enabled` flips —
 * resolved with the same delivery-ladder precedence the client page uses
 * (active v2 plan → PDF → goals-only → empty).
 */

/** What the client will see after the switch. */
export type ClientDietVerdict =
  /** Has an active v2 meal plan — sees it. */
  | "plan_v2"
  /** Sees a PDF diet (v2 upload or legacy pointer). */
  | "pdf"
  /** Sees the goals-only view (default goals and/or named presets). */
  | "goals"
  /** ⚠️ Has an active STRUCTURED legacy plan that v2 cannot render, and no
   *  fallback — their visible diet disappears until a v2 plan/PDF exists. */
  | "at_risk"
  /** Nothing today, nothing after — the neutral empty state. */
  | "none";

export interface ClientDietPreset extends NutritionGoals {
  id: string;
  name: string;
}

export interface ClientReadiness {
  clientId: number;
  name: string;
  verdict: ClientDietVerdict;
  /** Present for verdict "pdf" — feeds the phone-frame preview. */
  pdf?: ClientDietPdf;
  /** Present for verdict "goals" — feeds the phone-frame preview. */
  goals?: NutritionGoals | null;
  presets?: ClientDietPreset[];
}

/** Pure ladder resolution — mirrors the client page's precedence exactly. */
export function resolveClientVerdict(input: {
  hasActiveV2Plan: boolean;
  hasPdf: boolean;
  hasGoals: boolean;
  hasStructuredV1Plan: boolean;
}): ClientDietVerdict {
  if (input.hasActiveV2Plan) {
    return "plan_v2";
  }

  if (input.hasPdf) {
    return "pdf";
  }

  if (input.hasGoals) {
    return "goals";
  }

  return input.hasStructuredV1Plan ? "at_risk" : "none";
}

/**
 * Resolve every client of the tenant in a fixed number of bulk queries (7),
 * regardless of client count — never one query per client.
 *
 * `trainerId` scopes the client list (clients.tenant carries the trainer's
 * UUID); everything else is tenant_host-scoped like the rest of nutrition-v2.
 */
export async function listClientReadiness(
  client: SupabaseClient,
  tenantHost: string,
  trainerId: string
): Promise<ClientReadiness[]> {
  const [clients, activePlans, v2Pdfs, legacyPlans, goals, presets] =
    await Promise.all([
      fetchClients(client, trainerId),
      fetchActiveV2PlanClientIds(client, tenantHost),
      fetchV2Pdfs(client, tenantHost),
      fetchLegacyPlans(client, tenantHost),
      fetchGoals(client, tenantHost),
      fetchPresets(client, tenantHost),
    ]);

  return clients.map((row) => {
    const clientId = row.id;
    // Same precedence as getClientDietPdf: v2 upload first, newest legacy
    // pointer as the fallback (legacyPlans arrive newest-first).
    const pdf =
      v2Pdfs.get(clientId) ??
      legacyPlans.find(
        (plan) => plan.clientId === clientId && plan.pdf !== null
      )?.pdf ??
      null;
    const clientGoals = goals.get(clientId) ?? null;
    const clientPresets = presets.get(clientId) ?? [];
    const verdict = resolveClientVerdict({
      hasActiveV2Plan: activePlans.has(clientId),
      hasPdf: pdf !== null,
      hasGoals: clientGoals !== null || clientPresets.length > 0,
      hasStructuredV1Plan: legacyPlans.some(
        (plan) => plan.clientId === clientId && plan.structured
      ),
    });

    const readiness: ClientReadiness = {
      clientId,
      name: row.name,
      verdict,
    };

    if (verdict === "pdf" && pdf !== null) {
      readiness.pdf = pdf;
    }

    if (verdict === "goals") {
      readiness.goals = clientGoals;
      readiness.presets = clientPresets;
    }

    return readiness;
  });
}

// ─── Bulk fetch helpers (each: one query, defensively typed) ────────────────

async function fetchClients(
  client: SupabaseClient,
  trainerId: string
): Promise<{ id: number; name: string }[]> {
  const { data, error } = await client
    .from("clients")
    .select("id, name")
    .eq("tenant", trainerId)
    .order("name", { ascending: true });

  if (error !== null) {
    throw new Error(`readiness clients: ${error.message}`);
  }

  return (data ?? [])
    .map((row) => ({
      id: Number((row as { id: unknown }).id),
      name: `${(row as { name: unknown }).name ?? ""}`.trim() || "Sin nombre",
    }))
    .filter((row) => Number.isInteger(row.id) && row.id > 0);
}

async function fetchActiveV2PlanClientIds(
  client: SupabaseClient,
  tenantHost: string
): Promise<Set<number>> {
  const { data, error } = await client
    .from("meal_cycles")
    .select("client_id")
    .eq("tenant_host", tenantHost)
    .eq("status", "active");

  if (error !== null) {
    throw new Error(`readiness meal_cycles: ${error.message}`);
  }

  return new Set(
    (data ?? []).map((row) => Number((row as { client_id: unknown }).client_id))
  );
}

async function fetchV2Pdfs(
  client: SupabaseClient,
  tenantHost: string
): Promise<Map<number, ClientDietPdf>> {
  const { data, error } = await client
    .from("client_diet_pdfs")
    .select("client_id, pdf_url, pdf_name")
    .eq("tenant_host", tenantHost);

  if (error !== null) {
    throw new Error(`readiness client_diet_pdfs: ${error.message}`);
  }

  const map = new Map<number, ClientDietPdf>();

  for (const raw of data ?? []) {
    const row = raw as {
      client_id: unknown;
      pdf_url: unknown;
      pdf_name: unknown;
    };
    const url = typeof row.pdf_url === "string" ? row.pdf_url.trim() : "";

    if (url.length > 0) {
      map.set(Number(row.client_id), {
        url,
        name:
          typeof row.pdf_name === "string" && row.pdf_name.trim().length > 0
            ? row.pdf_name.trim()
            : "plan-nutricional.pdf",
      });
    }
  }

  return map;
}

/** Active, non-template legacy plans, newest first, with what they carry. */
async function fetchLegacyPlans(
  client: SupabaseClient,
  tenantHost: string
): Promise<
  { clientId: number; pdf: ClientDietPdf | null; structured: boolean }[]
> {
  const { data, error } = await client
    .from("nutrition_plans")
    .select("client_id, pdf_url, pdf_name, plan_mode")
    .eq("tenant_host", tenantHost)
    .eq("status", "active")
    .not("is_template", "is", true)
    .order("updated_at", { ascending: false });

  if (error !== null) {
    throw new Error(`readiness nutrition_plans: ${error.message}`);
  }

  return (data ?? []).map((raw) => {
    const row = raw as {
      client_id: unknown;
      pdf_url: unknown;
      pdf_name: unknown;
      plan_mode: unknown;
    };
    const url = typeof row.pdf_url === "string" ? row.pdf_url.trim() : "";
    const pdf: ClientDietPdf | null =
      url.length > 0
        ? {
            url,
            name:
              typeof row.pdf_name === "string" && row.pdf_name.trim().length > 0
                ? row.pdf_name.trim()
                : "plan-nutricional.pdf",
          }
        : null;

    return {
      clientId: Number(row.client_id),
      pdf,
      // A structured plan with no PDF is what v2 cannot render (⚠️).
      structured: pdf === null && row.plan_mode !== "pdf",
    };
  });
}

async function fetchGoals(
  client: SupabaseClient,
  tenantHost: string
): Promise<Map<number, NutritionGoals>> {
  const { data, error } = await client
    .from("client_nutrition_goals")
    .select("client_id, kcal, protein_g, carbs_g, fat_g")
    .eq("tenant_host", tenantHost);

  if (error !== null) {
    throw new Error(`readiness goals: ${error.message}`);
  }

  const map = new Map<number, NutritionGoals>();

  for (const raw of data ?? []) {
    const row = raw as Record<string, unknown>;

    map.set(Number(row.client_id), {
      kcal: Number(row.kcal) || 0,
      protein_g: Number(row.protein_g) || 0,
      carbs_g: Number(row.carbs_g) || 0,
      fat_g: Number(row.fat_g) || 0,
    });
  }

  return map;
}

async function fetchPresets(
  client: SupabaseClient,
  tenantHost: string
): Promise<Map<number, ClientDietPreset[]>> {
  const { data, error } = await client
    .from("client_goal_presets")
    .select("id, client_id, name, kcal, protein_g, carbs_g, fat_g")
    .eq("tenant_host", tenantHost)
    .order("created_at", { ascending: true });

  if (error !== null) {
    throw new Error(`readiness presets: ${error.message}`);
  }

  const map = new Map<number, ClientDietPreset[]>();

  for (const raw of data ?? []) {
    const row = raw as Record<string, unknown>;
    const clientId = Number(row.client_id);
    const list = map.get(clientId) ?? [];

    list.push({
      id: `${row.id}`,
      name: `${row.name ?? ""}`,
      kcal: Number(row.kcal) || 0,
      protein_g: Number(row.protein_g) || 0,
      carbs_g: Number(row.carbs_g) || 0,
      fat_g: Number(row.fat_g) || 0,
    });
    map.set(clientId, list);
  }

  return map;
}
