import type { ClientSession } from "@/lib/auth/client-session";

import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { getActiveCycleTreeForClient } from "@/lib/nutrition/cycles/client-cycle-reader";
import { buildClientWeek } from "@/lib/nutrition/cycles/client-week";
import { getClientSelections } from "@/lib/nutrition/cycles/option-selection";
import { OverrideService } from "@/lib/nutrition/cycles/override-service";
import { isNutritionV2Enabled } from "@/lib/nutrition/feature-flag";
import { isYmd, shiftYmd } from "@/lib/nutrition/logs/log-window";
import { getMealLogs } from "@/lib/nutrition/logs/meal-log-service";
import { toYmdInTimezone } from "@/lib/forms/chart-helpers";
import { loadTenantContext } from "@/lib/tenant/loader";

const LOG_PREFIX = "[Client MealCycle Week API]";

/**
 * GET /api/client/meal-cycle/week?weekStart=YYYY-MM-DD&tz= — the authed client's
 * own active cycle laid out over the 7 days from `weekStart` (Monday).
 *
 * Each day carries: the date, the resolved plan (rotation day via
 * currentCycleDayIndex, then overrides applied for that date — swaps replace
 * options from the frozen snapshot, notes attach), that day's logs, and a
 * `canLog` boolean (started & today-or-past & ≤30 days back, in the client tz).
 * Days before the cycle starts return a clean not-started shape (no crash).
 *
 * Same auth/flag/tz conventions as the single-date /api/client/meal-cycle route,
 * which keeps working unchanged.
 */
export async function GET(request: NextRequest) {
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

    const params = new URL(request.url).searchParams;
    const weekStart = params.get("weekStart") ?? "";
    const timeZone = params.get("tz") || "UTC";

    if (isYmd(weekStart) === false) {
      return NextResponse.json(
        { success: false, error: "weekStart inválido (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const weekEnd = shiftYmd(weekStart, 6);
    const todayIso = toYmdInTimezone(new Date(), timeZone);
    const supabase = createSupabaseClient();
    const tree = await getActiveCycleTreeForClient(supabase, clientId);

    const [overrides, logs, selections] = await Promise.all([
      tree === null
        ? Promise.resolve([])
        : new OverrideService(supabase).listForCycle(tree.tenant_host, tree.id),
      getMealLogs(supabase, clientId, weekStart, weekEnd),
      getClientSelections(supabase, clientId),
    ]);

    const week = buildClientWeek(
      tree,
      overrides,
      logs,
      weekStart,
      todayIso,
      timeZone,
      selections
    );

    return NextResponse.json({ success: true, data: week });
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

/** The numeric clients.id from a valid client session, or null (trainer/none). */
function parseClientId(session: ClientSession | null): number | null {
  const raw = session?.client_id;

  if (typeof raw !== "string" || raw.trim().length === 0) {
    return null;
  }

  const id = Number(raw);

  return Number.isInteger(id) && id > 0 ? id : null;
}
