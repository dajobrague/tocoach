import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

const NUTRITION_PDFS_BUCKET = "nutrition-pdfs";
const PDF_MAX_BYTES = 20 * 1024 * 1024;
const PUBLIC_PATH_MARKER = `/storage/v1/object/public/${NUTRITION_PDFS_BUCKET}/`;

function pdfStoragePathFromPublicUrl(pdfUrl: string): string | null {
  try {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!base) return null;

    const u = new URL(pdfUrl);
    const expectedHost = new URL(base).host;

    if (u.host !== expectedHost) return null;

    const idx = u.pathname.indexOf(PUBLIC_PATH_MARKER);

    if (idx === -1) return null;

    const path = u.pathname.slice(idx + PUBLIC_PATH_MARKER.length);

    if (!path) return null;

    return decodeURIComponent(path);
  } catch {
    return null;
  }
}

/** Safe segment for storage path; keeps a recognizable name from the upload. */
function sanitizeFilenameForStorage(name: string): string {
  const base = name.split(/[/\\]/).pop() || "documento.pdf";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);

  return cleaned || "documento.pdf";
}

/**
 * POST /api/nutrition/plans/[id]/pdf — multipart field `pdf`
 * DELETE /api/nutrition/plans/[id]/pdf — remove plan PDF
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createSupabaseClient();

  try {
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { id: planId } = await params;

    const { data: plan, error: planError } = await supabase
      .from("nutrition_plans")
      .select("id, trainer_id, pdf_url, plan_mode")
      .eq("id", planId)
      .eq("trainer_id", session.trainer_id)
      .single();

    if (planError || !plan) {
      return NextResponse.json(
        { success: false, error: "Plan no encontrado o no autorizado" },
        { status: 404 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("pdf") as File | null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "No se envió ningún archivo PDF" },
        { status: 400 }
      );
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        {
          success: false,
          error: "El archivo debe ser un PDF (application/pdf)",
        },
        { status: 400 }
      );
    }

    if (file.size > PDF_MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: "El PDF no puede superar 20MB" },
        { status: 400 }
      );
    }

    const displayName = file.name?.trim() || "documento.pdf";
    const safeFileName = sanitizeFilenameForStorage(displayName);
    const timestamp = Date.now();
    const storagePath = `${session.trainer_id}/${planId}/${timestamp}-${safeFileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from(NUTRITION_PDFS_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("[Nutrition PDF] Upload error:", uploadError);

      return NextResponse.json(
        { success: false, error: "Error al subir el PDF" },
        { status: 500 }
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(NUTRITION_PDFS_BUCKET).getPublicUrl(storagePath);

    const previousUrl = plan.pdf_url;
    const nextMode =
      plan.plan_mode === "structured" ? "hybrid" : plan.plan_mode;

    const { error: updateError } = await supabase
      .from("nutrition_plans")
      .update({
        pdf_url: publicUrl,
        pdf_name: displayName,
        plan_mode: nextMode,
      })
      .eq("id", planId)
      .eq("trainer_id", session.trainer_id);

    if (updateError) {
      console.error("[Nutrition PDF] DB update error:", updateError);

      await supabase.storage.from(NUTRITION_PDFS_BUCKET).remove([storagePath]);

      return NextResponse.json(
        { success: false, error: "Error al guardar el PDF en el plan" },
        { status: 500 }
      );
    }

    if (previousUrl) {
      const oldPath = pdfStoragePathFromPublicUrl(previousUrl);

      if (oldPath) {
        const { error: removeError } = await supabase.storage
          .from(NUTRITION_PDFS_BUCKET)
          .remove([oldPath]);

        if (removeError) {
          console.error(
            "[Nutrition PDF] Failed to remove previous object:",
            removeError
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      pdfUrl: publicUrl,
      pdfName: displayName,
    });
  } catch (error) {
    console.error("[Nutrition PDF] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createSupabaseClient();

  try {
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { id: planId } = await params;

    const { data: plan, error: planError } = await supabase
      .from("nutrition_plans")
      .select("id, pdf_url, plan_mode")
      .eq("id", planId)
      .eq("trainer_id", session.trainer_id)
      .single();

    if (planError || !plan) {
      return NextResponse.json(
        { success: false, error: "Plan no encontrado o no autorizado" },
        { status: 404 }
      );
    }

    const pdfUrl = plan.pdf_url;

    if (pdfUrl) {
      const path = pdfStoragePathFromPublicUrl(pdfUrl);

      if (path) {
        const { error: removeError } = await supabase.storage
          .from(NUTRITION_PDFS_BUCKET)
          .remove([path]);

        if (removeError) {
          console.error("[Nutrition PDF] Storage remove error:", removeError);
        }
      }
    }

    const nextMode =
      plan.plan_mode === "pdf" || plan.plan_mode === "hybrid"
        ? "structured"
        : plan.plan_mode;

    const { error: updateError } = await supabase
      .from("nutrition_plans")
      .update({
        pdf_url: null,
        pdf_name: null,
        plan_mode: nextMode,
      })
      .eq("id", planId)
      .eq("trainer_id", session.trainer_id);

    if (updateError) {
      console.error("[Nutrition PDF] DB clear pdf fields error:", updateError);

      return NextResponse.json(
        { success: false, error: "Error al quitar el PDF del plan" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Nutrition PDF] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
