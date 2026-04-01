import type { CheckInSchedule } from "@/lib/forms/types";

import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { getScheduleOrDefault } from "@/lib/forms/schedule";

/**
 * POST /api/forms/notifications/test
 * Create a test notification for forms (for testing purposes)
 */
export async function POST(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    const body = await request.json();
    const { client_id, form_type } = body;

    if (!client_id || !form_type) {
      return NextResponse.json(
        { success: false, error: "client_id and form_type required" },
        { status: 400 }
      );
    }

    // Get tenant_host for this client
    const { data: clientData } = await supabase
      .from("clients")
      .select("tenant")
      .eq("id", client_id)
      .single();

    if (!clientData) {
      return NextResponse.json(
        { success: false, error: "Cliente no encontrado" },
        { status: 404 }
      );
    }

    const { data: tenantRecord } = await supabase
      .from("tenants")
      .select("host")
      .eq("trainer_id", clientData.tenant)
      .single();

    if (!tenantRecord) {
      return NextResponse.json(
        { success: false, error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    const tenantHost = tenantRecord.host;

    let checkinLabel = "Check-in";

    if (form_type === "checkins") {
      const { data: cfgRow } = await supabase
        .from("client_form_configs")
        .select("schedule")
        .eq("client_id", client_id)
        .eq("form_type", "checkins")
        .maybeSingle();

      checkinLabel = getScheduleOrDefault(
        cfgRow?.schedule as CheckInSchedule | null
      ).custom_name;
    }

    const title =
      form_type === "checkins"
        ? `${checkinLabel} disponible`
        : "Registro Diario Disponible";

    const message =
      form_type === "checkins"
        ? `Tu ${checkinLabel} está listo. ¡Compártenos cómo va tu semana!`
        : "¡Buenos días! Registra tus hábitos de hoy";

    // Create test notification
    const { data: notification, error } = await supabase
      .from("notifications")
      .insert({
        tenant_slug: tenantHost,
        client_id: client_id,
        type:
          form_type === "checkins"
            ? "form_weekly_available"
            : "form_daily_available",
        title,
        message,
        icon:
          form_type === "checkins"
            ? "solar:clipboard-check-bold"
            : "solar:calendar-mark-bold",
        metadata: {
          form_type,
          action: "open_form",
          test: true,
        },
      })
      .select()
      .single();

    if (error) {
      console.error("[Test Notification] Error:", error);

      return NextResponse.json(
        { success: false, error: "Error al crear notificación de prueba" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      notification,
      message: "Test notification created! Check the notification bell icon.",
    });
  } catch (error) {
    console.error("[Test Notification] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
