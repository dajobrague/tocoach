/* eslint-disable no-console */
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
export async function GET(_request: NextRequest) {
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
        .select("logo_url, theme_json, trainer_id")
        .eq("slug", session.tenant_slug)
        .single(),
      supabase
        .from("clients")
        .select("id, name, last_name, profile_picture_url")
        .eq("id", session.client_id)
        .single(),
    ]);

    // Fetch trainer's community_url if tenant has a trainer_id
    let communityUrl: string | null = null;

    if (tenantResult.data?.trainer_id) {
      const { data: trainer } = await supabase
        .from("trainers")
        .select("community_url")
        .eq("id", tenantResult.data.trainer_id)
        .single();

      communityUrl = trainer?.community_url || null;
    }

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
    const lastName =
      profile?.last_name || fullName.split(" ").slice(1).join(" ");

    return NextResponse.json({
      success: true,
      data: {
        clientId: session.client_id.toString(),
        firstName,
        lastName,
        logoUrl: tenant?.logo_url || "",
        trainerName: tenant?.theme_json?.meta?.name || "Your Trainer",
        clientProfilePicture: profile?.profile_picture_url || "",
        tenantSlug: session.tenant_slug,
        communityUrl,
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
