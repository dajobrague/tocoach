import { NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  isNutritionV2Enabled,
  isNutritionV2TrainerEnabled,
} from "@/lib/nutrition/feature-flag";
import { listClientReadiness } from "@/lib/nutrition/rollout/readiness-service";

const LOG_PREFIX = "[NutritionUpdate Readiness API]";

// GET /api/nutrition-update/readiness — the rollout wizard's data: both flags
// plus the per-client post-switch verdict (delivery-ladder resolution).
// Trainer-session gated ONLY — the wizard is the entry point into v2, so it
// must work before any flag is on.
export async function GET() {
  const correlationId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    const session = await getTrainerSession();

    if (session === null) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const supabase = createSupabaseClient();
    const [enabled, trainerEnabled, clients] = await Promise.all([
      isNutritionV2Enabled(session.tenant_host, supabase),
      isNutritionV2TrainerEnabled(session.tenant_host, supabase),
      listClientReadiness(supabase, session.tenant_host, session.trainer_id),
    ]);

    return NextResponse.json({
      success: true,
      data: { flags: { enabled, trainerEnabled }, clients },
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} error:`, {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
