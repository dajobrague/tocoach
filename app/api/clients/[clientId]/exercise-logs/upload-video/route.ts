import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

const ALLOWED_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
];
const MAX_SIZE = 100 * 1024 * 1024; // 100MB

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
          error: "El archivo es demasiado grande (máx 100MB)",
        },
        { status: 400 }
      );
    }

    const timestamp = Date.now();
    const fileExt = file.name.split(".").pop();
    const fileName = `${clientId}/${timestamp}.${fileExt}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("client-exercise-videos")
      .upload(fileName, file, {
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
