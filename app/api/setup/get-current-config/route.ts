// Get current trainer configuration API
import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

/**
 * Clean up legacy .localhost suffix from tenant host values
 */
function cleanupLegacyDomain(domain: string | undefined | null): string {
  if (!domain) return "temp-slug";

  // Remove .localhost suffix if present (legacy format)
  return domain.replace(/\.localhost$/, "");
}

export async function GET(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    // Check authentication
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Get tenant configuration directly using trainer_id (which is the auth user id)
    const { data: tenantDataArray, error: tenantError } = await supabase
      .from("tenants")
      .select("slug, theme_json, status")
      .eq("trainer_id", session.trainer_id);

    const tenantData =
      tenantDataArray && tenantDataArray.length > 0 ? tenantDataArray[0] : null;

    // Try to get trainer data if it exists (optional)
    const { data: trainerDataArray } = await supabase
      .from("trainers")
      .select("tenant_host, full_name, email")
      .eq("id", session.trainer_id);

    const trainerData =
      trainerDataArray && trainerDataArray.length > 0
        ? trainerDataArray[0]
        : null;

    // Use tenant data first, then session data, then trainer data as fallback
    // Clean up any legacy .localhost suffixes
    const currentSlug = cleanupLegacyDomain(
      tenantData?.slug || session.tenant_host || trainerData?.tenant_host
    );
    const themeJson = tenantData?.theme_json || null;

    return NextResponse.json({
      success: true,
      config: {
        trainer: {
          id: session.trainer_id,
          email: session.email || trainerData?.email,
          fullName: session.full_name || trainerData?.full_name,
        },
        domain: {
          current: currentSlug,
          isConfigured: !!tenantData?.slug, // true if slug is properly configured
        },
        theme: themeJson,
        status: tenantData?.status || "inactive",
      },
    });
  } catch (error) {
    console.error("[Get Config] Unexpected error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
