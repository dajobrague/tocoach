import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

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

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No se proporcionó ningún archivo" },
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

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        {
          success: false,
          error: "La imagen no puede superar 2MB",
        },
        { status: 400 }
      );
    }

    // Generate a unique file path using the client ID
    const ext = file.name.split(".").pop() || "jpg";
    const filePath = `${session.client_id}/avatar.${ext}`;

    // Convert File to ArrayBuffer then to Uint8Array for Supabase
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage (upsert to overwrite previous avatar)
    const { error: uploadError } = await supabase.storage
      .from("client-profile-pictures")
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("[Profile Picture] Upload error:", uploadError);

      return NextResponse.json(
        { success: false, error: "Error al subir la imagen" },
        { status: 500 }
      );
    }

    // Get the public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("client-profile-pictures").getPublicUrl(filePath);

    // Add a cache-buster query param so the browser sees the new image
    const profilePictureUrl = `${publicUrl}?t=${Date.now()}`;

    // Update the client's profile_picture_url in the database
    const { error: updateError } = await supabase
      .from("clients")
      .update({ profile_picture_url: profilePictureUrl })
      .eq("id", session.client_id);

    if (updateError) {
      console.error("[Profile Picture] DB update error:", updateError);

      return NextResponse.json(
        { success: false, error: "Error al actualizar el perfil" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      profilePictureUrl,
      message: "Foto de perfil actualizada correctamente",
    });
  } catch (error) {
    console.error("[Profile Picture] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
