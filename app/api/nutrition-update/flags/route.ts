import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

const LOG_PREFIX = "[NutritionUpdate Flags API]";

/** The only transitions the wizard performs. */
const ACTIONS = {
  /** Enter prepare mode: trainer tools on, clients untouched. */
  enable_trainer: { nutrition_v2_trainer_enabled: true },
  /** The cutover: clients switch to v2 (trainer tools implied). */
  activate_clients: { nutrition_v2_enabled: true },
  /** Rollback: clients back to legacy; trainer tools stay on. */
  deactivate_clients: { nutrition_v2_enabled: false },
} as const;

type Action = keyof typeof ACTIONS;

// POST /api/nutrition-update/flags { action } — flip the tenant's own
// nutrition-v2 flags, restricted to the three wizard transitions. Trainer
// session only; the tenant is always the caller's own (from the JWT).
export async function POST(request: NextRequest) {
  const correlationId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    const session = await getTrainerSession();

    if (session === null) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const body = (await request.json().catch(() => null)) as {
      action?: unknown;
    } | null;
    const action = body?.action;

    if (typeof action !== "string" || action in ACTIONS === false) {
      return NextResponse.json(
        { success: false, error: "action inválida" },
        { status: 400 }
      );
    }

    const { error } = await createSupabaseClient()
      .from("tenants")
      .update(ACTIONS[action as Action])
      .eq("host", session.tenant_host);

    if (error !== null) {
      throw new Error(error.message);
    }

    console.log(`${LOG_PREFIX} flags updated`, {
      correlationId,
      tenantHost: session.tenant_host,
      action,
    });

    return NextResponse.json({ success: true });
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
