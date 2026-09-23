// GET /api/trainer/share-card/preview?style=…&stats=a,b,c
// Vista previa de la tarjeta de sesión con la marca real del entrenador y
// una sesión de EJEMPLO, para que vea el resultado antes de guardar. Usa el
// mismo dibujo que la tarjeta del cliente (lib/share-card/render).

import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { loadShareCardBranding } from "@/lib/share-card/branding";
import { renderShareCard } from "@/lib/share-card/render";
import { parseShareCardSettings } from "@/lib/share-card/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const correlationId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const session = await getTrainerSession();

  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const settings = parseShareCardSettings({
    enabled: true,
    style: params.get("style"),
    stats: (params.get("stats") ?? "").split(",").filter(Boolean),
  });

  const supabase = createSupabaseClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("logo_url, theme_json")
    .eq("trainer_id", session.trainer_id)
    .maybeSingle();

  try {
    return await renderShareCard(
      {
        branding: await loadShareCardBranding(tenant, correlationId),
        programName: "Empuje · Tirón",
        sessionName: "Empujes A",
        date: new Date().toISOString().slice(0, 10),
        stats: {
          exercises: 6,
          sets: 22,
          reps: 184,
          volumeKg: 8420,
          cardioSeconds: 600,
          cardioMeters: 0,
          records: [{ exerciseName: "Press banca", reps: 5, weightKg: 90 }],
        },
        sessionNumber: 47,
      },
      settings,
      { "Cache-Control": "private, no-store" }
    );
  } catch (error) {
    console.error("[Share Card Preview] render failed:", {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "No se pudo generar la vista previa" },
      { status: 500 }
    );
  }
}
