import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// POST - Upload exercise image to Supabase storage
export async function POST(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    // Authenticate trainer
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    // Get form data
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No se proporcionó archivo" },
        { status: 400 }
      );
    }

    console.log(
      "[Exercise Library API] Uploading image:",
      file.name,
      "size:",
      file.size,
      "type:",
      file.type
    );

    // Validate file type
    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/gif",
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: "Tipo de archivo no permitido. Use PNG, JPEG, WEBP o GIF",
        },
        { status: 400 }
      );
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: "El archivo es demasiado grande (máx 5MB)" },
        { status: 400 }
      );
    }

    // Get tenant_host for the trainer
    const { data: tenant } = await supabase
      .from("tenants")
      .select("host")
      .eq("trainer_id", session.trainer_id)
      .single();

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileExt = file.name.split(".").pop();
    const fileName = `${tenant.host}/${session.trainer_id}/${timestamp}.${fileExt}`;

    // Upload to Supabase storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("exercise-images")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error(
        "[Exercise Library API] Error uploading image:",
        uploadError
      );

      return NextResponse.json(
        { success: false, error: "Error al subir imagen" },
        { status: 500 }
      );
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("exercise-images").getPublicUrl(fileName);

    console.log(
      "[Exercise Library API] Image uploaded successfully:",
      publicUrl
    );

    return NextResponse.json({
      success: true,
      url: publicUrl,
      path: uploadData.path,
    });
  } catch (error) {
    console.error("[Exercise Library API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}

// DELETE - Delete exercise image from Supabase storage
export async function DELETE(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    // Authenticate trainer
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const imagePath = searchParams.get("path");

    if (!imagePath) {
      return NextResponse.json(
        { success: false, error: "No se proporcionó la ruta de la imagen" },
        { status: 400 }
      );
    }

    console.log("[Exercise Library API] Deleting image:", imagePath);

    // Delete from Supabase storage
    const { error: deleteError } = await supabase.storage
      .from("exercise-images")
      .remove([imagePath]);

    if (deleteError) {
      console.error(
        "[Exercise Library API] Error deleting image:",
        deleteError
      );

      return NextResponse.json(
        { success: false, error: "Error al eliminar imagen" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Imagen eliminada exitosamente",
    });
  } catch (error) {
    console.error("[Exercise Library API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
