// Fixed muscle taxonomy for the exercise library (Oct 14 call, JC): the
// trainer tags each exercise with primary muscles (required except for cardio,
// several allowed) and optional secondary ones. Drives the client's muscle map on the share
// card and the library filter. Ids are stored in exercises.primary_muscles /
// secondary_muscles and pinned by a CHECK in 20261027120000_exercise_muscles —
// adding an id means a migration too (muscles.test.ts guards the pairing).
//
// Granularity follows what trainers already type in muscle_groups (pectoral
// superior, the three deltoid heads, trapecio medio, glúteo medio, sóleo…)
// cross-checked with free-exercise-db (17 groups), wger (15) and ExRx. Deep
// muscles (transverso, romboides, manguito, psoas) stay because trainers use
// them; the map paints them on the region that covers them.

export const MUSCLE_REGIONS = [
  "Pecho",
  "Hombros",
  "Brazos",
  "Espalda",
  "Core",
  "Cadera",
  "Piernas",
  "Cuello",
] as const;

export type MuscleRegion = (typeof MUSCLE_REGIONS)[number];

export const MUSCLES = [
  { id: "pectoral_superior", label: "Pectoral superior", region: "Pecho" },
  { id: "pectoral", label: "Pectoral", region: "Pecho" },
  { id: "serrato", label: "Serrato anterior", region: "Pecho" },
  { id: "deltoides_anterior", label: "Deltoides anterior", region: "Hombros" },
  { id: "deltoides_lateral", label: "Deltoides lateral", region: "Hombros" },
  {
    id: "deltoides_posterior",
    label: "Deltoides posterior",
    region: "Hombros",
  },
  { id: "manguito_rotador", label: "Manguito rotador", region: "Hombros" },
  { id: "biceps", label: "Bíceps", region: "Brazos" },
  { id: "braquial", label: "Braquial", region: "Brazos" },
  { id: "triceps", label: "Tríceps", region: "Brazos" },
  { id: "antebrazo", label: "Antebrazo", region: "Brazos" },
  { id: "trapecio_superior", label: "Trapecio superior", region: "Espalda" },
  {
    id: "trapecio_medio",
    label: "Trapecio medio e inferior",
    region: "Espalda",
  },
  { id: "romboides", label: "Romboides", region: "Espalda" },
  { id: "dorsal", label: "Dorsal ancho", region: "Espalda" },
  { id: "redondo_mayor", label: "Redondo mayor", region: "Espalda" },
  { id: "lumbares", label: "Lumbares (erectores)", region: "Espalda" },
  { id: "abdominales", label: "Abdominales", region: "Core" },
  { id: "oblicuos", label: "Oblicuos", region: "Core" },
  { id: "transverso", label: "Transverso", region: "Core" },
  { id: "gluteo_mayor", label: "Glúteo mayor", region: "Cadera" },
  { id: "gluteo_medio", label: "Glúteo medio (abductores)", region: "Cadera" },
  { id: "flexores_cadera", label: "Flexores de cadera", region: "Cadera" },
  { id: "aductores", label: "Aductores", region: "Cadera" },
  { id: "cuadriceps", label: "Cuádriceps", region: "Piernas" },
  { id: "isquiotibiales", label: "Isquiotibiales", region: "Piernas" },
  { id: "gemelos", label: "Gemelos", region: "Piernas" },
  { id: "soleo", label: "Sóleo", region: "Piernas" },
  { id: "tibial", label: "Tibial anterior", region: "Piernas" },
  { id: "cuello", label: "Cuello", region: "Cuello" },
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

/** Same exercise name across libraries: case, edge and inner spaces ignored. */
export const normalizeExerciseName = (name: string) =>
  name.toLowerCase().trim().replace(/\s+/g, " ");

/**
 * Most common muscle pick among exercises with the same name (other
 * trainers' libraries included). Offered as a suggestion the trainer
 * accepts, never applied on its own.
 */
export function pickMuscleSuggestion(
  rows: readonly { primary_muscles: unknown; secondary_muscles: unknown }[]
): MuscleSelection | null {
  const votes = new Map<string, { pick: MuscleSelection; count: number }>();

  for (const row of rows) {
    const parsed = parseMuscles(row.primary_muscles, row.secondary_muscles);

    if (parsed?.ok !== true || parsed.muscles.primary.length === 0) continue;

    const key = JSON.stringify(parsed.muscles);
    const vote = votes.get(key) ?? { pick: parsed.muscles, count: 0 };

    vote.count++;
    votes.set(key, vote);
  }

  let best: { pick: MuscleSelection; count: number } | null = null;

  for (const vote of votes.values()) {
    if (best === null || vote.count > best.count) best = vote;
  }

  return best?.pick ?? null;
}

// ---------------------------------------------------------------------------
// One-off backfill from the legacy free-text muscle_groups column. Order in
// the old list is the only signal: first muscle → primary, the rest →
// secondary. Ambiguous words ("hombro", "trapecio", "pecho") are resolved
// with the exercise name. Unknown words are reported, not guessed.

type LegacyRule = [RegExp, MuscleId[] | ((name: string) => MuscleId[])];

const deltoidByName = (name: string): MuscleId[] =>
  /lateral|elevaci/.test(name)
    ? ["deltoides_lateral"]
    : /posterior|p[aá]jaro|face ?pull|invers|reverse/.test(name)
      ? ["deltoides_posterior"]
      : ["deltoides_anterior"];

const trapByName = (name: string): MuscleId[] =>
  /encogim|shrug|ment[oó]n|farmer|granjero|paseo/.test(name)
    ? ["trapecio_superior"]
    : ["trapecio_medio"];

const chestByName = (name: string): MuscleId[] =>
  /inclinad/.test(name) ? ["pectoral_superior"] : ["pectoral"];

// First match wins, so specific phrases sit above the generic word.
const LEGACY_RULES: LegacyRule[] = [
  [/b[ií]ceps femoral/, ["isquiotibiales"]],
  [/b[ií]ceps/, ["biceps"]],
  [/tr[ií]ceps/, ["triceps"]],
  [
    /braquio?rradial|braquioradial|antebrazo|flexores de (la )?mu[ñn]eca|extensores de (la )?mu[ñn]eca/,
    ["antebrazo"],
  ],
  [/braquial/, ["braquial"]],
  [
    /pector.*(superior|clavicular)|(superior|clavicular).*pector|pecho.*(superior|clavicular)/,
    ["pectoral_superior"],
  ],
  [/pector|pecho/, chestByName],
  [/serrato/, ["serrato"]],
  [/(deltoides?|hombros?) ?(anterior|frontal)/, ["deltoides_anterior"]],
  [/(deltoides?|hombros?) ?(lateral|medial|medio)/, ["deltoides_lateral"]],
  [/(deltoides?|hombros?) ?posterior/, ["deltoides_posterior"]],
  [/manguito|rotadores|infraespinoso|supraespinoso/, ["manguito_rotador"]],
  [/deltiodes|deltoide|hombro/, deltoidByName],
  [/trapecio (medio|inferior)/, ["trapecio_medio"]],
  [/trapecio superior/, ["trapecio_superior"]],
  [/trapecio/, trapByName],
  [/romboid/, ["romboides"]],
  [/redondo mayor/, ["redondo_mayor"]],
  [/espalda (alta|media)/, ["trapecio_medio", "romboides"]],
  [/espalda baja|lumbar|erector/, ["lumbares"]],
  [/dorsal|espalda/, ["dorsal"]],
  [/cadena posterior/, ["gluteo_mayor", "isquiotibiales", "lumbares"]],
  [/obl[ií]cu/, ["oblicuos"]],
  [/transverso/, ["transverso"]],
  [/abdom|core|recto abdominal/, ["abdominales"]],
  [/gl[uú]te.*(medio|menor)|abductor|fascia lata/, ["gluteo_medio"]],
  [/gl[uú]te/, ["gluteo_mayor"]],
  [/psoas|flexores de (la )?cadera|il[ií]aco/, ["flexores_cadera"]],
  [/adu+c?ctor/, ["aductores"]],
  [/cu[aá]driceps|quadriceps|quads|recto femoral|vasto/, ["cuadriceps"]],
  [/isqui|femoral/, ["isquiotibiales"]],
  [/s[oó]leo/, ["soleo"]],
  [/gemelo|gastrocnemio|pantorrilla/, ["gemelos"]],
  [/tibial/, ["tibial"]],
  [/cuello|esternocleido/, ["cuello"]],
  [
    /tren inferior|^piernas?$/,
    ["cuadriceps", "isquiotibiales", "gluteo_mayor"],
  ],
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
