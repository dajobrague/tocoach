// Trainer profile picture upload API
import { NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

export async function POST(request: Request) {
  const supabase = createSupabaseClient();

  try {
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("photo") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No se encontró el archivo" },
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

    // Generate file path
    const fileExtension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const fileName = `${session.trainer_id}/avatar.${fileExtension}`;

    // Convert to buffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("trainer-profile-pictures")
      .upload(fileName, fileBuffer, {
        upsert: true,
        contentType: file.type,
      });

    if (uploadError) {
      console.error("[Trainer Profile Picture] Storage error:", uploadError);

      return NextResponse.json(
        { error: "Error al subir el archivo" },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("trainer-profile-pictures")
      .getPublicUrl(fileName);

    // Add cache buster to force UI refresh
    const profilePictureUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    // Update trainers table with the URL
    const { error: updateError } = await supabase
      .from("trainers")
      .update({ profile_picture_url: profilePictureUrl })
      .eq("id", session.trainer_id);

    if (updateError) {
      console.error(
        "[Trainer Profile Picture] Database update error:",
        updateError
      );
    }

    console.log(
      `[Trainer Profile Picture] Uploaded for trainer ${session.trainer_id}`
    );

    return NextResponse.json({
      success: true,
      url: profilePictureUrl,
      message: "Foto de perfil actualizada",
    });
  } catch (error) {
    console.error("[Trainer Profile Picture] Unexpected error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
