import { NextRequest, NextResponse } from "next/server";

import { verifyAdminRequest } from "@/lib/auth/admin-auth";
import { createSupabaseAdminClient } from "@/lib/clients/supabase-admin";
import { computeNutritionMetrics } from "@/lib/nutrition/admin/nutrition-metrics";

const LOG_PREFIX = "[Admin NutritionMetrics API]";

/**
 * GET /api/admin/nutrition-metrics — the platform-wide nutrition-v2 success
 * dashboard data (P6-T5): trainer adoption, library depth, weekly client
 * logging, and the stubbed complaint trend.
 *
 * Admin-only: the request must carry a valid `admin-session` whose subject is
 * an active `admin_users` row (see verifyAdminRequest). Trainer and client
 * tokens — which verify with the same secret but are not admins — are rejected
 * 401. The aggregation is cross-tenant, so it runs with the service-role client
 * (bypasses RLS), a true-admin operation per CLAUDE.md.
 */
export async function GET(request: NextRequest) {
  const correlationId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const { isAdmin } = await verifyAdminRequest(request);

  if (isAdmin === false) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 401 }
    );
  }

  try {
    const admin = createSupabaseAdminClient();
    const metrics = await computeNutritionMetrics(admin);

    return NextResponse.json({ success: true, data: metrics });
  } catch (error) {
    console.error(`${LOG_PREFIX} fetch error:`, {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
