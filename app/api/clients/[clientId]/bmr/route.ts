import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/clients/supabase-server";

interface RouteContext {
  params: Promise<{ clientId: string }>;
}

const WEIGHT_KEYS = ["body_weight", "weight", "peso", "peso_corporal"] as const;

/** Latest weight the client reported in any check-in / daily form response. */
function latestWeight(
  rows: { answers: unknown; response_date: string }[]
): { kg: number; date: string } | null {
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

      if (Number.isFinite(value) && value > 0) {
        return { kg: value, date: row.response_date };
      }
    }
  }

  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
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
      .select("answers, response_date")
      .eq("tenant_host", session.tenant_host)
      .eq("client_id", Number(clientId))
      .order("response_date", { ascending: false })
      .limit(30);

    const weight = latestWeight(responses ?? []);

    return NextResponse.json({
      success: true,
      data: {
        sex: (client as { sex: string | null }).sex,
        height_cm:
          (client as { height_cm: number | null }).height_cm !== null
            ? Number((client as { height_cm: number | null }).height_cm)
            : null,
        age: ageFromDob((client as { dob: string | null }).dob),
        latest_weight_kg: weight?.kg ?? null,
        latest_weight_date: weight?.date ?? null,
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
// calculator back to the profile, and/or record a weight measurement.
// Weight is NOT a profile column: it lands as body_weight in today's
// check-in response (merged into existing answers), so it joins the same
// history the weight chart already plots.
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

    const weight = Number(body?.weight_kg);
    const hasWeight = Number.isFinite(weight) && weight >= 25 && weight <= 400;

    if (Object.keys(patch).length === 0 && hasWeight === false) {
      return NextResponse.json(
        {
          error: "Nada que actualizar (sex, height_cm o weight_kg requeridos)",
        },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    // The client must belong to this trainer before writing anything.
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("id", Number(clientId))
      .eq("tenant", session.trainer_id)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    if (Object.keys(patch).length > 0) {
      const { error } = await (supabase.from("clients") as any)
        .update(patch)
        .eq("id", Number(clientId))
        .eq("tenant", session.trainer_id);

      if (error) {
        console.error("[BMR API] clients update error:", error);

        return NextResponse.json(
          { error: "No se pudo actualizar el perfil" },
          { status: 500 }
        );
      }
    }

    if (hasWeight) {
      // Server-side UTC date; near-midnight local writes may land on the
      // adjacent day, acceptable for a weight measurement.
      const today = new Date().toISOString().slice(0, 10);
      const { data: existing } = await supabase
        .from("form_responses")
        .select("answers, metadata")
        .eq("tenant_host", session.tenant_host)
        .eq("client_id", Number(clientId))
        .eq("form_type", "checkins")
        .eq("response_date", today)
        .maybeSingle();

      const { error } = await (supabase.from("form_responses") as any).upsert(
        {
          tenant_host: session.tenant_host,
          client_id: Number(clientId),
          form_type: "checkins",
          response_date: today,
          answers: { ...asRecord(existing?.answers), body_weight: weight },
          metadata: {
            ...asRecord(existing?.metadata),
            weight_updated_by: "trainer",
          },
        },
        { onConflict: "tenant_host,client_id,form_type,response_date" }
      );

      if (error) {
        console.error("[BMR API] weight upsert error:", error);

        return NextResponse.json(
          { error: "No se pudo registrar el peso" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[BMR API] PATCH error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
