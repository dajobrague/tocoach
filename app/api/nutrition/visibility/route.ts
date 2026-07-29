import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  getClientNutritionVisibility,
  sanitizeSections,
  setClientNutritionVisibility,
} from "@/lib/nutrition/delivery-visibility";
import {
  errorMessage,
  guardRecipeRequest,
} from "@/lib/nutrition/recipes/recipe-request";

const LOG_PREFIX = "[Nutrition Visibility API]";

/**
 * Which nutrition sections a client sees, trainer-managed.
 *
 * GET /api/nutrition/visibility?clientId=123 — the saved choice, or null for
 *     "Automático" (the delivery ladder decides).
 * PUT /api/nutrition/visibility — { clientId, sections } where sections is an
 *     array of "plan" | "pdf" | "goals". Null/empty returns the client to
 *     Automático (the row is removed).
 */
export async function GET(request: NextRequest) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const clientId = parseClientIdParam(request);

    if (clientId === null) {
      return invalidClientId();
    }

    const sections = await getClientNutritionVisibility(
      createSupabaseClient(),
      guard.session.tenant_host,
      clientId
    );

    return NextResponse.json({ success: true, data: { sections } });
  } catch (error) {
    console.error(`${LOG_PREFIX} get error:`, {
      correlationId: guard.correlationId,
      error: errorMessage(error),
    });

    return unexpected();
  }
}

export async function PUT(request: NextRequest) {
  const guard = await guardRecipeRequest();

  if (guard.ok === false) {
    return guard.response;
  }

  try {
    const body: unknown = await request.json().catch(() => null);
    const clientId = parseClientIdBody(body);

    if (clientId === null) {
      return invalidClientId();
    }

    const raw = (body as { sections?: unknown }).sections;

    // null/[] → Automático; anything else must sanitize to a non-empty
    // subset of the known sections or the payload is rejected.
    const sections = sanitizeSections(raw);

    if (sections === null && raw !== null && isEmptyArray(raw) === false) {
      return NextResponse.json(
        { success: false, error: "sections inválido" },
        { status: 400 }
      );
    }

    await setClientNutritionVisibility(
      createSupabaseClient(),
      guard.session.tenant_host,
      clientId,
      sections
    );

    return NextResponse.json({ success: true, data: { sections } });
  } catch (error) {
    console.error(`${LOG_PREFIX} put error:`, {
      correlationId: guard.correlationId,
      error: errorMessage(error),
    });

    return unexpected();
  }
}

function isEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length === 0;
}

function parseClientIdParam(request: NextRequest): number | null {
  const raw = new URL(request.url).searchParams.get("clientId") ?? "";
  const parsed = Number(raw);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseClientIdBody(body: unknown): number | null {
  const raw = (body as { clientId?: unknown } | null)?.clientId;

  // Solo number o string numérica: Number(true) === 1 y Number([5]) === 5
  // pasarían la validación de abajo sin este guard.
  if (typeof raw !== "number" && typeof raw !== "string") return null;
  const parsed = Number(raw);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function invalidClientId(): NextResponse {
  return NextResponse.json(
    { success: false, error: "clientId inválido" },
    { status: 400 }
  );
}

function unexpected(): NextResponse {
  return NextResponse.json(
    { success: false, error: "Error inesperado" },
    { status: 500 }
  );
}
