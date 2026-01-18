// Save slug configuration API
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

    const body = await request.json();
    const { domain: slug } = body; // Keep parameter name for backward compatibility

    if (!slug || typeof slug !== "string") {
      return NextResponse.json({ error: "Slug requerido" }, { status: 400 });
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
      console.error("[Save Slug] Trainer update error:", trainerError);

      return NextResponse.json(
        { error: "Error al actualizar el perfil del entrenador" },
        { status: 500 }
      );
    }

    // First, find existing tenant for this trainer
    const { data: existingTenant, error: findError } = await supabase
      .from("tenants")
      .select("slug, theme_json")
      .eq("trainer_id", session.trainer_id)
      .single();

    let tenantError;

    if (existingTenant) {
      // Update existing tenant record
      const updateData = {
        slug: normalizedSlug,
        host: normalizedSlug, // Keep host in sync with slug for now
        status: "active" as const,
      };

      const { error } = await supabase
        .from("tenants")
        .update(updateData)
        .eq("trainer_id", session.trainer_id);

      tenantError = error;
      console.log(
        `[Save Slug] Updated existing tenant from ${existingTenant.slug} to ${normalizedSlug}`
      );
    } else {
      // Create new tenant record
      const { error } = await supabase.from("tenants").insert({
        slug: normalizedSlug,
        host: normalizedSlug, // Keep host in sync with slug for now
        theme_slug: "default",
        trainer_id: session.trainer_id,
        status: "active",
        theme_json: {
          meta: {
            name: session.full_name || "Mi Plataforma",
            description: `${session.full_name || "Mi Plataforma"} - Plataforma de Coaching`,
          },
          colors: {
            brand: "#3b82f6",
            surface: {
              "1": "#ffffff",
              "2": "#f8fafc",
            },
          },
          fonts: {
            heading: "Poppins",
            body: "Poppins",
          },
          shadow: {
            sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
            md: "0 2px 4px -1px rgb(0 0 0 / 0.1)",
          },
        },
      });

      tenantError = error;
      console.log(`[Save Slug] Created new tenant record: ${normalizedSlug}`);
    }

    if (tenantError) {
      console.error("[Save Slug] Tenant operation error:", tenantError);

      return NextResponse.json(
        { error: "Error al actualizar el registro del tenant" },
        { status: 500 }
      );
    }

    console.log(
      `[Save Slug] Successfully updated slug for trainer ${session.trainer_id}: ${normalizedSlug}`
    );

    return NextResponse.json({
      success: true,
      domain: normalizedSlug,
      message: "Slug guardado correctamente",
    });
  } catch (error) {
    console.error("[Save Slug] Unexpected error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
