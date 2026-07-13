import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  deleteClientDietPdf,
  getClientDietPdfWithSource,
  upsertClientDietPdf,
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

/**
 * The client's PDF diet, trainer-managed (v2 delivery ladder).
 *
 * GET    /api/diet-pdf?clientId=123 — current PDF + source (v2 | legacy).
 * POST   /api/diet-pdf — multipart (clientId, pdf): upload + upsert. Replaces
 *        a previous v2 upload (its storage object is removed); a legacy PDF is
 *        merely shadowed — v2 never writes or deletes legacy data.
 * DELETE /api/diet-pdf?clientId=123 — remove the v2 PDF (row + object). The
 *        ladder then falls back to the legacy pointer, when one exists.
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

    const pdf = await getClientDietPdfWithSource(
      createSupabaseClient(),
      guard.session.tenant_host,
      clientId
    );

    return NextResponse.json({ success: true, data: pdf });
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

    let previousUrl: string | null = null;

    try {
      ({ previousUrl } = await upsertClientDietPdf(
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

    await removeV2Object(supabase, guard.session.trainer_id, previousUrl);

    return NextResponse.json({
      success: true,
      data: { url: publicUrl, name: displayName, source: "v2" },
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

    const { removedUrl } = await deleteClientDietPdf(
      supabase,
      guard.session.tenant_host,
      clientId
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
