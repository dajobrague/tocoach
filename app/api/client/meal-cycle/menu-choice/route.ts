import type { ClientSession } from "@/lib/auth/client-session";

import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { getActiveCycleTreeForClient } from "@/lib/nutrition/cycles/client-cycle-reader";
import { parseMenuChoice } from "@/lib/nutrition/cycles/cycle-request";
import { setMenuChoice } from "@/lib/nutrition/cycles/menu-choice-service";
import { isNutritionV2Enabled } from "@/lib/nutrition/feature-flag";
import { toYmdInTimezone } from "@/lib/forms/chart-helpers";
import { loadTenantContext } from "@/lib/tenant/loader";

const LOG_PREFIX = "[Client MenuChoice API]";

/**
 * PUT /api/client/meal-cycle/menu-choice — pick which plan menu (day) to
 * follow on a date. Body: `date` ("YYYY-MM-DD") + `day_index` (or null to go
 * back to the rotation's recommendation).
 *
 * Auth boundary: client-session only; the client id comes from the verified
 * session. The day must exist in the client's OWN active cycle — the choice
 * row records that cycle id, so stale choices never leak into a later plan.
 * Behind the nutrition-v2 flag (404 when off).
 */
export async function PUT(request: NextRequest) {
  const correlationId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const session = await getClientSession();
  const clientId = parseClientId(session);

  if (clientId === null) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 401 }
    );
  }

  try {
    const tenant = await loadTenantContext(session!.tenant_slug);

    if ((await isNutritionV2Enabled(tenant?.host ?? "")) === false) {
      return NextResponse.json(
        { success: false, error: "No encontrado" },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = parseMenuChoice(body);

    if (parsed.ok === false) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();
    const tree = await getActiveCycleTreeForClient(supabase, clientId);

    if (tree === null) {
      return NextResponse.json(
        { success: false, error: "No hay un plan activo" },
        { status: 404 }
      );
    }

    const { date, dayIndex } = parsed.value;

    if (dayIndex !== null && dayIndex >= tree.duration_days) {
      return NextResponse.json(
        { success: false, error: "day_index fuera del plan" },
        { status: 400 }
      );
    }

    // Past dates are history (the trainer's retrospective view reads them) —
    // choosing is only for today and forward, mirroring the UI gate. tz comes
    // from the query, same convention as /api/client/meal-logs.
    const timeZone = new URL(request.url).searchParams.get("tz") || "UTC";
    const todayIso = toYmdInTimezone(new Date(), timeZone);

    if (date < todayIso) {
      return NextResponse.json(
        { success: false, error: "Solo puedes elegir menú de hoy en adelante" },
        { status: 400 }
      );
    }

    await setMenuChoice(
      supabase,
      tree.tenant_host,
      clientId,
      tree.id,
      date,
      dayIndex
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error(`${LOG_PREFIX} set error:`, {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}

/** The numeric clients.id from a valid client session, or null (trainer/none). */
function parseClientId(session: ClientSession | null): number | null {
  const raw = session?.client_id;

  if (typeof raw !== "string" || raw.trim().length === 0) {
    return null;
  }

  const id = Number(raw);

  return Number.isInteger(id) && id > 0 ? id : null;
}
