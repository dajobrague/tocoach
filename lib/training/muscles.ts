// Fixed muscle taxonomy for the exercise library: 16 groups (Nov 2 call, JC —
// "aunque el cuerpo humano tiene cientos de músculos, se suelen agrupar"). The
// trainer tags each exercise with primary muscles (required except for cardio,
// several allowed) and optional secondary ones. Drives the client's muscle map,
// per-muscle volume and the library filter. Ids are stored in
// exercises.primary_muscles / secondary_muscles and pinned by a CHECK in
// 20261102120000_muscles_16_groups — adding an id means a migration too
// (muscles.test.ts guards the pairing).
//
// Merged on purpose: pectoral (+superior, serrato), bíceps (+braquial),
// trapecio (+romboides), dorsal (+redondo mayor), abdomen (+oblicuos,
// transverso), glúteo (+medio/abductores), gemelos (+sóleo), erectores (was
// lumbares). Removed: manguito rotador, flexores de cadera, tibial, cuello.

export const MUSCLE_REGIONS = [
  "Pecho",
  "Hombros",
  "Brazos",
  "Espalda",
  "Core",
  "Cadera",
  "Piernas",
] as const;

export type MuscleRegion = (typeof MUSCLE_REGIONS)[number];

export const MUSCLES = [
  { id: "pectoral", label: "Pectoral", region: "Pecho" },
  { id: "deltoides_anterior", label: "Deltoides anterior", region: "Hombros" },
  { id: "deltoides_lateral", label: "Deltoides lateral", region: "Hombros" },
  {
    id: "deltoides_posterior",
    label: "Deltoides posterior",
    region: "Hombros",
  },
  { id: "biceps", label: "Bíceps y braquial", region: "Brazos" },
  { id: "triceps", label: "Tríceps", region: "Brazos" },
  { id: "antebrazo", label: "Antebrazo", region: "Brazos" },
  { id: "trapecio", label: "Trapecio", region: "Espalda" },
  { id: "dorsal", label: "Dorsal ancho", region: "Espalda" },
  { id: "erectores", label: "Erectores", region: "Espalda" },
  { id: "abdomen", label: "Abdomen", region: "Core" },
  { id: "gluteo", label: "Glúteo", region: "Cadera" },
  { id: "aductores", label: "Aductores", region: "Cadera" },
  { id: "cuadriceps", label: "Cuádriceps", region: "Piernas" },
  { id: "isquiotibiales", label: "Isquiotibiales", region: "Piernas" },
  { id: "gemelos", label: "Gemelos", region: "Piernas" },
] as const satisfies readonly {
  id: string;
  label: string;
  region: MuscleRegion;
}[];

export type MuscleId = (typeof MUSCLES)[number]["id"];

const MUSCLE_IDS = new Set<string>(MUSCLES.map((m) => m.id));

export const isMuscleId = (value: unknown): value is MuscleId =>
  typeof value === "string" && MUSCLE_IDS.has(value);

export const muscleLabel = (id: MuscleId): string =>
  MUSCLES.find((m) => m.id === id)?.label ?? id;

export type MuscleSelection = { primary: MuscleId[]; secondary: MuscleId[] };

export type ParsedMuscles =
  | { ok: true; muscles: MuscleSelection }
  | { ok: false; error: string };

/**
 * Validate `primary_muscles` / `secondary_muscles` from a request body.
 * Returns `undefined` when both are absent so callers leave the columns
 * untouched. A muscle picked as primary is dropped from secondary.
 */
export function parseMuscles(
  primary: unknown,
  secondary: unknown
): ParsedMuscles | undefined {
  if (primary === undefined && secondary === undefined) return undefined;

  const lists: MuscleId[][] = [];

  for (const value of [primary ?? [], secondary ?? []]) {
    if (!Array.isArray(value) || !value.every(isMuscleId)) {
      return { ok: false, error: "Músculo no válido" };
    }
    lists.push([...new Set(value as MuscleId[])]);
  }

  const [p = [], s = []] = lists;

  return {
    ok: true,
    muscles: { primary: p, secondary: s.filter((id) => !p.includes(id)) },
  };
}

/** Cardio is the only category saved without a primary muscle (Oct 27, David). */
export const primaryMuscleRequired = (category: string | null | undefined) =>
  category !== "cardio";

export const MISSING_PRIMARY_ERROR = "Elige al menos un músculo principal";

// ---------------------------------------------------------------------------
// The trainer's old free-text muscle_groups, read as a suggestion in the
// picker (never applied on its own: David, 28 oct, no data migration).
// Order in the old list is the only signal: first muscle → primary, the
// rest → secondary. Ambiguous words ("hombro", "trapecio", "pecho") are
// resolved with the exercise name. Unknown words are reported, not guessed.

type LegacyRule = [RegExp, MuscleId[] | ((name: string) => MuscleId[])];

const deltoidByName = (name: string): MuscleId[] =>
  /lateral|elevaci/.test(name)
    ? ["deltoides_lateral"]
    : /posterior|p[aá]jaro|face ?pull|invers|reverse/.test(name)
      ? ["deltoides_posterior"]
      : ["deltoides_anterior"];

// First match wins, so specific phrases sit above the generic word.
const LEGACY_RULES: LegacyRule[] = [
  [/b[ií]ceps femoral/, ["isquiotibiales"]],
  [/b[ií]ceps|braquial/, ["biceps"]],
  [/tr[ií]ceps/, ["triceps"]],
  [
    /braquio?rradial|braquioradial|antebrazo|flexores de (la )?mu[ñn]eca|extensores de (la )?mu[ñn]eca/,
    ["antebrazo"],
  ],
  [/pector|pecho|serrato/, ["pectoral"]],
  [/(deltoides?|hombros?) ?(anterior|frontal)/, ["deltoides_anterior"]],
  [/(deltoides?|hombros?) ?(lateral|medial|medio)/, ["deltoides_lateral"]],
  [/(deltoides?|hombros?) ?posterior/, ["deltoides_posterior"]],
  [/deltiodes|deltoide|hombro/, deltoidByName],
  [/trapecio|romboid|espalda (alta|media)/, ["trapecio"]],
  [/dorsal|redondo mayor/, ["dorsal"]],
  [/espalda baja|lumbar|erector/, ["erectores"]],
  [/espalda/, ["dorsal"]],
  [/cadena posterior/, ["gluteo", "isquiotibiales", "erectores"]],
  [/obl[ií]cu|transverso|abdom|core|recto abdominal/, ["abdomen"]],
  [/gl[uú]te|abductor|fascia lata/, ["gluteo"]],
  [/adu+c?ctor/, ["aductores"]],
  [/cu[aá]driceps|quadriceps|quads|recto femoral|vasto/, ["cuadriceps"]],
  [/isqui|femoral/, ["isquiotibiales"]],
  [/s[oó]leo|gemelo|gastrocnemio|pantorrilla/, ["gemelos"]],
  [/tren inferior|^piernas?$/, ["cuadriceps", "isquiotibiales", "gluteo"]],
];

export type LegacyMapping = MuscleSelection & { unknown: string[] };

/** Map a legacy muscle_groups array (plus the exercise name) to the taxonomy. */
export function legacyToMuscles(
  muscleGroups: readonly string[] | null | undefined,
  exerciseName: string
): LegacyMapping {
  const name = exerciseName.toLowerCase();
  const found: MuscleId[] = [];
  const unknown: string[] = [];

  const tokens = (muscleGroups ?? [])
    .flatMap((group) => group.toLowerCase().split(/\s*[,;]\s*|\s+y\s+/))
    .map((token) => token.replace(/[()]/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  for (const token of tokens) {
    const rule = LEGACY_RULES.find(([re]) => re.test(token));

    if (!rule) {
      unknown.push(token);
      continue;
    }

    const [, target] = rule;

    found.push(...(typeof target === "function" ? target(name) : target));
  }

  const ordered = [...new Set(found)];
  const [first, ...rest] = ordered;

  return {
    primary: first ? [first] : [],
    secondary: rest,
    unknown,
  };
}
