import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

/**
 * POST /api/forms/upload-photo
 *
 * Uploads a photo for a form response (progress photos, etc.).
 * Expects multipart/form-data with fields:
 *   - file: the image file
 *   - question_id: the question this photo belongs to (e.g. "photo_front")
 *   - form_type: "checkins" | "habits"
 *
 * Returns the public URL of the uploaded photo.
 * Photos are stored at: {client_id}/{form_type}/{question_id}_{timestamp}.{ext}
 */
export async function POST(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    const session = await getClientSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const questionId = formData.get("question_id") as string | null;
    const formType = formData.get("form_type") as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No se proporcionó ningún archivo" },
        { status: 400 }
      );
    }

    if (!questionId) {
      return NextResponse.json(
        { success: false, error: "Falta el ID de la pregunta" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: "Formato no válido. Usa PNG, JPG o WebP.",
        },
        { status: 400 }
      );
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        {
          success: false,
          error: "La imagen no puede superar 5MB",
        },
        { status: 400 }
      );
    }

    // Build the storage path
    const ext = file.name.split(".").pop() || "jpg";
    const timestamp = Date.now();
    const safeFormType = formType === "habits" ? "habits" : "checkins";
    const filePath = `${session.client_id}/${safeFormType}/${questionId}_${timestamp}.${ext}`;

    // Convert File to ArrayBuffer then to Uint8Array for Supabase
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("form-photos")
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false, // Don't overwrite — each upload is unique via timestamp
      });

    if (uploadError) {
      console.error("[Form Photo] Upload error:", uploadError);

      return NextResponse.json(
        { success: false, error: "Error al subir la imagen" },
        { status: 500 }
      );
    }

    // Get the public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("form-photos").getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      url: publicUrl,
      questionId,
      message: "Foto subida correctamente",
    });
  } catch (error) {
    console.error("[Form Photo] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
