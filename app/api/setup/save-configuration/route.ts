// Save complete setup configuration (theme, domain, logo, fonts)
import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

export async function POST(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    // Check authentication
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { domain: slug, themeJson } = body; // Keep parameter name for backward compatibility

    console.log("[Save Configuration] Received data:", {
      slug,
      trainerId: session.trainer_id,
      themeKeys: Object.keys(themeJson || {}),
    });

    // Validate required fields
    if (!slug || typeof slug !== "string") {
      return NextResponse.json(
        { success: false, error: "Slug requerido" },
        { status: 400 }
      );
    }

    if (!themeJson || typeof themeJson !== "object") {
      return NextResponse.json(
        { success: false, error: "Configuración de tema requerida" },
        { status: 400 }
      );
    }

    // Validate theme JSON structure (required by database constraints)
    const requiredKeys = ["meta", "fonts", "colors", "radius", "shadow"];
    const missingKeys = requiredKeys.filter((key) => !themeJson[key]);

    if (missingKeys.length > 0) {
      console.error(
        "[Save Configuration] Missing required theme keys:",
        missingKeys
      );

      return NextResponse.json(
        {
          success: false,
          error: `Configuración incompleta. Faltan: ${missingKeys.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const normalizedSlug = slug.toLowerCase().trim();

    // Update trainer's tenant_host (now stores slug)
    const { error: trainerError } = await supabase
      .from("trainers")
      .update({
        tenant_host: normalizedSlug,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.trainer_id);

    if (trainerError) {
      console.error("[Save Configuration] Trainer update error:", trainerError);

      return NextResponse.json(
        {
          success: false,
          error: "Error al actualizar el perfil del entrenador",
        },
        { status: 500 }
      );
    }

    // Check if tenant already exists for this trainer
    const { data: existingTenant, error: findError } = await supabase
      .from("tenants")
      .select("slug, theme_json")
      .eq("trainer_id", session.trainer_id)
      .maybeSingle();

    if (findError) {
      console.error("[Save Configuration] Error finding tenant:", findError);

      return NextResponse.json(
        { success: false, error: "Error al buscar configuración existente" },
        { status: 500 }
      );
    }

    let result;

    if (existingTenant) {
      // Update existing tenant
      console.log(
        "[Save Configuration] Updating existing tenant:",
        existingTenant.slug
      );

      const { data, error } = await supabase
        .from("tenants")
        .update({
          slug: normalizedSlug,
          host: normalizedSlug, // Keep host in sync with slug for now
          theme_json: themeJson,
          status: "active",
          onboarding_completed: true,
          updated_at: new Date().toISOString(),
        })
        .eq("trainer_id", session.trainer_id)
        .select()
        .single();

      if (error) {
        console.error("[Save Configuration] Update error:", error);

        return NextResponse.json(
          { success: false, error: "Error al actualizar la configuración" },
          { status: 500 }
        );
      }

      result = data;
      console.log("[Save Configuration] Successfully updated tenant");
    } else {
      // Create new tenant
      console.log(
        "[Save Configuration] Creating new tenant for slug:",
        normalizedSlug
      );

      const { data, error } = await supabase
        .from("tenants")
        .insert({
          slug: normalizedSlug,
          host: normalizedSlug, // Keep host in sync with slug for now
          theme_slug: "custom",
          theme_json: themeJson,
          trainer_id: session.trainer_id,
          status: "active",
          onboarding_completed: true,
        })
        .select()
        .single();

      if (error) {
        console.error("[Save Configuration] Insert error:", error);

        return NextResponse.json(
          { success: false, error: "Error al crear la configuración" },
          { status: 500 }
        );
      }

      result = data;
      console.log("[Save Configuration] Successfully created tenant");
    }

    return NextResponse.json({
      success: true,
      message: "Configuración guardada exitosamente",
      tenant: {
        host: result.host,
        slug: result.slug,
      },
    });
  } catch (error) {
    console.error("[Save Configuration] Unexpected error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
