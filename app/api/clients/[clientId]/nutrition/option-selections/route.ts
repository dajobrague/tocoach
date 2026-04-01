import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Approximate Chicago wall-clock as Date (same pattern as client nutrition UI). */
function chicagoWallClockDate(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })
  );
}

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${y}-${m}-${day}`;
}

/** Sunday–Saturday week in Chicago containing "today". */
function defaultChicagoWeekRange(): { from: string; to: string } {
  const c = chicagoWallClockDate();
  const dow = c.getDay();
  const start = new Date(c);

  start.setDate(c.getDate() - dow);
  const end = new Date(start);

  end.setDate(start.getDate() + 6);

  return { from: toYMD(start), to: toYMD(end) };
}

/**
 * GET /api/clients/[clientId]/nutrition/option-selections?from=&to=
 * Defaults: current week (Sun–Sat, America/Chicago).
 */
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

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .eq("tenant", session.trainer_id)
      .maybeSingle();

    if (clientError || !client) {
      return NextResponse.json(
        { success: false, error: "Cliente no encontrado" },
        { status: 404 }
      );
    }

    const def = defaultChicagoWeekRange();
    const from = request.nextUrl.searchParams.get("from")?.trim() || def.from;
    const to = request.nextUrl.searchParams.get("to")?.trim() || def.to;

    if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
      return NextResponse.json(
        { success: false, error: "from y to deben ser YYYY-MM-DD" },
        { status: 400 }
      );
    }

    const { data: rows, error } = await supabase
      .from("nutrition_option_selections")
      .select(
        `
        id,
        selected_date,
        meal_id,
        option_id,
        created_at,
        nutrition_meals ( label ),
        nutrition_meal_options ( name )
      `
      )
      .eq("client_id", clientId)
      .gte("selected_date", from)
      .lte("selected_date", to)
      .order("selected_date", { ascending: true });

    if (error) {
      console.error("[Trainer option-selections GET]", error);

      return NextResponse.json(
        { success: false, error: "Error al cargar selecciones" },
        { status: 500 }
      );
    }

    const normalized = (rows || []).map((r: Record<string, unknown>) => {
      const meal = r.nutrition_meals as { label?: string } | null;
      const opt = r.nutrition_meal_options as { name?: string } | null;

      return {
        id: r.id,
        selected_date: r.selected_date,
        meal_id: r.meal_id,
        option_id: r.option_id,
        created_at: r.created_at,
        meal_label: meal?.label ?? "",
        option_name: opt?.name ?? "",
      };
    });

    return NextResponse.json({
      success: true,
      data: normalized,
      range: { from, to },
    });
  } catch (e) {
    console.error("[Trainer option-selections GET]", e);

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
