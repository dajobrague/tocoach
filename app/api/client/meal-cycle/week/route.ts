import type { ClientSession } from "@/lib/auth/client-session";

import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { getActiveCycleTreeForClient } from "@/lib/nutrition/cycles/client-cycle-reader";
import {
  attachDayGoals,
  buildClientWeek,
  type ClientDietFallback,
} from "@/lib/nutrition/cycles/client-week";
import {
  getClientNutritionVisibility,
  resolveVisibleSections,
} from "@/lib/nutrition/delivery-visibility";
import { getClientDietPdf } from "@/lib/nutrition/diet-fallback";
import { getMenuChoices } from "@/lib/nutrition/cycles/menu-choice-service";
import { getClientSelections } from "@/lib/nutrition/cycles/option-selection";
import { ClientGoalsService } from "@/lib/nutrition/goals/client-goals-service";
import { GoalPresetsService } from "@/lib/nutrition/goals/goal-presets-service";
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
    const [tree, visibility] = await Promise.all([
      getActiveCycleTreeForClient(supabase, clientId),
      getClientNutritionVisibility(supabase, tenant?.host ?? "", clientId),
    ]);

    const [overrides, logs, selections, goals, presets, choices, dietPdf] =
      await Promise.all([
        tree === null
          ? Promise.resolve([])
          : new OverrideService(supabase).listForCycle(
              tree.tenant_host,
              tree.id
            ),
        getMealLogs(supabase, clientId, weekStart, weekEnd),
        getClientSelections(supabase, clientId),
        new ClientGoalsService(supabase).get(tenant?.host ?? "", clientId),
        new GoalPresetsService(supabase).list(tenant?.host ?? "", clientId),
        getMenuChoices(supabase, clientId, weekStart, weekEnd),
        // The PDF matters without a plan (the ladder's second rung) and
        // whenever the trainer explicitly chose to show it.
        tree === null || visibility?.includes("pdf") === true
          ? getClientDietPdf(supabase, tenant?.host ?? "", clientId)
          : Promise.resolve(null),
      ]);
    const presetsById = new Map(presets.map((preset) => [preset.id, preset]));

    // Only choices made against THIS plan count; a stale row from an older
    // (archived) cycle silently falls back to the recommendation.
    const menuChoices: Record<string, number> = {};

    for (const choice of choices) {
      if (tree !== null && choice.cycle_id === tree.id) {
        menuChoices[choice.date] = choice.day_index;
      }
    }

    // Which sections this client sees: the trainer's explicit choice
    // (intersected with what has data), else the automatic delivery ladder.
    const sections = resolveVisibleSections(visibility, {
      plan: tree !== null,
      pdf: dietPdf !== null,
      goals: goals !== null || presets.length > 0,
    });
    const planVisible = sections.includes("plan");

    const week = attachDayGoals(
      buildClientWeek(
        // A hidden plan renders (and logs) as if there were none.
        planVisible ? tree : null,
        overrides,
        logs,
        weekStart,
        todayIso,
        timeZone,
        selections,
        menuChoices
      ),
      planVisible ? tree?.day_targets : undefined,
      presetsById,
      goals
    );

    // What the non-plan sections need: the PDF and/or the named objectives.
    // Attached whenever either section is visible — also alongside a visible
    // plan, so the client page can stack them (e.g. plan + PDF).
    const fallback: ClientDietFallback | undefined =
      sections.includes("pdf") || sections.includes("goals") || tree === null
        ? {
            pdf: sections.includes("pdf") ? dietPdf : null,
            presets: sections.includes("goals")
              ? presets.map(
                  ({ id, name, kcal, protein_g, carbs_g, fat_g }) => ({
                    id,
                    name,
                    kcal,
                    protein_g,
                    carbs_g,
                    fat_g,
                  })
                )
              : [],
          }
        : undefined;

    return NextResponse.json({
      success: true,
      data: {
        ...week,
        // Mismo gating que fallback.presets/pdf: si el trainer ocultó la
        // sección de objetivos, el objeto crudo no viaja al cliente (los
        // targets por día del plan visible ya van dentro de `week`).
        goals: sections.includes("goals") ? goals : null,
        sections,
        ...(fallback !== undefined ? { fallback } : {}),
      },
    });
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
