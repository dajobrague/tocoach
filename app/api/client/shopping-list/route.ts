import type { ClientSession } from "@/lib/auth/client-session";
import type { ShoppingListItem } from "@/lib/nutrition/shopping/shopping-list";
import type { SupabaseClient } from "@supabase/supabase-js";

import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { getActiveCycleTreeForClient } from "@/lib/nutrition/cycles/client-cycle-reader";
import { getMenuChoices } from "@/lib/nutrition/cycles/menu-choice-service";
import { getClientSelections } from "@/lib/nutrition/cycles/option-selection";
import { isNutritionV2Enabled } from "@/lib/nutrition/feature-flag";
import { aggregateShoppingList } from "@/lib/nutrition/shopping/shopping-list";
import { loadTenantContext } from "@/lib/tenant/loader";

const LOG_PREFIX = "[Client ShoppingList API]";
const YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/client/shopping-list?from=&to= — a merged ingredient shopping list
 * for the authed client's own active meal cycle over the `[from, to]` calendar
 * range. Each date resolves to the day it follows (the client's menu choice
 * when one exists, otherwise the rotation day), the selected (or first) option
 * per slot is taken, and snapshot ingredient quantities are summed, merging by
 * (name, unit).
 *
 * Auth boundary (§4.4 / §4.6): client-session only. The numeric client id comes
 * exclusively from the verified session (never the request), so a client can
 * only ever produce their own list — a request-supplied `clientId` is ignored.
 * A trainer JWT (no numeric `client_id`) is rejected 401. Behind the
 * nutrition-v2 flag: when off the route 404s to hide its existence. A missing,
 * malformed, or inverted range is 400. No active cycle is a clean empty 200.
 *
 * The range is taken as tz-less calendar dates; "UTC" is threaded into the
 * day-math (consistent with the meal-cycle route) since both bounds and the
 * cycle start are calendar dates.
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
    // Flag gate first (404 hides existence) — before validating the range.
    const tenant = await loadTenantContext(session!.tenant_slug);
    const enabled = await isNutritionV2Enabled(tenant?.host ?? "");

    if (enabled === false) {
      return NextResponse.json(
        { success: false, error: "No encontrado" },
        { status: 404 }
      );
    }

    const range = parseRange(new URL(request.url).searchParams);

    if (range === null) {
      return NextResponse.json(
        { success: false, error: "Rango de fechas inválido" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();
    const [tree, selections, choices] = await Promise.all([
      getActiveCycleTreeForClient(supabase, clientId),
      getClientSelections(supabase, clientId),
      getMenuChoices(supabase, clientId, range.from, range.to),
    ]);

    // Dates where the client chose a menu shop for THAT menu, not the
    // rotation's. Choices from an older (archived) cycle are ignored.
    const menuChoices: Record<string, number> = {};

    for (const choice of choices) {
      if (tree !== null && choice.cycle_id === tree.id) {
        menuChoices[choice.date] = choice.day_index;
      }
    }

    const items = aggregateShoppingList({
      tree,
      selections,
      from: range.from,
      to: range.to,
      menuChoices,
    });
    const enriched = await attachImages(supabase, tenant?.host ?? "", items);

    return NextResponse.json({
      success: true,
      data: { from: range.from, to: range.to, items: enriched },
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

/**
 * Attach product photos from the tenant's ingredient cache (image_url comes
 * from OpenFoodFacts). Snapshot lines carry name+brand but no ingredient id,
 * so the match is exact (name, brand) case-insensitive, falling back to a
 * brand-less cache row with the same name. Best-effort: a lookup failure
 * degrades to no images, never to an error.
 */
async function attachImages(
  supabase: SupabaseClient,
  tenantHost: string,
  items: ShoppingListItem[]
): Promise<ShoppingListItem[]> {
  if (items.length === 0 || tenantHost.length === 0) {
    return items;
  }

  try {
    const names = [...new Set(items.map((item) => item.name))];
    const { data } = await supabase
      .from("ingredients")
      .select("name, brand, image_url")
      .eq("tenant_host", tenantHost)
      .in("name", names)
      .not("image_url", "is", null);

    const byKey = new Map<string, string>();

    for (const row of (data ?? []) as {
      name: string | null;
      brand: string | null;
      image_url: string | null;
    }[]) {
      const url = row.image_url;

      if (typeof url !== "string" || url.length === 0) continue;
      const key = imageKey(row.name ?? "", row.brand);

      if (byKey.has(key) === false) byKey.set(key, url);
    }

    return items.map((item) => ({
      ...item,
      imageUrl:
        byKey.get(imageKey(item.name, item.brand)) ??
        byKey.get(imageKey(item.name, null)) ??
        null,
    }));
  } catch {
    return items;
  }
}

function imageKey(name: string, brand: string | null | undefined): string {
  const trimmedBrand = brand?.trim().toLowerCase() ?? "";

  return `${name.trim().toLowerCase()}|${trimmedBrand}`;
}

/**
 * The validated `[from, to]` range, or `null` for a missing/malformed/inverted
 * range (which the route maps to 400). Both bounds must be real "YYYY-MM-DD"
 * calendar dates and `from` must be on or before `to`.
 */
function parseRange(
  params: URLSearchParams
): { from: string; to: string } | null {
  const from = params.get("from");
  const to = params.get("to");

  if (isCalendarDate(from) === false || isCalendarDate(to) === false) {
    return null;
  }

  // Both pass the shape check; compare as ISO strings (lexicographic = chronological).
  if (from! > to!) {
    return null;
  }

  return { from: from!, to: to! };
}

/**
 * True when `value` is a real "YYYY-MM-DD" calendar date. Rejects bad shapes
 * and impossible dates (e.g. 2026-02-30, which would roll over to March).
 */
function isCalendarDate(value: string | null): value is string {
  if (value === null || YMD.test(value) === false) {
    return false;
  }

  return new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

/**
 * The numeric `clients.id` carried by a valid client session (stored as a
 * string), or `null` for an unauthenticated request, a trainer token (no
 * `client_id`), or any malformed value.
 */
function parseClientId(session: ClientSession | null): number | null {
  const raw = session?.client_id;

  if (typeof raw !== "string" || raw.trim().length === 0) {
    return null;
  }

  const id = Number(raw);

  return Number.isInteger(id) && id > 0 ? id : null;
}
