// Which RepDB muscle-heatmap overlays make up each of the app's 16 groups.
// The kit (scripts/library-media/build-body.mjs) ships a body base plus one
// overlay per anatomical muscle, per view; a group lights several at once.
// Notes: the kit has a single "deltoids" overlay (no heads), so the lateral
// head lights both views; brachialis/teres major/rhomboids are not separate
// shapes (they live under biceps/dorsal/trapecio).

import type { MuscleId } from "./muscles";

export type BodyView = "front" | "back";

export const BODY_OVERLAYS: Record<
  MuscleId,
  Partial<Record<BodyView, readonly string[]>>
> = {
  pectoral: { front: ["pectoralis_major"] },
  deltoides_anterior: { front: ["deltoids"] },
  deltoides_lateral: { front: ["deltoids"], back: ["deltoids"] },
  deltoides_posterior: { back: ["deltoids"] },
  biceps: { front: ["biceps_brachii"] },
  triceps: { front: ["triceps"], back: ["triceps", "anconeus"] },
  antebrazo: {
    front: ["brachioradialis", "palmaris_longus"],
    back: ["brachioradialis", "extensor_carpi"],
  },
  trapecio: { front: ["trapezius"], back: ["trapezius"] },
  dorsal: { back: ["latissimus_dorsi"] },
  erectores: { back: ["erector_spinae"] },
  abdomen: { front: ["abdominals", "obliques"] },
  gluteo: { back: ["gluteus_maximus", "gluteus_medius"] },
  aductores: {
    front: ["adductor_longus", "gracilis", "pectineus_sartorius"],
    back: ["adductor_magnus", "gracilis"],
  },
  cuadriceps: {
    front: ["rectus_femoris", "vastus_lateralis", "vastus_medialis"],
  },
  isquiotibiales: {
    back: ["biceps_femoris", "semimembranosus", "semitendinosus"],
  },
  gemelos: {
    front: ["gracilis_gastrocnemius"],
    back: ["gastrocnemius", "soleus"],
  },
};

/**
 * Pixel size of each built figure (build-body.mjs resizes to width 640). The
 * male and female kits have different proportions, so every face needs its own
 * ratio or the figure stretches.
 */
export const BODY_WIDTH = 640;
export const BODY_HEIGHT: Record<
  "male" | "female",
  Record<BodyView, number>
> = {
  male: { front: 1722, back: 1650 },
  female: { front: 1864, back: 1764 },
};

export const bodyFile = (view: BodyView, name: string) =>
  `${view}_${name}.webp`;

/** Every file of the kit we serve (the two bases + each mapped overlay). */
export const BODY_FILES: readonly string[] = [
  ...new Set([
    "front_base.webp",
    "back_base.webp",
    ...Object.values(BODY_OVERLAYS).flatMap((views) =>
      (["front", "back"] as const).flatMap((view) =>
        (views[view] ?? []).map((name) => bodyFile(view, name))
      )
    ),
  ]),
];

/** overlay file -> 2 (primary) or 1 (secondary); primary wins on shared shapes. */
export function overlayRanks(
  view: BodyView,
  primary: readonly MuscleId[],
  secondary: readonly MuscleId[]
): Map<string, 1 | 2> {
  const ranks = new Map<string, 1 | 2>();

  for (const [ids, rank] of [
    [secondary, 1],
    [primary, 2],
  ] as const) {
    for (const id of ids) {
      for (const name of BODY_OVERLAYS[id][view] ?? []) {
        ranks.set(bodyFile(view, name), rank);
      }
    }
  }

  return ranks;
}

/** The side with more worked overlays; front on a tie (or nothing worked). */
export function bestView(
  primary: readonly MuscleId[],
  secondary: readonly MuscleId[]
): BodyView {
  const score = (view: BodyView) => {
    let total = 0;

    for (const rank of overlayRanks(view, primary, secondary).values()) {
      total += rank;
    }

    return total;
  };

  return score("back") > score("front") ? "back" : "front";
}
