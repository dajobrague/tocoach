import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/clients/supabase-server";

interface RouteContext {
  params: Promise<{ clientId: string }>;
}

const WEIGHT_KEYS = ["body_weight", "weight", "peso", "peso_corporal"] as const;

/** Latest weight the client reported in any check-in / daily form response. */
function latestWeight(rows: { answers: unknown }[]): number | null {
  for (const row of rows) {
    const answers = row.answers;

    if (
      answers === null ||
      typeof answers !== "object" ||
      Array.isArray(answers)
    ) {
      continue;
    }

    for (const key of WEIGHT_KEYS) {
      const value = Number((answers as Record<string, unknown>)[key]);

      if (Number.isFinite(value) && value > 0) return value;
    }
  }

  return null;
}

function ageFromDob(dob: string | null): number | null {
  if (dob === null) return null;
  const birth = new Date(dob);

  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}

// GET /api/clients/[clientId]/bmr — the profile inputs the BMR calculator
// prefills: sex/height from the profile, age derived from dob, weight from
// the latest check-in response that carries one.
export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await getTrainerSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { clientId } = await context.params;
    const supabase = createServerSupabaseClient();

    const { data: client } = await supabase
      .from("clients")
      .select("id, dob, sex, height_cm")
      .eq("id", Number(clientId))
      .eq("tenant", session.trainer_id)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const { data: responses } = await supabase
      .from("form_responses")
      .select("answers")
      .eq("tenant_host", session.tenant_host)
      .eq("client_id", Number(clientId))
      .order("response_date", { ascending: false })
      .limit(30);

    return NextResponse.json({
      success: true,
      data: {
        sex: (client as { sex: string | null }).sex,
        height_cm:
          (client as { height_cm: number | null }).height_cm !== null
            ? Number((client as { height_cm: number | null }).height_cm)
            : null,
        age: ageFromDob((client as { dob: string | null }).dob),
        latest_weight_kg: latestWeight(responses ?? []),
      },
    });
  } catch (error) {
    console.error("[BMR API] GET error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/clients/[clientId]/bmr — persist sex/height typed into the
// calculator back to the profile (partial update, nothing else touched).
export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getTrainerSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { clientId } = await context.params;
    const body = await request.json().catch(() => null);

    const patch: { sex?: string; height_cm?: number } = {};

    if (body?.sex === "male" || body?.sex === "female") patch.sex = body.sex;
    const height = Number(body?.height_cm);

    if (Number.isFinite(height) && height > 50 && height < 275) {
      patch.height_cm = height;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: "Nada que actualizar (sex o height_cm requeridos)" },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();
    const { data: updated, error } = await (supabase.from("clients") as any)
      .update(patch)
      .eq("id", Number(clientId))
      .eq("tenant", session.trainer_id)
      .select("id, sex, height_cm")
      .single();

    if (error || !updated) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[BMR API] PATCH error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
