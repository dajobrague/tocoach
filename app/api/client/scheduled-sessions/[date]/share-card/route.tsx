// GET /api/client/scheduled-sessions/[date]/share-card?sessionId=…
// PNG 1080×1920 (9:16, Stories) con la marca del entrenador y los highlights
// de la sesión, para que el cliente la comparta (llamada JC, 15 sep). La
// genera el servidor con next/og: misma imagen en cualquier móvil y lista
// ANTES del tap de "Compartir" (navigator.share exige gesto de usuario).
//
// Scoping: la fila se busca por client_id de la sesión del cliente; nunca se
// lee nada de otro cliente.

/* eslint-disable no-console */
import type { SessionSets, SetInput } from "@/lib/training/e1rm";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { resolveTenantLogoUrl } from "@/lib/tenant/logo";
import { fetchLogoBytes, logoUrlIsAllowed } from "@/lib/tenant/logo-bytes";
import {
  type ShareCardLog,
  type ShareCardStats,
  computeShareCardStats,
} from "@/lib/training/share-card-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOG_PREFIX = "[Share Card API]";
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const WIDTH = 1080;
const HEIGHT = 1920;

// Cargadas una vez por proceso (outputFileTracingIncludes las copia al
// standalone — ver next.config.js).
let fontsPromise: Promise<[Buffer, Buffer]> | null = null;

function loadFonts() {
  fontsPromise ??= Promise.all([
    readFile(join(process.cwd(), "assets/fonts/BarlowCondensed-500.ttf")),
    readFile(join(process.cwd(), "assets/fonts/BarlowCondensed-700.ttf")),
  ]);

  return fontsPromise;
}

function legacySets(log: {
  sets_completed: number | null;
  reps_completed: string | null;
  weight_kg: number | null;
}): SetInput[] {
  const reps = /\d+/.exec(log.reps_completed ?? "")?.[0];

  return Array.from({ length: log.sets_completed ?? 0 }, () => ({
    reps: reps !== undefined ? parseInt(reps, 10) : null,
    weight_kg: log.weight_kg,
  }));
}

function toNumber(value: unknown): number | null {
  const n = typeof value === "string" ? parseFloat(value) : value;

  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

/** Color de marca legible sobre fondo oscuro; si no, blanco. */
function accentOn(dark: string, brand: unknown): string {
  if (typeof brand !== "string" || !/^#[0-9a-f]{6}$/i.test(brand)) {
    return dark;
  }
  const [r, g, b] = [1, 3, 5].map(
    (i) => parseInt(brand.slice(i, i + 2), 16) / 255
  ) as [number, number, number];
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  return luminance < 0.25 ? dark : brand;
}

const numberEs = (n: number, digits = 0) =>
  n.toLocaleString("es-ES", {
    maximumFractionDigits: digits,
    useGrouping: true,
  });

function formatDate(ymd: string): string {
  const text = new Date(`${ymd}T12:00:00Z`).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

  return text.charAt(0).toUpperCase() + text.slice(1);
}

function statTiles(
  stats: ShareCardStats
): Array<{ value: string; unit?: string; label: string }> {
  const tiles: Array<{ value: string; unit?: string; label: string }> = [];

  if (stats.volumeKg > 0) {
    tiles.push({
      value: numberEs(stats.volumeKg),
      unit: "kg",
      label: "Volumen",
    });
  }
  if (stats.sets > 0)
    tiles.push({ value: String(stats.sets), label: "Series" });
  if (stats.cardioSeconds > 0) {
    tiles.push({
      value: String(Math.round(stats.cardioSeconds / 60)),
      unit: "min",
      label: "Cardio",
    });
  }
  if (stats.cardioMeters > 0) {
    tiles.push({
      value: numberEs(stats.cardioMeters / 1000, 1),
      unit: "km",
      label: "Distancia",
    });
  }
  tiles.push({ value: String(stats.exercises), label: "Ejercicios" });
  if (stats.reps > 0 && tiles.length < 4) {
    tiles.push({ value: String(stats.reps), label: "Repeticiones" });
  }

  return tiles.slice(0, 4);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const correlationId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    const session = await getClientSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { date } = await params;
    const sessionId = request.nextUrl.searchParams.get("sessionId");

    if (!YMD_RE.test(date) || !sessionId) {
      return NextResponse.json(
        { success: false, error: "Fecha o sesión inválida" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();
    const clientId = parseInt(String(session.client_id), 10);

    const { data: row, error: rowError } = await supabase
      .from("scheduled_sessions")
      .select("id, session:sessions(name, program:programs(name))")
      .eq("client_id", clientId)
      .eq("scheduled_date", date)
      .eq("session_id", sessionId)
      .maybeSingle();

    if (rowError || !row) {
      if (rowError) {
        console.error(`${LOG_PREFIX} row fetch error:`, {
          correlationId,
          error: rowError.message,
        });
      }

      return NextResponse.json(
        { success: false, error: "Sesión no encontrada" },
        { status: 404 }
      );
    }

    const [logsResult, countResult, tenantResult] = await Promise.all([
      supabase
        .from("exercise_logs")
        .select(
          "exercise_id, sets_completed, reps_completed, weight_kg, duration_seconds, distance_meters, exercise:exercises(name), exercise_log_sets(reps, weight_kg)"
        )
        .eq("client_id", clientId)
        .eq("scheduled_session_id", row.id)
        .not("finalized_at", "is", null),
      supabase
        .from("scheduled_sessions")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("status", "completed")
        .lte("scheduled_date", date),
      supabase
        .from("tenants")
        .select("logo_url, theme_json")
        .eq("slug", session.tenant_slug)
        .maybeSingle(),
    ]);

    if (logsResult.error) {
      console.error(`${LOG_PREFIX} logs fetch error:`, {
        correlationId,
        error: logsResult.error.message,
      });

      return NextResponse.json(
        { success: false, error: "Error al leer la sesión" },
        { status: 500 }
      );
    }

    const logs: ShareCardLog[] = (logsResult.data ?? []).map((log: any) => {
      const rows = (log.exercise_log_sets ?? []) as any[];

      return {
        exerciseId: log.exercise_id,
        exerciseName:
          pickOne<{ name?: string }>(log.exercise)?.name ?? "Ejercicio",
        sets:
          rows.length > 0
            ? rows.map((set) => ({
                reps: toNumber(set.reps),
                weight_kg: toNumber(set.weight_kg),
              }))
            : legacySets({
                sets_completed: log.sets_completed,
                reps_completed: log.reps_completed,
                weight_kg: toNumber(log.weight_kg),
              }),
        durationSeconds: toNumber(log.duration_seconds),
        distanceMeters: toNumber(log.distance_meters),
      };
    });

    // Historial de los mismos ejercicios en días ANTERIORES (récords).
    // Best-effort: si falla, la tarjeta sale sin récords.
    const priorByExercise = new Map<string, SessionSets[]>();
    const exerciseIds = [...new Set(logs.map((log) => log.exerciseId))];

    if (exerciseIds.length > 0) {
      const { data: prior, error: priorError } = await supabase
        .from("exercise_logs")
        .select(
          "exercise_id, scheduled_sessions!inner(scheduled_date), exercise_log_sets(reps, weight_kg)"
        )
        .eq("client_id", clientId)
        .in("exercise_id", exerciseIds)
        .not("finalized_at", "is", null)
        .lt("scheduled_sessions.scheduled_date", date)
        .limit(5000);

      if (priorError) {
        console.warn(`${LOG_PREFIX} prior logs failed:`, {
          correlationId,
          error: priorError.message,
        });
      }

      for (const log of (prior ?? []) as any[]) {
        const day = pickOne<{ scheduled_date?: string }>(
          log.scheduled_sessions
        )?.scheduled_date;

        if (!day) continue;
        const list = priorByExercise.get(log.exercise_id) ?? [];

        list.push({
          date: day,
          sets: ((log.exercise_log_sets ?? []) as any[]).map((set) => ({
            reps: toNumber(set.reps),
            weight_kg: toNumber(set.weight_kg),
          })),
        });
        priorByExercise.set(log.exercise_id, list);
      }
    }

    const stats = computeShareCardStats(logs, priorByExercise);
    const theme = (tenantResult.data?.theme_json ?? {}) as Record<string, any>;
    const trainerName: string =
      typeof theme.meta?.name === "string" && theme.meta.name.trim().length > 0
        ? theme.meta.name.trim()
        : "Tu entrenador";
    const accent = accentOn("#F2F5F8", theme.colors?.brand);

    // Logo → PNG data URI (Satori no pinta webp). Sin logo: iniciales.
    let logoSrc: string | null = null;
    const logoUrl = resolveTenantLogoUrl(tenantResult.data?.logo_url, theme);

    if (logoUrl && logoUrlIsAllowed(logoUrl)) {
      const bytes = await fetchLogoBytes(logoUrl, correlationId);

      if (bytes) {
        try {
          const png = await sharp(bytes)
            .resize(220, 220, { fit: "inside", withoutEnlargement: true })
            .png()
            .toBuffer();

          logoSrc = `data:image/png;base64,${png.toString("base64")}`;
        } catch (error) {
          console.warn(`${LOG_PREFIX} logo convert failed:`, {
            correlationId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    const sessionRow = pickOne<{ name?: string; program?: unknown }>(
      row.session as any
    );
    const sessionName = sessionRow?.name ?? "Entrenamiento";
    const programName =
      pickOne<{ name?: string }>(sessionRow?.program as any)?.name ?? null;
    const sessionNumber = countResult.count ?? null;
    const tiles = statTiles(stats);
    const [regular, bold] = await loadFonts();
    const initials = trainerName
      .split(/\s+/)
      .map((word) => word.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase();

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            padding: "120px 96px 110px",
            color: "#F2F5F8",
            fontFamily: "Barlow",
            backgroundImage: "linear-gradient(170deg, #1E2833 0%, #0B0F14 72%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
              <img
                src={logoSrc}
                style={{
                  width: 132,
                  height: 132,
                  objectFit: "contain",
                  borderRadius: 28,
                }}
              />
            ) : (
              <div
                style={{
                  width: 132,
                  height: 132,
                  borderRadius: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: accent,
                  color: "#0B0F14",
                  fontSize: 56,
                  fontWeight: 700,
                }}
              >
                {initials}
              </div>
            )}
            <div
              style={{
                display: "flex",
                fontSize: 54,
                fontWeight: 500,
                letterSpacing: 1,
              }}
            >
              {trainerName}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: "auto",
              gap: 18,
            }}
          >
            {programName ? (
              <div
                style={{
                  display: "flex",
                  fontSize: 38,
                  fontWeight: 500,
                  letterSpacing: 8,
                  textTransform: "uppercase",
                  color: accent,
                }}
              >
                {programName}
              </div>
            ) : null}
            <div
              style={{
                display: "flex",
                fontSize: 150,
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              {sessionName}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 44,
                fontWeight: 500,
                opacity: 0.7,
              }}
            >
              {formatDate(date)}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              marginTop: 90,
              rowGap: 64,
            }}
          >
            {tiles.map((tile) => (
              <div
                key={tile.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  width: "50%",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "baseline", gap: 10 }}
                >
                  <span
                    style={{ fontSize: 130, fontWeight: 700, lineHeight: 1 }}
                  >
                    {tile.value}
                  </span>
                  {tile.unit ? (
                    <span
                      style={{ fontSize: 52, fontWeight: 500, opacity: 0.75 }}
                    >
                      {tile.unit}
                    </span>
                  ) : null}
                </div>
                <span
                  style={{
                    fontSize: 34,
                    fontWeight: 500,
                    letterSpacing: 6,
                    textTransform: "uppercase",
                    opacity: 0.6,
                    marginTop: 8,
                  }}
                >
                  {tile.label}
                </span>
              </div>
            ))}
          </div>

          {stats.records.length > 0 ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 24,
                marginTop: 80,
                padding: "30px 36px",
                borderRadius: 32,
                backgroundColor: "rgba(255, 196, 64, 0.16)",
                color: "#FFC94D",
                fontSize: 48,
                fontWeight: 700,
              }}
            >
              <span style={{ fontSize: 60 }}>★</span>
              {stats.records.length === 1
                ? `Nuevo récord · ${stats.records[0]?.exerciseName} ${numberEs(stats.records[0]?.weightKg ?? 0, 1)} kg × ${stats.records[0]?.reps}`
                : `${stats.records.length} récords nuevos hoy`}
            </div>
          ) : null}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 90,
              fontSize: 32,
              fontWeight: 500,
              letterSpacing: 4,
              textTransform: "uppercase",
              opacity: 0.5,
            }}
          >
            <span>
              {sessionNumber !== null && sessionNumber > 0
                ? `Sesión nº ${sessionNumber}`
                : ""}
            </span>
            <span>powered by TopCoach</span>
          </div>
        </div>
      ),
      {
        width: WIDTH,
        height: HEIGHT,
        fonts: [
          { name: "Barlow", data: regular, weight: 500, style: "normal" },
          { name: "Barlow", data: bold, weight: 700, style: "normal" },
        ],
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (error) {
    console.error(`${LOG_PREFIX} unexpected error:`, {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
