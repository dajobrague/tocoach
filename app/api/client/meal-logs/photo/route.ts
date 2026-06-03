import type { ClientSession } from "@/lib/auth/client-session";

import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { isNutritionV2Enabled } from "@/lib/nutrition/feature-flag";
import { uploadMealPhoto } from "@/lib/nutrition/logs/meal-photo-service";
import { loadTenantContext } from "@/lib/tenant/loader";

export const runtime = "nodejs";

const LOG_PREFIX = "[Client MealLog Photo API]";
const IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB (matches the meal-photos bucket)

/**
 * POST /api/client/meal-logs/photo — upload a meal-log photo. Multipart `file`.
 *
 * Client-session only; the object is stored under the authed client's OWN id
 * path (derived from the session, never the request), so a client can upload
 * only to their own path. Returns the public URL to attach to a meal log.
 * Behind the nutrition-v2 flag (404 when off).
 */
export async function POST(request: NextRequest) {
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

    const formData = await request.formData();
    const file = formData.get("file");

    if (file === null || typeof file === "string") {
      return NextResponse.json(
        { success: false, error: "No se proporcionó archivo" },
        { status: 400 }
      );
    }

    if (IMAGE_TYPES.includes(file.type) === false) {
      return NextResponse.json(
        { success: false, error: "Tipo de archivo no permitido" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: "El archivo es demasiado grande (máx 10MB)" },
        { status: 400 }
      );
    }

    const url = await uploadMealPhoto(createSupabaseClient(), clientId, {
      buffer: Buffer.from(await file.arrayBuffer()),
      contentType: file.type,
      filename: file.name,
    });

    return NextResponse.json({ success: true, data: { url } }, { status: 201 });
  } catch (error) {
    console.error(`${LOG_PREFIX} upload error:`, {
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
