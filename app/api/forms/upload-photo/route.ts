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

    // Diagnostic log so 400s aren't silent. Hits Railway/Vercel logs and
    // local `npm run dev` output — gives us file.name/type/size to see
    // exactly which guard tripped without parsing the multipart body again.
    console.log("[Form Photo] Incoming upload", {
      clientId: session.client_id,
      questionId,
      formType,
      fileName: file?.name ?? null,
      fileType: file?.type ?? null,
      fileSize: file?.size ?? null,
    });

    if (!file) {
      console.warn("[Form Photo] 400: no file in form data");

      return NextResponse.json(
        { success: false, error: "No se proporcionó ningún archivo" },
        { status: 400 }
      );
    }

    if (!questionId) {
      console.warn("[Form Photo] 400: missing question_id", {
        fileName: file.name,
      });

      return NextResponse.json(
        { success: false, error: "Falta el ID de la pregunta" },
        { status: 400 }
      );
    }

    // Validate file type. Includes HEIC and HEIF (iOS gallery formats)
    // and is lenient with empty MIME by falling back to the file
    // extension — some browsers (and AirDrop/Universal Clipboard handoffs)
    // strip the type, which would otherwise reject perfectly valid JPEGs.
    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/heic",
      "image/heif",
    ];
    const allowedExtensions = ["png", "jpg", "jpeg", "webp", "heic", "heif"];
    const declaredType = file.type?.toLowerCase().trim();
    const ext = file.name.split(".").pop()?.toLowerCase();
    const typeOk = declaredType ? allowedTypes.includes(declaredType) : false;
    const extOk = ext ? allowedExtensions.includes(ext) : false;

    if (!typeOk && !extOk) {
      console.warn("[Form Photo] 400: rejected file type", {
        fileName: file.name,
        declaredType,
        ext,
      });

      return NextResponse.json(
        {
          success: false,
          error: `Formato no válido (${declaredType || "tipo desconocido"}). Usa PNG, JPG, WebP, HEIC o HEIF.`,
        },
        { status: 400 }
      );
    }

    // Validate file size (10MB max — iPhone HEIC live photos routinely
    // hit 6-9MB so the previous 5MB cap was rejecting them silently).
    const MAX_BYTES = 10 * 1024 * 1024;

    if (file.size > MAX_BYTES) {
      console.warn("[Form Photo] 400: file too large", {
        fileName: file.name,
        size: file.size,
        max: MAX_BYTES,
      });

      return NextResponse.json(
        {
          success: false,
          error: `La imagen no puede superar 10MB (recibido ${(file.size / 1024 / 1024).toFixed(1)}MB)`,
        },
        { status: 400 }
      );
    }

    // Build the storage path. Reuse `ext` derived above (with fallback) so
    // the file lands with a consistent extension even when the browser
    // strips the MIME type and we accepted it via the extension fallback.
    const safeExt = ext ?? "jpg";
    const timestamp = Date.now();
    const safeFormType = formType === "habits" ? "habits" : "checkins";
    const filePath = `${session.client_id}/${safeFormType}/${questionId}_${timestamp}.${safeExt}`;

    // Convert File to ArrayBuffer then to Uint8Array for Supabase
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    // Map extension → MIME for the rare case where file.type is empty
    // (some browsers/transports strip it). The bucket's allowed_mime_types
    // check is strict, so we must always send a concrete contentType.
    const extToMime: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
      heic: "image/heic",
      heif: "image/heif",
    };
    const resolvedContentType =
      declaredType && allowedTypes.includes(declaredType)
        ? declaredType
        : (extToMime[safeExt] ?? "application/octet-stream");

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("form-photos")
      .upload(filePath, fileBuffer, {
        contentType: resolvedContentType,
        upsert: false, // Don't overwrite — each upload is unique via timestamp
      });

    if (uploadError) {
      console.error("[Form Photo] Upload error:", {
        message: uploadError.message,
        name: uploadError.name,
        filePath,
        contentType: resolvedContentType,
      });

      // Surface the underlying storage error message to the client when
      // safe — bucket-side rejections (mime, size, RLS) are otherwise
      // hidden behind a generic 500 toast and leave the user stuck.
      return NextResponse.json(
        {
          success: false,
          error: `Error al subir la imagen: ${uploadError.message}`,
        },
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
