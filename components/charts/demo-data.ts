/**
 * Demo data synthesizer for the trainer template editor surface.
 *
 * The template page has no real client data behind it, but we still want
 * to show something realistic so the trainer can see how their template
 * will look. This generates plausible 30-day data per source with a
 * deterministic seed (so re-renders don't flicker), and a banner the
 * caller renders to clarify "the real client's data will be used here."
 *
 * It produces BucketedPoint[] directly — bypassing the adapter pipeline.
 * That's a deliberate trade: we don't want to construct synthetic
 * `form_responses` rows just to exercise the bucketing code; the bucket
 * shape is what the renderer consumes.
 */

import type {
  Aggregation,
  BucketedPoint,
  ChartConfig,
  ChartDataSource,
} from "@/lib/charts/types";

import { generateBuckets } from "@/lib/charts/adapters/bucketing";
import { DEFAULT_CHECKIN_SCHEDULE } from "@/lib/forms/types";

// ─── Deterministic PRNG (mulberry32) ───────────────────────────────────────

function seededRandom(seed: number): () => number {
  let s = seed >>> 0;

  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;

    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fast string hash → seed.
function hashString(s: string): number {
  let h = 2166136261;

  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  return h >>> 0;
}

// ─── Per-catalog presets ──────────────────────────────────────────────────

interface RandomWalkPreset {
  start: number;
  drift: number;
  /** Standard deviation per step (rough sd in source units). */
  noise: number;
  min: number;
  max: number;
  decimals?: number;
}

const PRESETS: Record<string, RandomWalkPreset> = {
  weight: {
    start: 75,
    drift: -0.05,
    noise: 0.5,
    min: 50,
    max: 130,
    decimals: 1,
  },
  body_fat: {
    start: 22,
    drift: -0.05,
    noise: 0.3,
    min: 5,
    max: 45,
    decimals: 1,
  },
  sleep_hours: {
    start: 7.5,
    drift: 0,
    noise: 0.7,
    min: 4,
    max: 11,
    decimals: 1,
  },
  steps: { start: 7000, drift: 0, noise: 1500, min: 0, max: 25000 },
  calories: { start: 2200, drift: 0, noise: 250, min: 1200, max: 4000 },
  protein: { start: 130, drift: 0, noise: 15, min: 40, max: 250 },
  carbs: { start: 220, drift: 0, noise: 30, min: 50, max: 500 },
  fats: { start: 70, drift: 0, noise: 10, min: 20, max: 200 },
  water: { start: 2.2, drift: 0, noise: 0.5, min: 0, max: 6, decimals: 1 },
  mood: { start: 7, drift: 0, noise: 1.5, min: 1, max: 10, decimals: 0 },
  energy: { start: 7, drift: 0, noise: 1.5, min: 1, max: 10, decimals: 0 },
  stress: { start: 4, drift: 0, noise: 1.5, min: 1, max: 10, decimals: 0 },
};

const DEFAULT_PRESET: RandomWalkPreset = {
  start: 50,
  drift: 0,
  noise: 8,
  min: 0,
  max: 100,
};

const MACROS_PRESET = { protein: 130, carbs: 220, fats: 70 };
const TRAINING_PRESET = { strengthPerWeek: 4, cardioPerWeek: 2 };

// ─── Helpers ──────────────────────────────────────────────────────────────

function clampRound(v: number, p: RandomWalkPreset): number {
  const clamped = Math.max(p.min, Math.min(p.max, v));

  if (p.decimals === undefined) return Math.round(clamped);
  const factor = Math.pow(10, p.decimals);

  return Math.round(clamped * factor) / factor;
}

interface BucketSpec {
  label: string;
  /** Used to scale "intensity" of synth — e.g. weekly buckets get ~7×. */
  daysSpanned: number;
}

/**
 * Días aproximados que cubre cada aggregation cuando queremos generar
 * `bucketCount` buckets ending today. Usado solo para construir un
 * `range` sintético que alimente a `generateBuckets`.
 */
const DAYS_PER_BUCKET: Record<Aggregation, number> = {
  daily: 1,
  weekly: 7,
  biweekly: 14,
  monthly: 31, // upper bound para que el range cubra 12 meses calendario
  checkin_period: 7, // depends on schedule; default weekly
  range_total: 30,
};

/**
 * Genera buckets demo con LABELS REALISTAS (mismo formato que los
 * que ve el cliente con datos reales: "5 May", "1-7 May", "May",
 * etc.). Antes producíamos placeholders cripticos como "D-7", "S-3",
 * "Q-2" que el trainer no podía interpretar — ahora la preview de
 * la plantilla se ve idéntica visualmente a lo que el cliente verá
 * con datos reales, solo cambian los valores (random) por los del
 * cliente.
 *
 * Implementación: construimos un `range` sintético terminando "hoy"
 * y delegamos a `generateBuckets` (mismo helper que el snapshot
 * route) con un `DEFAULT_CHECKIN_SCHEDULE`. Eso nos da BucketWindow
 * reales con labels formateadas igual que los buckets reales.
 *
 * `daysSpanned` se computa de cada bucket window (end-start+1) para
 * que el synthesizer escale los valores correctamente (ej: una
 * bucket weekly tiene ~7x los entrenamientos de una daily).
 */
export function buildDemoBucketSpecs(
  aggregation: Aggregation,
  bucketCount = 12
): BucketSpec[] {
  if (aggregation === "range_total") {
    // generateBuckets para range_total devuelve 1 bucket "Total".
    return [{ label: "Total", daysSpanned: 30 }];
  }

  const days = DAYS_PER_BUCKET[aggregation];
  const to = new Date();
  const from = new Date(to.getTime() - bucketCount * days * 86400000);
  // Un schedule mínimo (default weekly Mon 12:00 Madrid) sólo se usa
  // para que `generateBuckets` tenga algo coherente al construir
  // tooltips y boundaries — no afecta el rendering visual ya que las
  // labels se computan en clientTz que pasamos abajo.
  const schedule = { ...DEFAULT_CHECKIN_SCHEDULE };
  const tz = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  })();
  const windows = generateBuckets({ from, to }, aggregation, schedule, tz);

  // Pickeamos los últimos `bucketCount` buckets — el helper puede
  // generar uno extra al inicio dependiendo del alineamiento.
  const sliced = windows.slice(-bucketCount);

  return sliced.map((w) => {
    const spannedMs = w.end.getTime() - w.start.getTime();
    const daysSpanned = Math.max(1, Math.round(spannedMs / 86400000) + 1);

    return { label: w.label, daysSpanned };
  });
}

// ─── Public synthesizer ────────────────────────────────────────────────────

/**
 * Generate demo BucketedPoint[] for a chart. The synthesizer keys its
 * randomness on the chart id so the same chart renders consistently
 * across re-renders during a session.
 */
export function synthesizeDemoBuckets(
  chart: ChartConfig,
  source: ChartDataSource | undefined
): BucketedPoint[] {
  const rng = seededRandom(hashString(chart.id));
  const specs = buildDemoBucketSpecs(chart.aggregation, 12);

  // Multi-dim sources (ring, stacked_bar) produce Record<seriesId, number>.
  if (source?.dimensions === "multi") {
    if (source.id === "macros_breakdown") {
      // ring is range_total — single bucket with 3 series.
      const protein = MACROS_PRESET.protein + Math.round((rng() - 0.5) * 30);
      const carbs = MACROS_PRESET.carbs + Math.round((rng() - 0.5) * 60);
      const fats = MACROS_PRESET.fats + Math.round((rng() - 0.5) * 20);

      return [
        {
          label: "Total",
          value: { protein, carbs, fats },
        },
      ];
    }
    if (source.id === "training_breakdown") {
      // stacked_bar over time-bucketed periods.
      return specs.map((s) => {
        const sFactor = Math.max(0.3, Math.min(1.5, 0.7 + rng() * 0.7));
        const cFactor = Math.max(0.0, Math.min(1.5, rng() * 1.2));
        const strength = Math.round(
          (TRAINING_PRESET.strengthPerWeek * s.daysSpanned * sFactor) / 7
        );
        const cardio = Math.round(
          (TRAINING_PRESET.cardioPerWeek * s.daysSpanned * cFactor) / 7
        );

        return {
          label: s.label,
          value: { strength, cardio },
        };
      });
    }

    // Unknown multi-dim composite — render zero series.
    return specs.map((s) => ({ label: s.label, value: {} }));
  }

  // 1-D path — random walk inside the preset's [min, max] band.
  const presetKey =
    chart.source.kind === "catalog" ? chart.source.id : "default";
  const preset = PRESETS[presetKey] ?? DEFAULT_PRESET;
  let v = preset.start;

  return specs.map((s) => {
    v += preset.drift + (rng() - 0.5) * 2 * preset.noise;

    return {
      label: s.label,
      value: clampRound(v, preset),
    };
  });
}
