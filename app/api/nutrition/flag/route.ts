import { NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import {
  isNutritionV2Enabled,
  isNutritionV2TrainerEnabled,
} from "@/lib/nutrition/feature-flag";

// GET /api/nutrition/flag — the tenant's nutrition-v2 state, both sides:
// `trainerEnabled` gates the trainer tools (nav entry, builder tab — the
// prepare phase), `enabled` is the client-facing cutover. `trainerEnabled`
// is always true when `enabled` is.
export async function GET() {
  const session = await getTrainerSession();

  if (session === null) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 401 }
    );
  }

  const [enabled, trainerEnabled] = await Promise.all([
    isNutritionV2Enabled(session.tenant_host),
    isNutritionV2TrainerEnabled(session.tenant_host),
  ]);

  return NextResponse.json({ success: true, enabled, trainerEnabled });
}
