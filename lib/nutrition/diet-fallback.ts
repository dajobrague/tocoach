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

/** A PDF as the trainer manages it: `id` is the v2 row (null = legacy, read-only). */
export interface ClientDietPdfItem extends ClientDietPdfWithSource {
  id: string | null;
}

/**
 * The client's PDF diets — the second rung of the nutrition delivery ladder
 * (active meal plan → PDF → goals-only → empty). A client can have several
 * (e.g. training days + rest days), shown in upload order.
 *
 * Resolution order:
 * 1. `client_diet_pdfs` — PDFs uploaded through the v2 trainer UI.
 * 2. Only when there are none: the LEGACY `nutrition_plans` pointer (any
 *    active, non-template plan carrying a pdf_url, newest first). This keeps
 *    the production clients whose diet is a legacy PDF working with no
 *    backfill and no legacy writes: v2 only reads the pointer.
 *
 * Tenant-scoped: `tenantHost` + `clientId` both come from the caller's session
 * context, never from request input.
 */
export async function listClientDietPdfs(
  client: SupabaseClient,
  tenantHost: string,
  clientId: number
): Promise<ClientDietPdfItem[]> {
  if (tenantHost.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from(DIET_PDFS_TABLE)
    .select("id, pdf_url, pdf_name")
    .eq("tenant_host", tenantHost)
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });

  if (error !== null) {
    throw new Error(`listClientDietPdfs failed: ${error.message}`);
  }

  const v2: ClientDietPdfItem[] = [];

  for (const row of data ?? []) {
    const pdf = toDietPdf(row);

    if (pdf !== null) {
      v2.push({ ...pdf, id: String(row.id), source: "v2" });
    }
  }

  if (v2.length > 0) {
    return v2;
  }

  const legacy = await readLegacyDietPdf(client, tenantHost, clientId);

  return legacy === null ? [] : [{ ...legacy, id: null, source: "legacy" }];
}

/** {@link listClientDietPdfs} as the client sees them (url + name only). */
export async function getClientDietPdfs(
  client: SupabaseClient,
  tenantHost: string,
  clientId: number
): Promise<ClientDietPdf[]> {
  const items = await listClientDietPdfs(client, tenantHost, clientId);

  return items.map(({ url, name }) => ({ url, name }));
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

/**
 * Normalize a pdf_url/pdf_name row to a {@link ClientDietPdf} (or null).
 * Only web URLs pass: the legacy pdf_url column is free text and the value
 * lands in an `<a href>`/iframe on the client's page, so a stored
 * `javascript:` URL must never reach the DOM.
 */
function toDietPdf(
  data: { pdf_url?: unknown; pdf_name?: unknown } | null
): ClientDietPdf | null {
  const url = typeof data?.pdf_url === "string" ? data.pdf_url.trim() : "";

  if (isRenderableUrl(url) === false) {
    return null;
  }

  const rawName =
    typeof data?.pdf_name === "string" ? data.pdf_name.trim() : "";

  return { url, name: rawName.length > 0 ? rawName : DEFAULT_PDF_NAME };
}

/** http(s) absolute URLs and site-relative paths only — anything else
 *  (javascript:, data:, blob:, malformed) is dropped as if there were no PDF. */
function isRenderableUrl(url: string): boolean {
  if (url.length === 0) {
    return false;
  }

  if (url.startsWith("/")) {
    return true;
  }

  try {
    const protocol = new URL(url).protocol;

    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

/** Add a v2 PDF diet for the client (they can have several). */
export async function addClientDietPdf(
  client: SupabaseClient,
  tenantHost: string,
  clientId: number,
  pdf: ClientDietPdf
): Promise<{ id: string }> {
  const { data, error } = await client
    .from(DIET_PDFS_TABLE)
    .insert({
      tenant_host: tenantHost,
      client_id: clientId,
      pdf_url: pdf.url,
      pdf_name: pdf.name,
    })
    .select("id")
    .single();

  if (error !== null) {
    throw new Error(`addClientDietPdf failed: ${error.message}`);
  }

  return { id: String(data.id) };
}

/**
 * Remove one of the client's v2 PDF diets. Returns the removed url (for
 * storage cleanup), or null when no such row exists for this client. Legacy
 * PDFs are untouched — once no v2 PDF is left, the ladder falls back to the
 * legacy pointer if one exists.
 */
export async function deleteClientDietPdf(
  client: SupabaseClient,
  tenantHost: string,
  clientId: number,
  pdfId: string
): Promise<{ removedUrl: string | null }> {
  const { data, error } = await client
    .from(DIET_PDFS_TABLE)
    .delete()
    .eq("tenant_host", tenantHost)
    .eq("client_id", clientId)
    .eq("id", pdfId)
    .select("pdf_url")
    .maybeSingle();

  if (error !== null) {
    throw new Error(`deleteClientDietPdf failed: ${error.message}`);
  }

  return {
    removedUrl: typeof data?.pdf_url === "string" ? data.pdf_url : null,
  };
}
