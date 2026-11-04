// Pure mapping from a RepDB exercise (exercises.json, schema v3) to a
// library_exercises row. No server-only import: the seed script runs it too.

import type { MuscleId } from "@/lib/training/muscles";

/** RepDB muscle id -> the app's 16 groups (null = dropped: Nov 2 call, JC). */
export const REPDB_MUSCLE: Record<string, MuscleId | null> = {
  pectoralis_major: "pectoral",
  serratus_anterior: "pectoral",
  anterior_deltoid: "deltoides_anterior",
  lateral_deltoid: "deltoides_lateral",
  posterior_deltoid: "deltoides_posterior",
  supraspinatus: null,
  biceps_brachii: "biceps",
  brachialis: "biceps",
  triceps_brachii: "triceps",
  forearms: "antebrazo",
  forearm_flexors: "antebrazo",
  forearm_extensors: "antebrazo",
  brachioradialis: "antebrazo",
  trapezius: "trapecio",
  rhomboids: "trapecio",
  latissimus_dorsi: "dorsal",
  erector_spinae: "erectores",
  quadratus_lumborum: "erectores",
  rectus_abdominis: "abdomen",
  obliques: "abdomen",
  transverse_abdominis: "abdomen",
  gluteus_maximus: "gluteo",
  gluteus_medius: "gluteo",
  abductors: "gluteo",
  adductors: "aductores",
  hip_flexors: null,
  quadriceps: "cuadriceps",
  hamstrings: "isquiotibiales",
  gastrocnemius: "gemelos",
  soleus: "gemelos",
  tibialis_anterior: null,
};

const unique = <T>(list: T[]) => [...new Set(list)];

/**
 * Map + merge RepDB muscles. When every primary was dropped (hip-flexor
 * stretches) the first mapped secondary is promoted, so the exercise still
 * has a main muscle; with nothing left it stays empty (the library's
 * "missing muscles" banner picks it up).
 */
export function mapRepdbMuscles(
  primary: readonly string[] = [],
  secondary: readonly string[] = []
): { primary: MuscleId[]; secondary: MuscleId[] } {
  const keep = (ids: readonly string[]) =>
    unique(ids.flatMap((id) => REPDB_MUSCLE[id] ?? []));
  let p = keep(primary);
  let s = keep(secondary).filter((id) => !p.includes(id));

  if (p.length === 0 && s.length > 0) {
    p = [s[0]!];
    s = s.slice(1);
  }

  return { primary: p, secondary: s };
}

const CATEGORY: Record<string, string> = {
  strength: "strength",
  stretching: "flexibility",
  cardio: "cardio",
  olympic: "olympic",
  plyometrics: "plyometric",
};

export const mapCategory = (category: string): string =>
  CATEGORY[category] ?? "other";

/**
 * The trainer app only knows two exercise types (Fuerza / Cardio tabs, pickers
 * and prescriptions); everything that isn't cardio lives under Fuerza. Adding
 * a stretch or an olympic lift with its catalog category would hide it.
 */
export const trainerCategory = (category: string): "strength" | "cardio" =>
  category === "cardio" ? "cardio" : "strength";

/** Lower-case, accent-free: what the search column and the query share. */
export const searchKey = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

type Lang = "en" | "de" | "es" | "fr";
type RepdbExercise = {
  id: string;
  category: string;
  body_part?: string;
  difficulty?: string;
  equipment?: string;
  is_unilateral?: boolean;
  synonyms?: string[];
  primary_muscles?: string[];
  secondary_muscles?: string[];
  animation?: boolean;
} & Record<string, unknown>;

const text = (e: RepdbExercise, key: string, lang: Lang) =>
  (e[`${key}_${lang}`] as string | undefined) ?? null;
const list = (e: RepdbExercise, key: string, lang: Lang) =>
  (e[`${key}_${lang}`] as string[] | undefined) ?? [];

export function toCatalogRow(
  e: RepdbExercise,
  equipmentLabels: Record<string, { name_es?: string }> = {}
) {
  const muscles = mapRepdbMuscles(e.primary_muscles, e.secondary_muscles);
  const nameEs = text(e, "name", "es") ?? text(e, "name", "en") ?? e.id;
  const i18n = Object.fromEntries(
    (["en", "de", "fr"] as const).map((lang) => [
      lang,
      {
        name: text(e, "name", lang),
        description: text(e, "description", lang),
        instructions: list(e, "instructions", lang),
        tips: list(e, "tips", lang),
      },
    ])
  );

  return {
    slug: e.id,
    name: nameEs,
    description: text(e, "description", "es") ?? text(e, "description", "en"),
    instructions: list(e, "instructions", "es"),
    tips: list(e, "tips", "es"),
    category: mapCategory(e.category),
    body_part: e.body_part ?? null,
    difficulty: e.difficulty ?? null,
    equipment: e.equipment
      ? (equipmentLabels[e.equipment]?.name_es ?? e.equipment)
      : null,
    primary_muscles: muscles.primary,
    secondary_muscles: muscles.secondary,
    has_animation: e.animation === true,
    is_unilateral: e.is_unilateral === true,
    search: searchKey(
      [nameEs, text(e, "name", "en"), ...(e.synonyms ?? [])]
        .filter(Boolean)
        .join(" ")
    ),
    i18n,
  };
}
