/* eslint-disable no-console */
// Get current trainer session API
import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

export async function GET(_request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    const session = await getTrainerSession();

    if (!session) {
      const response = NextResponse.json({ session: null }, { status: 200 });

      response.headers.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate"
      );
      response.headers.set("Pragma", "no-cache");
      response.headers.set("Expires", "0");

      return response;
    }

    const { data: tenant, error } = await supabase
      .from("tenants")
      .select("onboarding_completed")
      .eq("trainer_id", session.trainer_id)
      .maybeSingle();

    if (error) {
      console.warn("[Session] Failed to fetch onboarding status:", error);
    }

    const enrichedSession = {
      ...session,
      onboarding_completed: tenant?.onboarding_completed ?? false,
    };

    const response = NextResponse.json(
      { session: enrichedSession },
      { status: 200 }
    );

    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate"
    );
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");

    return response;
  } catch (error) {
    console.error("[Session] Error getting session:", error);

    return NextResponse.json(
      { session: null, error: "Error al obtener la sesión" },
      { status: 500 }
    );
  }
}
