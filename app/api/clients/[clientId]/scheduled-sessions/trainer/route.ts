import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const supabase = createSupabaseClient();

  try {
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { clientId } = await params;
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, tenant")
      .eq("id", clientId)
      .single();

    if (clientError || !client || client.tenant !== session.trainer_id) {
      return NextResponse.json(
        { success: false, error: "Cliente no encontrado" },
        { status: 404 }
      );
    }

    let query = supabase
      .from("scheduled_sessions")
      .select(
        `id, scheduled_date, status, completion_date,
         session:sessions(
           id, name,
           session_exercises(
             id, exercise_order, sets, reps, weight_kg,
             exercise:exercises(id, name, category)
           )
         )`
      )
      .eq("client_id", clientId)
      .order("scheduled_date", { ascending: true });

    if (startDate) query = query.gte("scheduled_date", startDate);
    if (endDate) query = query.lte("scheduled_date", endDate);

    const { data, error } = await query;

    if (error) {
      console.error("[Trainer Scheduled Sessions API] Error:", error);

      return NextResponse.json(
        { success: false, error: "Error al obtener sesiones programadas" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      scheduledSessions: data ?? [],
    });
  } catch (error) {
    console.error("[Trainer Scheduled Sessions API] Unexpected:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
