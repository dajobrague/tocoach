import type { SupabaseClient } from "@supabase/supabase-js";

const VISIBILITY_TABLE = "client_nutrition_visibility";

/** The sections a client's Nutrición page can show, in display order. */
export const NUTRITION_SECTIONS = ["plan", "pdf", "goals"] as const;

export type NutritionSection = (typeof NUTRITION_SECTIONS)[number];

/** Which sections currently have data for a client (computed by the caller). */
export interface SectionAvailability {
  plan: boolean;
  pdf: boolean;
  goals: boolean;
}

/**
 * Normalize a stored/submitted sections value: keep known section names only,
 * dedupe, and order canonically ({@link NUTRITION_SECTIONS}). Returns null for
 * anything that normalizes to empty — null is the "Automático" state
 * everywhere in this module.
 */
export function sanitizeSections(input: unknown): NutritionSection[] | null {
  if (Array.isArray(input) === false) {
    return null;
  }

  const chosen = NUTRITION_SECTIONS.filter((section) =>
    (input as unknown[]).includes(section)
  );

  return chosen.length === 0 ? null : chosen;
}

/**
 * The delivery decision (§ Jul-15 call): which sections the client's page
 * shows. The trainer's explicit choice wins, intersected with what actually
 * has data — a section that lost its data (PDF deleted, plan archived) is
 * silently dropped rather than rendered empty. When nothing chosen survives —
 * or nothing was ever chosen — the original automatic ladder decides:
 * plan → PDF → goals-only → empty.
 */
export function resolveVisibleSections(
  explicit: NutritionSection[] | null,
  available: SectionAvailability
): NutritionSection[] {
  if (explicit !== null) {
    const withData = NUTRITION_SECTIONS.filter(
      (section) => explicit.includes(section) && available[section]
    );

    if (withData.length > 0) {
      return withData;
    }
  }

  const first = NUTRITION_SECTIONS.find((section) => available[section]);

  return first === undefined ? [] : [first];
}

/**
 * The trainer's saved choice for a client, or null for "Automático" (no row).
 * A stored row that no longer parses (bad manual edit) reads as null too.
 * Tenant-scoped: both keys come from the caller's session context.
 */
export async function getClientNutritionVisibility(
  client: SupabaseClient,
  tenantHost: string,
  clientId: number
): Promise<NutritionSection[] | null> {
  if (tenantHost.length === 0) {
    return null;
  }

  const { data, error } = await client
    .from(VISIBILITY_TABLE)
    .select("sections")
    .eq("tenant_host", tenantHost)
    .eq("client_id", clientId)
    .maybeSingle();

  if (error !== null) {
    // Code deploys can precede the (manually applied) migration; a missing
    // table means nobody chose anything yet — read as "Automático" instead of
    // breaking every client's Nutrición page. 42P01 = undefined_table.
    if (error.code === "42P01") {
      return null;
    }

    throw new Error(`getClientNutritionVisibility failed: ${error.message}`);
  }

  return sanitizeSections(data?.sections);
}

/**
 * Save the trainer's choice — or return the client to "Automático" by passing
 * null/empty (the row is deleted, not stored empty, so absence stays the one
 * representation of the default).
 */
export async function setClientNutritionVisibility(
  client: SupabaseClient,
  tenantHost: string,
  clientId: number,
  sections: NutritionSection[] | null
): Promise<void> {
  const normalized = sanitizeSections(sections);

  if (normalized === null) {
    const { error } = await client
      .from(VISIBILITY_TABLE)
      .delete()
      .eq("tenant_host", tenantHost)
      .eq("client_id", clientId);

    if (error !== null) {
      throw new Error(`setClientNutritionVisibility failed: ${error.message}`);
    }

    return;
  }

  const { error } = await client.from(VISIBILITY_TABLE).upsert(
    {
      tenant_host: tenantHost,
      client_id: clientId,
      sections: normalized,
    },
    { onConflict: "tenant_host,client_id" }
  );

  if (error !== null) {
    throw new Error(`setClientNutritionVisibility failed: ${error.message}`);
  }
}
