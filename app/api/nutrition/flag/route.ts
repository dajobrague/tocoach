import { NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { isNutritionV2Enabled } from "@/lib/nutrition/feature-flag";

// GET /api/nutrition/flag — whether nutrition-v2 is enabled for the trainer's
// tenant. Used by the nav to conditionally show the Recipes entry.
export async function GET() {
  const session = await getTrainerSession();

  if (session === null) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 401 }
    );
  }

  const enabled = await isNutritionV2Enabled(session.tenant_host);

  return NextResponse.json({ success: true, enabled });
}
