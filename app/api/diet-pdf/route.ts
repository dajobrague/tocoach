import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  addClientDietPdf,
  deleteClientDietPdf,
  listClientDietPdfs,
} from "@/lib/nutrition/diet-fallback";
import {
  dietPdfPrefix,
  NUTRITION_PDFS_BUCKET,
  PDF_MAX_BYTES,
  pdfStoragePathFromPublicUrl,
  sanitizeFilenameForStorage,
} from "@/lib/nutrition/pdf-storage";
import {
  errorMessage,
  guardRecipeRequest,
} from "@/lib/nutrition/recipes/recipe-request";

const LOG_PREFIX = "[DietPdf API]";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The client's PDF diets, trainer-managed (v2 delivery ladder). A client can
 * have several (e.g. training days + rest days).
 *
 * GET    /api/diet-pdf?clientId=123 — the PDFs, upload order, with source
 *        (v2 | legacy) and id (null for the read-only legacy one).
 * POST   /api/diet-pdf — multipart (clientId, pdf): upload + add. A legacy PDF
 *        is merely shadowed — v2 never writes or deletes legacy data.
 * DELETE /api/diet-pdf?clientId=123&id=<uuid> — remove one v2 PDF (row +
 *        object). With none left, the ladder falls back to the legacy one.
 */
export async function GET(request: NextRequest) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const clientId = parseClientIdParam(request);

    if (clientId === null) {
      return invalidClientId();
    }

    const pdfs = await listClientDietPdfs(
      createSupabaseClient(),
      guard.session.tenant_host,
      clientId
    );

    return NextResponse.json({ success: true, data: pdfs });
  } catch (error) {
    console.error(`${LOG_PREFIX} get error:`, {
      correlationId: guard.correlationId,
      error: errorMessage(error),
    });

    return unexpected();
  }
}

export async function POST(request: NextRequest) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  const supabase = createSupabaseClient();

  try {
    const formData = await request.formData();
    const clientId = parseClientIdValue(formData.get("clientId"));
    const file = formData.get("pdf");

    if (clientId === null) {
      return invalidClientId();
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "No se envió ningún archivo PDF" },
        { status: 400 }
      );
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { success: false, error: "El archivo debe ser un PDF" },
        { status: 400 }
      );
    }

    if (file.size > PDF_MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: "El PDF no puede superar 20MB" },
        { status: 400 }
      );
    }

    const displayName =
      file.name.trim().length > 0 ? file.name.trim() : "documento.pdf";
    const prefix = dietPdfPrefix(guard.session.trainer_id);
    const storagePath = `${prefix}${clientId}/${Date.now()}-${sanitizeFilenameForStorage(displayName)}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(NUTRITION_PDFS_BUCKET)
      .upload(storagePath, bytes, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError !== null) {
      console.error(`${LOG_PREFIX} upload error:`, {
        correlationId: guard.correlationId,
        error: uploadError.message,
      });

      return NextResponse.json(
        { success: false, error: "Error al subir el PDF" },
        { status: 500 }
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(NUTRITION_PDFS_BUCKET).getPublicUrl(storagePath);

    let id: string;

    try {
      ({ id } = await addClientDietPdf(
        supabase,
        guard.session.tenant_host,
        clientId,
        { url: publicUrl, name: displayName }
      ));
    } catch (error) {
      // The row write failed — don't leave an orphaned object behind.
      await supabase.storage.from(NUTRITION_PDFS_BUCKET).remove([storagePath]);
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: { id, url: publicUrl, name: displayName, source: "v2" },
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} post error:`, {
      correlationId: guard.correlationId,
      error: errorMessage(error),
    });

    return unexpected();
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  const supabase = createSupabaseClient();

  try {
    const clientId = parseClientIdParam(request);

    if (clientId === null) {
      return invalidClientId();
    }

    const pdfId = request.nextUrl.searchParams.get("id") ?? "";

    if (UUID_RE.test(pdfId) === false) {
      return NextResponse.json(
        { success: false, error: "id inválido" },
        { status: 400 }
      );
    }

    const { removedUrl } = await deleteClientDietPdf(
      supabase,
      guard.session.tenant_host,
      clientId,
      pdfId
    );

    await removeV2Object(supabase, guard.session.trainer_id, removedUrl);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`${LOG_PREFIX} delete error:`, {
      correlationId: guard.correlationId,
      error: errorMessage(error),
    });

    return unexpected();
  }
}

/**
 * Best-effort removal of a storage object that v2 itself wrote. The guard is
 * the `<trainer_id>/diet/` prefix — anything else (legacy uploads especially)
 * is left alone. A failed removal only logs: the row is already correct.
 */
async function removeV2Object(
  supabase: ReturnType<typeof createSupabaseClient>,
  trainerId: string,
  url: string | null
): Promise<void> {
  if (url === null) {
    return;
  }

  const path = pdfStoragePathFromPublicUrl(url);

  if (path === null || path.startsWith(dietPdfPrefix(trainerId)) === false) {
    return;
  }

  const { error } = await supabase.storage
    .from(NUTRITION_PDFS_BUCKET)
    .remove([path]);

  if (error !== null) {
    console.warn(`${LOG_PREFIX} stale object not removed:`, {
      path,
      error: error.message,
    });
  }
}

function parseClientIdParam(request: NextRequest): number | null {
  return parseClientIdValue(request.nextUrl.searchParams.get("clientId"));
}

function parseClientIdValue(value: unknown): number | null {
  const id = Number(value);

  return Number.isInteger(id) && id > 0 ? id : null;
}

function invalidClientId(): NextResponse {
  return NextResponse.json(
    { success: false, error: "clientId inválido" },
    { status: 400 }
  );
}

function unexpected(): NextResponse {
  return NextResponse.json(
    { success: false, error: "Error inesperado" },
    { status: 500 }
  );
}
