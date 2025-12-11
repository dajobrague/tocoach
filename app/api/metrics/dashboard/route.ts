import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  console.log("========================================");
  console.log("[Metrics Dashboard API] Route handler START");
  console.log("========================================");

  try {
    const session = await getTrainerSession();

    console.log(
      "[Metrics Dashboard] Session check:",
      session ? "FOUND" : "NOT FOUND"
    );

    if (!session) {
      console.log("[Metrics Dashboard] Returning 401 - no session");

      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const supabase = createSupabaseClient();

    // Get active clients count (using trainer_id directly - the clients.tenant field is actually the trainer UUID)
    const { count: activeClientsCount, error: clientsError } = await supabase
      .from("clients")
      .select("*", { count: "exact", head: true })
      .eq("tenant", session.trainer_id)
      .eq("status", "Activo");

    console.log(
      "[Metrics Dashboard] Active clients count:",
      activeClientsCount
    );
    if (clientsError) {
      console.log("[Metrics Dashboard] Clients error:", clientsError);
    }

    // Get completed sessions count for this week
    const today = new Date();
    const weekStart = new Date(today);

    weekStart.setDate(today.getDate() - today.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const { count: completedSessionsCount, error: sessionsError } =
      await supabase
        .from("scheduled_sessions")
        .select("*", { count: "exact", head: true })
        .eq("trainer_id", session.trainer_id)
        .eq("status", "completed")
        .gte("scheduled_date", weekStart.toISOString().split("T")[0]);

    console.log(
      "[Metrics Dashboard] Completed sessions:",
      completedSessionsCount
    );

    // Calculate retention rate (clients who stayed 3+ months)
    const threeMonthsAgo = new Date();

    threeMonthsAgo.setMonth(today.getMonth() - 3);

    // Get clients who joined 3+ months ago and are still active
    const { count: retainedClientsCount } = await supabase
      .from("clients")
      .select("*", { count: "exact", head: true })
      .eq("tenant", session.trainer_id)
      .eq("status", "Activo")
      .lte("sign_up_date", threeMonthsAgo.toISOString().split("T")[0]);

    // Get total clients who joined 3+ months ago
    const { data: oldClients } = await supabase
      .from("clients")
      .select("id")
      .eq("tenant", session.trainer_id)
      .lte("sign_up_date", threeMonthsAgo.toISOString().split("T")[0]);

    const oldClientsCount = oldClients?.length || 0;
    const retentionRate =
      oldClientsCount > 0
        ? Math.round(((retainedClientsCount || 0) / oldClientsCount) * 100)
        : 0;

    console.log("[Metrics Dashboard] Retention rate:", retentionRate);

    const result = {
      activeClients: activeClientsCount || 0,
      completedSessions: completedSessionsCount || 0,
      retentionRate: retentionRate,
    };

    console.log("[Metrics Dashboard] Returning success with data:", result);
    console.log("========================================");

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[Metrics Dashboard] FATAL ERROR:", error);

    return NextResponse.json(
      { error: "Error al obtener métricas" },
      { status: 500 }
    );
  }
}
