import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { getClientAdherence } from "@/lib/nutrition/logs/adherence-service";
import {
  errorMessage,
  guardRecipeRequest,
} from "@/lib/nutrition/recipes/recipe-request";

const LOG_PREFIX = "[Adherence API]";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type RouteContext = { params: Promise<{ clientId: string }> };

/**
 * GET /api/clients/[clientId]/adherence?from=&to= — a trainer's view of one of
 * their clients' meal adherence over a date range.
 *
 * Trainer-session only (+ nutrition-v2 flag, 404 when off). Ownership boundary:
 * `getClientAdherence` returns null when the client is not owned by the authed
 * trainer (cross-tenant / not-your-client) → 404, so a trainer can never read
 * another trainer's client. The trainer id comes from the session, never the
 * request.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const { clientId: rawClientId } = await params;
    const clientId = Number(rawClientId);

    if (Number.isInteger(clientId) === false || clientId <= 0) {
      return NextResponse.json(
        { success: false, error: "clientId inválido" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (
      from === null ||
      to === null ||
      !ISO_DATE.test(from) ||
      !ISO_DATE.test(to)
    ) {
      return NextResponse.json(
        { success: false, error: "from y to (YYYY-MM-DD) son obligatorios" },
        { status: 400 }
      );
    }

    const report = await getClientAdherence(createSupabaseClient(), {
      trainerId: guard.session.trainer_id,
      clientId,
      from,
      to,
    });

    // null = the trainer does not own this client (hide existence with a 404).
    if (report === null) {
      return NextResponse.json(
        { success: false, error: "No encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error(`${LOG_PREFIX} error:`, {
      correlationId: guard.correlationId,
      error: errorMessage(error),
    });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}
