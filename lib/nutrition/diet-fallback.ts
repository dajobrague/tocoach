import type { SupabaseClient } from "@supabase/supabase-js";

const LEGACY_PLANS_TABLE = "nutrition_plans";
const DEFAULT_PDF_NAME = "plan-nutricional.pdf";

/** A PDF diet shared with the client (name is the display filename). */
export interface ClientDietPdf {
  url: string;
  name: string;
}

/**
 * The client's PDF diet, if any — the second rung of the nutrition delivery
 * ladder (active meal plan → PDF → goals-only → empty).
 *
 * Reads the LEGACY `nutrition_plans` table (plan_mode pdf/hybrid — any active,
 * non-template plan carrying a pdf_url counts, newest first). This keeps the
 * ~120 production clients whose diet is a PDF working the moment nutrition-v2
 * flips on, with no backfill and no legacy writes: v2 only reads the pointer;
 * the file itself stays in the `nutrition-pdfs` bucket.
 *
 * The v2 upload flow (client_diet_pdfs) will be consulted FIRST here when it
 * lands; this legacy read stays as the fallback beneath it.
 *
 * Tenant-scoped: `tenantHost` + `clientId` both come from the caller's session
 * context, never from request input.
 */
export async function getClientDietPdf(
  client: SupabaseClient,
  tenantHost: string,
  clientId: number
): Promise<ClientDietPdf | null> {
  if (tenantHost.length === 0) {
    return null;
  }

  const { data, error } = await client
    .from(LEGACY_PLANS_TABLE)
    .select("pdf_url, pdf_name")
    .eq("tenant_host", tenantHost)
    .eq("client_id", clientId)
    .eq("status", "active")
    // Legacy rows may have is_template NULL; only exclude explicit templates.
    .not("is_template", "is", true)
    .not("pdf_url", "is", null)
    .neq("pdf_url", "")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error !== null) {
    throw new Error(`getClientDietPdf failed: ${error.message}`);
  }

  const url = typeof data?.pdf_url === "string" ? data.pdf_url.trim() : "";

  if (url.length === 0) {
    return null;
  }

  const rawName =
    typeof data?.pdf_name === "string" ? data.pdf_name.trim() : "";

  return { url, name: rawName.length > 0 ? rawName : DEFAULT_PDF_NAME };
}
