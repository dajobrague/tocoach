// Image upload API for supplement images in Supabase Storage
import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

export async function POST(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    // Check authentication
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("image") as File;
    const supplementId = formData.get("supplement_id") as string;

    if (!file) {
      return NextResponse.json(
        { error: "No se encontró el archivo" },
        { status: 400 }
      );
    }

    if (!supplementId) {
      return NextResponse.json(
        { error: "supplement_id es requerido" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Tipo de archivo no válido. Usa PNG, JPG o WebP" },
        { status: 400 }
      );
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        { error: "El archivo es demasiado grande. Máximo 2MB" },
        { status: 400 }
      );
    }

    // Generate file path: supplement-images/{trainer_id}/{supplement_id}/{timestamp}_{filename}
    const fileExtension = file.name.split(".").pop()?.toLowerCase() || "png";
    const timestamp = Date.now();
    const fileName = `${session.trainer_id}/${supplementId}/${timestamp}.${fileExtension}`;

    console.log("[Supplement Image Upload] Uploading image:", fileName);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("supplement-images")
      .upload(fileName, file, {
        contentType: file.type,
        cacheControl: "3600",
      });

    if (uploadError) {
      console.error("[Supplement Image Upload] Upload error:", uploadError);

      return NextResponse.json(
        { error: "Error al subir el archivo" },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("supplement-images")
      .getPublicUrl(fileName);

    const imageUrl = urlData.publicUrl;

    console.log(
      `[Supplement Image Upload] Successfully uploaded image for supplement ${supplementId}: ${imageUrl}`
    );

    return NextResponse.json({
      success: true,
      imageUrl,
      message: "Imagen subida correctamente",
    });
  } catch (error) {
    console.error("[Supplement Image Upload] Unexpected error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// DELETE - Delete an image from storage
export async function DELETE(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    // Check authentication
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { imageUrl } = body;

    if (!imageUrl) {
      return NextResponse.json(
        { error: "imageUrl es requerido" },
        { status: 400 }
      );
    }

    // Extract the file path from the URL
    // URL format: https://{project}.supabase.co/storage/v1/object/public/supplement-images/{path}
    const urlParts = imageUrl.split("/supplement-images/");

    if (urlParts.length < 2) {
      return NextResponse.json(
        { error: "URL de imagen no válida" },
        { status: 400 }
      );
    }

    const filePath = urlParts[1];

    console.log("[Supplement Image Upload] Deleting image:", filePath);

    // Delete from Supabase Storage
    const { error: deleteError } = await supabase.storage
      .from("supplement-images")
      .remove([filePath]);

    if (deleteError) {
      console.error("[Supplement Image Upload] Delete error:", deleteError);

      return NextResponse.json(
        { error: "Error al eliminar el archivo" },
        { status: 500 }
      );
    }

    console.log(
      `[Supplement Image Upload] Successfully deleted image: ${filePath}`
    );

    return NextResponse.json({
      success: true,
      message: "Imagen eliminada correctamente",
    });
  } catch (error) {
    console.error("[Supplement Image Upload] Unexpected error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
