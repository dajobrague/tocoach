import type { SupabaseClient } from "@supabase/supabase-js";

const DIET_PDFS_TABLE = "client_diet_pdfs";
const LEGACY_PLANS_TABLE = "nutrition_plans";
const DEFAULT_PDF_NAME = "plan-nutricional.pdf";

/** A PDF diet shared with the client (name is the display filename). */
export interface ClientDietPdf {
  url: string;
  name: string;
}

/** A PDF diet plus where it came from — the trainer UI shows legacy PDFs
 *  read-only (replacing uploads a v2 copy; deleting is v2-only). */
export interface ClientDietPdfWithSource extends ClientDietPdf {
  source: "v2" | "legacy";
}

/**
 * The client's PDF diet, if any — the second rung of the nutrition delivery
 * ladder (active meal plan → PDF → goals-only → empty).
 *
 * Resolution order:
 * 1. `client_diet_pdfs` — PDFs uploaded through the v2 trainer UI.
 * 2. The LEGACY `nutrition_plans` pointer (any active, non-template plan
 *    carrying a pdf_url, newest first). This keeps the ~120 production
 *    clients whose diet is a PDF working the moment nutrition-v2 flips on,
 *    with no backfill and no legacy writes: v2 only reads the pointer; the
 *    file itself stays in the `nutrition-pdfs` bucket.
 *
 * Tenant-scoped: `tenantHost` + `clientId` both come from the caller's session
 * context, never from request input.
 */
export async function getClientDietPdf(
  client: SupabaseClient,
  tenantHost: string,
  clientId: number
): Promise<ClientDietPdf | null> {
  const withSource = await getClientDietPdfWithSource(
    client,
    tenantHost,
    clientId
  );

  return withSource === null
    ? null
    : { url: withSource.url, name: withSource.name };
}

/** {@link getClientDietPdf}, keeping which rung answered (trainer UI needs it). */
export async function getClientDietPdfWithSource(
  client: SupabaseClient,
  tenantHost: string,
  clientId: number
): Promise<ClientDietPdfWithSource | null> {
  if (tenantHost.length === 0) {
    return null;
  }

  const v2 = await readV2DietPdf(client, tenantHost, clientId);

  if (v2 !== null) {
    return { ...v2, source: "v2" };
  }

  const legacy = await readLegacyDietPdf(client, tenantHost, clientId);

  return legacy === null ? null : { ...legacy, source: "legacy" };
}

/** The v2 row for a client, or null. */
async function readV2DietPdf(
  client: SupabaseClient,
  tenantHost: string,
  clientId: number
): Promise<ClientDietPdf | null> {
  const { data, error } = await client
    .from(DIET_PDFS_TABLE)
    .select("pdf_url, pdf_name")
    .eq("tenant_host", tenantHost)
    .eq("client_id", clientId)
    .maybeSingle();

  if (error !== null) {
    throw new Error(`readV2DietPdf failed: ${error.message}`);
  }

  return toDietPdf(data);
}

async function readLegacyDietPdf(
  client: SupabaseClient,
  tenantHost: string,
  clientId: number
): Promise<ClientDietPdf | null> {
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
    throw new Error(`readLegacyDietPdf failed: ${error.message}`);
  }

  return toDietPdf(data);
}

/** Normalize a pdf_url/pdf_name row to a {@link ClientDietPdf} (or null). */
function toDietPdf(
  data: { pdf_url?: unknown; pdf_name?: unknown } | null
): ClientDietPdf | null {
  const url = typeof data?.pdf_url === "string" ? data.pdf_url.trim() : "";

  if (url.length === 0) {
    return null;
  }

  const rawName =
    typeof data?.pdf_name === "string" ? data.pdf_name.trim() : "";

  return { url, name: rawName.length > 0 ? rawName : DEFAULT_PDF_NAME };
}

/**
 * Create or replace the client's v2 PDF diet (one per client). Returns the
 * PREVIOUS v2 url (for storage cleanup) — null on first upload. Never touches
 * the legacy pointer.
 */
export async function upsertClientDietPdf(
  client: SupabaseClient,
  tenantHost: string,
  clientId: number,
  pdf: ClientDietPdf
): Promise<{ previousUrl: string | null }> {
  const previous = await readV2DietPdf(client, tenantHost, clientId);

  const { error } = await client.from(DIET_PDFS_TABLE).upsert(
    {
      tenant_host: tenantHost,
      client_id: clientId,
      pdf_url: pdf.url,
      pdf_name: pdf.name,
    },
    { onConflict: "tenant_host,client_id" }
  );

  if (error !== null) {
    throw new Error(`upsertClientDietPdf failed: ${error.message}`);
  }

  return { previousUrl: previous?.url ?? null };
}

/**
 * Remove the client's v2 PDF diet. Returns the removed url (for storage
 * cleanup), or null when there was none. Legacy PDFs are untouched — after a
 * delete, the ladder falls back to the legacy pointer if one exists.
 */
export async function deleteClientDietPdf(
  client: SupabaseClient,
  tenantHost: string,
  clientId: number
): Promise<{ removedUrl: string | null }> {
  const { data, error } = await client
    .from(DIET_PDFS_TABLE)
    .delete()
    .eq("tenant_host", tenantHost)
    .eq("client_id", clientId)
    .select("pdf_url")
    .maybeSingle();

  if (error !== null) {
    throw new Error(`deleteClientDietPdf failed: ${error.message}`);
  }

  return {
    removedUrl: typeof data?.pdf_url === "string" ? data.pdf_url : null,
  };
}
