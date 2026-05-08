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
 * Generate time-bucketed labels matching the aggregation. We don't have
 * the schedule here — the surface passes a small spec (how many buckets,
 * what kind of label).
 */
export function buildDemoBucketSpecs(
  aggregation: Aggregation,
  bucketCount = 12
): BucketSpec[] {
  const out: BucketSpec[] = [];

  switch (aggregation) {
    case "daily":
      for (let i = bucketCount - 1; i >= 0; i -= 1) {
        out.push({ label: `D-${i}`, daysSpanned: 1 });
      }
      break;
    case "weekly":
      for (let i = bucketCount - 1; i >= 0; i -= 1) {
        out.push({ label: `S-${i}`, daysSpanned: 7 });
      }
      break;
    case "biweekly":
      for (let i = bucketCount - 1; i >= 0; i -= 1) {
        out.push({ label: `Q-${i}`, daysSpanned: 14 });
      }
      break;
    case "monthly":
      for (let i = bucketCount - 1; i >= 0; i -= 1) {
        // 30 days es una aproximación — los demos no dependen de la
        // longitud exacta del mes calendario.
        out.push({ label: `M-${i}`, daysSpanned: 30 });
      }
      break;
    case "checkin_period":
      for (let i = bucketCount - 1; i >= 0; i -= 1) {
        out.push({ label: `P-${i}`, daysSpanned: 7 });
      }
      break;
    case "range_total":
      out.push({ label: "Total", daysSpanned: 30 });
      break;
  }

  return out;
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
