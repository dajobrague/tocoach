import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseBody(body: unknown): {
  mealId: string;
  optionId: string;
  date: string;
} | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const mealId = typeof o.mealId === "string" ? o.mealId.trim() : "";
  const optionId = typeof o.optionId === "string" ? o.optionId.trim() : "";
  const date = typeof o.date === "string" ? o.date.trim() : "";

  if (!mealId || !optionId || !DATE_RE.test(date)) return null;

  return { mealId, optionId, date };
}

/** GET ?date=YYYY-MM-DD — selections for the authenticated client on that day */
export async function GET(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    const session = await getClientSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const date = request.nextUrl.searchParams.get("date")?.trim() ?? "";

    if (!DATE_RE.test(date)) {
      return NextResponse.json(
        { success: false, error: "Parámetro date inválido (use YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("nutrition_option_selections")
      .select("meal_id, option_id, created_at")
      .eq("client_id", session.client_id)
      .eq("selected_date", date);

    if (error) {
      console.error("[Client select-option GET]", error);

      return NextResponse.json(
        { success: false, error: "Error al cargar selecciones" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (e) {
    console.error("[Client select-option GET]", e);

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}

/** POST { mealId, optionId, date } — upsert selection */
export async function POST(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    const session = await getClientSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    let json: unknown;

    try {
      json = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Cuerpo JSON inválido" },
        { status: 400 }
      );
    }

    const parsed = parseBody(json);

    if (!parsed) {
      return NextResponse.json(
        {
          success: false,
          error: "Se requieren mealId, optionId y date (YYYY-MM-DD)",
        },
        { status: 400 }
      );
    }

    const { mealId, optionId, date } = parsed;

    const { data: mealRow, error: mealErr } = await supabase
      .from("nutrition_meals")
      .select("id, nutrition_day_id")
      .eq("id", mealId)
      .maybeSingle();

    if (mealErr || !mealRow) {
      return NextResponse.json(
        { success: false, error: "Comida no encontrada" },
        { status: 404 }
      );
    }

    const { data: dayRow, error: dayErr } = await supabase
      .from("nutrition_days")
      .select("id, nutrition_plan_id")
      .eq("id", mealRow.nutrition_day_id)
      .maybeSingle();

    if (dayErr || !dayRow) {
      return NextResponse.json(
        { success: false, error: "Día del plan no encontrado" },
        { status: 404 }
      );
    }

    const { data: planRow, error: planErr } = await supabase
      .from("nutrition_plans")
      .select("id, client_id")
      .eq("id", dayRow.nutrition_plan_id)
      .maybeSingle();

    if (planErr || !planRow) {
      return NextResponse.json(
        { success: false, error: "Plan no encontrado" },
        { status: 404 }
      );
    }

    if (String(planRow.client_id) !== String(session.client_id)) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 403 }
      );
    }

    const { data: optRow, error: optErr } = await supabase
      .from("nutrition_meal_options")
      .select("id, meal_id")
      .eq("id", optionId)
      .maybeSingle();

    if (optErr || !optRow || optRow.meal_id !== mealId) {
      return NextResponse.json(
        { success: false, error: "Opción no válida para esta comida" },
        { status: 400 }
      );
    }

    const { error: upsertErr } = await supabase
      .from("nutrition_option_selections")
      .upsert(
        {
          client_id: session.client_id,
          meal_id: mealId,
          option_id: optionId,
          selected_date: date,
        },
        {
          onConflict: "client_id,meal_id,selected_date",
        }
      );

    if (upsertErr) {
      console.error("[Client select-option POST]", upsertErr);

      return NextResponse.json(
        { success: false, error: "No se pudo guardar la selección" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[Client select-option POST]", e);

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
