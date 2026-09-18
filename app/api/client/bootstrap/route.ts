/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";

import {
  getClientSession,
  updateClientLastLogin,
} from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { resolveTenantLogoUrl } from "@/lib/tenant/logo";

// Sello de "último acceso" como mucho una vez por hora: el query del shell
// refresca este endpoint cada 5 min mientras la app está abierta.
const LAST_SEEN_THROTTLE_MS = 60 * 60 * 1000;

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
        .select("id, name, last_name, profile_picture_url, last_login_at")
        .eq("id", session.client_id)
        .single(),
    ]);

    // `clients.last_login_at` es lo que el trainer ve como "Último acceso",
    // pero solo se sellaba al introducir la contraseña. Como la sesión de
    // cliente dura 30 días, alguien que entrena a diario aparecía con
    // "hace 12 días". Este endpoint se llama al abrir la app, así que el
    // sello pasa a significar "última vez que abrió la app".
    const lastSeen = profileResult.data?.last_login_at
      ? new Date(profileResult.data.last_login_at).getTime()
      : 0;

    if (Date.now() - lastSeen > LAST_SEEN_THROTTLE_MS) {
      updateClientLastLogin(session.client_id).catch(console.warn);
    }

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
        logoUrl: resolveTenantLogoUrl(tenant?.logo_url, tenant?.theme_json),
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
