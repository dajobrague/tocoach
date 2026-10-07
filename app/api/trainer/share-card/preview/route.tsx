// GET /api/trainer/share-card/preview?style=…&stats=a,b,c&name=…&ig=…&list=1&tc=1
// Vista previa de la tarjeta de sesión con la marca real del entrenador y
// una sesión de EJEMPLO, para que vea el resultado antes de guardar. Usa el
// mismo dibujo que la tarjeta del cliente (lib/share-card/render).

import type { ShareCardSignatureGroup } from "@/lib/training/share-card-stats";

import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { loadShareCardBranding } from "@/lib/share-card/branding";
import { renderShareCard } from "@/lib/share-card/render";
import { parseShareCardSettings } from "@/lib/share-card/settings";

// Una barra por serie de la sesión de ejemplo (22 series + 10 min de cardio).
const sample = (
  name: string,
  sets: Array<[number, number]>,
  recordAt = -1
) => ({
  kind: "strength" as const,
  name,
  sets: sets.map(([weightKg, reps], i) => ({
    weightKg,
    reps,
    record: i === recordAt,
  })),
});
const SAMPLE_SIGNATURE: ShareCardSignatureGroup[] = [
  sample(
    "Press banca",
    [
      [70, 8],
      [80, 6],
      [85, 5],
      [90, 5],
    ],
    3
  ),
  sample("Press inclinado mancuerna", [
    [30, 10],
    [32, 10],
    [32, 8],
    [32, 8],
  ]),
  sample("Fondos lastrados", [
    [40, 8],
    [40, 8],
    [42.5, 6],
  ]),
  sample("Elevaciones laterales", [
    [20, 12],
    [22, 10],
    [22, 10],
    [22, 9],
  ]),
  sample("Extensión de tríceps", [
    [12, 15],
    [12, 15],
    [12, 12],
  ]),
  sample("Press militar", [
    [25, 12],
    [27.5, 10],
    [27.5, 10],
    [30, 8],
  ]),
  { kind: "cardio", name: "Cinta inclinada", minutes: 10 },
];

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
    displayName: params.get("name") ?? "",
    instagram: params.get("ig") ?? "",
    exerciseList: params.get("list") !== "0",
    showTopcoach: params.get("tc") !== "0",
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
          signature: SAMPLE_SIGNATURE,
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
