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
 * POST /api/forms/notifications/generate-batch
 * Generate notifications for all clients based on current time
 * Should be called by a cron job
 */
export async function PUT(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    // Get all active clients
    const { data: clients } = await supabase
      .from("clients")
      .select("id, name, tenant")
      .eq("status", "Activo");

    if (!clients || clients.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No active clients found",
      });
    }

    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday
    const currentHour = now.getHours();

    let created = 0;

    // Simplified: create notifications for all clients
    for (const client of clients) {
      // Monday 8am: Weekly check-in available
      if (currentDay === 1 && currentHour === 8) {
        await fetch(
          `${request.nextUrl.origin}/api/forms/notifications/create`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              client_id: client.id,
              notification_type: "form_weekly_available",
              form_type: "checkins",
            }),
          }
        );
        created++;
      }

      // Daily 8am: Daily habits available
      if (currentHour === 8) {
        await fetch(
          `${request.nextUrl.origin}/api/forms/notifications/create`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              client_id: client.id,
              notification_type: "form_daily_available",
              form_type: "habits",
            }),
          }
        );
        created++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Created ${created} notifications`,
    });
  } catch (error) {
    console.error("[Forms Notifications Batch] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
