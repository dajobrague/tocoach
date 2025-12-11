import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";

/**
 * POST /api/forms/notifications/create
 * Create form reminder notifications for clients
 * Can be called manually or by cron job
 */
export async function POST(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    const body = await request.json();
    const { client_id, notification_type, form_type } = body;

    if (!client_id || !notification_type || !form_type) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Parámetros requeridos: client_id, notification_type, form_type",
        },
        { status: 400 }
      );
    }

    // Get tenant_host for this client
    const { data: tenantHost } = await supabase
      .rpc("get_tenant_host_for_client", { p_client_id: client_id })
      .single();

    if (!tenantHost) {
      return NextResponse.json(
        { success: false, error: "Cliente no encontrado" },
        { status: 404 }
      );
    }

    // Get client details
    const { data: client } = await supabase
      .from("clients")
      .select("name, email")
      .eq("id", client_id)
      .single();

    // Create notification title and message based on type
    let title = "";
    let message = "";
    let actionUrl = "";

    if (form_type === "checkins") {
      switch (notification_type) {
        case "form_weekly_available":
          title = "Seguimiento Semanal Disponible";
          message =
            "Tu check-in semanal está listo. ¡Compártenos cómo va tu semana!";
          break;
        case "form_weekly_reminder":
          title = "Recordatorio: Seguimiento Semanal";
          message = "No olvides completar tu check-in semanal";
          break;
        case "form_weekly_expiring":
          title = "Última Oportunidad";
          message =
            "Tu seguimiento semanal vence esta noche. ¡Complétalo ahora!";
          break;
        case "form_weekly_expired":
          title = "Seguimiento Semanal Vencido";
          message =
            "El check-in semanal ha expirado. Estará disponible el próximo lunes.";
          break;
      }
    } else {
      switch (notification_type) {
        case "form_daily_available":
          title = "Registro Diario Disponible";
          message = "¡Buenos días! Registra tus hábitos de hoy";
          break;
        case "form_daily_reminder":
          title = "Recordatorio: Registro Diario";
          message = "Aún no has registrado tus hábitos de hoy";
          break;
      }
    }

    // Check if notification already exists today (for daily) or this week (for weekly)
    const today = new Date().toISOString().split("T")[0];

    let existingCheck = supabase
      .from("notifications")
      .select("id")
      .eq("client_id", client_id)
      .eq("type", notification_type);

    if (form_type === "habits") {
      // For daily: check if notification exists today
      existingCheck = existingCheck.gte("created_at", `${today}T00:00:00`);
    } else {
      // For weekly: check if notification exists this week
      const weekStart = new Date();
      const dayOfWeek = weekStart.getDay();
      const diff = weekStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);

      weekStart.setDate(diff);
      weekStart.setHours(0, 0, 0, 0);

      existingCheck = existingCheck.gte("created_at", weekStart.toISOString());
    }

    const { data: existing } = await existingCheck.limit(1).single();

    // If notification already exists, skip creation
    if (existing) {
      return NextResponse.json({
        success: true,
        message: "Notification already exists",
        notification: existing,
      });
    }

    // Create notification
    const { data: notification, error } = await supabase
      .from("notifications")
      .insert({
        tenant_slug: tenantHost,
        client_id: client_id,
        type: notification_type,
        title,
        message,
        icon:
          form_type === "checkins"
            ? "solar:clipboard-check-bold"
            : "solar:calendar-mark-bold",
        metadata: {
          form_type,
          action: "open_form",
          created_by: "system",
        },
      })
      .select()
      .single();

    if (error) {
      console.error(
        "[Forms Notifications] Error creating notification:",
        error
      );

      return NextResponse.json(
        { success: false, error: "Error al crear notificación" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      notification,
    });
  } catch (error) {
    console.error("[Forms Notifications] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/forms/notifications/create (batch endpoint)
 * Generate notifications for all clients based on current time
 * Called by Supabase cron job every hour
 */
export async function PUT(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    console.log("[Forms Notifications Batch] Starting batch notification job");

    // Get all active clients
    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select("id, name, tenant_host");

    if (clientsError) {
      console.error(
        "[Forms Notifications Batch] Error fetching clients:",
        clientsError
      );

      return NextResponse.json(
        { success: false, error: "Error fetching clients" },
        { status: 500 }
      );
    }

    if (!clients || clients.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No clients found",
        created: 0,
      });
    }

    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday
    const currentHour = now.getHours();

    console.log(
      `[Forms Notifications Batch] Current time: Day ${currentDay}, Hour ${currentHour}`
    );

    let weeklyCreated = 0;
    let dailyCreated = 0;
    const errors: string[] = [];

    // Process each client
    for (const client of clients) {
      try {
        // Monday 8am UTC: Weekly check-in available
        if (currentDay === 1 && currentHour === 8) {
          // Check if notification already exists for today
          const today = new Date().toISOString().split("T")[0];
          const { data: existingWeekly } = await supabase
            .from("notifications")
            .select("id")
            .eq("client_id", client.id)
            .eq("type", "form_weekly_available")
            .gte("created_at", `${today}T00:00:00`)
            .single();

          if (!existingWeekly) {
            const { error: notifError } = await supabase
              .from("notifications")
              .insert({
                tenant_slug: client.tenant_host,
                client_id: client.id,
                type: "form_weekly_available",
                title: "Seguimiento Semanal Disponible",
                message:
                  "Tu check-in semanal está listo. ¡Compártenos cómo va tu semana!",
                icon: "solar:clipboard-check-bold",
                metadata: {
                  form_type: "checkins",
                  action: "open_form",
                  created_by: "system",
                },
              });

            if (notifError) {
              console.error(
                `[Forms Notifications Batch] Error creating weekly notification for client ${client.id}:`,
                notifError
              );
              errors.push(`Client ${client.id}: ${notifError.message}`);
            } else {
              weeklyCreated++;
            }
          }
        }

        // Every day at 8am UTC: Daily habits available
        if (currentHour === 8) {
          // Check if notification already exists for today
          const today = new Date().toISOString().split("T")[0];
          const { data: existingDaily } = await supabase
            .from("notifications")
            .select("id")
            .eq("client_id", client.id)
            .eq("type", "form_daily_available")
            .gte("created_at", `${today}T00:00:00`)
            .single();

          if (!existingDaily) {
            const { error: notifError } = await supabase
              .from("notifications")
              .insert({
                tenant_slug: client.tenant_host,
                client_id: client.id,
                type: "form_daily_available",
                title: "Registro Diario Disponible",
                message: "¡Buenos días! Registra tus hábitos de hoy",
                icon: "solar:calendar-mark-bold",
                metadata: {
                  form_type: "habits",
                  action: "open_form",
                  created_by: "system",
                },
              });

            if (notifError) {
              console.error(
                `[Forms Notifications Batch] Error creating daily notification for client ${client.id}:`,
                notifError
              );
              errors.push(`Client ${client.id}: ${notifError.message}`);
            } else {
              dailyCreated++;
            }
          }
        }
      } catch (clientError) {
        console.error(
          `[Forms Notifications Batch] Error processing client ${client.id}:`,
          clientError
        );
        errors.push(`Client ${client.id}: ${clientError}`);
      }
    }

    const totalCreated = weeklyCreated + dailyCreated;

    console.log(
      `[Forms Notifications Batch] Completed: ${totalCreated} notifications created (${weeklyCreated} weekly, ${dailyCreated} daily)`
    );

    return NextResponse.json({
      success: true,
      message: `Created ${totalCreated} notifications`,
      weekly: weeklyCreated,
      daily: dailyCreated,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("[Forms Notifications Batch] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
