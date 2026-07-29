import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { buildVideoUploadNotificationRow } from "@/lib/notifications/video-upload-notification";
import { compressVideo } from "@/lib/utils/server-video-compression";

export const runtime = "nodejs";
// Raw uploads can be up to 1 GB and compression on a shared CPU can take
// many minutes for long clips. Give the route plenty of headroom; ffmpeg
// has its own internal timeout (see compressVideo's `timeoutMs`).
export const maxDuration = 600;

const ALLOWED_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
];
const MAX_SIZE = 1024 * 1024 * 1024; // 1GB raw — compression makes the stored copy much smaller

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const supabase = createSupabaseClient();

  try {
    const session = await getClientSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { clientId } = await params;

    if (session.client_id.toString() !== clientId) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No se proporcionó archivo" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: "Tipo de archivo no permitido. Use MP4, WebM o MOV",
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: "El archivo es demasiado grande (máx 1GB)",
        },
        { status: 400 }
      );
    }

    const rawBuffer = Buffer.from(await file.arrayBuffer());

    let uploadBuffer: Buffer = rawBuffer;
    let uploadContentType = file.type;
    let uploadFilename = file.name;

    try {
      const compressed = await compressVideo({
        buffer: rawBuffer,
        filename: file.name,
      });

      uploadBuffer = compressed.buffer;
      uploadContentType = compressed.contentType;
      uploadFilename = compressed.filename;
    } catch (err) {
      // If encoding fails, fall back to uploading the original so the user
      // doesn't lose their video. Log the cause so we can investigate.
      console.error(
        "[Client Exercise Video API] Compression failed, uploading raw:",
        err
      );
    }

    const timestamp = Date.now();
    const fileExt = uploadFilename.split(".").pop();
    const fileName = `${clientId}/${timestamp}.${fileExt}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("client-exercise-videos")
      .upload(fileName, uploadBuffer, {
        contentType: uploadContentType,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error(
        "[Client Exercise Video API] Error uploading:",
        uploadError
      );

      return NextResponse.json(
        { success: false, error: "Error al subir video" },
        { status: 500 }
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("client-exercise-videos").getPublicUrl(fileName);

    console.log(
      "[Client Exercise Video API] Uploaded successfully:",
      publicUrl
    );

    // Campana del trainer: "X subió un video". Va aquí y no en el guardado de
    // logs porque la URL se acuña UNA vez en este upload (el autosave de logs
    // reinserta la misma URL muchas veces). Si el trainer aún tiene una
    // notificación sin leer de este cliente no apilamos otra — la cola de la
    // página de métricas ya muestra el detalle. Fire-and-forget.
    void (async () => {
      const { data: clientRow } = await supabase
        .from("clients")
        .select("id, tenant, name, last_name")
        .eq("id", clientId)
        .maybeSingle();

      if (!clientRow?.tenant) return;

      const { data: unread } = await supabase
        .from("notifications")
        .select("id")
        .eq("client_id", clientId)
        .eq("type", "video_upload")
        .is("read_at", null)
        .limit(1);

      if (unread && unread.length > 0) return;

      const { error: notifError } = await supabase.from("notifications").insert(
        buildVideoUploadNotificationRow({
          tenantSlug: session.tenant_slug,
          clientId: Number(clientId),
          trainerId: clientRow.tenant,
          clientName: [clientRow.name, clientRow.last_name]
            .filter(Boolean)
            .join(" "),
        })
      );

      if (notifError) {
        console.error(
          "[Client Exercise Video API] trainer notification insert failed:",
          notifError
        );
      }
    })().catch((e) => {
      console.error(
        "[Client Exercise Video API] trainer notification failed:",
        e
      );
    });

    return NextResponse.json({
      success: true,
      url: publicUrl,
      path: uploadData.path,
    });
  } catch (error) {
    console.error("[Client Exercise Video API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const supabase = createSupabaseClient();

  try {
    const session = await getClientSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { clientId } = await params;

    if (session.client_id.toString() !== clientId) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const videoPath = searchParams.get("path");

    if (!videoPath) {
      return NextResponse.json(
        { success: false, error: "No se proporcionó la ruta del video" },
        { status: 400 }
      );
    }

    const { error: deleteError } = await supabase.storage
      .from("client-exercise-videos")
      .remove([videoPath]);

    if (deleteError) {
      console.error("[Client Exercise Video API] Error deleting:", deleteError);

      return NextResponse.json(
        { success: false, error: "Error al eliminar video" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Video eliminado exitosamente",
    });
  } catch (error) {
    console.error("[Client Exercise Video API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
