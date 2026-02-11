import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

/**
 * GET /api/client/bootstrap
 *
 * Single endpoint that returns everything the client app shell needs:
 *   - Client profile (id, name, profile picture)
 *   - Tenant context (logo, trainer name)
 *
 * Both queries run in parallel so the total latency is max(tenant, profile)
 * rather than tenant + profile.
 */
export async function GET(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    const session = await getClientSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    // Run both queries in parallel — single round-trip time instead of two
    const [tenantResult, profileResult] = await Promise.all([
      supabase
        .from("tenants")
        .select("logo_url, theme_json")
        .eq("host", session.tenant_slug)
        .single(),
      supabase
        .from("clients")
        .select("id, name, last_name, profile_picture_url")
        .eq("id", session.client_id)
        .single(),
    ]);

    if (tenantResult.error) {
      console.error("[Bootstrap API] Tenant query error:", tenantResult.error);
    }

    if (profileResult.error) {
      console.error(
        "[Bootstrap API] Profile query error:",
        profileResult.error
      );
    }

    const tenant = tenantResult.data;
    const profile = profileResult.data;

    const fullName = profile
      ? `${profile.name} ${profile.last_name || ""}`.trim()
      : session.full_name || "Client";
    const firstName = profile?.name || fullName.split(" ")[0];

    return NextResponse.json({
      success: true,
      data: {
        clientId: session.client_id.toString(),
        firstName,
        logoUrl: tenant?.logo_url || "",
        trainerName: tenant?.theme_json?.meta?.name || "Your Trainer",
        clientProfilePicture: profile?.profile_picture_url || "",
        tenantSlug: session.tenant_slug,
      },
    });
  } catch (error) {
    console.error("[Bootstrap API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
