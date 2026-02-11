import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const supabase = createSupabaseClient();
    const trainerId = session.trainer_id;

    // Date helpers
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const weekStart = new Date(today);

    weekStart.setDate(today.getDate() - today.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekStartStr = weekStart.toISOString().split("T")[0];
    const sevenDaysAgo = new Date(today);

    sevenDaysAgo.setDate(today.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];
    const threeMonthsAgo = new Date();

    threeMonthsAgo.setMonth(today.getMonth() - 3);

    // Get trainer's tenant_host for message/form queries
    const { data: trainerData } = await supabase
      .from("trainers")
      .select("tenant_host")
      .eq("id", trainerId)
      .single();
    const tenantHost = trainerData?.tenant_host || "";

    // Run all queries in parallel for speed
    const [
      activeClientsResult,
      allClientsResult,
      completedSessionsResult,
      scheduledSessionsResult,
      missedSessionsResult,
      retainedClientsResult,
      oldClientsResult,
      checkinsResult,
      unreadMessagesResult,
      // Recent activity sources
      recentCompletedSessions,
      recentMissedSessions,
      recentFormResponses,
      recentNewClients,
      recentProgramCompletions,
      // Clients needing attention
      inactiveClients,
    ] = await Promise.all([
      // 1. Active clients count
      supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("tenant", trainerId)
        .eq("status", "Activo"),

      // 2. All clients (for active today calculation)
      supabase
        .from("clients")
        .select("id, last_login_at")
        .eq("tenant", trainerId)
        .eq("status", "Activo"),

      // 3. Completed sessions this week
      supabase
        .from("scheduled_sessions")
        .select("*", { count: "exact", head: true })
        .eq("trainer_id", trainerId)
        .eq("status", "completed")
        .gte("scheduled_date", weekStartStr),

      // 4. Total scheduled sessions this week (all statuses)
      supabase
        .from("scheduled_sessions")
        .select("*", { count: "exact", head: true })
        .eq("trainer_id", trainerId)
        .gte("scheduled_date", weekStartStr),

      // 5. Missed sessions this week
      supabase
        .from("scheduled_sessions")
        .select("*", { count: "exact", head: true })
        .eq("trainer_id", trainerId)
        .eq("status", "missed")
        .gte("scheduled_date", weekStartStr),

      // 6. Retained clients (active, joined 3+ months ago)
      supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("tenant", trainerId)
        .eq("status", "Activo")
        .lte("sign_up_date", threeMonthsAgo.toISOString().split("T")[0]),

      // 7. All clients joined 3+ months ago
      supabase
        .from("clients")
        .select("id")
        .eq("tenant", trainerId)
        .lte("sign_up_date", threeMonthsAgo.toISOString().split("T")[0]),

      // 8. Check-ins this week
      tenantHost
        ? supabase
            .from("form_responses")
            .select("*", { count: "exact", head: true })
            .eq("tenant_host", tenantHost)
            .eq("form_type", "checkins")
            .gte("submitted_at", weekStart.toISOString())
        : Promise.resolve({ count: 0, error: null }),

      // 9. Unread messages (from clients, not read by trainer)
      tenantHost
        ? supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .eq("tenant_slug", tenantHost)
            .eq("sender_type", "client")
            .is("read_at", null)
        : Promise.resolve({ count: 0, error: null }),

      // --- Recent Activity Sources (last 7 days) ---

      // 10. Recent completed sessions with client info
      supabase
        .from("scheduled_sessions")
        .select("id, client_id, completion_date, scheduled_date")
        .eq("trainer_id", trainerId)
        .eq("status", "completed")
        .gte("scheduled_date", sevenDaysAgoStr)
        .order("completion_date", { ascending: false })
        .limit(5),

      // 11. Recent missed sessions
      supabase
        .from("scheduled_sessions")
        .select("id, client_id, scheduled_date")
        .eq("trainer_id", trainerId)
        .eq("status", "missed")
        .gte("scheduled_date", sevenDaysAgoStr)
        .order("scheduled_date", { ascending: false })
        .limit(5),

      // 12. Recent form responses
      tenantHost
        ? supabase
            .from("form_responses")
            .select("id, client_id, form_type, submitted_at")
            .eq("tenant_host", tenantHost)
            .gte("submitted_at", sevenDaysAgo.toISOString())
            .order("submitted_at", { ascending: false })
            .limit(5)
        : Promise.resolve({ data: [], error: null }),

      // 13. Recent new clients
      supabase
        .from("clients")
        .select("id, name, last_name, sign_up_date")
        .eq("tenant", trainerId)
        .gte("sign_up_date", sevenDaysAgoStr)
        .order("sign_up_date", { ascending: false })
        .limit(5),

      // 14. Recent program completions (progress = 100 or status = completed)
      supabase
        .from("client_programs")
        .select("id, client_id, updated_at")
        .eq("trainer_id", trainerId)
        .eq("status", "completed")
        .gte("updated_at", sevenDaysAgo.toISOString())
        .order("updated_at", { ascending: false })
        .limit(5),

      // 15. Inactive clients (no login in 7+ days but status = Activo)
      supabase
        .from("clients")
        .select("id, name, last_name, last_login_at")
        .eq("tenant", trainerId)
        .eq("status", "Activo")
        .or(
          `last_login_at.is.null,last_login_at.lt.${sevenDaysAgo.toISOString()}`
        ),
    ]);

    // --- Compute top-level metrics ---
    const activeClients = activeClientsResult.count || 0;
    const completedSessions = completedSessionsResult.count || 0;
    const scheduledSessionsThisWeek = scheduledSessionsResult.count || 0;
    const missedSessionsThisWeek = missedSessionsResult.count || 0;

    const oldClientsCount = oldClientsResult.data?.length || 0;
    const retentionRate =
      oldClientsCount > 0
        ? Math.round(
            ((retainedClientsResult.count || 0) / oldClientsCount) * 100
          )
        : 0;

    // Clients active today (logged in today)
    const clientsActiveToday =
      allClientsResult.data?.filter((c: any) => {
        if (!c.last_login_at) return false;

        return c.last_login_at.startsWith(todayStr);
      }).length || 0;

    const checkinsThisWeek = (checkinsResult as any).count || 0;
    const unreadMessages = (unreadMessagesResult as any).count || 0;

    // --- Build the recent activity feed ---
    // Collect all client IDs referenced in activity events
    const clientIds = new Set<number>();

    recentCompletedSessions.data?.forEach((s: any) =>
      clientIds.add(s.client_id)
    );
    recentMissedSessions.data?.forEach((s: any) => clientIds.add(s.client_id));
    (recentFormResponses as any).data?.forEach((f: any) =>
      clientIds.add(f.client_id)
    );
    recentProgramCompletions.data?.forEach((p: any) =>
      clientIds.add(p.client_id)
    );

    // Fetch client names for activity items
    let clientNameMap: Record<number, string> = {};
    const clientIdArray = Array.from(clientIds);

    if (clientIdArray.length > 0) {
      const { data: clientNames } = await supabase
        .from("clients")
        .select("id, name, last_name")
        .in("id", clientIdArray);

      if (clientNames) {
        clientNames.forEach((c: any) => {
          const fullName = [c.name, c.last_name].filter(Boolean).join(" ");

          clientNameMap[c.id] = fullName || `Cliente #${c.id}`;
        });
      }
    }

    // Also add names from new clients directly
    recentNewClients.data?.forEach((c: any) => {
      const fullName = [c.name, c.last_name].filter(Boolean).join(" ");

      clientNameMap[c.id] = fullName || `Cliente #${c.id}`;
    });

    // Build activity events
    type ActivityEvent = {
      id: string;
      type: string;
      clientName: string;
      clientId: number;
      description: string;
      timestamp: string;
      icon: string;
      color: string;
    };

    const events: ActivityEvent[] = [];

    // Completed sessions
    recentCompletedSessions.data?.forEach((s: any) => {
      events.push({
        id: `session-completed-${s.id}`,
        type: "session_completed",
        clientName: clientNameMap[s.client_id] || `Cliente #${s.client_id}`,
        clientId: s.client_id,
        description: "completó su sesión de entrenamiento",
        timestamp: s.completion_date || s.scheduled_date,
        icon: "solar:dumbbell-bold",
        color: "green",
      });
    });

    // Missed sessions
    recentMissedSessions.data?.forEach((s: any) => {
      events.push({
        id: `session-missed-${s.id}`,
        type: "session_missed",
        clientName: clientNameMap[s.client_id] || `Cliente #${s.client_id}`,
        clientId: s.client_id,
        description: "no asistió a su sesión programada",
        timestamp: s.scheduled_date,
        icon: "solar:close-circle-bold",
        color: "red",
      });
    });

    // Form responses (check-ins / habits)
    (recentFormResponses as any).data?.forEach((f: any) => {
      const formLabel =
        f.form_type === "checkins" ? "check-in" : "formulario de hábitos";

      events.push({
        id: `form-${f.id}`,
        type: "form_response",
        clientName: clientNameMap[f.client_id] || `Cliente #${f.client_id}`,
        clientId: f.client_id,
        description: `envió su ${formLabel}`,
        timestamp: f.submitted_at,
        icon: "solar:document-text-bold",
        color: "blue",
      });
    });

    // New clients
    recentNewClients.data?.forEach((c: any) => {
      events.push({
        id: `new-client-${c.id}`,
        type: "new_client",
        clientName: clientNameMap[c.id] || `Cliente #${c.id}`,
        clientId: c.id,
        description: "se registró como nuevo cliente",
        timestamp: c.sign_up_date,
        icon: "solar:user-plus-bold",
        color: "slate",
      });
    });

    // Program completions
    recentProgramCompletions.data?.forEach((p: any) => {
      events.push({
        id: `program-${p.id}`,
        type: "program_completed",
        clientName: clientNameMap[p.client_id] || `Cliente #${p.client_id}`,
        clientId: p.client_id,
        description: "completó su programa de entrenamiento",
        timestamp: p.updated_at,
        icon: "solar:cup-star-bold",
        color: "amber",
      });
    });

    // Sort by timestamp descending, take top 10
    events.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const recentActivity = events.slice(0, 10);

    // Clients needing attention
    const clientsNeedingAttention = inactiveClients.data?.length || 0;

    const result = {
      // Top-level KPIs (existing)
      activeClients,
      completedSessions,
      retentionRate,
      // Engagement summary (new)
      scheduledSessionsThisWeek,
      missedSessionsThisWeek,
      checkinsThisWeek,
      clientsActiveToday,
      unreadMessages,
      // Activity feed (new)
      recentActivity,
      // Attention (new)
      clientsNeedingAttention,
    };

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[Metrics Dashboard] Error:", error);

    return NextResponse.json(
      { error: "Error al obtener métricas" },
      { status: 500 }
    );
  }
}
