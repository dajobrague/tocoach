// Trainer profile API - GET and PATCH
import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

export async function GET() {
  const supabase = createSupabaseClient();

  try {
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { data: trainer, error } = await supabase
      .from("trainers")
      .select(
        "id, email, full_name, phone, profile_picture_url, tenant_host, created_at, status, community_url"
      )
      .eq("id", session.trainer_id)
      .single();

    if (error || !trainer) {
      console.error("[Trainer Profile] Error fetching profile:", error);

      return NextResponse.json(
        { error: "Error al obtener perfil" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, trainer });
  } catch (error) {
    console.error("[Trainer Profile] Unexpected error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();

    // Validate community_url format if provided
    if (
      body.community_url !== undefined &&
      body.community_url !== null &&
      body.community_url !== ""
    ) {
      try {
        new URL(body.community_url);
      } catch {
        return NextResponse.json(
          { error: "URL de comunidad no válida" },
          { status: 400 }
        );
      }
    }

    // Only allow updating specific fields
    const allowedFields = ["full_name", "phone", "email", "community_url"];
    const updates: Record<string, string | null> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No hay campos para actualizar" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("trainers")
      .update(updates)
      .eq("id", session.trainer_id);

    if (error) {
      console.error("[Trainer Profile] Error updating profile:", error);

      return NextResponse.json(
        { error: "Error al actualizar perfil" },
        { status: 500 }
      );
    }

    console.log(
      `[Trainer Profile] Updated profile for ${session.trainer_id}:`,
      Object.keys(updates)
    );

    return NextResponse.json({
      success: true,
      message: "Perfil actualizado correctamente",
    });
  } catch (error) {
    console.error("[Trainer Profile] Unexpected error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
